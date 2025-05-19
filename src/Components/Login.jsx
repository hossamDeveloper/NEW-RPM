import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../App';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { handleLogin } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Add login validation logic here
      if (username === 'admin' && password === 'admin123') {
        await handleLogin('admin');
        navigate('/');
      } else if (username === 'user' && password === 'user123') {
        await handleLogin('user');
        navigate('/');
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('An error occurred during login');
      console.error('Login error:', err);
    }
  };

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-white mb-2">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6] text-white placeholder-white/50 focus:outline-none focus:border-[#035AA6]"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-white mb-2">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#03178C]/50 border border-[#034AA6] text-white placeholder-white/50 focus:outline-none focus:border-[#035AA6]"
                placeholder="Enter your password"
                required
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full bg-gradient-to-r from-[#03178C] to-[#034AA6] text-white py-2 rounded-lg hover:from-[#034AA6] hover:to-[#035AA6] transition-all duration-200"
            >
              Login
            </motion.button>
          </form>

          <div className="mt-4 text-center text-white/70 text-sm">
            <p>Test Credentials:</p>
            <p>Admin: admin / admin123</p>
            <p>User: user / user123</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login; 