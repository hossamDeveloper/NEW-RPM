import React from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';

const Loading = () => {
  const imageVariants = {
    initial: { scale: 0.95, opacity: 0.9 },
    animate: {
      scale: [0.95, 1, 0.95],
      opacity: [0.9, 1, 0.9],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
    }
  };

  return (
    <motion.img
      src={logo}
      alt="Loading..."
      variants={imageVariants}
      initial="initial"
      animate="animate"
      className="w-[350px] h-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.15)]"
    />
  );
};

export default Loading; 