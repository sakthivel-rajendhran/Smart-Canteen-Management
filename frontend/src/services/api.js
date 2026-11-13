import axios from 'axios';

// Helper to detect local development environments (localhost, 127.0.0.1, or local LAN IP)
const isLocalHostname = (hostname) => {
  if (!hostname) return true;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  );
};

// Default API baseURL: on Vercel or any production host, connect directly to Render backend
export const getDefaultApiUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocal = isLocalHostname(window.location.hostname);
    if (!isLocal) {
      // In production / cloud hosting (e.g. Vercel), NEVER use a localhost URL
      const envUrl = import.meta.env.VITE_API_URL;
      if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
      }
      return 'https://smart-canteen-management-1-b9zg.onrender.com/api';
    }
  }

  // Local development: use VITE_API_URL if configured, otherwise Vite proxy '/api'
  return import.meta.env.VITE_API_URL || '/api';
};

const API = axios.create({
  baseURL: getDefaultApiUrl(),
  timeout: 45000, // 45s timeout to allow Render free tier cold-start wakeups
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token in Authorization header and safeguard against localhost in production
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const isLocal = isLocalHostname(window.location.hostname);
    // Safety guard: if deployed on a live domain, override any accidental localhost baseURL
    if (!isLocal && config.baseURL && (config.baseURL.includes('localhost') || config.baseURL.includes('127.0.0.1'))) {
      config.baseURL = 'https://smart-canteen-management-1-b9zg.onrender.com/api';
    }
  }

  const user = JSON.parse(localStorage.getItem('drs_user') || 'null');
  if (user && user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  // Let the browser automatically configure multipart boundaries for FormData uploads
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocal = isLocalHostname(window.location.hostname);
    if (!isLocal) {
      const envSocket = import.meta.env.VITE_SOCKET_URL;
      if (envSocket && !envSocket.includes('localhost') && !envSocket.includes('127.0.0.1')) {
        return envSocket;
      }
      return 'https://smart-canteen-management-1-b9zg.onrender.com';
    }
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return 'http://localhost:5000';
};

export default API;
