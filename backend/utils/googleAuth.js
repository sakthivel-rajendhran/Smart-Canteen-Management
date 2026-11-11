import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const usedExchangeJtis = new Map();
let cachedFirebaseCerts = null;
let cachedFirebaseCertsExpiresAt = 0;

export class GoogleAuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'GoogleAuthError';
    this.statusCode = statusCode;
  }
}

export const getFirebaseConfig = () => {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const apiKey = String(process.env.FIREBASE_API_KEY || '').trim();
  const authDomain = String(process.env.FIREBASE_AUTH_DOMAIN || '').trim();
  const appId = String(process.env.FIREBASE_APP_ID || '').trim();

  return {
    projectId,
    configured: Boolean(projectId),
    clientConfigured: Boolean(projectId && apiKey && authDomain),
    clientConfig:
      projectId && apiKey && authDomain
        ? {
            apiKey,
            authDomain,
            projectId,
            ...(appId ? { appId } : {}),
          }
        : null,
  };
};

const fetchFirebasePublicCerts = async (forceRefresh = false) => {
  if (!forceRefresh && cachedFirebaseCerts && Date.now() < cachedFirebaseCertsExpiresAt) {
    return cachedFirebaseCerts;
  }

  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new GoogleAuthError('Unable to fetch Firebase public signing certificates.', 503);
  }

  const certs = await res.json();
  if (!certs || typeof certs !== 'object' || Object.keys(certs).length === 0) {
    throw new GoogleAuthError('Invalid Firebase public certificates payload.', 503);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 300;

  cachedFirebaseCerts = certs;
  cachedFirebaseCertsExpiresAt = Date.now() + ttlSec * 1000;
  return certs;
};

export const verifyFirebaseIdToken = async (idToken, { customCerts = null } = {}) => {
  const { projectId } = getFirebaseConfig();
  if (!projectId) {
    throw new GoogleAuthError(
      'Firebase authentication is not configured on this server. Set FIREBASE_PROJECT_ID in backend/.env.',
      503
    );
  }

  if (!idToken || typeof idToken !== 'string') {
    throw new GoogleAuthError('A valid Firebase ID token is required.', 400);
  }

  const trimmedToken = idToken.trim();
  const decodedComplete = jwt.decode(trimmedToken, { complete: true });
  if (!decodedComplete || !decodedComplete.header || !decodedComplete.payload) {
    throw new GoogleAuthError('Invalid Firebase ID token format.', 401);
  }

  const { alg, kid } = decodedComplete.header;
  if (alg !== 'RS256' || !kid) {
    throw new GoogleAuthError('Unsupported Firebase token signing algorithm or missing key ID.', 401);
  }

  let certPem;
  if (customCerts) {
    certPem = customCerts[kid];
  } else {
    let certs = await fetchFirebasePublicCerts(false);
    certPem = certs[kid];
    if (!certPem) {
      certs = await fetchFirebasePublicCerts(true);
      certPem = certs[kid];
    }
  }

  if (!certPem) {
    throw new GoogleAuthError('Firebase signing key not recognized.', 401);
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  let payload;
  try {
    payload = jwt.verify(trimmedToken, certPem, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: expectedIssuer,
      clockTolerance: 5,
    });
  } catch (err) {
    throw new GoogleAuthError(
      `Invalid or expired Firebase token: ${err?.message || 'Verification failed'}`,
      401
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload !== 'object') {
    throw new GoogleAuthError('Invalid Firebase token payload.', 401);
  }

  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    throw new GoogleAuthError('Invalid Firebase subject identifier.', 401);
  }

  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new GoogleAuthError('Invalid Firebase token issued-at timestamp.', 401);
  }

  if (payload.auth_time !== undefined && (typeof payload.auth_time !== 'number' || payload.auth_time > nowSec + 300)) {
    throw new GoogleAuthError('Invalid Firebase authentication timestamp.', 401);
  }

  if (!payload.email || payload.email_verified !== true) {
    throw new GoogleAuthError('Please verify your Google email address before signing in.', 403);
  }

  const provider = payload.firebase?.sign_in_provider;
  if (provider !== 'google.com') {
    throw new GoogleAuthError('Firebase token must originate from Google Sign-In.', 403);
  }

  const rawGoogleIds = payload.firebase?.identities?.['google.com'];
  const googleId =
    Array.isArray(rawGoogleIds) && rawGoogleIds[0] ? String(rawGoogleIds[0]) : undefined;

  return {
    firebaseUid: String(payload.sub),
    ...(googleId ? { googleId } : {}),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || '').trim(),
    picture: String(payload.picture || '').trim(),
    emailVerified: true,
  };
};

export const getGoogleConfig = (req = null) => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const configuredRedirect = String(process.env.GOOGLE_REDIRECT_URI || '').trim();

  let redirectUri = configuredRedirect;
  if (!redirectUri) {
    const baseUrl = req
      ? `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`
      : 'http://localhost:5000';
    redirectUri = `${baseUrl}/api/auth/google/callback`;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId),
    oauthCodeFlow: Boolean(clientId && clientSecret),
  };
};

export const verifyGoogleIdToken = async (idToken, { oauthClient = null } = {}) => {
  const { clientId } = getGoogleConfig();
  if (!clientId) {
    throw new GoogleAuthError(
      'Google Sign-In is not configured on this server. Configure Firebase Auth or Google OAuth credentials in .env.',
      503
    );
  }

  if (!idToken || typeof idToken !== 'string') {
    throw new GoogleAuthError('A valid Google ID token is required.', 400);
  }

  const verifierClient = oauthClient || new OAuth2Client(clientId);

  let ticket;
  try {
    ticket = await verifierClient.verifyIdToken({
      idToken: idToken.trim(),
      audience: clientId,
    });
  } catch (err) {
    throw new GoogleAuthError(
      `Invalid or expired Google token: ${err?.message || 'Verification failed'}`,
      401
    );
  }

  const payload = ticket?.getPayload?.();
  if (!payload) {
    throw new GoogleAuthError('Unable to extract Google identity payload.', 401);
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    throw new GoogleAuthError('Invalid Google token issuer.', 401);
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(clientId)) {
    throw new GoogleAuthError('Google token audience mismatch.', 401);
  }

  if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) {
    throw new GoogleAuthError('Google ID token has expired.', 401);
  }

  if (!payload.sub || !payload.email) {
    throw new GoogleAuthError('Google account did not provide required identity claims.', 400);
  }

  if (payload.email_verified !== true) {
    throw new GoogleAuthError('Please verify your email address with Google before signing in.', 403);
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || '').trim(),
    picture: String(payload.picture || '').trim(),
    emailVerified: true,
  };
};

export const createGoogleOAuthStateUrl = (req) => {
  const { clientId, clientSecret, redirectUri, oauthCodeFlow } = getGoogleConfig(req);
  if (!oauthCodeFlow) {
    throw new GoogleAuthError(
      'Google OAuth redirect flow requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      503
    );
  }

  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const state = jwt.sign(
    {
      purpose: 'google_oauth_state',
      nonce: crypto.randomUUID(),
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });
};

export const verifyGoogleOAuthState = (state) => {
  if (!state || typeof state !== 'string') {
    throw new GoogleAuthError('Missing OAuth state parameter.', 400);
  }
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    if (decoded?.purpose !== 'google_oauth_state') {
      throw new Error('Unexpected state purpose');
    }
    return decoded;
  } catch {
    throw new GoogleAuthError('Invalid or expired Google OAuth session state.', 401);
  }
};

export const exchangeCodeForVerifiedGoogleProfile = async (code, req = null) => {
  const { clientId, clientSecret, redirectUri, oauthCodeFlow } = getGoogleConfig(req);
  if (!oauthCodeFlow) {
    throw new GoogleAuthError(
      'Google OAuth authorization code flow requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      503
    );
  }

  if (!code || typeof code !== 'string') {
    throw new GoogleAuthError('Authorization code is required.', 400);
  }

  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  let tokens;
  try {
    const res = await client.getToken(code);
    tokens = res.tokens;
  } catch (err) {
    throw new GoogleAuthError(
      `Failed to exchange Google authorization code: ${err?.message || 'Token error'}`,
      401
    );
  }

  if (!tokens?.id_token) {
    throw new GoogleAuthError('Google did not return an OpenID Connect ID token.', 401);
  }

  return verifyGoogleIdToken(tokens.id_token, { oauthClient: client });
};

const cleanupExpiredExchangeJtis = () => {
  const now = Date.now();
  for (const [jti, expMs] of usedExchangeJtis.entries()) {
    if (expMs <= now) usedExchangeJtis.delete(jti);
  }
};

export const createOneTimeExchangeToken = (userId) => {
  cleanupExpiredExchangeJtis();
  return jwt.sign(
    {
      purpose: 'google_session_exchange',
      userId: String(userId),
      jti: crypto.randomUUID(),
    },
    process.env.JWT_SECRET,
    { expiresIn: '90s' }
  );
};

export const consumeOneTimeExchangeToken = (exchangeToken) => {
  cleanupExpiredExchangeJtis();
  if (!exchangeToken || typeof exchangeToken !== 'string') {
    throw new GoogleAuthError('Missing Google session exchange token.', 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(exchangeToken, process.env.JWT_SECRET);
  } catch {
    throw new GoogleAuthError('Google login exchange link has expired. Please try again.', 401);
  }

  if (decoded?.purpose !== 'google_session_exchange' || !decoded.userId || !decoded.jti) {
    throw new GoogleAuthError('Invalid Google session exchange token.', 401);
  }

  if (usedExchangeJtis.has(decoded.jti)) {
    throw new GoogleAuthError('Google login exchange token has already been used.', 401);
  }

  usedExchangeJtis.set(decoded.jti, Number(decoded.exp || 0) * 1000 || Date.now() + 90000);
  return String(decoded.userId);
};
