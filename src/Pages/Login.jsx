import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../redux/authSlice';
import api from '../redux/api';

const Login = () => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

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

      try {
        const response = await api.post('/auth/login', {
          username: values.username,
          password: values.password,
        });

        if (response.data.success && response.data.data?.token) {
          const token = response.data.data.token;
          const role = response.data.data.user.role;

          dispatch(loginSuccess({ token, role }));
          navigate('/');
        } else {
          setError('Invalid response from server');
        }
      } catch (err) {
        if (err.response) {
          if (err.response.data?.errors && Array.isArray(err.response.data.errors)) {
            const errorMessages = err.response.data.errors.map(error => error.message).join(', ');
            setError(errorMessages);
          } else {
            const errorMessage = err.response.data?.message || 'Login failed';
            setError(errorMessage);
          }
        } else if (err.request) {
          setError('No response from server. Please check your internet connection.');
        } else {
          setError('An error occurred while setting up the request.');
        }
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="relative  bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-lg shadow-sm p-8 border border-[#E5EDFF]">
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
          <h2 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">Login</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}
          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-[#1F3B73] mb-2">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2 rounded-lg bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                placeholder="Enter your username"
                disabled={isLoading}
              />
              {formik.touched.username && formik.errors.username && (
                <div className="text-red-600 text-sm mt-1">{formik.errors.username}</div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-[#1F3B73] mb-2">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2 rounded-lg bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {formik.touched.password && formik.errors.password && (
                <div className="text-red-600 text-sm mt-1">{formik.errors.password}</div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] text-white py-2 rounded-lg hover:from-[#3B82F6] hover:to-[#2563EB] transition-all duration-200 relative border border-transparent hover:border-[#F59E0B]"
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

          {/* <div className="mt-4 text-center text-[#64748B] text-sm">
            <p>Admin Credentials:</p>
            <p>Username: hossam</p>
            <p>Password: Aa11111$</p>
          </div> */}
        </div>
      </motion.div>
    </div>
  );
};

export default Login; 