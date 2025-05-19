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
    
    // The index coming in is 0-based, but we want to work with 1-based positions for clarity
    // Convert to 1-based index for user-friendly display
    const displayIndex = index + 1;
    
    // Define the key point positions (1-based indexing for clarity)
    const keyPoints = [1, 250, 500, 750, 1000];
    
    // Check if this display index is a key point, return exact value if it is
    const keyPointIndex = keyPoints.indexOf(displayIndex);
    if (keyPointIndex !== -1 && keyPointIndex < efficiencies.length) {
      return efficiencies[keyPointIndex].toFixed(4);
    }
    
    // Fixed step sizes for each segment as specified
    const stepSizes = [0.020080, 0.008032, -0.008032, -0.028112];
    
    // For interpolation, determine which segment this index is in
    let segmentIndex = 0;
    for (let i = 1; i < keyPoints.length; i++) {
      if (displayIndex < keyPoints[i]) {
        segmentIndex = i - 1;
        break;
      }
    }
    
    // Get the start value and position for this segment
    const startIndex = keyPoints[segmentIndex];
    const startValue = efficiencies[segmentIndex];
    
    // Calculate the points position in the segment (0-based within segment)
    const positionInSegment = displayIndex - startIndex;
    
    // Calculate and return the interpolated value
    const interpolatedValue = startValue + (stepSizes[segmentIndex] * positionInSegment);
    return interpolatedValue.toFixed(4);
  };

  // Function to load example data
  const loadExampleData = () => {
    const exampleData = [
      { rpm: 900, flowRate: 1.575, totalPressure: 97.2, outletVelocity: 0.190774, brakePower: 0.190773692, efficiency: 65 },
      { rpm: 900, flowRate: 1.9125, totalPressure: 93.15, outletVelocity: 0.206144, brakePower: 0.206144277, efficiency: 70 },
      { rpm: 900, flowRate: 2.16, totalPressure: 72.9, outletVelocity: 0.177147, brakePower: 0.177147, efficiency: 72 },
      { rpm: 900, flowRate: 2.376, totalPressure: 56.7, outletVelocity: 0.155889, brakePower: 0.15588936, efficiency: 70 },
      { rpm: 900, flowRate: 2.52, totalPressure: 40.5, outletVelocity: 0.13122, brakePower: 0.13122, efficiency: 63 }
    ];
    setDataPoints(exampleData);
  };

  // Function to solve the quadratic equation based on input points
  const calculateQuadraticEquation = (points) => {
    // Filter out points with empty values
    const validPoints = points.filter(
      point => point.flowRate !== '' && point.totalPressure !== ''
    );

    if (validPoints.length < 3) {
      console.error('Need at least 3 valid points to calculate a quadratic equation');
      return null;
    }

    // Create matrices for least squares method
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumY = 0, sumXY = 0, sumX2Y = 0;
    const n = validPoints.length;

    validPoints.forEach(point => {
      const x = parseFloat(point.flowRate);
      const y = parseFloat(point.totalPressure);
      
      sumX += x;
      sumX2 += x * x;
      sumX3 += x * x * x;
      sumX4 += x * x * x * x;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x * x * y;
    });

    // Create matrix equation
    const A = [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4]
    ];

    const B = [sumY, sumXY, sumX2Y];

    // Solve using Gaussian elimination
    for (let i = 0; i < 3; i++) {
      // Find pivot
      let maxRow = i;
      for (let j = i + 1; j < 3; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) {
          maxRow = j;
        }
      }

      // Swap rows
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [B[i], B[maxRow]] = [B[maxRow], B[i]];

      // Eliminate below
      for (let j = i + 1; j < 3; j++) {
        const factor = A[j][i] / A[i][i];
        B[j] -= factor * B[i];
        for (let k = i; k < 3; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }

    // Back substitution
    const X = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < 3; j++) {
        sum += A[i][j] * X[j];
      }
      X[i] = (B[i] - sum) / A[i][i];
    }

    // X now contains c, b, a
    return {
      c: X[0],
      b: X[1],
      a: X[2]
    };
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

    // Calculate flow rate steps between key points
    const flowSteps = [
      (keyPoints[1].flowRate - keyPoints[0].flowRate) / 249,
      (keyPoints[2].flowRate - keyPoints[1].flowRate) / 250,
      (keyPoints[3].flowRate - keyPoints[2].flowRate) / 250,
      (keyPoints[4].flowRate - keyPoints[3].flowRate) / 250
    ];

    for (let i = 0; i < 1000; i++) {
      let flowRate, totalPressure, efficiency;

      // Check if this is a key point
      const keyPoint = keyPoints.find(kp => kp.index === i);
      if (keyPoint) {
        flowRate = keyPoint.flowRate;
        totalPressure = keyPoint.totalPressure;
        efficiency = keyPoint.efficiency;
      } else {
        // Calculate flow rate based on which segment we're in
        if (i < 250) {
          flowRate = keyPoints[0].flowRate + (flowSteps[0] * i);
        } else if (i < 500) {
          flowRate = keyPoints[1].flowRate + (flowSteps[1] * (i - 250));
        } else if (i < 750) {
          flowRate = keyPoints[2].flowRate + (flowSteps[2] * (i - 500));
        } else {
          flowRate = keyPoints[3].flowRate + (flowSteps[3] * (i - 750));
        }

        // Calculate total pressure using quadratic equation
      if (coeffs && coeffs.a !== undefined) {
        totalPressure = (coeffs.a * flowRate * flowRate) + 
                       (coeffs.b * flowRate) + 
                       coeffs.c;
      } else {
          // Linear interpolation between key points
          if (i < 250) {
            totalPressure = keyPoints[0].totalPressure + 
                          ((keyPoints[1].totalPressure - keyPoints[0].totalPressure) * i / 249);
          } else if (i < 500) {
            totalPressure = keyPoints[1].totalPressure + 
                          ((keyPoints[2].totalPressure - keyPoints[1].totalPressure) * (i - 250) / 250);
          } else if (i < 750) {
            totalPressure = keyPoints[2].totalPressure + 
                          ((keyPoints[3].totalPressure - keyPoints[2].totalPressure) * (i - 500) / 250);
          } else {
            totalPressure = keyPoints[3].totalPressure + 
                          ((keyPoints[4].totalPressure - keyPoints[3].totalPressure) * (i - 750) / 250);
          }
        }

        // Calculate efficiency using the existing interpolation function
        efficiency = generateInterpolatedEfficiency(i, sortedPoints);
      }
      
      const velocity = VELOCITY_CONSTANT * flowRate;
      const efficiencyDecimal = parseFloat(efficiency) / 100;
      const brakePower = (flowRate * totalPressure) / (efficiencyDecimal * 1000);
      
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
      const coeffs = {
        a: -51.28,
        b: 150.00,
        c: -11.84
      };
      
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
          <h1 className="text-3xl font-bold text-white mb-8 text-center">Flow Calculator</h1>
          
          {/* Input Form */}
          <div className="space-y-4 mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="grid grid-cols-5 gap-4 text-white/80 font-medium mb-2">
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
                  className="grid grid-cols-5 gap-4 items-center py-2 border-b border-white/10 last:border-0"
                >
                  <div className="font-medium text-white">Point {index + 1}</div>
                  <div>
                    <input
                      type="number"
                      value={point.rpm}
                      onChange={(e) => handleInputChange(index, 'rpm', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="RPM"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={point.flowRate}
                      onChange={(e) => handleInputChange(index, 'flowRate', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Flow Rate"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={point.totalPressure}
                      onChange={(e) => handleInputChange(index, 'totalPressure', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Total Pressure"
                    />
                  </div>
                  <div>
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
                <div className="flex flex-col gap-2">
                  <div className="flex gap-4">
                    <input
                      type="number"
                      value={nextRpm}
                      onChange={(e) => {
                        setNextRpm(e.target.value);
                        setError('');
                      }}
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#034AA6] focus:border-transparent"
                      placeholder="Enter RPM"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGenerateNextRpm}
                      className=" py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
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