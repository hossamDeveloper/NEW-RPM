import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { useState } from 'react';

const AddUser = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const formik = useFormik({
    initialValues: {
      name: '',
      username: '',
      password: ''
    },
    validationSchema: Yup.object({
      name: Yup.string()
        .required('Name is required')
        .min(3, 'Name must be at least 3 characters'),
      username: Yup.string()
        .required('Username is required')
        .min(3, 'Username must be at least 3 characters'),
      password: Yup.string()
        .required('Password is required')
        .matches(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
          'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character'
        )
    }),
    onSubmit: async (values) => {
      try {
        setError('');
        setSuccess('');
        
        // Get the admin token from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
          setError('Admin authentication required');
          return;
        }

        const response = await axios.post(
          'https://notaty-6ryr.onrender.com/api/v1/admin',
          values,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        setSuccess('User added successfully!');
        formik.resetForm();
      } catch (err) {
        if (err.response?.status === 401) {
          setError('Unauthorized: Please login as admin');
        } else {
          setError(err.response?.data?.message || 'Failed to add user');
        }
      }
    }
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Add New User</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-500">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-500">
          {success}
        </div>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-white mb-2">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6]/30 text-white placeholder-white/50 focus:outline-none focus:border-[#034AA6]"
            placeholder="Enter name"
          />
          {formik.touched.name && formik.errors.name && (
            <div className="mt-1 text-red-500 text-sm">{formik.errors.name}</div>
          )}
        </div>
        
        <div>
          <label htmlFor="username" className="block text-white mb-2">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6]/30 text-white placeholder-white/50 focus:outline-none focus:border-[#034AA6]"
            placeholder="Enter username"
          />
          {formik.touched.username && formik.errors.username && (
            <div className="mt-1 text-red-500 text-sm">{formik.errors.username}</div>
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
            className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6]/30 text-white placeholder-white/50 focus:outline-none focus:border-[#034AA6]"
            placeholder="Enter password"
          />
          {formik.touched.password && formik.errors.password && (
            <div className="mt-1 text-red-500 text-sm">{formik.errors.password}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="w-full px-6 py-3 bg-[#034AA6] text-white rounded-lg hover:bg-[#034AA6]/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formik.isSubmitting ? 'Adding User...' : 'Add User'}
        </button>
      </form>
    </div>
  );
};

export default AddUser; 