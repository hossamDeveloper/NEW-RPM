import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../App';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import logo from '../assets/logo.png';

const linkIcons = [
  // Home
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-6 0h6" /></svg>
  ),
  // Flow Calculate
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  // Flow Search
  (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
  )
];

const Navbar = () => {
  const { handleLogout } = useContext(AuthContext);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { userRole } = useContext(AuthContext);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Only show Flow Calculate for admin
  const navLinks = [
    { path: '/', label: 'Home' },
    ...(userRole === 'admin' ? [{ path: '/flow-calculate', label: 'Flow Calculate' }] : []),
    { path: '/flow-search', label: 'Flow Search' }
  ];

  return (
    <nav className="bg-[#021F59]/90 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="RPM Logo" className="h-12 w-auto" />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link, idx) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center ${
                  isActive(link.path)
                    ? 'bg-[#034AA6] text-white'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {linkIcons[idx]}{link.label}
              </Link>
            ))}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors duration-200"
            >
              Logout
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
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

      {/* Mobile Menu Drawer - Modern Design with Portal */}
      {isMenuOpen && createPortal(
        <div className="fixed inset-0 z-[9999999999]">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[9999999999]" onClick={() => setIsMenuOpen(false)} />
          {/* Drawer */}
          <div className="absolute top-0 right-0 h-full w-72 max-w-full bg-[#021F59]/95 border-l border-white/10 shadow-2xl flex flex-col pt-6 pb-6 px-4 animate-slideIn rounded-l-2xl z-[9999999999]">
            {/* Close Button */}
            <button
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-bold focus:outline-none shadow"
              aria-label="Close menu"
            >
              &times;
            </button>
            {/* Menu Title */}
            <div className="text-left mb-8 mt-2 pl-14">
              <h2 className="text-xl font-bold text-white tracking-wide drop-shadow">Menu</h2>
            </div>
            {/* Links */}
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
            {/* Logout Button */}
            <button
              onClick={() => {
                handleLogout();
                setIsMenuOpen(false);
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