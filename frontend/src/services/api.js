import axios from 'axios';

// VITE_API_URL falls back to '/api' so it operates through the Vite proxy in development
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token in Authorization header
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('drs_user') || 'null');
  if (user && user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default API;
