import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  KeyRound, 
  Save, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Shield,
  Sparkles
} from 'lucide-react';

const Profile = () => {
  const { user, updateProfile, changePassword, logout } = useAuth();

  // Profile info states
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Avatar state & preview
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(() => {
    if (user?._id) {
      return localStorage.getItem(`drs_avatar_${user._id}`) || user?.avatar || '';
    }
    return user?.avatar || '';
  });
  const [avatarNote, setAvatarNote] = useState('');

  // Status alerts
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });

  const [profileLoading, setProfileLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      const savedAvatar = localStorage.getItem(`drs_avatar_${user._id}`);
      if (savedAvatar) {
        setAvatarPreview(savedAvatar);
      } else if (user.avatar) {
        setAvatarPreview(user.avatar);
      }
    }
  }, [user]);

  // Handle local image upload preview
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarNote('Please select a valid image file (JPEG, PNG, or WEBP).');
      return;
    }

    // Limit to 3MB
    if (file.size > 3 * 1024 * 1024) {
      setAvatarNote('Image size must be less than 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setAvatarPreview(dataUrl);
        if (user?._id) {
          try {
            localStorage.setItem(`drs_avatar_${user._id}`, dataUrl);
          } catch (err) {
            console.warn('LocalStorage quota limit reached for avatar cache');
          }
        }
        setAvatarNote('Profile picture preview updated.');
        setTimeout(() => setAvatarNote(''), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper for name initials fallback
  const getInitials = (fullName) => {
    if (!fullName) return 'U';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });
    setProfileLoading(true);

    try {
      await updateProfile(name, email, phone);
      setProfileMsg({ text: 'Profile information updated successfully!', type: 'success' });
    } catch (error) {
      setProfileMsg({ text: error.message || 'Profile update failed.', type: 'error' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPwMsg({ text: '', type: '' });

    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      setPwMsg({ text: 'New password must be at least 6 characters.', type: 'error' });
      return;
    }

    setPwLoading(true);

    try {
      await changePassword(oldPassword, newPassword);
      setPwMsg({ text: 'Password updated successfully!', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPwMsg({ text: error.message || 'Password update failed.', type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10 pb-20">
      
      {/* Page Title & Breadcrumb */}
      <div className="mb-6 md:mb-8">
        <h1 className="font-outfit font-black text-2xl sm:text-3xl text-primary-dark tracking-tight">
          My Profile
        </h1>
        <p className="text-muted text-xs sm:text-sm mt-1">
          Manage your personal information, account details and security settings.
        </p>
      </div>

      {/* Header Profile Identity Card */}
      <div className="bg-white border border-border rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          
          {/* Profile Picture with Edit Indicator */}
          <div className="relative flex-shrink-0 group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-md overflow-hidden bg-primary-light flex items-center justify-center">
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt={user?.name || 'User Profile'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary-darker flex flex-col items-center justify-center text-white select-none">
                  <span className="font-outfit font-black text-2xl sm:text-3xl tracking-wider">
                    {getInitials(user?.name)}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest opacity-75 font-semibold mt-0.5">
                    {user?.role === 'admin' ? 'Admin' : 'Student'}
                  </span>
                </div>
              )}
            </div>

            {/* Camera Overlay Badge Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              title="Click to change profile picture"
              className="absolute bottom-0 right-0 w-8 h-8 sm:w-9 sm:h-9 bg-amber hover:bg-amber-dark text-primary-darker rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-primary-darker" />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />
          </div>

          {/* Account Details & Badges */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-light text-primary-dark border border-primary/20">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                {user?.role === 'admin' || user?.role === 'ADMIN'
                  ? 'Canteen Administrator'
                  : user?.accountType === 'STAFF' || user?.role === 'STAFF'
                  ? 'College Staff'
                  : 'Student Account'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Active
              </span>
            </div>

            <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-primary-dark truncate">
              {user?.name || 'User Profile'}
            </h2>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-4 text-xs sm:text-sm text-muted mt-1.5">
              <span className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                {user?.email || 'user@example.com'}
              </span>
              {user?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  +91 {user.phone}
                </span>
              )}
            </div>

            {/* Academic / Staff Meta Pills */}
            {user?.studentDetails?.registerNumber && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                <span className="text-[11px] font-bold bg-cream border border-border text-primary-dark px-2.5 py-1 rounded-lg">
                  🎓 Reg No: {user.studentDetails.registerNumber}
                </span>
                {user.studentDetails.department && (
                  <span className="text-[11px] font-bold bg-cream border border-border text-primary-dark px-2.5 py-1 rounded-lg">
                    🏛️ {user.studentDetails.department}
                  </span>
                )}
                {user.studentDetails.year && (
                  <span className="text-[11px] font-bold bg-cream border border-border text-primary-dark px-2.5 py-1 rounded-lg">
                    📅 {user.studentDetails.year}
                  </span>
                )}
              </div>
            )}

            {user?.staffDetails?.staffId && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                <span className="text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-lg">
                  💼 Staff ID: {user.staffDetails.staffId}
                </span>
                {user.staffDetails.department && (
                  <span className="text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-lg">
                    🏛️ {user.staffDetails.department}
                  </span>
                )}
              </div>
            )}

            {avatarNote && (
              <p className="text-xs text-primary font-semibold mt-2.5 flex items-center justify-center sm:justify-start gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber" /> {avatarNote}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Content Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Panel: Personal Information */}
        <div className="bg-white border border-border rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3.5 pb-5 border-b border-border mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-bold text-lg text-primary-dark">Personal Information</h3>
              <p className="text-muted text-xs">Update your identity and contact details.</p>
            </div>
          </div>

          {/* Profile Alert State */}
          {profileMsg.text && (
            <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-semibold mb-5 leading-relaxed ${
              profileMsg.type === 'success' 
                ? 'bg-primary-light text-primary-dark border border-primary/20' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-primary" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileUpdate} className="flex flex-col gap-5 flex-1 justify-between">
            <div className="flex flex-col gap-4">
              
              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full h-12 bg-cream/60 focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl pl-11 pr-4 text-sm font-medium focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@college.edu"
                    className="w-full h-12 bg-cream/60 focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl pl-11 pr-4 text-sm font-medium focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="tel"
                    maxLength="10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10 digit mobile number"
                    className="w-full h-12 bg-cream/60 focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl pl-11 pr-4 text-sm font-medium focus:outline-none transition-all"
                  />
                </div>
                <span className="text-[10px] text-muted block mt-1">Used for order alerts and pickup identification.</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-border mt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full sm:w-auto bg-primary-dark hover:bg-primary text-white font-bold h-12 px-7 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{profileLoading ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel: Account Security */}
        <div className="bg-white border border-border rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3.5 pb-5 border-b border-border mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-bold text-lg text-primary-dark">Account Security</h3>
              <p className="text-muted text-xs">Manage your password and credentials.</p>
            </div>
          </div>

          {/* Password Alert State */}
          {pwMsg.text && (
            <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-semibold mb-5 leading-relaxed ${
              pwMsg.type === 'success' 
                ? 'bg-primary-light text-primary-dark border border-primary/20' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {pwMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-primary" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />}
              <span>{pwMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-5 flex-1 justify-between">
            <div className="flex flex-col gap-4">
              
              {/* Current Password */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showOldPw ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full h-12 bg-cream/60 focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl pl-11 pr-11 text-sm font-medium focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw(!showOldPw)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-primary-dark focus:outline-none transition-colors"
                  >
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-12 bg-cream/60 focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl pl-11 pr-11 text-sm font-medium focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-primary-dark focus:outline-none transition-colors"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-12 bg-cream/60 focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl pl-11 pr-11 text-sm font-medium focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-primary-dark focus:outline-none transition-colors"
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit & Security Note */}
            <div>
              <div className="pt-4 border-t border-border mt-2">
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full sm:w-auto bg-primary-dark hover:bg-primary text-white font-bold h-12 px-7 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{pwLoading ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>

              {/* Security Hint Note */}
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Keep your password private and never share it with anyone.</span>
              </div>
            </div>
          </form>
        </div>

      </div>

      {/* Account Session & Sign Out Bar */}
      <div className="bg-white border border-border rounded-2xl md:rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
          <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Authorized Role</span>
            <span className="font-outfit font-extrabold text-primary-dark text-base capitalize">
              {user?.role === 'admin' ? 'Canteen Administrator Access' : 'Verified Student Portal'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 font-bold px-6 py-3 rounded-xl border border-red-200 transition-all flex items-center justify-center gap-2 text-xs shadow-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

    </div>
  );
};

export default Profile;
