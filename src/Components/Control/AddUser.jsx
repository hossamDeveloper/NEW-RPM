import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../../redux/api';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const AddUser = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const queryClient = useQueryClient();

  const addUserMutation = useMutation({
    mutationFn: (values) => api.post('/admin', values),
    onSuccess: (res) => {
      if (res.data?.success) {
        setSuccess('User added successfully!');
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        setError(res.data?.message || 'Failed to add user');
      }
    },
    onError: (err) => {
      if (err.response?.status === 401) {
        setError('Unauthorized: Please login as admin');
      } else {
        setError(err.response?.data?.message || 'Failed to add user');
      }
    }
  });

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
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      setError('');
      setSuccess('');
      addUserMutation.mutate(values, {
        onSuccess: () => {
          resetForm();
          setSubmitting(false);
        },
        onError: () => setSubmitting(false)
      });
    }
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-[#1E3A8A] mb-6">Add New User</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-[#1F3B73] mb-2 font-medium">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="w-full px-4 py-2 rounded-lg bg-white border border-[#E5EDFF] text-[#1F3B73] placeholder-gray-400 focus:outline-none focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/20"
            placeholder="Enter name"
          />
          {formik.touched.name && formik.errors.name && (
            <div className="mt-1 text-red-600 text-sm">{formik.errors.name}</div>
          )}
        </div>
        
        <div>
          <label htmlFor="username" className="block text-[#1F3B73] mb-2 font-medium">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="w-full px-4 py-2 rounded-lg bg-white border border-[#E5EDFF] text-[#1F3B73] placeholder-gray-400 focus:outline-none focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/20"
            placeholder="Enter username"
          />
          {formik.touched.username && formik.errors.username && (
            <div className="mt-1 text-red-600 text-sm">{formik.errors.username}</div>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-[#1F3B73] mb-2 font-medium">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="w-full px-4 py-2 rounded-lg bg-white border border-[#E5EDFF] text-[#1F3B73] placeholder-gray-400 focus:outline-none focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/20"
            placeholder="Enter password"
          />
          {formik.touched.password && formik.errors.password && (
            <div className="mt-1 text-red-600 text-sm">{formik.errors.password}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="w-full px-6 py-3 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {formik.isSubmitting ? 'Adding User...' : 'Add User'}
        </button>
      </form>
    </div>
  );
};

export default AddUser; 