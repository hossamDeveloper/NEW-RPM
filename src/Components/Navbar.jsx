import React, { useMemo, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/authSlice';
import logo from '../assets/logo.png';

const linkIcons = [
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-6 0h6" /></svg>
  ),
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
  ),
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
];

const Navbar = () => {
  const dispatch = useDispatch();
  const userRole = useSelector((state) => state.auth.role);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  const navLinks = useMemo(() => (
    [
      { path: '/', label: 'Home' },
      ...(userRole === 'admin' ? [{ path: '/flow-calculate', label: 'Flow Calculate' }] : []),
      { path: '/flow-search', label: 'Selector' },
      ...(userRole === 'admin' ? [{ path: '/control', label: 'Control' }] : [])
    ]
  ), [userRole]);

  return (
    <nav className="bg-gradient-to-r from-[#60A5FA] to-[#FDBA74] backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[73px]">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="RPM Logo" className="h-16 w-auto" />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link, idx) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center h-[45px] ${
                  isActive(link.path)
                    ? 'bg-[#60a5facb] text-white'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {linkIcons[idx]}{link.label}
              </Link>
            ))}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                dispatch(logout());
                navigate('/login');
              }}
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors duration-200"
            >
              Logout
            </motion.button>
          </div>

          <div className="md:hidden">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white/80 hover:text-white focus:outline-none p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
            >
              {isMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {isMenuOpen && createPortal(
        <div className="fixed inset-0 z-[9999999999]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[9999999999]" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 max-w-full bg-[#021F59]/95 border-l border-white/10 shadow-2xl flex flex-col pt-6 pb-6 px-4 animate-slideIn rounded-l-2xl z-[9999999999]">
            <button
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-bold focus:outline-none shadow"
              aria-label="Close menu"
            >
              &times;
            </button>
            <div className="text-left mb-8 mt-2 pl-14">
              <h2 className="text-xl font-bold text-white tracking-wide drop-shadow">Menu</h2>
            </div>
            <div className="flex-1 flex flex-col space-y-2 mt-2">
              {navLinks.map((link, idx) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                    isActive(link.path)
                      ? 'bg-[#034AA6] text-white shadow-lg shadow-[#034AA6]/30'
                      : 'text-white/90 hover:bg-white/10 hover:shadow-md'
                  }`}
                >
                  {linkIcons[idx]}{link.label}
                </Link>
              ))}
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                setIsMenuOpen(false);
                navigate('/login');
              }}
              className="w-full mt-4 px-4 py-3 bg-red-600 text-white rounded-lg text-base font-semibold hover:bg-red-700 transition-all duration-200 shadow-lg shadow-red-600/30"
            >
              Logout
            </button>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
};

export default Navbar; 