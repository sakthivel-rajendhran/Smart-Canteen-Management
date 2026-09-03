import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Lock, Save, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

const Profile = () => {
  const { user, updateProfile, changePassword, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status alerts
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });

  const [profileLoading, setProfileLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });
    setProfileLoading(true);

    try {
      await updateProfile(name, email, phone);
      setProfileMsg({ text: 'Profile updated successfully! ✅', type: 'success' });
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
      setPwMsg({ text: 'New passwords do not match ❌', type: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      setPwMsg({ text: 'New password must be at least 6 characters ❌', type: 'error' });
      return;
    }

    setPwLoading(true);

    try {
      await changePassword(oldPassword, newPassword);
      setPwMsg({ text: 'Password updated successfully! ✅', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPwMsg({ text: error.message || 'Password change failed.', type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 pb-20">
      <h1 className="font-outfit font-black text-3xl text-primary-dark mb-2">My Profile 👤</h1>
      <p className="text-muted text-sm mb-8">Manage your account information and change password settings.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Profile Info Form */}
        <div className="bg-white border border-border p-6 md:p-8 rounded-3xl shadow-sm">
          <h2 className="font-outfit font-bold text-lg text-primary-dark mb-5 pb-3 border-b border-border flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Personal Information
          </h2>

          {profileMsg.text && (
            <div className={`flex items-center gap-2 p-3.5 rounded-xl text-xs font-semibold mb-4 leading-relaxed ${
              profileMsg.type === 'success' ? 'bg-primary-light text-primary-dark border border-primary/20' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> : <AlertCircle className="w-4.5 h-4.5" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileUpdate} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  maxLength="10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10 digit number"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="bg-primary-dark hover:bg-primary text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 mt-2 disabled:bg-gray-400"
            >
              <Save className="w-4 h-4" />
              <span>{profileLoading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-border p-6 md:p-8 rounded-3xl shadow-sm">
            <h2 className="font-outfit font-bold text-lg text-primary-dark mb-5 pb-3 border-b border-border flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Change Password
            </h2>

            {pwMsg.text && (
              <div className={`flex items-center gap-2 p-3.5 rounded-xl text-xs font-semibold mb-4 leading-relaxed ${
                pwMsg.type === 'success' ? 'bg-primary-light text-primary-dark border border-primary/20' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {pwMsg.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> : <AlertCircle className="w-4.5 h-4.5" />}
                <span>{pwMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Current Password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 px-4 text-sm focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 px-4 text-sm focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-3 px-4 text-sm focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={pwLoading}
                className="bg-primary-dark hover:bg-primary text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 mt-2 disabled:bg-gray-400"
              >
                <Save className="w-4 h-4" />
                <span>{pwLoading ? 'Updating...' : 'Update Password'}</span>
              </button>
            </form>
          </div>

          {/* Quick Stats / Session Info */}
          <div className="bg-primary-light/50 border border-primary/10 rounded-3xl p-6 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-0.5">Role Authorization</span>
              <span className="font-outfit font-extrabold text-primary-dark capitalize text-lg">{user?.role} Dashboard</span>
            </div>
            <button
              onClick={logout}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-5 py-2.5 rounded-xl border border-red-200 transition-all flex items-center gap-2 text-xs shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
