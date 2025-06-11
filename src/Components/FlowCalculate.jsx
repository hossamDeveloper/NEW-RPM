import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  setAllRpmPoints,
  setCalculatedPoints,
  setSelectedRpm,
  setNextRpmPoints,
  setAllDataGenerated
} from '../redux/flowSlice';

const API_URL = 'https://notaty-6ryr.onrender.com/api/v1/model/';

const FlowCalculate = () => {
  const dispatch = useDispatch();
  const {
    allRpmPoints,
    calculatedPoints,
    selectedRpm,
    nextRpmPoints,
    allDataGenerated
  } = useSelector((state) => state.flow);

  const [fanType, setFanType] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [diameter, setDiameter] = useState(0.63); // Default value

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
      if (!isNaN(rpmValue) && (rpmValue < 250 || rpmValue > 3750)) {
        setError('RPM must be between 250 and 3750.');
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

  useEffect(() => {
    const fetchModels = async () => {
      if (!fanType) return;
      
      setIsLoadingModels(true);
      setModelError('');
      try {
        const token = localStorage.getItem('token');
        console.log('Fetching models for type:', fanType);
        const response = await axios.get(`${API_URL}?type=${fanType}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Models API Response:', response.data);
        
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          setModels(response.data.data);
          setModelError('');
        } else {
          setModelError('No models found for this type');
          setModels([]);
        }
      } catch (error) {
        setModelError('Failed to fetch models. Please try again.');
        console.error('Error fetching models:', error.response || error);
        setModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, [fanType]);

  // Function to load example data based on selected model
  const loadExampleData = async () => {
    if (!selectedModel) {
      setError('Please select a model first');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Fetching model data for ID:', selectedModel);
      const response = await axios.get(`${API_URL}${selectedModel}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('API Response:', response.data);
      
      const modelData = response.data.data;
      if (modelData && modelData.points && Array.isArray(modelData.points)) {
        // Ensure we have at least 5 points
        const points = modelData.points.slice(0, 5);
        
        // Format the points to match the expected structure
        const formattedPoints = points.map(point => ({
          rpm: point.rpm || 900,
          flowRate: point.flowRate || 0,
          totalPressure: point.totalPressure || 0,
          outletVelocity: point.outletVelocity || 0,
          brakePower: point.brakePower || 0,
          efficiency: point.efficiency || 0
        }));

        console.log('Formatted points:', formattedPoints);
        setDataPoints(formattedPoints);
        setError('');
      } else {
        setError('Selected model does not have valid data points');
        console.error('Invalid model data structure:', modelData);
      }
    } catch (error) {
      setError('Failed to load model data. Please try again.');
      console.error('Error loading model data:', error.response || error);
    }
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

  // Function to calculate diameter from model name
  const calculateDiameter = (modelName) => {
    try {
      // Extract numbers from model name
      const numbers = modelName.match(/\d+/);
      if (numbers) {
        // Convert to number and divide by 1000
        const diameterValue = parseInt(numbers[0]) / 1000;
        setDiameter(diameterValue);
        console.log('diameter', diameterValue)
        return diameterValue;
      }
      return 0.63; // Default value if no numbers found
    } catch (error) {
      console.error('Error calculating diameter:', error);
      return 0.63; // Default value if error occurs
    }
  };

  // Update model selection handler
  const handleModelChange = (e) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    
    // Find the selected model from models array
    const selectedModelData = models.find(model => model._id === modelId);
    if (selectedModelData) {
      calculateDiameter(selectedModelData.name);
    }
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
    const DIAMETER_SQUARED = diameter * diameter;
    const VELOCITY_CONSTANT = 4 / (PI * DIAMETER_SQUARED);
    
    const generatedPoints = [];

    const keyPoints = [
      { index: 0, flowRate: parseFloat(firstPoint.flowRate), totalPressure: parseFloat(firstPoint.totalPressure), efficiency: parseFloat(firstPoint.efficiency) },
      { index: 249, flowRate: parseFloat(sortedPoints[1].flowRate), totalPressure: parseFloat(sortedPoints[1].totalPressure), efficiency: parseFloat(sortedPoints[1].efficiency) },
      { index: 499, flowRate: parseFloat(sortedPoints[2].flowRate), totalPressure: parseFloat(sortedPoints[2].totalPressure), efficiency: parseFloat(sortedPoints[2].efficiency) },
      { index: 749, flowRate: parseFloat(sortedPoints[3].flowRate), totalPressure: parseFloat(sortedPoints[3].totalPressure), efficiency: parseFloat(sortedPoints[3].efficiency) },
      { index: 999, flowRate: parseFloat(lastPoint.flowRate), totalPressure: parseFloat(lastPoint.totalPressure), efficiency: parseFloat(lastPoint.efficiency) }
    ];

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

      const t = (1 - Math.cos(progress * Math.PI)) / 2;
      const smoothT = Math.pow(t, 1.1);
      
      const flowRate = startPoint.flowRate + (endPoint.flowRate - startPoint.flowRate) * smoothT;
      
      return Number(flowRate.toFixed(6));
    };

    const calculatePressure = (flowRate) => {
      const totalPressure = (coeffs.a * flowRate * flowRate) + 
                          (coeffs.b * flowRate) + 
                          coeffs.c;

      return Number(totalPressure.toFixed(6));
    };

    const calculateBrakePower = (flowRate, totalPressure, efficiency) => {
      const flowRateNum = Number(flowRate);
      const totalPressureNum = Number(totalPressure);
      const efficiencyDecimal = Number(efficiency) / 100;
      
      const brakePower = (flowRateNum * totalPressureNum) / (efficiencyDecimal * 1000);
      
      return Number(brakePower.toFixed(6));
    };

    const verifyPoint = (flowRate, totalPressure) => {
      const calculatedPressure = calculatePressure(flowRate);
      const error = Math.abs(calculatedPressure - totalPressure);
      const errorPercentage = (error / totalPressure) * 100;
      
      return errorPercentage <= 0.0001;
    };

    for (let i = 0; i < 1000; i++) {
      let flowRate, totalPressure, efficiency;

      const keyPoint = keyPoints.find(kp => kp.index === i);
      if (keyPoint) {
        flowRate = keyPoint.flowRate;
        totalPressure = keyPoint.totalPressure;
        efficiency = keyPoint.efficiency;
      } else {
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
    // const DIAMETER = 0.63; // diameter in meters
    const velocityConstant = 4 / (Math.PI * Math.pow(diameter, 2));
    
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

    if (targetRpm < 250 || targetRpm > 3750) {
      setError('RPM must be between 250 and 3750.');
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
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Selector</h2>
          
          {/* Fan Type and Model Selection */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <label className="block text-lg font-semibold text-white mb-3">
                Fan Type
              </label>
              <select
                value={fanType}
                onChange={(e) => {
                  setFanType(e.target.value);
                  setSelectedModel('');
                  setModels([]);
                }}
                className="w-full px-4 py-3 bg-[#021F59] border border-blue-400/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="" className="bg-[#021F59]">Select Fan Type</option>
                <option value="axial" className="bg-[#021F59]">Axial</option>
                <option value="centrifugal" className="bg-[#021F59]">Centrifugal</option>
              </select>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <label className="block text-lg font-semibold text-white mb-3">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={handleModelChange}
                disabled={!fanType || isLoadingModels}
                className="w-full px-4 py-3 bg-[#021F59] border border-blue-400/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-[#021F59]/50 disabled:text-white/50"
              >
                <option value="" className="bg-[#021F59]">Select Model</option>
                {models.map((model) => (
                  <option key={model._id} value={model._id} className="bg-[#021F59]">
                    {model.name}
                  </option>
                ))}
              </select>
              {isLoadingModels && (
                <p className="mt-2 text-blue-300 text-sm">Loading models...</p>
              )}
              {modelError && (
                <p className="mt-2 text-red-300 text-sm">{modelError}</p>
              )}
             
            </div>
          </div>

          {/* Data Points Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Data Points</h3>
              <button
                onClick={loadExampleData}
                disabled={!selectedModel}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#021F59] disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200"
              >
                Load Model Data
              </button>
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 text-red-200 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {dataPoints.map((point, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">RPM</label>
                      <input
                        type="number"
                        value={point.rpm}
                        onChange={(e) => handleInputChange(index, 'rpm', e.target.value)}
                        className="w-full px-4 py-2 bg-[#021F59] border border-blue-400/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Flow Rate</label>
                      <input
                        type="number"
                        value={point.flowRate}
                        onChange={(e) => handleInputChange(index, 'flowRate', e.target.value)}
                        className="w-full px-4 py-2 bg-[#021F59] border border-blue-400/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Total Pressure</label>
                      <input
                        type="number"
                        value={point.totalPressure}
                        onChange={(e) => handleInputChange(index, 'totalPressure', e.target.value)}
                        className="w-full px-4 py-2 bg-[#021F59] border border-blue-400/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Efficiency (%)</label>
                      <input
                        type="number"
                        value={point.efficiency}
                        onChange={(e) => handleInputChange(index, 'efficiency', e.target.value)}
                        className="w-full px-4 py-2 bg-[#021F59] border border-blue-400/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                  </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg"
            >
              Calculate
            </motion.button>
          </div>

          {/* Results Section */}
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Results</h3>
              
              {/* Next RPM Input */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Next RPM
                    </label>
                    <input
                      type="number"
                      value={nextRpm}
                      onChange={(e) => setNextRpm(e.target.value)}
                      className="w-full px-4 py-2 bg-[#021F59] border border-blue-400/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="Enter next RPM"
                    />
                  </div>
                  <button
                    onClick={handleGenerateNextRpm}
                    disabled={isLoading}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#021F59] disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Generate Next RPM
                  </button>
                  </div>
                  {error && (
                  <p className="mt-2 text-red-300 text-sm">{error}</p>
                  )}
              </div>

              {/* RPM Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Select RPM
                </label>
                <div className="relative">
                  <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex space-x-2 pb-2 min-w-full">
                      {Object.keys(allRpmPoints)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((rpm) => (
                          <button
                            key={rpm}
                            onClick={() => handleRpmSelect({ target: { value: rpm } })}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 ${
                              selectedRpm === Number(rpm)
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-[#021F59] text-white/80 hover:bg-blue-500/50'
                            }`}
                          >
                            {rpm} RPM
                          </button>
                        ))}
                    </div>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#021F59] to-transparent pointer-events-none"></div>
                </div>
              </div>

              {/* Generated Points Table */}
              <div className="relative mb-6">
                <div className="overflow-x-auto">
                  <div className="max-h-[500px] overflow-y-auto rounded-lg border border-blue-400/30 bg-[#021F59]/50">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[#021F59] z-10">
                        <tr>
                          <th className="px-4 py-3 text-white font-semibold">RPM</th>
                          <th className="px-4 py-3 text-white font-semibold">Flow Rate</th>
                          <th className="px-4 py-3 text-white font-semibold">Total Pressure</th>
                          <th className="px-4 py-3 text-white font-semibold">Velocity</th>
                          <th className="px-4 py-3 text-white font-semibold">Efficiency</th>
                          <th className="px-4 py-3 text-white font-semibold">Brake Power</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nextRpmPoints.map((point, index) => (
                          <tr key={index} className="border-b border-blue-400/10 hover:bg-white/5 transition-colors duration-150">
                            <td className="px-4 py-3 text-white/80">{point.rpm}</td>
                            <td className="px-4 py-3 text-white/80">{point.flowRate}</td>
                            <td className="px-4 py-3 text-white/80">{point.totalPressure}</td>
                            <td className="px-4 py-3 text-white/80">{point.velocity}</td>
                            <td className="px-4 py-3 text-white/80">{point.efficiency}%</td>
                            <td className="px-4 py-3 text-white/80">{point.brakePower}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Quadratic Coefficients */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#021F59] rounded-lg p-4 border border-blue-400/30">
                  <h4 className="text-lg font-medium text-white mb-2">Quadratic </h4>
                  <div className="space-y-2">
                    <p className="text-white/80">a: {quadraticCoefficients.a.toFixed(6)}</p>
                    <p className="text-white/80">b: {quadraticCoefficients.b.toFixed(6)}</p>
                    <p className="text-white/80">c: {quadraticCoefficients.c.toFixed(6)}</p>
                  </div>
                </div>
               
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default FlowCalculate; 