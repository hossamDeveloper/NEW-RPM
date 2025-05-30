import { useState, useEffect } from 'react';
import axios from 'axios';

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.get('https://notaty-6ryr.onrender.com/api/v1/admin', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data.success) {
        setUsers(response.data.data);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleBlock = async (userId) => {
    if (!window.confirm('Are you sure you want to block this user?')) return;

    try {
      const response = await axios.delete(`https://notaty-6ryr.onrender.com/api/v1/admin`, {
        data: {
          userId: userId,
          type: "block"
        },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setUsers(users.map(user => 
          user._id === userId ? { ...user, isBlocked: true } : user
        ));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to block user');
    }
  };

  const handleUnblock = async (userId) => {
    if (!window.confirm('Are you sure you want to unblock this user?')) return;

    try {
      const response = await axios.patch(`https://notaty-6ryr.onrender.com/api/v1/admin/${userId}/cancel-block`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setUsers(users.map(user => 
          user._id === userId ? { ...user, isBlocked: false } : user
        ));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unblock user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user._id);
    setEditForm({
      name: user.name,
      username: user.username,
      password: user.password
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!editForm.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
        setModalError('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character');
        setShowErrorModal(true);
        return;
      }

      const requestData = {
        userId: editingUser,
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        password: editForm.password
      };

      const response = await axios.patch('https://notaty-6ryr.onrender.com/api/v1/admin', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setUsers(users.map(user => 
          user._id === editingUser ? { ...user, ...editForm } : user
        ));
        setEditingUser(null);
        setError('');
      } else {
        setModalError(response.data.message || 'Failed to update user');
        setShowErrorModal(true);
      }
    } catch (err) {
      setModalError(
        `Failed to update user: ${err.response?.status} - ${err.response?.statusText}. ` +
        (err.response?.data?.message || err.response?.data?.error || 'Unknown error')
      );
      setShowErrorModal(true);
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      const response = await axios.delete(`https://notaty-6ryr.onrender.com/api/v1/admin`, {
        data: {
          userId: userId,
          type: "delete"
        },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setUsers(users.filter(user => user._id !== userId));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#03178C]/80 backdrop-blur-md rounded-lg shadow-xl p-8 border border-[#034AA6]/30">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-white">Loading users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#03178C]/80 backdrop-blur-md rounded-lg shadow-xl p-8 border border-[#034AA6]/30">
        <div className="bg-red-500/20 border border-red-500 text-white px-4 py-2 rounded">
          {error}
          <button 
            onClick={() => setError('')}
            className="ml-2 text-white/70 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#03178C]/80 backdrop-blur-md rounded-lg shadow-xl p-8 border border-[#034AA6]/30">
      <h2 className="text-2xl font-bold text-white mb-6">All Users</h2>
      
      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowErrorModal(false)} />
          <div className="relative bg-[#03178C] border border-[#034AA6]/30 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Error</h3>
              <button
                onClick={() => setShowErrorModal(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-white/90 mb-6">{modalError}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-4 py-2 bg-[#034AA6] text-white rounded-lg hover:bg-[#034AA6]/80 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-white/70 border-b border-[#034AA6]/30">
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
              <tr key={user._id} className={`text-white border-b border-[#034AA6]/30 ${user.isBlocked ? 'opacity-50' : ''}`}>
                <td className="py-4">
                  {editingUser === user._id ? (
                    <input
                      type="text"
                      name="name"
                      value={editForm.name}
                      onChange={handleEditInputChange}
                      className="w-full px-2 py-1 rounded bg-[#034AA6]/50 border border-[#034AA6] text-white"
                    />
                  ) : (
                    user.name
                  )}
                </td>
                <td className="py-4">
                  {editingUser === user._id ? (
                    <input
                      type="text"
                      name="username"
                      value={editForm.username}
                      onChange={handleEditInputChange}
                      className="w-full px-2 py-1 rounded bg-[#034AA6]/50 border border-[#034AA6] text-white"
                    />
                  ) : (
                    user.username
                  )}
                </td>
                <td className="py-4">
                  {editingUser === user._id ? (
                    <input
                      type="password"
                      name="password"
                      value={editForm.password}
                      onChange={handleEditInputChange}
                      className="w-full px-2 py-1 rounded bg-[#034AA6]/50 border border-[#034AA6] text-white"
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>{showPasswords[user._id] ? user.password : '••••••••'}</span>
                      <button
                        onClick={() => togglePasswordVisibility(user._id)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {showPasswords[user._id] ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </td>
                <td className="py-4">
                  {user.isBlocked ? (
                    <span className="text-red-400">Blocked</span>
                  ) : (
                    <span className="text-green-400">Active</span>
                  )}
                </td>
                <td className="py-4">
                  <div className="flex space-x-3">
                    {editingUser === user._id ? (
                      <>
                        <button
                          onClick={handleEditSubmit}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors duration-200"
                          title="Save Changes"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="p-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors duration-200"
                          title="Cancel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors duration-200"
                          title="Edit User"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {user.role !== 'admin' && (
                          user.isBlocked ? (
                            <button
                              onClick={() => handleUnblock(user._id)}
                              className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors duration-200"
                              title="Unblock User"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlock(user._id)}
                              className="p-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors duration-200"
                              title="Block User"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="py-4">
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => handleDelete(user._id)}
                      className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors duration-200"
                      title="Delete User"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
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