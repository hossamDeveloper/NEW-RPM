import { createSlice } from '@reduxjs/toolkit';

const initialAuthState = (() => {
  try {
    const token = localStorage.getItem('token') || null;
    const role = localStorage.getItem('userRole') || null;
    return {
      token,
      role,
      isAuthenticated: Boolean(token && role),
    };
  } catch (e) {
    return { token: null, role: null, isAuthenticated: false };
  }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState, 
  reducers: {
    loginSuccess: (state, action) => {
      const { token, role } = action.payload;
      state.token = token;
      state.role = role;
      state.isAuthenticated = true;
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userData', JSON.stringify({ isAuthenticated: true, role }));
      } catch (_) {}
    },
    logout: (state) => {
      state.token = null;
      state.role = null;
      state.isAuthenticated = false;
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userData');
      } catch (_) {}
    },
  }
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer; 