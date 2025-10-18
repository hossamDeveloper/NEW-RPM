import axios from 'axios';
import { store } from './store';
import { logout, logoutAsync } from './authSlice';

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
        const state = store.getState();
        const userId = state?.auth?.userId;
        
        if (userId) {
          // Try to logout via API first
          store.dispatch(logoutAsync(userId));
        } else {
          // Fallback to local logout if no userId
          store.dispatch(logout());
        }
      } catch (_) {}
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

// Logout API call function
export const logoutUser = async (userId) => {
  try {
    const response = await api.post(`/auth/logout/${userId}`);
    return response.data;
  } catch (error) {
    // Even if the API call fails, we should still clear local state
 
    throw error;
  }
};

export default api; 