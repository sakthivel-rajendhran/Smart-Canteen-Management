import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ShieldCheck, Mail, Lock, User, AlertCircle } from 'lucide-react';

const Login = () => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Password strength states
  const [pwStrength, setPwStrength] = useState({ score: 0, label: '', colorClass: 'bg-gray-200', textClass: 'text-gray-400' });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/menu');
    }
  }, [user, navigate]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
    setPassword('');
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
      { score: 1, label: 'Weak — too short', colorClass: 'bg-red-500 w-1/4', textClass: 'text-red-500' },
      { score: 2, label: 'Fair — try adding numbers', colorClass: 'bg-orange-500 w-2/4', textClass: 'text-orange-500' },
      { score: 3, label: 'Good — almost there!', colorClass: 'bg-yellow-500 w-3/4', textClass: 'text-yellow-500' },
      { score: 4, label: 'Strong password ✅', colorClass: 'bg-green-500 w-full', textClass: 'text-green-500' }
    ];

    const s = Math.max(0, Math.min(3, score - 1));
    setPwStrength(strengths[s]);
  };

  const validateEmail = (em) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address (e.g. user@example.com)');
      return;
    }

    setSubmitting(true);

    try {
      if (activeTab === 'login') {
        const res = await login(email, password);
        setSuccess('✅ Login successful! Redirecting...');
        setTimeout(() => {
          navigate(res.data.role === 'admin' ? '/admin' : '/menu');
        }, 900);
      } else {
        if (!name) {
          setError('Name field is required');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        const res = await register(name, email, password, phone);
        setSuccess('✅ Account created! Redirecting to menu...');
        setTimeout(() => {
          navigate('/menu');
        }, 900);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'An error occurred during authentication';
      setError(errorMsg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] grid grid-cols-1 md:grid-cols-2 bg-cream">
      {/* Left Branding Panel (Hidden on mobile) */}
      <div className="hidden md:flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-primary-darker via-primary-dark to-[#1a5c38] text-white relative overflow-hidden">
        <div className="absolute w-80 h-80 bg-radial-gradient(circle, rgba(245, 158, 11, .12)_0%,_transparent_70%) top-[-80px] right-[-80px] pointer-events-none"></div>
        <div className="absolute w-60 h-60 bg-radial-gradient(circle, rgba(26, 122, 69, .25)_0%,_transparent_70%) bottom-[-60px] left-[-40px] pointer-events-none"></div>
        
        <Link to="/" className="flex items-center gap-2 mb-10 text-decoration-none z-10">
          <div className="w-10 h-10 bg-amber rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-amber/35">🍛</div>
          <span className="font-outfit text-2xl font-black text-white">DRS <em className="text-amber not-italic">Quick Serve</em></span>
        </Link>

        <span className="text-7xl block mb-6 animate-bounce">🍛</span>
        <h2 className="font-outfit font-black text-3xl mb-4 leading-tight">Your College Canteen,<br />Reimagined</h2>
        <p className="text-white/60 text-sm max-w-sm leading-relaxed mb-8">Order authentic Tamil Nadu recipes fresh every day right from your phone.</p>

        <div className="flex flex-col gap-3.5 text-left w-full max-w-xs">
          {[
            { label: 'Live Order Tracking', icon: '📍', sub: 'Watch status update in real-time' },
            { label: 'Coupon Discounts', icon: '🎟️', sub: 'Save up to ₹20 on every order' },
            { label: 'UPI & Cash Payment', icon: '💳', sub: 'Pay your way, securely' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3.5 bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-md">
              <span className="text-xl">{item.icon}</span>
              <div>
                <strong className="block text-xs font-semibold text-white">{item.label}</strong>
                <span className="text-[10px] text-white/50">{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Login/Signup Form Panel */}
      <div className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md bg-white border border-border rounded-3xl p-8 shadow-xl">
          <div className="mb-6">
            <h1 className="font-outfit font-black text-2xl text-primary-dark mb-1">
              {activeTab === 'login' ? 'Welcome Back 👋' : 'Join DRS 🍛'}
            </h1>
            <p className="text-muted text-sm">
              {activeTab === 'login' ? 'Login to order your favourite Tamil food' : 'Create your free account in seconds'}
            </p>
          </div>

          {/* Form Alert States */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl mb-4 leading-relaxed font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-primary-light border border-primary/20 text-primary-dark text-xs p-3.5 rounded-xl mb-4 leading-relaxed font-semibold">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Tab Selection */}
          <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 mb-6 gap-1">
            <button
              onClick={() => handleTabSwitch('login')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'login' ? 'bg-white text-primary-dark shadow-sm' : 'text-muted hover:text-primary-dark'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => handleTabSwitch('signup')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'signup' ? 'bg-white text-primary-dark shadow-sm' : 'text-muted hover:text-primary-dark'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {activeTab === 'signup' && (
              <div className="relative">
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="relative">
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            {activeTab === 'signup' && (
              <div className="relative">
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-semibold text-gray-400 select-none">+91</span>
                  <input
                    type="tel"
                    maxLength="10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10 digit number"
                    className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-14 pr-4 text-sm focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="relative">
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder={activeTab === 'login' ? 'Enter password' : 'Minimum 6 characters'}
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-11 pr-11 text-sm focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-primary-dark transition-all focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {/* Password strength meter */}
              {activeTab === 'signup' && password && (
                <div className="mt-2.5">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                    <div className={`h-full transition-all ${pwStrength.colorClass}`}></div>
                  </div>
                  <span className={`text-[10px] font-bold ${pwStrength.textClass}`}>{pwStrength.label}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-dark text-white font-bold py-3.5 rounded-xl hover:bg-primary transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 shadow-md shadow-primary/20 disabled:bg-gray-400 disabled:transform-none disabled:shadow-none mt-2"
            >
              {submitting ? 'Authenticating...' : activeTab === 'login' ? 'Login →' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
