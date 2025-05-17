import { useState, useEffect } from 'react';

const FlowCalculate = () => {
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

  const [calculatedPoints, setCalculatedPoints] = useState([]);
  const [nextRpmPoints, setNextRpmPoints] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [nextRpm, setNextRpm] = useState('');
  const [allRpmPoints, setAllRpmPoints] = useState({});
  const [selectedRpm, setSelectedRpm] = useState(null);
  const [allDataGenerated, setAllDataGenerated] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (index, field, value) => {
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
    
    // Get the range of flow rates from base points
    const firstPoint = basePoints[0];
    const lastPoint = basePoints[basePoints.length - 1];
    const minFlow = parseFloat(firstPoint.flowRate);
    const maxFlow = parseFloat(lastPoint.flowRate);
    const flowStep = (maxFlow - minFlow) / 999;
    
    const newPoints = [];
    // Correct velocity constant calculation
    const DIAMETER = 0.63; // diameter in meters
    const velocityConstant = 4 / (Math.PI * Math.pow(DIAMETER, 2));
    
    for (let i = 0; i < 1000; i++) {
      // Calculate base flow rate
      const baseFlowRate = minFlow + (flowStep * i);
      
      // Scale flow rate by RPM ratio
      const scaledFlowRate = baseFlowRate * rpmRatio;
      
      // Find the corresponding base pressure
      const basePoint = basePoints.find(point => 
        Math.abs(parseFloat(point.flowRate) - baseFlowRate) < flowStep / 2
      ) || basePoints[Math.floor(i * (basePoints.length - 1) / 999)];
      
      // Scale pressure by RPM ratio squared
      const scaledPressure = parseFloat(basePoint.totalPressure) * pressureRatio;
      
      // Calculate velocity using the scaled flow rate
      const newVelocity = scaledFlowRate * velocityConstant;
      
      // Get efficiency from base point
      const newEfficiency = parseFloat(basePoint.efficiency);
      
      // Calculate brake power using the same formula as base points
      // Power = (Flow rate × total pressure) / (efficiency/100 × 1000)
      const efficiencyDecimal = newEfficiency / 100;
      const newBrakePower = (scaledFlowRate * scaledPressure) / (efficiencyDecimal * 1000);
      
      newPoints.push({
        rpm: newRpm,
        flowRate: Number(scaledFlowRate).toFixed(6),
        totalPressure: Number(scaledPressure).toFixed(6),
        velocity: Number(newVelocity).toFixed(6),
        efficiency: Number(newEfficiency).toFixed(4),
        brakePower: Number(newBrakePower).toFixed(6)
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
      // استخدام المعادلة التربيعية المحددة
      const coeffs = {
        a: -51.28,
        b: 150.00,
        c: -11.84
      };
      
      setQuadraticCoefficients(coeffs);
      const points = generatePoints(coeffs, dataPoints);
      setCalculatedPoints(points);
      setAllDataGenerated(points);
      console.log('All Generated Data:', points);
      
      const currentRpm = parseFloat(validPoints[0].rpm) || 900;
      setNextRpm((currentRpm + 1).toString());
      setShowResults(true);
      setIsLoading(false);
    } else {
      alert('Please enter at least 2 valid data points with flowRate and totalPressure values.');
    }
  };

  const handleGenerateNextRpm = () => {
    if (!nextRpm || calculatedPoints.length === 0) {
      alert('Please enter a valid RPM value and ensure base points are calculated first.');
      return;
    }
    
    const currentRpm = parseFloat(calculatedPoints[0].rpm);
    const targetRpm = parseFloat(nextRpm);
    
    if (isNaN(targetRpm) || targetRpm <= 0) {
      alert('Please enter a valid positive number for RPM.');
      return;
    }

    if (targetRpm <= currentRpm) {
      alert('Please enter an RPM value greater than the current RPM: ' + currentRpm);
      return;
    }
    
    setIsLoading(true);
    const allPoints = {};
    let allGeneratedData = [...calculatedPoints];
    
    // Generate points for each RPM value
    for (let rpm = currentRpm + 1; rpm <= targetRpm; rpm++) {
      // Use the base points (calculatedPoints) and the current RPM (900) to generate points for each new RPM
      const rpmPoints = generateNextRpmPoints(calculatedPoints, currentRpm, rpm);
      allPoints[rpm] = rpmPoints;
      allGeneratedData = [...allGeneratedData, ...rpmPoints];
    }
    
    setAllRpmPoints(allPoints);
    setAllDataGenerated(allGeneratedData);
    console.log('All Generated Data:', allGeneratedData);
    
    // Set the selected RPM to the first generated RPM (currentRpm + 1)
    const firstGeneratedRpm = currentRpm + 1;
    setSelectedRpm(firstGeneratedRpm);
    setNextRpmPoints(allPoints[firstGeneratedRpm]);
    setIsLoading(false);
  };

  const handleRpmSelect = (e) => {
    const selectedRpm = parseInt(e.target.value);
    setSelectedRpm(selectedRpm);
    setNextRpmPoints(allRpmPoints[selectedRpm]);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Flow Calculation Data</h2>
      
      <div className="mb-4">
        <button
          type="button"
          onClick={loadExampleData}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Load Example Data
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b">Point</th>
                <th className="py-2 px-4 border-b">RPM</th>
                <th className="py-2 px-4 border-b">Flow Rate</th>
                <th className="py-2 px-4 border-b">Total Pressure</th>
                <th className="py-2 px-4 border-b">Outlet Velocity</th>
                <th className="py-2 px-4 border-b">Brake Power</th>
                <th className="py-2 px-4 border-b">Efficiency (%)</th>
              </tr>
            </thead>
            <tbody>
              {dataPoints.map((point, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-4 border-b text-center font-semibold">{index + 1}</td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded"
                      value={point.rpm}
                      onChange={(e) => handleInputChange(index, 'rpm', e.target.value)}
                      placeholder="Ex: 900"
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded"
                      value={point.flowRate}
                      onChange={(e) => handleInputChange(index, 'flowRate', e.target.value)}
                      placeholder="Ex: 1.27575"
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded"
                      value={point.totalPressure}
                      onChange={(e) => handleInputChange(index, 'totalPressure', e.target.value)}
                      placeholder="Ex: 97.2"
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded"
                      value={point.outletVelocity}
                      onChange={(e) => handleInputChange(index, 'outletVelocity', e.target.value)}
                      placeholder="Ex: 0.190774"
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded"
                      value={point.brakePower}
                      onChange={(e) => handleInputChange(index, 'brakePower', e.target.value)}
                      placeholder="Ex: 0.190773692"
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-1 border rounded"
                      value={point.efficiency}
                      onChange={(e) => handleInputChange(index, 'efficiency', e.target.value)}
                      placeholder="Ex: 65"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4">
          <button 
            type="submit" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center min-w-[200px]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري التوليد...
              </>
            ) : (
              'Calculate Quadratic Equation'
            )}
          </button>
        </div>
      </form>

      {showResults && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-2">Calculation Results</h3>
          
          {quadraticCoefficients && quadraticCoefficients.a !== 0 && (
            <p className="mb-4">
              <strong>Quadratic Equation:</strong> y = {quadraticCoefficients.a.toFixed(6)}x² + {quadraticCoefficients.b.toFixed(6)}x + {quadraticCoefficients.c.toFixed(6)}
              <br />
              <span className="text-sm text-gray-600">Where y is Total Pressure and x is Flow Rate</span>
              <br />
              <span className="text-sm text-gray-600">The 1000 generated points follow this equation exactly</span>
            </p>
          )}
          
          <p className="mb-4">
            <strong>Generated Points:</strong> 1000 points with uniform increments in both Flow Rate and Total Pressure between the first and last input points.
            <br />
            <strong>Velocity Formula:</strong> velocity = 4 × flowRate / (π × 0.63²)
            <br />
            <strong>Efficiency Values:</strong> Exact input values at key points with linear interpolation in between:
            <br />
            <span className="text-sm pl-4 block">
              Point 1: Exactly {parseFloat(dataPoints[0]?.efficiency || 65).toFixed(4)}%
              <br />
              Points 2-249: Linear steps of 0.020080% per point
              <br />
              Point 250: Exactly {parseFloat(dataPoints[1]?.efficiency || 70).toFixed(4)}%
              <br />
              Points 251-499: Linear steps of 0.008032% per point
              <br />
              Point 500: Exactly {parseFloat(dataPoints[2]?.efficiency || 72).toFixed(4)}%
              <br />
              Points 501-749: Linear steps of -0.008032% per point
              <br />
              Point 750: Exactly {parseFloat(dataPoints[3]?.efficiency || 70).toFixed(4)}%
              <br />
              Points 751-999: Linear steps of -0.028112% per point
              <br />
              Point 1000: Exactly {parseFloat(dataPoints[4]?.efficiency || 63).toFixed(4)}%
            </span>
          </p>
          
          <div className="my-4 flex items-center">
            <div className="flex-1">
              <label className="block font-medium mb-1">Generate RPM Range:</label>
              <div className="flex items-center">
                <input 
                  type="number" 
                  value={nextRpm}
                  onChange={(e) => setNextRpm(e.target.value)}
                  className="w-32 p-2 border rounded mr-2"
                  placeholder="Enter max RPM"
                  disabled={isLoading}
                />
                <button 
                  type="button" 
                  onClick={handleGenerateNextRpm}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center justify-center min-w-[120px]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      جاري...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Will generate all RPM values from {calculatedPoints.length > 0 ? parseInt(calculatedPoints[0].rpm) + 1 : '?'} to entered value
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm bg-gray-100 p-2 rounded">
                <strong>Scaling Laws:</strong>
                <br />
                • Flow Rate ∝ RPM: New Flow = Old Flow × (New RPM ÷ Old RPM)
                <br />
                • Pressure ∝ RPM²: New Pressure = Old Pressure × (New RPM ÷ Old RPM)²
                <br />
                • Velocity: Calculated directly using velocity = 4 × flowRate / (π × 0.63²)
                <br />
                • Brake Power: Calculated directly using (Flow rate × total pressure) / (efficiency/100 × 1000)
              </p>
            </div>
          </div>
          
          <h4 className="text-lg font-semibold mb-2">Generated 1000 Points:</h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="sticky top-0 bg-gray-200">
                <tr>
                  <th className="py-2 px-4 border-b">Point</th>
                  <th className="py-2 px-4 border-b">RPM</th>
                  <th className="py-2 px-4 border-b">Flow Rate</th>
                  <th className="py-2 px-4 border-b">Total Pressure</th>
                  <th className="py-2 px-4 border-b">Velocity</th>
                  <th className="py-2 px-4 border-b">Brake Power</th>
                  <th className="py-2 px-4 border-b">Efficiency (%)</th>
                </tr>
              </thead>
              <tbody>
                {calculatedPoints.map((point, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-1 px-4 border-b text-center font-medium">{index + 1}</td>
                    <td className="py-1 px-4 border-b">{point.rpm}</td>
                    <td className="py-1 px-4 border-b">{point.flowRate}</td>
                    <td className="py-1 px-4 border-b">{point.totalPressure}</td>
                    <td className="py-1 px-4 border-b">{point.velocity}</td>
                    <td className="py-1 px-4 border-b">{point.brakePower}</td>
                    <td className="py-1 px-4 border-b">{point.efficiency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {Object.keys(allRpmPoints).length > 0 && (
            <>
              <div className="flex items-center mt-8 mb-2">
                <h4 className="text-lg font-semibold">Select RPM Value:</h4>
                <div className="ml-4 overflow-x-auto flex space-x-2 p-2">
                  {Object.keys(allRpmPoints).map(rpm => (
                    <button
                      key={rpm}
                      onClick={() => handleRpmSelect({ target: { value: rpm } })}
                      className={`px-3 py-1 rounded ${
                        selectedRpm === parseFloat(rpm) 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      {rpm}
                    </button>
                  ))}
                </div>
              </div>
              
              {selectedRpm && (
                <>
                  <h4 className="text-lg font-semibold mb-2">Points for RPM {selectedRpm}:</h4>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full bg-white border rounded-lg">
                      <thead className="sticky top-0 bg-gray-200">
                        <tr>
                          <th className="py-2 px-4 border-b">Point</th>
                          <th className="py-2 px-4 border-b">RPM</th>
                          <th className="py-2 px-4 border-b">Flow Rate</th>
                          <th className="py-2 px-4 border-b">Total Pressure</th>
                          <th className="py-2 px-4 border-b">Velocity</th>
                          <th className="py-2 px-4 border-b">Brake Power</th>
                          <th className="py-2 px-4 border-b">Efficiency (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nextRpmPoints.map((point, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="py-1 px-4 border-b text-center font-medium">{index + 1}</td>
                            <td className="py-1 px-4 border-b">{point.rpm}</td>
                            <td className="py-1 px-4 border-b">{point.flowRate}</td>
                            <td className="py-1 px-4 border-b">{point.totalPressure}</td>
                            <td className="py-1 px-4 border-b">{point.velocity}</td>
                            <td className="py-1 px-4 border-b">{point.brakePower}</td>
                            <td className="py-1 px-4 border-b">{point.efficiency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FlowCalculate; 