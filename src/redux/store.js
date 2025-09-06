import { configureStore } from '@reduxjs/toolkit';
import flowReducer from './flowSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    flow: flowReducer,
    auth: authReducer,
  }
}); 