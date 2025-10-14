import axios from 'axios';
import { store } from './store';
import { logout } from './authSlice';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state?.auth?.token || localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = (error.response?.data?.message || '').toLowerCase();
    const skipRedirect = error.config?.headers?.['X-Skip-Auth-Redirect'] === 'true';

    if (!skipRedirect && (status === 401 || status === 403 || message.includes('token is invalid') || message.includes('invalid token'))) {
      try {
        store.dispatch(logout());
      } catch (_) {}
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api; 