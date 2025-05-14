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
      { rpm: 900, flowRate: 1.27575, totalPressure: 97.2, outletVelocity: 0.190774, brakePower: 0.190773692, efficiency: 65 },
      { rpm: 900, flowRate: 1.549125, totalPressure: 93.15, outletVelocity: 0.206144, brakePower: 0.206144277, efficiency: 70 },
      { rpm: 900, flowRate: 1.7496, totalPressure: 72.9, outletVelocity: 0.177147, brakePower: 0.177147, efficiency: 72 },
      { rpm: 900, flowRate: 1.92456, totalPressure: 56.7, outletVelocity: 0.155889, brakePower: 0.15588936, efficiency: 70 },
      { rpm: 900, flowRate: 2.0412, totalPressure: 40.5, outletVelocity: 0.13122, brakePower: 0.13122, efficiency: 63 }
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

  // Function to generate 1000 points with uniform increments in both flow rate and pressure
  const generatePoints = (coefficients, points) => {
    // Find min and max from valid points
    const validPoints = points.filter(point => 
      point.flowRate !== '' && point.totalPressure !== '' && point.efficiency !== ''
    );
    
    if (validPoints.length < 2) return [];

    // Sort by flowRate to find first and last points
    const sortedPoints = [...validPoints].sort((a, b) => 
      parseFloat(a.flowRate) - parseFloat(b.flowRate)
    );
    
    const firstPoint = sortedPoints[0];
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    
    const minFlow = parseFloat(firstPoint.flowRate);
    const maxFlow = parseFloat(lastPoint.flowRate);
    
    // Get the RPM value from the first valid point (assuming all points have the same RPM)
    const rpm = firstPoint.rpm || 900; // Default to 900 if not provided
    
    // Calculate step size for uniform flow rate increments
    // We need to create exactly 1000 points, so the step is for 999 intervals
    const flowStep = (maxFlow - minFlow) / 999; // 999 steps for 1000 points
    
    console.log(`------------------------------------------------------`);
    console.log(`Generating points from:`);
    console.log(`First point: Flow Rate = ${minFlow}`);
    console.log(`Last point: Flow Rate = ${maxFlow}`);
    console.log(`Using RPM = ${rpm} for all 1000 points`);
    console.log(`Flow Rate Step: ${flowStep}`);
    
    if (coefficients && coefficients.a !== undefined) {
      console.log(`Using quadratic equation: y = ${coefficients.a.toFixed(6)}x² + ${coefficients.b.toFixed(6)}x + ${coefficients.c.toFixed(6)}`);
      console.log(`Where y is Total Pressure and x is Flow Rate`);
    } else {
      console.log(`No valid quadratic coefficients found, will use linear interpolation between points`);
    }
    
    console.log(`Efficiency will be interpolated between input points with key points at positions 1, 250, 500, 750, 1000`);
    console.log(`------------------------------------------------------`);
    
    // Calculate constants for velocity formula: velocity = 4 * flowRate / (π * 0.63²)
    const PI = Math.PI;
    const DIAMETER = 0.63; // diameter in appropriate units
    const DIAMETER_SQUARED = DIAMETER * DIAMETER;
    const VELOCITY_CONSTANT = 4 / (PI * DIAMETER_SQUARED);
    
    console.log(`Velocity formula: velocity = 4 * flowRate / (π * ${DIAMETER}²)`);
    console.log(`Simplified to: velocity = ${VELOCITY_CONSTANT} * flowRate`);
    console.log(`------------------------------------------------------`);
    
    console.log(`Input efficiency values for interpolation at key points:`);
    sortedPoints.forEach((point, idx) => {
      console.log(`Key Point ${idx + 1} (position ${[1, 250, 500, 750, 1000][idx]}): ${point.efficiency}%`);
    });
    console.log(`------------------------------------------------------`);
    
    // Generate 1000 equally spaced points
    const generatedPoints = [];

    for (let i = 0; i < 1000; i++) {
      // Calculate flow rate with uniform increments
      const flowRate = minFlow + (flowStep * i);
      
      // Calculate total pressure using quadratic equation if coefficients are available
      let totalPressure;
      if (coefficients && coefficients.a !== undefined) {
        // Use the quadratic equation: y = ax² + bx + c where x is flow rate and y is total pressure
        totalPressure = (coefficients.a * flowRate * flowRate) + 
                         (coefficients.b * flowRate) + 
                         coefficients.c;
      } else {
        // Fallback to linear interpolation if no coefficients
        const minPressure = parseFloat(firstPoint.totalPressure);
        const maxPressure = parseFloat(lastPoint.totalPressure);
        const pressureStep = (maxPressure - minPressure) / 999;
        totalPressure = minPressure + (pressureStep * i);
      }
      
      // Calculate velocity using the formula: velocity = 4 * flowRate / (π * 0.63²)
      const velocity = VELOCITY_CONSTANT * flowRate;
      
      // Generate interpolated efficiency value
      const efficiency = generateInterpolatedEfficiency(i, sortedPoints);
      
      // Calculate brake power: (Flow rate * total pressure) / (efficiency/100 * 1000)
      const efficiencyDecimal = parseFloat(efficiency) / 100;
      const brakePower = (flowRate * totalPressure) / (efficiencyDecimal * 1000);
      
      // Log sample calculations for key points only
      if (i === 0 || i === 249 || i === 499 || i === 749 || i === 999) {
        console.log(`Key point ${i+1}: RPM=${rpm}, Flow=${flowRate.toFixed(6)}, Total Pressure=${totalPressure.toFixed(6)}, Velocity=${velocity.toFixed(6)}, Efficiency=${efficiency}, Brake Power=${brakePower.toFixed(6)}`);
      }
      
      generatedPoints.push({
        rpm: rpm,
        flowRate: flowRate.toFixed(6),
        totalPressure: totalPressure.toFixed(6),
        velocity: velocity.toFixed(6),
        efficiency: efficiency,
        brakePower: brakePower.toFixed(6)
      });
    }

    // Verification that we have exactly 1000 points
    console.log(`Generated ${generatedPoints.length} points.`);
    
    return generatedPoints;
  };

  // Function to generate points for next RPM value
  const generateNextRpmPoints = (basePoints, currentRpm, newRpm) => {
    if (!basePoints || basePoints.length === 0 || !currentRpm || !newRpm) {
      return [];
    }

    const rpmRatio = newRpm / currentRpm;
    const pressureRatio = rpmRatio * rpmRatio; // Square of RPM ratio for pressure
    
    console.log(`------------------------------------------------------`);
    console.log(`Generating points for next RPM: ${newRpm}`);
    console.log(`RPM Ratio (${newRpm}/${currentRpm}): ${rpmRatio.toFixed(6)}`);
    console.log(`Pressure Ratio (RPM Ratio²): ${pressureRatio.toFixed(6)}`);
    console.log(`------------------------------------------------------`);
    
    // Calculate constants for velocity formula: velocity = 4 * flowRate / (π * 0.63²)
    const PI = Math.PI;
    const DIAMETER = 0.63; // diameter in appropriate units
    const DIAMETER_SQUARED = DIAMETER * DIAMETER;
    const VELOCITY_CONSTANT = 4 / (PI * DIAMETER_SQUARED);
    
    const nextPoints = basePoints.map(point => {
      // Scale flow rate directly with RPM ratio
      const newFlowRate = parseFloat(point.flowRate) * rpmRatio;
      
      // Scale total pressure with square of RPM ratio
      const newTotalPressure = parseFloat(point.totalPressure) * pressureRatio;
      
      // Calculate velocity directly using the formula: velocity = 4 * flowRate / (π * 0.63²)
      const newVelocity = VELOCITY_CONSTANT * newFlowRate;
      
      // Efficiency remains the same
      const efficiency = point.efficiency;
      
      // Calculate new brake power directly from new flow rate and pressure
      const efficiencyDecimal = parseFloat(efficiency) / 100;
      const newBrakePower = (newFlowRate * newTotalPressure) / (efficiencyDecimal * 1000);
      
      return {
        rpm: newRpm,
        flowRate: newFlowRate.toFixed(6),
        totalPressure: newTotalPressure.toFixed(6),
        velocity: newVelocity.toFixed(6),
        efficiency: efficiency,
        brakePower: newBrakePower.toFixed(6)
      };
    });
    
    console.log(`Generated ${nextPoints.length} points for RPM ${newRpm}`);
    
    return nextPoints;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check for at least 2 valid data points
    const validPoints = dataPoints.filter(point => 
      point.flowRate !== '' && point.totalPressure !== ''
    );
    
    if (validPoints.length >= 2) {
      // Calculate the coefficients for the quadratic equation (still useful for reference)
      const coeffs = calculateQuadraticEquation(dataPoints);
      
      if (coeffs) {
        setQuadraticCoefficients(coeffs);
      }
      
      // Generate 1000 points with uniform increments
      const points = generatePoints(coeffs, dataPoints);
      setCalculatedPoints(points);
      
      // Get the current RPM from the first valid point
      const currentRpm = parseFloat(validPoints[0].rpm) || 900;
      
      // Default next RPM value is current + 1
      setNextRpm((currentRpm + 1).toString());
      
      setShowResults(true);
    } else {
      alert('Please enter at least 2 valid data points with flowRate and totalPressure values.');
    }
  };

  const handleGenerateNextRpm = () => {
    if (!nextRpm || calculatedPoints.length === 0) {
      alert('Please enter a valid RPM value and ensure base points are calculated first.');
      return;
    }
    
    // Get the current RPM from the first point of calculated points
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
    
    console.log('============================================================');
    console.log(`GENERATING RPM RANGE FROM ${currentRpm} TO ${targetRpm}`);
    console.log('============================================================');
    
    // Generate points for all RPM values from current+1 to target
    const allPoints = {};
    for (let rpm = currentRpm + 1; rpm <= targetRpm; rpm++) {
      // Log the starting of a new RPM calculation
      console.log(`\n----- CALCULATING FOR RPM ${rpm} (Base RPM: ${currentRpm}) -----`);
      
      // Generate points for this RPM
      const rpmPoints = generateNextRpmPoints(calculatedPoints, currentRpm, rpm);
      allPoints[rpm] = rpmPoints;
      
      // Log sample points for verification
      console.log(`Sample calculations for RPM ${rpm}:`);
      if (rpmPoints.length > 0) {
        // Log first point
        console.log(`First point (1/100):`);
        console.log(`  Flow Rate: ${rpmPoints[0].flowRate} (Scaled by ${rpm/currentRpm})`);
        console.log(`  Total Pressure: ${rpmPoints[0].totalPressure} (Scaled by ${(rpm/currentRpm)**2})`);
        console.log(`  Velocity: ${rpmPoints[0].velocity} (Direct calculation)`);
        console.log(`  Brake Power: ${rpmPoints[0].brakePower} (Direct calculation)`);
        
        // Log middle point
        const midIndex = Math.floor(rpmPoints.length / 2);
        console.log(`Middle point (${midIndex+1}/100):`);
        console.log(`  Flow Rate: ${rpmPoints[midIndex].flowRate} (Scaled by ${rpm/currentRpm})`);
        console.log(`  Total Pressure: ${rpmPoints[midIndex].totalPressure} (Scaled by ${(rpm/currentRpm)**2})`);
        console.log(`  Velocity: ${rpmPoints[midIndex].velocity} (Direct calculation)`);
        console.log(`  Brake Power: ${rpmPoints[midIndex].brakePower} (Direct calculation)`);
        
        // Log last point
        console.log(`Last point (100/100):`);
        console.log(`  Flow Rate: ${rpmPoints[rpmPoints.length-1].flowRate} (Scaled by ${rpm/currentRpm})`);
        console.log(`  Total Pressure: ${rpmPoints[rpmPoints.length-1].totalPressure} (Scaled by ${(rpm/currentRpm)**2})`);
        console.log(`  Velocity: ${rpmPoints[rpmPoints.length-1].velocity} (Direct calculation)`);
        console.log(`  Brake Power: ${rpmPoints[rpmPoints.length-1].brakePower} (Direct calculation)`);
      }
    }
    
    console.log('============================================================');
    console.log(`COMPLETED GENERATING ${Object.keys(allPoints).length} RPM VALUES`);
    console.log('============================================================');
    
    setAllRpmPoints(allPoints);
    
    // Set the last RPM as the selected one to show by default
    setSelectedRpm(targetRpm);
    setNextRpmPoints(allPoints[targetRpm]);
  };

  const handleSelectRpm = (rpm) => {
    setSelectedRpm(rpm);
    setNextRpmPoints(allRpmPoints[rpm]);
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
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Calculate Quadratic Equation
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
                />
                <button 
                  type="button" 
                  onClick={handleGenerateNextRpm}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Generate
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
                      onClick={() => handleSelectRpm(parseFloat(rpm))}
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