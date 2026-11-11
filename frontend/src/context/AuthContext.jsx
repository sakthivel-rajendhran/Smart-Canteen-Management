import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { signOutFirebaseIfInitialized } from '../config/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('PUBLIC'); // 'PUBLIC' | 'AUTHENTICATED' | 'LOGGING_OUT'

  useEffect(() => {
    const savedUser = localStorage.getItem('drs_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.token) {
          setUser(parsed);
          setAuthStatus('AUTHENTICATED');
        } else {
          setUser(null);
          setAuthStatus('PUBLIC');
        }
      } catch (e) {
        console.error('Error parsing user session', e);
        localStorage.removeItem('drs_user');
        setUser(null);
        setAuthStatus('PUBLIC');
      }
    } else {
      setAuthStatus('PUBLIC');
    }
    setLoading(false);
  }, []);

  const persistSession = (userData) => {
    localStorage.setItem('drs_user', JSON.stringify(userData));
    setUser(userData);
    setAuthStatus('AUTHENTICATED');
  };

  const login = async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    if (response.data?.success) {
      persistSession(response.data.data);
      return response.data;
    }
    throw new Error(response.data?.message || 'Login failed');
  };

  const register = async (registrationData, maybeEmail, maybePassword, maybePhone) => {
    const payload =
      typeof registrationData === 'object' && registrationData !== null
        ? registrationData
        : {
            name: registrationData,
            email: maybeEmail,
            password: maybePassword,
            ...(maybePhone ? { phone: maybePhone } : {}),
          };

    const response = await API.post('/auth/register', payload);
    if (response.data?.success) {
      persistSession(response.data.data);
      return response.data;
    }
    throw new Error(response.data?.message || 'Registration failed');
  };

  const loginWithGoogle = async ({ firebaseIdToken, credential, code }) => {
    const response = await API.post('/auth/google', {
      ...(firebaseIdToken ? { firebaseIdToken } : {}),
      ...(credential ? { credential } : {}),
      ...(code ? { code } : {}),
    });
    if (response.data?.success) {
      persistSession(response.data.data);
      return response.data;
    }
    throw new Error(response.data?.message || 'Google authentication failed');
  };

  const exchangeGoogleSession = async (exchangeToken) => {
    const response = await API.post('/auth/google/exchange', { exchangeToken });
    if (response.data?.success) {
      persistSession(response.data.data);
      return response.data;
    }
    throw new Error(response.data?.message || 'Google session exchange failed');
  };

  const updateProfile = async (name, email, phone, details = {}) => {
    const payload = { name, email, phone, ...details };
    const response = await API.put('/auth/profile', payload);
    if (response.data?.success) {
      const updatedUser = response.data.data;
      const currentSession = JSON.parse(localStorage.getItem('drs_user') || '{}');
      const newSession = { ...updatedUser, token: currentSession.token };
      localStorage.setItem('drs_user', JSON.stringify(newSession));
      setUser(newSession);
      return response.data;
    }
    throw new Error(response.data?.message || 'Profile update failed');
  };

  const changePassword = async (oldPassword, newPassword) => {
    const response = await API.put('/auth/change-password', { oldPassword, newPassword });
    if (response.data?.success && user) {
      const updatedSession = { ...user, hasPassword: true };
      localStorage.setItem('drs_user', JSON.stringify(updatedSession));
      setUser(updatedSession);
    }
    return response.data;
  };

  const logout = () => {
    setAuthStatus('LOGGING_OUT');
    signOutFirebaseIfInitialized();
    localStorage.removeItem('drs_user');
    localStorage.removeItem('drs_cart');
    setUser(null);
    setAuthStatus('PUBLIC');
  };

  const isAuthenticated = Boolean(user && user.token);
  const isStudent = Boolean(
    user && (user.accountType === 'STUDENT' || user.role === 'STUDENT' || user.role === 'user')
  );
  const isStaff = Boolean(user && (user.accountType === 'STAFF' || user.role === 'STAFF'));
  const isAdmin = Boolean(user && (user.role === 'admin' || user.role === 'ADMIN'));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authStatus,
        isAuthenticated,
        isStudent,
        isStaff,
        isAdmin,
        login,
        register,
        loginWithGoogle,
        exchangeGoogleSession,
        updateProfile,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
