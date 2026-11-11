import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import {
  getFirebaseConfig,
  verifyFirebaseIdToken,
  getGoogleConfig,
  verifyGoogleIdToken,
  createGoogleOAuthStateUrl,
  verifyGoogleOAuthState,
  exchangeCodeForVerifiedGoogleProfile,
  createOneTimeExchangeToken,
  consumeOneTimeExchangeToken,
} from '../utils/googleAuth.js';

const resolveAccountType = (user) =>
  user.accountType ||
  (user.role === 'admin' || user.role === 'ADMIN'
    ? 'ADMIN'
    : user.role === 'STAFF'
    ? 'STAFF'
    : 'STUDENT');

const buildAuthPayload = (user, token = null) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  accountType: resolveAccountType(user),
  phone: user.phone || '',
  avatar: user.avatar || '',
  authProvider: user.authProvider || (user.googleId || user.firebaseUid ? 'google' : 'local'),
  hasPassword: Boolean(user.password),
  studentDetails: user.studentDetails,
  staffDetails: user.staffDetails,
  ...(token ? { token } : {}),
});

const getClientBaseUrl = () => {
  const url = String(process.env.CLIENT_URL || 'http://localhost:5173').trim();
  return url.replace(/\/+$/, '');
};

const resolveOrCreateGoogleUser = async (profile) => {
  const cleanEmail = String(profile.email || '').trim().toLowerCase();
  const firebaseUid = profile.firebaseUid ? String(profile.firebaseUid).trim() : '';
  const googleId = profile.googleId ? String(profile.googleId).trim() : '';

  if (!cleanEmail || (!firebaseUid && !googleId)) {
    const err = new Error('Google profile did not provide a verified email and identity.');
    err.statusCode = 400;
    throw err;
  }

  const orConditions = [{ email: cleanEmail }];
  if (firebaseUid) orConditions.push({ firebaseUid });
  if (googleId) orConditions.push({ googleId });

  let user = await User.findOne({ $or: orConditions });

  if (user) {
    if (user.isActive === false) {
      const err = new Error('Your account has been disabled. Please contact canteen admin.');
      err.statusCode = 403;
      throw err;
    }

    if (firebaseUid && user.firebaseUid && user.firebaseUid !== firebaseUid) {
      const err = new Error('This email address is already linked to a different Firebase user.');
      err.statusCode = 409;
      throw err;
    }

    if (googleId && user.googleId && user.googleId !== googleId) {
      const err = new Error('This email address is already linked to a different Google account.');
      err.statusCode = 409;
      throw err;
    }

    const matchedPreviouslyLinked =
      (firebaseUid && user.firebaseUid === firebaseUid) || (googleId && user.googleId === googleId);
    if ((user.role === 'admin' || user.role === 'ADMIN') && !matchedPreviouslyLinked) {
      const err = new Error('Administrator accounts must sign in with their email and password.');
      err.statusCode = 403;
      throw err;
    }

    let modified = false;
    if (firebaseUid && !user.firebaseUid) {
      user.firebaseUid = firebaseUid;
      user.authProvider = user.password ? 'hybrid' : 'google';
      modified = true;
    }
    if (googleId && !user.googleId) {
      user.googleId = googleId;
      user.authProvider = user.password ? 'hybrid' : 'google';
      modified = true;
    }
    if (!user.emailVerified) {
      user.emailVerified = true;
      modified = true;
    }
    if (!user.avatar && profile.picture) {
      user.avatar = profile.picture;
      modified = true;
    }

    if (modified) {
      await user.save();
    }

    return { user, isNewUser: false };
  }

  // Strictly assign normal customer role ('STUDENT') on new Google sign-ups
  user = await User.create({
    name: profile.name || cleanEmail.split('@')[0],
    email: cleanEmail,
    ...(firebaseUid ? { firebaseUid } : {}),
    ...(googleId ? { googleId } : {}),
    authProvider: 'google',
    emailVerified: true,
    avatar: profile.picture || '',
    role: 'STUDENT',
    accountType: 'STUDENT',
  });

  return { user, isNewUser: true };
};

// @desc    Register a new customer user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !String(name).trim() || !email || !password) {
      res.status(400);
      throw new Error('Please fill in your full name, email address, and password');
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      res.status(400);
      throw new Error('Please provide a valid email address');
    }

    if (String(password).length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters long');
    }

    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    // Strictly assign normal customer role; Admin/Employee cannot be created via public signup
    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password,
      phone: phone ? String(phone).replace(/\D/g, '') : '',
      role: 'STUDENT',
      accountType: 'STUDENT',
      authProvider: 'local',
    });

    if (user) {
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: buildAuthPayload(user, generateToken(user._id)),
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please enter email and password');
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && !user.password) {
      res.status(401);
      throw new Error('This account uses Google Sign-In. Please click "Continue with Google".');
    }

    if (user && (await user.matchPassword(password))) {
      if (user.isActive === false) {
        res.status(403);
        throw new Error('Your account has been disabled.');
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: buildAuthPayload(user, generateToken(user._id)),
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Get non-secret Firebase / Google OAuth configuration status
// @route   GET /api/auth/google/config
// @access  Public
const getGoogleAuthConfig = async (req, res) => {
  const fb = getFirebaseConfig();
  const { configured, clientId, oauthCodeFlow } = getGoogleConfig(req);
  res.json({
    success: true,
    data: {
      provider: fb.configured ? 'firebase' : configured ? 'google-oidc' : 'none',
      configured: fb.configured || configured,
      firebaseConfigured: fb.configured,
      firebase: fb.clientConfig,
      clientId,
      oauthCodeFlow,
    },
  });
};

// @desc    Verify Firebase Google ID token (or Google OIDC credential / code) & login/register customer
// @route   POST /api/auth/google | POST /api/auth/firebase-google
// @access  Public
const googleAuthLogin = async (req, res) => {
  try {
    const { firebaseIdToken, credential, code } = req.body || {};

    let verifiedProfile;
    if (firebaseIdToken) {
      verifiedProfile = await verifyFirebaseIdToken(firebaseIdToken);
    } else if (credential) {
      verifiedProfile = await verifyGoogleIdToken(credential);
    } else if (code) {
      verifiedProfile = await exchangeCodeForVerifiedGoogleProfile(code, req);
    } else {
      res.status(400);
      throw new Error('Firebase Google ID token or Google credential is required.');
    }

    const { user, isNewUser } = await resolveOrCreateGoogleUser(verifiedProfile);

    res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? 'Google account created successfully' : 'Google login successful',
      data: buildAuthPayload(user, generateToken(user._id)),
    });
  } catch (error) {
    const status = error.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
    res.status(status).json({ success: false, message: error.message });
  }
};

// @desc    Start standard Google OAuth 2.0 / OIDC redirect flow
// @route   GET /api/auth/google
// @access  Public
const startGoogleOAuth = async (req, res) => {
  try {
    const authUrl = createGoogleOAuthStateUrl(req);
    return res.redirect(authUrl);
  } catch (error) {
    const msg = encodeURIComponent(error.message || 'Google Sign-In is not configured.');
    return res.redirect(`${getClientBaseUrl()}/login?googleError=${msg}`);
  }
};

// @desc    Handle Google OAuth 2.0 callback
// @route   GET /api/auth/google/callback
// @access  Public
const handleGoogleOAuthCallback = async (req, res) => {
  const clientBase = getClientBaseUrl();
  try {
    if (req.query.error) {
      const reason =
        req.query.error === 'access_denied'
          ? 'Google sign-in was cancelled.'
          : String(req.query.error);
      return res.redirect(`${clientBase}/login?googleError=${encodeURIComponent(reason)}`);
    }

    verifyGoogleOAuthState(req.query.state);
    const verifiedProfile = await exchangeCodeForVerifiedGoogleProfile(req.query.code, req);
    const { user } = await resolveOrCreateGoogleUser(verifiedProfile);
    const exchangeToken = createOneTimeExchangeToken(user._id);

    return res.redirect(`${clientBase}/login?googleExchange=${encodeURIComponent(exchangeToken)}`);
  } catch (error) {
    const msg = encodeURIComponent(error.message || 'Google authentication failed.');
    return res.redirect(`${clientBase}/login?googleError=${msg}`);
  }
};

// @desc    Exchange short-lived one-time token from OAuth redirect for session JWT
// @route   POST /api/auth/google/exchange
// @access  Public
const exchangeGoogleSession = async (req, res) => {
  try {
    const { exchangeToken } = req.body || {};
    const userId = consumeOneTimeExchangeToken(exchangeToken);
    const user = await User.findById(userId);

    if (!user || user.isActive === false) {
      res.status(401);
      throw new Error('Account not available or disabled.');
    }

    res.json({
      success: true,
      message: 'Google login successful',
      data: buildAuthPayload(user, generateToken(user._id)),
    });
  } catch (error) {
    const status = error.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
    res.status(status).json({ success: false, message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        success: true,
        data: buildAuthPayload(user),
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;

      // Email change checking
      if (req.body.email && req.body.email !== user.email) {
        const cleanEmail = String(req.body.email).trim().toLowerCase();
        const emailExists = await User.findOne({ email: cleanEmail });
        if (emailExists) {
          res.status(400);
          throw new Error('Email already in use');
        }
        user.email = cleanEmail;
      }

      if (req.body.studentDetails && user.role === 'STUDENT') {
        user.studentDetails = {
          ...user.studentDetails,
          ...req.body.studentDetails,
        };
      }

      if (req.body.staffDetails && user.role === 'STAFF') {
        user.staffDetails = {
          ...user.staffDetails,
          ...req.body.staffDetails,
        };
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: buildAuthPayload(updatedUser, generateToken(updatedUser._id)),
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters long');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (user.password) {
      if (!oldPassword) {
        res.status(400);
        throw new Error('Please fill in both password fields');
      }
      if (!(await user.matchPassword(oldPassword))) {
        res.status(401);
        throw new Error('Invalid current password');
      }
    }

    user.password = newPassword;
    if (user.googleId || user.firebaseUid) {
      user.authProvider = 'hybrid';
    }
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

export {
  registerUser,
  loginUser,
  getGoogleAuthConfig,
  googleAuthLogin,
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  exchangeGoogleSession,
  getUserProfile,
  updateUserProfile,
  changePassword,
};
