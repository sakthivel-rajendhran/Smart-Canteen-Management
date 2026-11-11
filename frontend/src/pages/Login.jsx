import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { getEnvFirebaseConfig, getFirebaseAuthClient } from '../config/firebase';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  Lock,
  User,
  AlertCircle,
  Utensils,
  MapPin,
  TicketPercent,
  CreditCard,
  ArrowRight,
} from 'lucide-react';

const GoogleLogo = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

const loadGoogleIdentityScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Sign-In SDK'));
    document.head.appendChild(script);
  });

const Login = () => {
  const { user, login, register, loginWithGoogle, exchangeGoogleSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showGisFallback, setShowGisFallback] = useState(false);
  const gisFallbackRef = useRef(null);

  // Core Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Public Firebase / Google OAuth config from env & server
  const [authProviderConfig, setAuthProviderConfig] = useState(() => {
    const envFirebase = getEnvFirebaseConfig();
    return {
      loaded: false,
      firebase: envFirebase,
      firebaseConfigured: Boolean(envFirebase),
      configured: Boolean(envFirebase || import.meta.env.VITE_GOOGLE_CLIENT_ID),
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      oauthCodeFlow: false,
    };
  });

  // Password strength indicator
  const [pwStrength, setPwStrength] = useState({
    score: 0,
    label: '',
    colorClass: 'bg-gray-200',
    textClass: 'text-gray-400',
  });

  const redirectUserAfterAuth = useCallback(
    (authUser) => {
      const target =
        authUser?.role === 'admin' || authUser?.role === 'ADMIN' ? '/admin' : '/menu';
      navigate(target, { replace: true });
    },
    [navigate]
  );

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      redirectUserAfterAuth(user);
    }
  }, [user, redirectUserAfterAuth]);

  // Fetch public Firebase/Google OAuth config & complete redirect flows if present
  useEffect(() => {
    let active = true;

    const completeFirebaseRedirectIfNeeded = async (serverFirebaseCfg) => {
      const fb = await getFirebaseAuthClient(serverFirebaseCfg);
      if (!fb) return;
      try {
        const result = await fb.getRedirectResult(fb.auth);
        if (result?.user && active) {
          setGoogleSubmitting(true);
          const firebaseIdToken = await result.user.getIdToken(true);
          const authRes = await loginWithGoogle({ firebaseIdToken });
          setSuccess('Signed in with Google. Redirecting...');
          redirectUserAfterAuth(authRes.data);
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || err.message || 'Firebase Google sign-in failed.');
          setGoogleSubmitting(false);
        }
      }
    };

    const initAuthConfig = async () => {
      try {
        const res = await API.get('/auth/google/config');
        const srv = res.data?.success && res.data.data ? res.data.data : {};
        const envFirebase = getEnvFirebaseConfig();
        const resolvedFirebase = envFirebase || srv.firebase || null;
        if (active) {
          setAuthProviderConfig({
            loaded: true,
            firebase: resolvedFirebase,
            firebaseConfigured: Boolean(resolvedFirebase),
            configured: Boolean(resolvedFirebase || srv.configured || import.meta.env.VITE_GOOGLE_CLIENT_ID),
            clientId: srv.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
            oauthCodeFlow: Boolean(srv.oauthCodeFlow),
          });
        }
        await completeFirebaseRedirectIfNeeded(resolvedFirebase);
      } catch {
        const envFirebase = getEnvFirebaseConfig();
        if (active) {
          setAuthProviderConfig((prev) => ({ ...prev, loaded: true }));
        }
        await completeFirebaseRedirectIfNeeded(envFirebase);
      }
    };
    initAuthConfig();

    const params = new URLSearchParams(location.search);
    const exchangeToken = params.get('googleExchange');
    const googleError = params.get('googleError');

    if (googleError) {
      setError(googleError);
      navigate('/login', { replace: true });
    } else if (exchangeToken) {
      setGoogleSubmitting(true);
      exchangeGoogleSession(exchangeToken)
        .then((res) => {
          setSuccess('Signed in with Google. Redirecting...');
          redirectUserAfterAuth(res.data);
        })
        .catch((err) => {
          setError(err.response?.data?.message || err.message || 'Google login failed.');
          setGoogleSubmitting(false);
          navigate('/login', { replace: true });
        });
    }

    return () => {
      active = false;
    };
  }, [location.search, exchangeGoogleSession, loginWithGoogle, navigate, redirectUserAfterAuth]);

  const handleModeSwitch = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setShowGisFallback(false);
    setPwStrength({ score: 0, label: '', colorClass: 'bg-gray-200', textClass: 'text-gray-400' });
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    if (!val) {
      setPwStrength({ score: 0, label: '', colorClass: 'bg-gray-200', textClass: 'text-gray-400' });
      return;
    }

    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;

    const strengths = [
      { score: 1, label: 'Weak — minimum 6 characters', colorClass: 'bg-red-500 w-1/4', textClass: 'text-red-500' },
      { score: 2, label: 'Fair — add numbers or symbols', colorClass: 'bg-orange-500 w-2/4', textClass: 'text-orange-500' },
      { score: 3, label: 'Good password', colorClass: 'bg-yellow-500 w-3/4', textClass: 'text-yellow-600' },
      { score: 4, label: 'Strong password', colorClass: 'bg-green-500 w-full', textClass: 'text-green-600' },
    ];

    const idx = Math.max(0, Math.min(3, score - 1));
    setPwStrength(strengths[idx]);
  };

  const validateEmail = (em) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);

  const handleGoogleCredentialResponse = useCallback(
    async (credentialResponse) => {
      if (!credentialResponse?.credential) {
        setError('Google did not return a valid identity credential.');
        setGoogleSubmitting(false);
        return;
      }
      try {
        setError('');
        setGoogleSubmitting(true);
        const res = await loginWithGoogle({ credential: credentialResponse.credential });
        setSuccess('Signed in with Google. Redirecting...');
        setTimeout(() => redirectUserAfterAuth(res.data), 400);
      } catch (err) {
        setError(
          err.response?.data?.message || err.message || 'Unable to authenticate with Google.'
        );
        setGoogleSubmitting(false);
      }
    },
    [loginWithGoogle, redirectUserAfterAuth]
  );

  // Render Google Identity button in fallback container only if One Tap prompt is suppressed
  useEffect(() => {
    if (!showGisFallback || !authProviderConfig.clientId || !gisFallbackRef.current) return;
    let cancelled = false;
    loadGoogleIdentityScript()
      .then((g) => {
        if (cancelled || !g?.accounts?.id || !gisFallbackRef.current) return;
        g.accounts.id.initialize({
          client_id: authProviderConfig.clientId,
          callback: handleGoogleCredentialResponse,
        });
        gisFallbackRef.current.innerHTML = '';
        g.accounts.id.renderButton(gisFallbackRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          width: Math.min(360, gisFallbackRef.current.offsetWidth || 320),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showGisFallback, authProviderConfig.clientId, handleGoogleCredentialResponse]);

  const handleContinueWithGoogle = async () => {
    setError('');
    setSuccess('');

    // Primary flow: Firebase Google Authentication
    const fb = await getFirebaseAuthClient(authProviderConfig.firebase);
    if (fb) {
      setGoogleSubmitting(true);
      try {
        const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
        const firebaseIdToken = await result.user.getIdToken(true);
        const authRes = await loginWithGoogle({ firebaseIdToken });
        setSuccess('Signed in with Google. Redirecting...');
        setTimeout(() => redirectUserAfterAuth(authRes.data), 400);
      } catch (err) {
        if (err?.code === 'auth/popup-blocked') {
          await fb.signInWithRedirect(fb.auth, fb.googleProvider);
          return;
        }
        if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
          setError('Google sign-in popup was closed. Please try again.');
        } else {
          setError(
            err.response?.data?.message || err.message || 'Unable to authenticate with Google via Firebase.'
          );
        }
        setGoogleSubmitting(false);
      }
      return;
    }

    // Secondary fallback: Direct Google OIDC flow if configured instead of Firebase
    if (authProviderConfig.oauthCodeFlow) {
      setGoogleSubmitting(true);
      const apiBase = String(API.defaults.baseURL || '/api').replace(/\/+$/, '');
      window.location.href = `${apiBase}/auth/google`;
      return;
    }

    if (authProviderConfig.clientId) {
      setGoogleSubmitting(true);
      try {
        const g = await loadGoogleIdentityScript();
        if (!g?.accounts?.id) {
          throw new Error('Google Identity Services failed to initialize.');
        }

        g.accounts.id.initialize({
          client_id: authProviderConfig.clientId,
          callback: handleGoogleCredentialResponse,
        });

        g.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setGoogleSubmitting(false);
            setShowGisFallback(true);
          }
        });
      } catch (err) {
        setError(err.message || 'Unable to start Google Sign-In.');
        setGoogleSubmitting(false);
      }
      return;
    }

    setError(
      'Firebase Google Sign-In is not configured yet. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID in frontend/.env and FIREBASE_PROJECT_ID in backend/.env.'
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await login(cleanEmail, password);
        setSuccess('Sign in successful. Redirecting...');
        setTimeout(() => {
          redirectUserAfterAuth(res.data);
        }, 500);
      } else {
        if (!name.trim()) {
          setError('Full Name is required.');
          setSubmitting(false);
          return;
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match. Please re-enter.');
          setSubmitting(false);
          return;
        }

        const res = await register({
          name: name.trim(),
          email: cleanEmail,
          password,
        });

        setSuccess('Account created successfully. Redirecting to menu...');
        setTimeout(() => {
          redirectUserAfterAuth(res.data);
        }, 500);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Authentication failed. Please try again.'
      );
      setSubmitting(false);
    }
  };

  const isSignUp = mode === 'signup';

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 md:grid-cols-2 bg-cream">
      {/* Left Branding Panel (Desktop) */}
      <div className="hidden md:flex flex-col items-center justify-center p-10 lg:p-12 text-center bg-gradient-to-br from-primary-darker via-primary-dark to-[#144c2e] text-white relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2.5 mb-8 z-10">
          <div className="w-10 h-10 bg-amber rounded-xl flex items-center justify-center text-primary-darker shadow-md">
            <Utensils className="w-5 h-5" />
          </div>
          <span className="font-outfit text-2xl font-black text-white tracking-tight">
            DRS <em className="text-amber not-italic">Quick Serve</em>
          </span>
        </Link>

        <h2 className="font-outfit font-black text-3xl lg:text-4xl mb-3 leading-tight max-w-sm">
          Your College Canteen, Simplified
        </h2>
        <p className="text-white/75 text-sm max-w-sm leading-relaxed mb-8">
          Order fresh food, snacks, and drinks in seconds and pick them up right on time.
        </p>

        <div className="flex flex-col gap-3 text-left w-full max-w-xs">
          {[
            {
              label: 'Live Order Tracking',
              Icon: MapPin,
              sub: 'Follow each preparation stage in real time',
            },
            {
              label: 'Instant Pickup Tokens',
              Icon: TicketPercent,
              sub: 'Skip counter queues with ready alerts',
            },
            {
              label: 'Quick Counter & Online Pay',
              Icon: CreditCard,
              sub: 'Seamless checkout built for campus speed',
            },
          ].map(({ label, Icon, sub }) => (
            <div
              key={label}
              className="flex items-center gap-3.5 bg-white/10 border border-white/15 rounded-xl p-3.5"
            >
              <div className="w-9 h-9 rounded-lg bg-amber text-primary-darker flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <strong className="block text-xs font-bold text-white">{label}</strong>
                <span className="text-[11px] text-white/70">{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex flex-col items-center justify-center px-4 py-8 sm:p-8 md:p-10">
        <div
          data-testid="auth-card"
          className="w-full max-w-[420px] bg-white border border-border rounded-3xl p-5 sm:p-8 shadow-lg"
        >
          {/* Logo Header */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 bg-amber rounded-xl flex items-center justify-center text-primary-darker shadow-xs shrink-0">
              <Utensils className="w-4.5 h-4.5" />
            </div>
            <span className="font-outfit text-lg font-extrabold text-primary-dark tracking-tight">
              DRS <em className="text-amber-dark not-italic">Quick Serve</em>
            </span>
          </div>

          <div className="mb-5">
            <h1 data-testid="auth-heading" className="font-outfit font-black text-2xl text-primary-dark leading-tight mb-1">
              {isSignUp ? 'Create Your Account' : 'Welcome Back!'}
            </h1>
            <p className="text-muted text-sm">
              {isSignUp
                ? 'Join DRS Quick Serve and order easily.'
                : 'Sign in to continue ordering your favourite food.'}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div
              role="alert"
              data-testid="auth-error"
              className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl mb-4 leading-relaxed font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              data-testid="auth-success"
              className="flex items-center gap-2 bg-primary-light border border-primary/20 text-primary-dark text-xs p-3 rounded-xl mb-4 leading-relaxed font-semibold"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
              <span>{success}</span>
            </div>
          )}

          {/* Continue with Google Button */}
          <button
            type="button"
            data-testid="google-auth-btn"
            onClick={handleContinueWithGoogle}
            disabled={googleSubmitting || submitting}
            className="w-full h-12 bg-white text-gray-800 font-semibold text-sm border border-gray-300 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
          >
            <GoogleLogo />
            <span>{googleSubmitting ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {showGisFallback && (
            <div className="mt-3 flex flex-col items-center">
              <div ref={gisFallbackRef} className="w-full flex justify-center" />
            </div>
          )}

          {/* OR Divider */}
          <div className="relative my-5 flex items-center">
            <div className="flex-1 border-t border-gray-200" />
            <span className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-white">
              OR
            </span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            {isSignUp && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full h-11 bg-cream border border-border focus:border-primary focus:bg-white rounded-xl pl-10 pr-4 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full h-11 bg-cream border border-border focus:border-primary focus:bg-white rounded-xl pl-10 pr-4 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                  className="w-full h-11 bg-cream border border-border focus:border-primary focus:bg-white rounded-xl pl-10 pr-11 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-dark p-1 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {isSignUp && password && (
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                    <div className={`h-full transition-all ${pwStrength.colorClass}`} />
                  </div>
                  <span className={`text-[10px] font-bold ${pwStrength.textClass}`}>
                    {pwStrength.label}
                  </span>
                </div>
              )}
            </div>

            {isSignUp && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className={`w-full h-11 bg-cream border rounded-xl pl-10 pr-11 text-sm text-primary-dark focus:outline-none focus:ring-2 transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-border focus:border-primary focus:bg-white focus:ring-primary/15'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-dark p-1 focus:outline-none transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <span className="text-[11px] font-semibold text-red-600 mt-1 block">
                    Passwords do not match
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={submitting || googleSubmitting}
              className="w-full h-12 bg-primary-dark text-white font-bold text-sm rounded-xl hover:bg-primary active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/15 disabled:bg-gray-400 disabled:shadow-none mt-1 cursor-pointer"
            >
              <span>
                {submitting
                  ? 'Please wait...'
                  : isSignUp
                  ? 'Create Account'
                  : 'Sign In'}
              </span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Bottom Mode Switcher */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-center text-xs text-muted">
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  data-testid="switch-to-login-btn"
                  onClick={() => handleModeSwitch('login')}
                  className="font-bold text-primary-dark hover:text-primary underline underline-offset-2 cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  data-testid="switch-to-signup-btn"
                  onClick={() => handleModeSwitch('signup')}
                  className="font-bold text-primary-dark hover:text-primary underline underline-offset-2 cursor-pointer"
                >
                  Sign Up
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
