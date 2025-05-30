import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../App';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'https://notaty-6ryr.onrender.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

const Login = () => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { handleLogin } = useContext(AuthContext);

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema: Yup.object({
      username: Yup.string().required('Username is required'),
      password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .matches(/[0-9]/, 'Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
        .matches(/[a-zA-Z]/, 'Password must contain at least one letter')
        .required('Password is required'),
    }),
    onSubmit: async (values) => {
      setError('');
      setIsLoading(true);
      console.log('Attempting login with:', values);

      try {
        console.log('Sending request to:', `${api.defaults.baseURL}/auth/login`);
        const response = await api.post('/auth/login', {
          username: values.username,
          password: values.password,
        });

        console.log('Response received:', response.data);

        if (response.data.success && response.data.data?.token) {
          console.log('Login successful, storing token');
          // Store the token in localStorage
          localStorage.setItem('token', response.data.data.token);
          // Store user role in localStorage
          localStorage.setItem('userRole', response.data.data.user.role);
          // Set the token in axios default headers for future requests
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.token}`;
          
          // Pass user role to handleLogin
          await handleLogin(values.username, response.data.data.user.role);
          
          // Navigate to home page
          navigate('/');
        } else {
          console.log('Invalid response structure:', response.data);
          setError('Invalid response from server');
        }
      } catch (err) {
        console.error('Login error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          headers: err.response?.headers
        });

        if (err.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          if (err.response.data?.errors && Array.isArray(err.response.data.errors)) {
            // Display validation errors from the server
            const errorMessages = err.response.data.errors.map(error => error.message).join(', ');
            setError(errorMessages);
          } else {
            const errorMessage = err.response.data?.message || 'Login failed';
            setError(errorMessage);
          }
        } else if (err.request) {
          // The request was made but no response was received
          console.log('No response received from server');
          setError('No response from server. Please check your internet connection.');
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Request setup error:', err.message);
          setError('An error occurred while setting up the request.');
        }
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#021F59]/80 backdrop-blur-md rounded-lg shadow-xl p-8 border border-[#034AA6]/30">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-white px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-white mb-2">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6] text-white placeholder-white/50 focus:outline-none focus:border-[#035AA6]"
                placeholder="Enter your username"
                disabled={isLoading}
              />
              {formik.touched.username && formik.errors.username && (
                <div className="text-red-500 text-sm mt-1">{formik.errors.username}</div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-white mb-2">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6] text-white placeholder-white/50 focus:outline-none focus:border-[#035AA6]"
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {formik.touched.password && formik.errors.password && (
                <div className="text-red-500 text-sm mt-1">{formik.errors.password}</div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#03178C] to-[#034AA6] text-white py-2 rounded-lg hover:from-[#034AA6] hover:to-[#035AA6] transition-all duration-200 relative"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Loading...
                </div>
              ) : (
                'Login'
              )}
            </motion.button>
          </form>

          <div className="mt-4 text-center text-white/70 text-sm">
            <p>Admin Credentials:</p>
            <p>Username: hossam</p>
            <p>Password: Aa11111$</p>
           
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login; 