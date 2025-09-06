import { useState, useEffect } from 'react';
import api from '../../redux/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const AllUsers = () => {
  const [users, setUsers] = useState([]);
  const [showPasswords, setShowPasswords] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: ''
  });
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalError, setModalError] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading: qLoading, error: qError } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/admin');
      if (res.data.success) return res.data.data;
      throw new Error('Failed to fetch users');
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (qLoading) {
      setIsLoading(true);
      setError('');
    } else {
      setIsLoading(false);
      setError(qError?.message || '');
      setUsers(Array.isArray(data) ? data : []);
    }
  }, [qLoading, qError, data]);

  const blockMutation = useMutation({
    mutationFn: (userId) => api.delete('/admin', { data: { userId, type: 'block' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => setError(err.response?.data?.message || 'Failed to block user'),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId) => api.patch(`/admin/${userId}/cancel-block`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => setError(err.response?.data?.message || 'Failed to unblock user'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => api.patch('/admin', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      setError('');
    },
    onError: (err) => {
      setModalError(
        `Failed to update user: ${err.response?.status} - ${err.response?.statusText}. ` +
        (err.response?.data?.message || err.response?.data?.error || 'Unknown error')
      );
      setShowErrorModal(true);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId) => api.delete('/admin', { data: { userId, type: 'delete' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => setError(err.response?.data?.message || 'Failed to delete user'),
  });

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleBlock = (userId) => {
    if (!window.confirm('Are you sure you want to block this user?')) return;
    blockMutation.mutate(userId);
  };

  const handleUnblock = (userId) => {
    if (!window.confirm('Are you sure you want to unblock this user?')) return;
    unblockMutation.mutate(userId);
  };

  const handleEdit = (user) => {
    setEditingUser(user._id);
    setEditForm({ name: user.name, username: user.username, password: user.password });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
      setModalError('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character');
      setShowErrorModal(true);
      return;
    }
    updateMutation.mutate({
      userId: editingUser,
      name: editForm.name.trim(),
      username: editForm.username.trim(),
      password: editForm.password,
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    deleteMutation.mutate(userId);
  };

  if (isLoading) {
    return (
      <div className="relative bg-white rounded-lg shadow-sm p-8 border border-[#E5EDFF]">
        <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#93C5FD] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-[#334155]">Loading users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative bg-white rounded-lg shadow-sm p-8 border border-[#E5EDFF]">
        <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-[#64748B] hover:text-[#0F172A]">×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF]  rounded-lg shadow-sm p-8 border border-[#E5EDFF]">
      <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
      <h2 className="text-2xl font-bold text-[#1E3A8A] mb-6">All Users</h2>
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowErrorModal(false)} />
          <div className="relative bg-white border border-[#E5EDFF] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#1E3A8A]">Error</h3>
              <button onClick={() => setShowErrorModal(false)} className="text-[#64748B] hover:text-[#0F172A] transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-[#334155] mb-6">{modalError}</p>
            <div className="flex justify-end">
              <button onClick={() => setShowErrorModal(false)} className="px-4 py-2 bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] text-white rounded-lg hover:from-[#3B82F6] hover:to-[#2563EB] transition-colors border border-transparent hover:border-[#F59E0B]">Try Again</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[#475569] border-b border-[#E5EDFF]">
              <th className="pb-4">Name</th>
              <th className="pb-4">Username</th>
              <th className="pb-4">Password</th>
              <th className="pb-4">Status</th>
              <th className="pb-4">Actions</th>
              <th className="pb-4">Delete</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id} className={`text-[#334155] border-b border-[#E5EDFF] ${user.isBlocked ? 'opacity-60' : ''}`}>
                <td className="py-4">
                  {editingUser === user._id ? (
                    <input type="text" name="name" value={editForm.name} onChange={handleEditInputChange} className="w-full px-2 py-1 rounded bg-white border border-[#C7DAFF] text-[#1F3B73]" />
                  ) : (
                    user.name
                  )}
                </td>
                <td className="py-4">
                  {editingUser === user._id ? (
                    <input type="text" name="username" value={editForm.username} onChange={handleEditInputChange} className="w-full px-2 py-1 rounded bg:white border border-[#C7DAFF] text-[#1F3B73]" />
                  ) : (
                    user.username
                  )}
                </td>
                <td className="py-4">
                  {editingUser === user._id ? (
                    <input type="password" name="password" value={editForm.password} onChange={handleEditInputChange} className="w-full px-2 py-1 rounded bg-white border border-[#C7DAFF] text-[#1F3B73]" />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>{showPasswords[user._id] ? user.password : '••••••••'}</span>
                      <button onClick={() => togglePasswordVisibility(user._id)} className="text-blue-500 hover:text-blue-600">
                        {showPasswords[user._id] ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  )}
                </td>
                <td className="py-4">
                  {user.isBlocked ? <span className="text-red-600">Blocked</span> : <span className="text-emerald-600">Active</span>}
                </td>
                <td className="py-4">
                  <div className="flex space-x-3">
                    {editingUser === user._id ? (
                      <>
                        <button onClick={handleEditSubmit} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors duration-200" title="Save Changes">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button onClick={() => setEditingUser(null)} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors duration-200" title="Cancel">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(user)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200" title="Edit User">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {user.role !== 'admin' && (
                          user.isBlocked ? (
                            <button onClick={() => handleUnblock(user._id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors duration-200" title="Unblock User">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                            </button>
                          ) : (
                            <button onClick={() => handleBlock(user._id)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors duration-200" title="Block User">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="py-4">
                  {user.role !== 'admin' && (
                    <button onClick={() => handleDelete(user._id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors duration-200" title="Delete User">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllUsers; 