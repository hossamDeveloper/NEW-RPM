import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { logoutUser } from './api';

// Async thunk for logout API call
export const logoutAsync = createAsyncThunk(
  'auth/logoutAsync',
  async (userId, { rejectWithValue }) => {
    try {    
      
      await logoutUser(userId);
      return { success: true };
    } catch (error) {
      // Even if API call fails, we still want to logout locally
      return rejectWithValue(error.message);
    }
  }
);

const initialAuthState = (() => {
  try {
    const token = localStorage.getItem('token') || null;
    const role = localStorage.getItem('userRole') || null;
    const userId = localStorage.getItem('userId') || null;
    
    
    return {
      token,
      role,
      userId,
      isAuthenticated: Boolean(token && role),
    };
  } catch (e) {
    return { token: null, role: null, userId: null, isAuthenticated: false };
  }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState, 
  reducers: {
    loginSuccess: (state, action) => {
      const { token, role, userId } = action.payload;
      
      state.token = token;
      state.role = role;
      state.userId = userId;
      state.isAuthenticated = true;
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userData', JSON.stringify({ isAuthenticated: true, role, userId }));
      } catch (_) {}
    },
    logout: (state) => {
      state.token = null;
      state.role = null;
      state.userId = null;
      state.isAuthenticated = false;
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        localStorage.removeItem('userData');
      } catch (_) {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logoutAsync.fulfilled, (state) => {
        // Clear state on successful logout
        state.token = null;
        state.role = null;
        state.userId = null;
        state.isAuthenticated = false;
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userId');
          localStorage.removeItem('userData');
        } catch (_) {}
      })
      .addCase(logoutAsync.rejected, (state) => {
        // Even if API call fails, clear local state
        state.token = null;
        state.role = null;
        state.userId = null;
        state.isAuthenticated = false;
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userId');
          localStorage.removeItem('userData');
        } catch (_) {}
      });
  }
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer; 