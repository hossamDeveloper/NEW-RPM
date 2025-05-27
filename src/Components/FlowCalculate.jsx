import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAllRpmPoints,
  setCalculatedPoints,
  setSelectedRpm,
  setNextRpmPoints,
  setAllDataGenerated
} from '../redux/flowSlice';

const FlowCalculate = () => {
  const dispatch = useDispatch();
  const {
    allRpmPoints,
    calculatedPoints,
    selectedRpm,
    nextRpmPoints,
    allDataGenerated
  } = useSelector((state) => state.flow);

  const initialPoint = {
    rpm: '',
    flowRate: '',
    totalPressure: '',
    outletVelocity: '',
    brakePower: '',
    efficiency: ''
  };

  const [dataPoints, setDataPoints] = useState([
    { ...initialPoint },
    { ...initialPoint },
    { ...initialPoint },
    { ...initialPoint },
    { ...initialPoint }
  ]);

  const [quadraticCoefficients, setQuadraticCoefficients] = useState({
    a: 0,
    b: 0,
    c: 0
  });

  const [showResults, setShowResults] = useState(false);
  const [nextRpm, setNextRpm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (index, field, value) => {
    if (field === 'rpm') {
      const rpmValue = parseFloat(value);
      if (!isNaN(rpmValue) && (rpmValue < 900 || rpmValue > 3000)) {
        setError('RPM must be between 900 and 3000.');
        return;
      }
    }
    setError('');
    
    const newDataPoints = [...dataPoints];
    newDataPoints[index] = {
      ...newDataPoints[index],
      [field]: value
    };
    setDataPoints(newDataPoints);
  };

  // Function to generate efficiency values by interpolating between input points
  // For the 5 sample points (65, 70, 72, 70, 63), they appear at indices 0, 249, 499, 749, 999
  const generateInterpolatedEfficiency = (index, validPoints) => {
    // Default efficiency values in case we don't have enough input data
    const defaultEfficiencies = [65, 70, 72, 70, 63];
    
    let efficiencies = [];
    
    // If we have valid points with efficiency values, use those
    if (validPoints && validPoints.length >= 2) {
      efficiencies = validPoints.map(point => 
        parseFloat(point.efficiency || '65')
      );
    } else {
      // Otherwise use the default values
      efficiencies = defaultEfficiencies;
    }
    
    const displayIndex = index + 1;
    const keyPoints = [1, 250, 500, 750, 1000];
    
    // Check if this display index is a key point
    const keyPointIndex = keyPoints.indexOf(displayIndex);
    if (keyPointIndex !== -1 && keyPointIndex < efficiencies.length) {
      return efficiencies[keyPointIndex].toFixed(4);
    }
    
    // Find which segment this index belongs to
    let segment = 0;
    for (let i = 1; i < keyPoints.length; i++) {
      if (displayIndex < keyPoints[i]) {
        segment = i - 1;
        break;
      }
    }
    
    // Get the start and end points for this segment
    const startIndex = keyPoints[segment];
    const endIndex = keyPoints[segment + 1];
    const startValue = efficiencies[segment];
    const endValue = efficiencies[segment + 1];
    
    // Calculate progress through the segment with enhanced smoothing
    const progress = (displayIndex - startIndex) / (endIndex - startIndex);
    
    // Use enhanced smooth interpolation for efficiency
    const t = (1 - Math.cos(progress * Math.PI)) / 2;
    const smoothT = Math.pow(t, 1.2); // Add extra smoothing
    
    // Calculate interpolated efficiency with additional smoothing
    const interpolatedValue = startValue + (endValue - startValue) * smoothT;
    
    return interpolatedValue.toFixed(4);
  };

  // Function to load example data
  const loadExampleData = () => {
    const exampleData = [
      { rpm: 900, flowRate: 1.575, totalPressure: 97.2, outletVelocity: 0.190774, brakePower: 0.190773692, efficiency: 65 },
      { rpm: 900, flowRate: 1.9125, totalPressure: 	87.47, outletVelocity: 0.206144, brakePower: 0.206144277, efficiency: 70 },
      { rpm: 900, flowRate: 2.16, totalPressure: 72.9, outletVelocity: 0.177147, brakePower: 0.177147, efficiency: 72 },
      { rpm: 900, flowRate: 2.376, totalPressure: 55.065, outletVelocity: 0.155889, brakePower: 0.15588936, efficiency: 70 },
      { rpm: 900, flowRate: 2.52, totalPressure: 40.5, outletVelocity: 0.13122, brakePower: 0.13122, efficiency: 63 }
    ];
    setDataPoints(exampleData);
  };

  const calculateQuadraticCoefficients = (points) => {
    // Get points 1, 3, and 5 (0-based index: 0, 2, 4)
    const point1 = points[0];
    const point3 = points[2];
    const point5 = points[4];

    // Extract x (flowRate) and y (totalPressure) values
    const x1 = parseFloat(point1.flowRate);
    const y1 = parseFloat(point1.totalPressure);
    const x3 = parseFloat(point3.flowRate);
    const y3 = parseFloat(point3.totalPressure);
    const x5 = parseFloat(point5.flowRate);
    const y5 = parseFloat(point5.totalPressure);

    // Calculate coefficients using the three points
    // Using the system of equations:
    // y1 = ax1² + bx1 + c
    // y3 = ax3² + bx3 + c
    // y5 = ax5² + bx5 + c

    // Calculate determinants
    const det = (x1 * x1 * x3) + (x3 * x3 * x5) + (x5 * x5 * x1) - 
                (x1 * x3 * x3) - (x3 * x5 * x5) - (x5 * x1 * x1);

    const detA = (y1 * x3) + (y3 * x5) + (y5 * x1) - 
                 (x1 * y3) - (x3 * y5) - (x5 * y1);

    const detB = (x1 * x1 * y3) + (x3 * x3 * y5) + (x5 * x5 * y1) - 
                 (y1 * x3 * x3) - (y3 * x5 * x5) - (y5 * x1 * x1);

    const detC = (x1 * x1 * x3 * y5) + (x3 * x3 * x5 * y1) + (x5 * x5 * x1 * y3) - 
                 (y1 * x3 * x5 * x5) - (y3 * x5 * x1 * x1) - (y5 * x1 * x3 * x3);

    // Calculate coefficients
    const a = detA / det;
    const b = detB / det;
    const c = detC / det;

    return { a, b, c };
  };

  const generatePoints = (coeffs, basePoints) => {
    const validPoints = basePoints.filter(point => 
      point.flowRate !== '' && point.totalPressure !== '' && point.efficiency !== ''
    );
    
    if (validPoints.length < 2) return [];

    const sortedPoints = [...validPoints].sort((a, b) => 
      parseFloat(a.flowRate) - parseFloat(b.flowRate)
    );
    
    const firstPoint = sortedPoints[0];
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    
    const minFlow = parseFloat(firstPoint.flowRate);
    const maxFlow = parseFloat(lastPoint.flowRate);
    const rpm = firstPoint.rpm || 900;
    
    const PI = Math.PI;
    const DIAMETER = 0.63;
    const DIAMETER_SQUARED = DIAMETER * DIAMETER;
    const VELOCITY_CONSTANT = 4 / (PI * DIAMETER_SQUARED);
    
    const generatedPoints = [];

    // Define the key points that must be included exactly
    const keyPoints = [
      { index: 0, flowRate: parseFloat(firstPoint.flowRate), totalPressure: parseFloat(firstPoint.totalPressure), efficiency: parseFloat(firstPoint.efficiency) },
      { index: 249, flowRate: parseFloat(sortedPoints[1].flowRate), totalPressure: parseFloat(sortedPoints[1].totalPressure), efficiency: parseFloat(sortedPoints[1].efficiency) },
      { index: 499, flowRate: parseFloat(sortedPoints[2].flowRate), totalPressure: parseFloat(sortedPoints[2].totalPressure), efficiency: parseFloat(sortedPoints[2].efficiency) },
      { index: 749, flowRate: parseFloat(sortedPoints[3].flowRate), totalPressure: parseFloat(sortedPoints[3].totalPressure), efficiency: parseFloat(sortedPoints[3].efficiency) },
      { index: 999, flowRate: parseFloat(lastPoint.flowRate), totalPressure: parseFloat(lastPoint.totalPressure), efficiency: parseFloat(lastPoint.efficiency) }
    ];

    // Calculate flow rate steps between key points with high precision
    const calculateFlowRate = (index) => {
      let segment = 0;
      for (let i = 1; i < keyPoints.length; i++) {
        if (index < keyPoints[i].index) {
          segment = i - 1;
          break;
        }
      }

      const startPoint = keyPoints[segment];
      const endPoint = keyPoints[segment + 1];
      const segmentLength = endPoint.index - startPoint.index;
      const progress = (index - startPoint.index) / segmentLength;

      // Use smooth interpolation for flow rate
      const t = (1 - Math.cos(progress * Math.PI)) / 2;
      const smoothT = Math.pow(t, 1.1); // Add slight smoothing
      
      const flowRate = startPoint.flowRate + (endPoint.flowRate - startPoint.flowRate) * smoothT;
      
      return Number(flowRate.toFixed(6));
    };

    // Calculate pressure using quadratic equation with high precision
    const calculatePressure = (flowRate) => {
      const totalPressure = (coeffs.a * flowRate * flowRate) + 
                          (coeffs.b * flowRate) + 
                          coeffs.c;

      return Number(totalPressure.toFixed(6));
    };

    // Calculate brake power with smooth curve interpolation
    const calculateBrakePower = (flowRate, totalPressure, efficiency) => {
      // Convert all inputs to numbers with maximum precision
      const flowRateNum = Number(flowRate);
      const totalPressureNum = Number(totalPressure);
      const efficiencyDecimal = Number(efficiency) / 100;
      
      // Calculate base brake power with maximum precision
      const basePower = (flowRateNum * totalPressureNum) / (efficiencyDecimal * 1000);
      
      // Apply smooth curve interpolation
      // Using a very small smoothing factor to maintain accuracy while reducing oscillations
      const smoothingFactor = 0.0005; // Reduced from previous value
      const smoothPower = basePower * (1 + Math.sin(flowRateNum * Math.PI * 0.5) * smoothingFactor);
      
      // Return with 6 decimal places precision
      return Number(smoothPower.toFixed(6));
    };

    // Verify point satisfies equation with high precision
    const verifyPoint = (flowRate, totalPressure) => {
      const calculatedPressure = calculatePressure(flowRate);
      const error = Math.abs(calculatedPressure - totalPressure);
      const errorPercentage = (error / totalPressure) * 100;
      
      return errorPercentage <= 0.0001; // Accept only if error is less than 0.0001%
    };

    for (let i = 0; i < 1000; i++) {
      let flowRate, totalPressure, efficiency;

      // Check if this is a key point
      const keyPoint = keyPoints.find(kp => kp.index === i);
      if (keyPoint) {
        flowRate = keyPoint.flowRate;
        totalPressure = keyPoint.totalPressure;
        efficiency = keyPoint.efficiency;
      } else {
        // Calculate values with enhanced smoothing
        flowRate = calculateFlowRate(i);
        totalPressure = calculatePressure(flowRate);
        efficiency = generateInterpolatedEfficiency(i, sortedPoints);
      }
      
      const velocity = VELOCITY_CONSTANT * flowRate;
      const brakePower = calculateBrakePower(flowRate, totalPressure, efficiency);
      
      generatedPoints.push({
        rpm: rpm,
        flowRate: flowRate.toFixed(6),
        totalPressure: totalPressure.toFixed(6),
        velocity: velocity.toFixed(6),
        efficiency: efficiency,
        brakePower: brakePower.toFixed(6)
      });
    }
    
    return generatedPoints;
  };

  const generateNextRpmPoints = (basePoints, currentRpm, newRpm) => {
    const rpmRatio = newRpm / currentRpm;
    const pressureRatio = Math.pow(rpmRatio, 2);
    
    const newPoints = [];
    // Correct velocity constant calculation
    const DIAMETER = 0.63; // diameter in meters
    const velocityConstant = 4 / (Math.PI * Math.pow(DIAMETER, 2));
    
    // Apply scaling laws to each of the 1000 base points
    for (let i = 0; i < 1000; i++) {
      const basePoint = basePoints[i];
      
      // Apply scaling laws
      const flowRate = parseFloat(basePoint.flowRate) * rpmRatio;
      const totalPressure = parseFloat(basePoint.totalPressure) * pressureRatio;
      const efficiency = parseFloat(basePoint.efficiency);
      
      // Calculate velocity using the scaled flow rate
      const velocity = flowRate * velocityConstant;
      
      // Calculate brake power using the scaled values
      const efficiencyDecimal = efficiency / 100;
      const brakePower = (flowRate * totalPressure) / (efficiencyDecimal * 1000);
      
      newPoints.push({
        rpm: newRpm,
        flowRate: Number(flowRate).toFixed(6),
        totalPressure: Number(totalPressure).toFixed(6),
        velocity: Number(velocity).toFixed(6),
        efficiency: Number(efficiency).toFixed(4),
        brakePower: Number(brakePower).toFixed(6)
      });
    }
    
    return newPoints;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validPoints = dataPoints.filter(point => 
      point.flowRate !== '' && point.totalPressure !== ''
    );
    
    if (validPoints.length >= 2) {
      setIsLoading(true);
      
      // Calculate coefficients automatically using points 1, 3, and 5
      const coeffs = calculateQuadraticCoefficients(dataPoints);
      
      // Display Quadratic Equation in console
      console.log('Quadratic Equation:');
      console.log(`y = ${coeffs.a.toFixed(2)}x² + ${coeffs.b.toFixed(2)}x + ${coeffs.c.toFixed(2)}`);
      console.log('Where:');
      console.log('y = Total Pressure');
      console.log('x = Flow Rate');
      console.log('\nPoints used for calculation:');
      console.log(`Point 1: (${dataPoints[0].flowRate}, ${dataPoints[0].totalPressure})`);
      console.log(`Point 3: (${dataPoints[2].flowRate}, ${dataPoints[2].totalPressure})`);
      console.log(`Point 5: (${dataPoints[4].flowRate}, ${dataPoints[4].totalPressure})`);
      
      setQuadraticCoefficients(coeffs);
      const points = generatePoints(coeffs, dataPoints);
      
      dispatch(setCalculatedPoints(points));
      dispatch(setAllDataGenerated(points));
      
      const currentRpm = parseFloat(validPoints[0].rpm) || 900;
      dispatch(setAllRpmPoints({
        [currentRpm]: points
      }));
      
      dispatch(setSelectedRpm(currentRpm));
      dispatch(setNextRpmPoints(points));
      
      setNextRpm((currentRpm + 1).toString());
      setShowResults(true);
      setIsLoading(false);
    } else {
      alert('Please enter at least 2 valid data points with flowRate and totalPressure values.');
    }
  };

  const handleGenerateNextRpm = () => {
    if (!nextRpm || calculatedPoints.length === 0) {
      setError('Please enter a valid RPM value and ensure base points are calculated first.');
      return;
    }
    
    const currentRpm = parseFloat(calculatedPoints[0].rpm);
    const targetRpm = parseFloat(nextRpm);
    
    if (isNaN(targetRpm) || targetRpm <= 0) {
      setError('Please enter a valid positive number for RPM.');
      return;
    }

    if (targetRpm <= currentRpm) {
      setError('Please enter an RPM value greater than the current RPM: ' + currentRpm);
      return;
    }

    if (targetRpm < 900 || targetRpm > 3000) {
      setError('RPM must be between 900 and 3000.');
      return;
    }
    
    setError('');
    setIsLoading(true);
    const allPoints = { ...allRpmPoints };
    let allGeneratedData = [...calculatedPoints];
    
    for (let rpm = currentRpm + 1; rpm <= targetRpm; rpm++) {
      const rpmPoints = generateNextRpmPoints(calculatedPoints, currentRpm, rpm);
      allPoints[rpm] = rpmPoints;
      allGeneratedData = [...allGeneratedData, ...rpmPoints];
    }
    
    dispatch(setAllRpmPoints(allPoints));
    dispatch(setAllDataGenerated(allGeneratedData));
    
    const firstGeneratedRpm = currentRpm + 1;
    dispatch(setSelectedRpm(firstGeneratedRpm));
    dispatch(setNextRpmPoints(allPoints[firstGeneratedRpm]));
    setIsLoading(false);
  };

  const handleRpmSelect = (e) => {
    const selectedRpm = parseInt(e.target.value);
    dispatch(setSelectedRpm(selectedRpm));
    dispatch(setNextRpmPoints(allRpmPoints[selectedRpm]));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#021F59] to-[#03178C] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-white/20"
        >
          <h1 className="text-3xl font-bold text-white mb-8 text-center">Selector</h1>
          
          {/* Input Form */}
          <div className="space-y-4 mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              {/* Headers - Hidden on mobile */}
              <div className="hidden md:grid grid-cols-5 gap-4 text-white/80 font-medium mb-2">
                <div>Point</div>
                <div>RPM</div>
                <div>Flow Rate</div>
                <div>Total Pressure</div>
                <div>Efficiency</div>
              </div>
              {dataPoints.map((point, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center py-4 border-b border-white/10 last:border-0"
                >
                  {/* Mobile View */}
                  <div className="md:hidden grid grid-cols-2 gap-2 mb-2">
                    <div className="font-medium text-white/80">Point:</div>
                  <div className="font-medium text-white">Point {index + 1}</div>
                  </div>
                  
                  {/* Desktop View */}
                  <div className="hidden md:block font-medium text-white">Point {index + 1}</div>
                  
                  {/* Mobile View */}
                  <div className="md:hidden grid grid-cols-2 gap-2">
                    <div className="font-medium text-white/80">RPM:</div>
                  <div>
                      <input
                        type="number"
                        value={point.rpm}
                        onChange={(e) => handleInputChange(index, 'rpm', e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                        placeholder="RPM"
                      />
                    </div>
                  </div>
                  
                  {/* Desktop View */}
                  <div className="hidden md:block">
                    <input
                      type="number"
                      value={point.rpm}
                      onChange={(e) => handleInputChange(index, 'rpm', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="RPM"
                    />
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden grid grid-cols-2 gap-2">
                    <div className="font-medium text-white/80">Flow Rate:</div>
                  <div>
                      <input
                        type="number"
                        value={point.flowRate}
                        onChange={(e) => handleInputChange(index, 'flowRate', e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                        placeholder="Flow Rate"
                      />
                    </div>
                  </div>
                  
                  {/* Desktop View */}
                  <div className="hidden md:block">
                    <input
                      type="number"
                      value={point.flowRate}
                      onChange={(e) => handleInputChange(index, 'flowRate', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Flow Rate"
                    />
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden grid grid-cols-2 gap-2">
                    <div className="font-medium text-white/80">Total Pressure:</div>
                  <div>
                      <input
                        type="number"
                        value={point.totalPressure}
                        onChange={(e) => handleInputChange(index, 'totalPressure', e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                        placeholder="Total Pressure"
                      />
                    </div>
                  </div>
                  
                  {/* Desktop View */}
                  <div className="hidden md:block">
                    <input
                      type="number"
                      value={point.totalPressure}
                      onChange={(e) => handleInputChange(index, 'totalPressure', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Total Pressure"
                    />
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden grid grid-cols-2 gap-2">
                    <div className="font-medium text-white/80">Efficiency:</div>
                  <div>
                      <input
                        type="number"
                        value={point.efficiency}
                        onChange={(e) => handleInputChange(index, 'efficiency', e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                        placeholder="Efficiency"
                      />
                    </div>
                  </div>
                  
                  {/* Desktop View */}
                  <div className="hidden md:block">
                    <input
                      type="number"
                      value={point.efficiency}
                      onChange={(e) => handleInputChange(index, 'efficiency', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Efficiency"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadExampleData}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
            >
              Load All Example Data
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
            >
              Calculate
            </motion.button>
          </div>

          {/* Results Section */}
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Results</h2>
              
              {/* Next RPM Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/80 mb-2">Enter Next RPM</label>
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                      type="number"
                      value={nextRpm}
                      onChange={(e) => {
                        setNextRpm(e.target.value);
                        setError('');
                      }}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Enter RPM"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGenerateNextRpm}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
                      >
                      Generate
                    </motion.button>
                  </div>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-500 text-sm font-medium"
                    >
                      {error}
                    </motion.p>
                  )}
              </div>

              {/* RPM Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/80 mb-2">Select RPM</label>
                <div className="overflow-x-auto">
                  <div className="flex space-x-2 pb-2 min-w-min">
                    {Object.keys(allRpmPoints).sort((a, b) => Number(a) - Number(b)).map((rpm) => (
                      <motion.button
                        key={rpm}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRpmSelect({ target: { value: rpm } })}
                        className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                          selectedRpm === Number(rpm)
                            ? 'bg-[#034AA6] text-white'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {rpm} RPM
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Results Table */}
              {selectedRpm && allRpmPoints[selectedRpm] && (
                <div className="overflow-x-auto">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-white">
                      <thead className="sticky top-0 bg-[#021F59]/80 backdrop-blur-sm">
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-2 text-left">Flow Rate</th>
                          <th className="px-4 py-2 text-left">Total Pressure</th>
                          <th className="px-4 py-2 text-left">Velocity</th>
                          <th className="px-4 py-2 text-left">Brake Power</th>
                          <th className="px-4 py-2 text-left">Efficiency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRpmPoints[selectedRpm].map((point, index) => (
                          <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-2">{point.flowRate}</td>
                            <td className="px-4 py-2">{point.totalPressure}</td>
                            <td className="px-4 py-2">{point.velocity}</td>
                            <td className="px-4 py-2">{point.brakePower}</td>
                            <td className="px-4 py-2">{point.efficiency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default FlowCalculate; 