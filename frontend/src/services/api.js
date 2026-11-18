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

// Active pending requests and cold-start warming detection (threshold: 3 seconds)
let activePendingRequests = 0;
let coldStartTimer = null;
let isWarming = false;

const notifyWarming = (warming) => {
  if (isWarming === warming) return;
  isWarming = warming;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('drs:server-warming', { detail: { warming } }));
  }
};

const handleRequestStart = () => {
  activePendingRequests += 1;
  if (activePendingRequests === 1 && !coldStartTimer) {
    coldStartTimer = setTimeout(() => {
      if (activePendingRequests > 0) {
        notifyWarming(true);
      }
    }, 3000);
  }
};

const handleRequestFinish = () => {
  activePendingRequests = Math.max(0, activePendingRequests - 1);
  if (activePendingRequests === 0) {
    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      coldStartTimer = null;
    }
    notifyWarming(false);
  }
};

const API = axios.create({
  baseURL: getDefaultApiUrl(),
  timeout: 30000, // 30s timeout to allow Render free tier cold-start wakeups
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token in Authorization header, safeguard against localhost in production, and start tracking
API.interceptors.request.use(
  (config) => {
    // Only count non-internal background pings towards cold-start warning
    if (!config.headers?.['X-Silent-Ping']) {
      handleRequestStart();
    }

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
  },
  (error) => {
    handleRequestFinish();
    return Promise.reject(error);
  }
);

// Response interceptor with retry mechanism and cold-start resolution
API.interceptors.response.use(
  (response) => {
    if (!response.config?.headers?.['X-Silent-Ping']) {
      handleRequestFinish();
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    const isSilent = config?.headers?.['X-Silent-Ping'];

    // Check if network error or timeout occurred (eligible for cold-start retry)
    const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';

    if (config && isNetworkOrTimeout) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 2) {
        config.__retryCount += 1;
        const backoffDelay = config.__retryCount * 1000; // 1s, then 2s
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return API(config);
      }
    }

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drs:auth-expired', { detail: error.response?.data }));
    }

    if (!isSilent) {
      handleRequestFinish();
    }
    return Promise.reject(error);
  }
);

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
