import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const Login = () => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Core Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const handleModeSwitch = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
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
              disabled={submitting}
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
