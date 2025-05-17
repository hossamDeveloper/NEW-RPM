import React from 'react';
import FlowCalculate from '../components/FlowCalculate';

const FlowCalculatePage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className='text-2xl font-bold text-center mb-6'>Flow Calculation System</h1>
      
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Flow Rate Calculator</h2>
        <p className="text-gray-600 mb-6">
          This tool helps you calculate flow rates, pressures, efficiencies and more for your system.
          Enter your parameters below and generate up to 1000 interpolated points.
        </p>
        
        <FlowCalculate />
      </div>
      
      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>Flow Calculation System © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default FlowCalculatePage; 