import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user session exists in localStorage
    const savedUser = localStorage.getItem('drs_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing user session', e);
        localStorage.removeItem('drs_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    if (response.data?.success) {
      const userData = response.data.data;
      localStorage.setItem('drs_user', JSON.stringify(userData));
      setUser(userData);
      return response.data;
    }
    throw new Error(response.data?.message || 'Login failed');
  };

  const register = async (name, email, password, phone) => {
    const response = await API.post('/auth/register', { name, email, password, phone });
    if (response.data?.success) {
      const userData = response.data.data;
      localStorage.setItem('drs_user', JSON.stringify(userData));
      setUser(userData);
      return response.data;
    }
    throw new Error(response.data?.message || 'Registration failed');
  };

  const updateProfile = async (name, email, phone) => {
    const response = await API.put('/auth/profile', { name, email, phone });
    if (response.data?.success) {
      const updatedUser = response.data.data;
      // Merge token into updated session
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
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('drs_user');
    localStorage.removeItem('drs_cart');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, changePassword, logout }}>
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
