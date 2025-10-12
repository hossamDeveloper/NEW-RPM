import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import api from '../redux/api';
import { useQuery } from '@tanstack/react-query';
import {
  setAllRpmPoints,
  setCalculatedPoints,
  setSelectedRpm,
  setNextRpmPoints,
  setAllDataGenerated,
  setDiameter
} from '../redux/flowSlice';

const FlowCalculate = () => {
  const dispatch = useDispatch();
  const {
    allRpmPoints,
    calculatedPoints,
    selectedRpm,
    nextRpmPoints,
    diameter
  } = useSelector((state) => state.flow);



  const [fanType, setFanType] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [nextRpm, setNextRpm] = useState('');
  const [pressureClass, setPressureClass] = useState(''); // low | medium | high
  const [lowConfig, setLowConfig] = useState(''); // sisw | didw (only for low)
  const [series, setSeries] = useState(''); // NBR, NBS, NBRS, NC, NBXI, NBR-D, NBS-D, NPD, NPE, NPF

  const initialPoint = {
    rpm: '',
    flowRate: '',
    totalPressure: '',
    outletVelocity: '',
    brakePower: '',
    efficiency: '',
    lpa: ''
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

  const [quarticCoefficients, setQuarticCoefficients] = useState({
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    e: 0,
  });

  // Track RPM precision to avoid floating-point artifacts (e.g., 1499.3200000000002)
  const [rpmPrecision, setRpmPrecision] = useState(0);                              //up

  const { data: modelsData, isLoading: qLoadingModels, error: qModelsError } = useQuery({
    queryKey: ['models', fanType],
    queryFn: async () => {
      const res = await api.get(`/model/`, { params: fanType ? { type: fanType } : {} });
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: !!fanType,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setIsLoadingModels(qLoadingModels);
    if (qModelsError) setModelError('Failed to fetch models. Please try again.');
    else setModelError('');

    // Filter models for centrifugal based on selected series and configuration
    if (fanType === 'centrifugal') {
      const filtered = (modelsData || []).filter((model) => {
        if (!model) return false;
        
        const matchesPressureType = model.pressureType === pressureClass;
        
        // If no series selected yet, show all models for the selected pressure class
        if (!series) {
          return matchesPressureType;
        }
        
        // Filter based on centrifugalType and configurationType properties
        const matchesCentrifugalType = model.centrifugalType === series;
        const matchesConfigurationType = model.configurationType === lowConfig.toUpperCase();
        
        // Debug the actual values
        console.log('Debug values:', {
          modelCentrifugalType: model.centrifugalType,
          selectedSeries: series,
          centrifugalMatch: matchesCentrifugalType,
          modelConfigurationType: model.configurationType,
          selectedLowConfig: lowConfig,
          configurationMatch: matchesConfigurationType
        });
        
        // Debug logging
        console.log('Model:', model.name, {
          centrifugalType: model.centrifugalType,
          configurationType: model.configurationType,
          pressureType: model.pressureType,
          series,
          lowConfig,
          pressureClass,
          matchesCentrifugalType,
          matchesConfigurationType,
          matchesPressureType
        });
        
        // For low pressure, check both centrifugalType and configurationType
        if (pressureClass === 'low') {
          // If no configuration selected yet, only check centrifugalType and pressureType
          if (!lowConfig) {
            const result = matchesCentrifugalType && matchesPressureType;
            console.log('Low pressure without config - Result:', result);
            return result;
          }
          // If configuration is selected, check all three
          const result = matchesCentrifugalType && matchesConfigurationType && matchesPressureType;
          console.log('Low pressure with config - Result:', result, {
            matchesCentrifugalType,
            matchesConfigurationType,
            matchesPressureType
          });
          return result;
        }
        
        // For medium and high pressure, only check centrifugalType and pressureType
        if (pressureClass === 'medium' || pressureClass === 'high') {
          return matchesCentrifugalType && matchesPressureType;
        }
        
        // Fallback to just centrifugalType match
        return matchesCentrifugalType;
      });
      setModels(filtered);
      console.log('Filtered models:', filtered);
      console.log('All models data:', modelsData);
    } else {
      setModels(modelsData || []);
    }
  }, [qLoadingModels, qModelsError, modelsData, fanType, pressureClass, lowConfig, series]);

  const { data: selectedModelData } = useQuery({
    queryKey: ['model', selectedModel],
    queryFn: async () => {
      const res = await api.get(`/model/${selectedModel}`);
      return res.data?.data;
    },
    enabled: !!selectedModel,
    staleTime: 5 * 60 * 1000,
  });

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
    newDataPoints[index] = { ...newDataPoints[index], [field]: value };
    setDataPoints(newDataPoints);
  };

  const handleModelChange = (e) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    const selectedModelObj = models.find(model => model._id === modelId);
    if (selectedModelObj) {
      const factorValue = Number(selectedModelObj.factor ?? 0);
      dispatch(setDiameter(factorValue / 1000));
    }
  };

  const generateInterpolatedEfficiency = (index, validPoints) => {
    const defaultEfficiencies = [65, 70, 72, 70, 63];
    let efficiencies = [];
    if (validPoints && validPoints.length >= 2) {
      efficiencies = validPoints.map(point => 
        parseFloat(point.efficiency || '65')
      );
    } else {
      efficiencies = defaultEfficiencies;
    }
    const displayIndex = index + 1;
    const keyPoints = [1, 250, 500, 750, 1000];
    const keyPointIndex = keyPoints.indexOf(displayIndex);
    if (keyPointIndex !== -1 && keyPointIndex < efficiencies.length) {
      return efficiencies[keyPointIndex].toFixed(4);
    }
    let segment = 0;
    for (let i = 1; i < keyPoints.length; i++) {
      if (displayIndex < keyPoints[i]) {
        segment = i - 1;
        break;
      }
    }
    const startIndex = keyPoints[segment];
    const endIndex = keyPoints[segment + 1];
    const startValue = efficiencies[segment];
    const endValue = efficiencies[segment + 1];
    const progress = (displayIndex - startIndex) / (endIndex - startIndex);
    const interpolatedValue = startValue + (endValue - startValue) * progress;
    return interpolatedValue.toFixed(4);
  };

  const loadExampleData = async () => {
    if (!selectedModel) {
      setError('Please select a model first');
      return;
    }
    try {
      const modelData = selectedModelData;
      if (modelData && modelData.points && Array.isArray(modelData.points)) {
        const points = modelData.points.slice(0, 5);
        const formattedPoints = points.map(point => ({
          rpm: point.rpm || 900,
          flowRate: point.flowRate || 0,
          totalPressure: point.totalPressure || 0,
          outletVelocity: point.outletVelocity || 0,
          brakePower: point.brakePower || 0,
          efficiency: point.efficiency || 0,
          lpa: point.lpa || 0
        }));
        setDataPoints(formattedPoints);
        if (modelData.factor !== undefined && modelData.factor !== null) {
          dispatch(setDiameter(Number(modelData.factor) / 1000));
        }
        setError('');
      } else {
        setError('Selected model does not have valid data points');
      }
    } catch (err) {
      setError('Failed to load model data. Please try again.');
    }
  };

  const calculateQuadraticCoefficients = (points) => {
    const point1 = points[0];
    const point3 = points[2];
    const point5 = points[4];
    const x1 = parseFloat(point1.flowRate);
    const y1 = parseFloat(point1.totalPressure);
    const x3 = parseFloat(point3.flowRate);
    const y3 = parseFloat(point3.totalPressure);
    const x5 = parseFloat(point5.flowRate);
    const y5 = parseFloat(point5.totalPressure);
    const det = (x1 * x1 * x3) + (x3 * x3 * x5) + (x5 * x5 * x1) - 
                (x1 * x3 * x3) - (x3 * x5 * x5) - (x5 * x1 * x1);
    const detA = (y1 * x3) + (y3 * x5) + (y5 * x1) - 
                 (x1 * y3) - (x3 * y5) - (x5 * y1);
    const detB = (x1 * x1 * y3) + (x3 * x3 * y5) + (x5 * x5 * y1) - 
                 (y1 * x3 * x3) - (y3 * x5 * x5) - (y5 * x1 * x1);
    const detC = (x1 * x1 * x3 * y5) + (x3 * x3 * x5 * y1) + (x5 * x5 * x1 * y3) - 
                 (y1 * x3 * x5 * x5) - (y3 * x5 * x1 * x1) - (y5 * x1 * x3 * x3);
    const a = detA / det;
    const b = detB / det;
    const c = detC / det;
    return { a, b, c };
  };

  const solveLinearSystem4x4 = (A, b) => {
    const n = 4;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
      }
      if (Math.abs(M[pivotRow][col]) < 1e-12) {
        return null;
      }
      if (pivotRow !== col) {
        const tmp = M[col];
        M[col] = M[pivotRow];
        M[pivotRow] = tmp;
      }
      const pivot = M[col][col];
      for (let c = col; c <= n; c++) M[col][c] /= pivot;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        for (let c = col; c <= n; c++) {
          M[r][c] -= factor * M[col][c];
        }
      }
    }
    return [M[0][n], M[1][n], M[2][n], M[3][n]];
  };

  const calculateCubicCoefficientsForLpa = (points) => {
    try {
      const indices = [0, 1, 3, 4];
      const selected = indices.map(i => points[i]);
      if (selected.some(p => !p)) return null;
      const xs = selected.map(p => parseFloat(p.flowRate));
      const ys = selected.map(p => parseFloat(p.lpa));
      if (xs.some(x => isNaN(x)) || ys.some(y => isNaN(y))) return null;
      const A = xs.map(x => [Math.pow(x, 3), Math.pow(x, 2), x, 1]);
      const solution = solveLinearSystem4x4(A, ys);
      if (!solution) return null;
      const [a, b, c, d] = solution;
      return { a, b, c, d };
    } catch (err) {
      console.error('Error calculating cubic coefficients for LPA:', err);
      return null;
    }
  };

  const evaluateCubic = (coeffs, x) => {
    if (!coeffs) return 0;
    const { a, b, c, d } = coeffs;
    return (a * x * x * x) + (b * x * x) + (c * x) + d;
  };

  const solveLinearSystem5x5 = (A, b) => {
    const n = 5;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
      }
      if (Math.abs(M[pivotRow][col]) < 1e-12) return null;
      if (pivotRow !== col) {
        const tmp = M[col];
        M[col] = M[pivotRow];
        M[pivotRow] = tmp;
      }
      const pivot = M[col][col];
      for (let c = col; c <= n; c++) M[col][c] /= pivot;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        for (let c = col; c <= n; c++) {
          M[r][c] -= factor * M[col][c];
        }
      }
    }
    return M.map(row => row[n]);
  };

  const calculateQuarticCoefficients = (points) => {
    try {
      const xs = points.map(p => parseFloat(p.flowRate));
      const ys = points.map(p => parseFloat(p.totalPressure));
 
      if (xs.some(isNaN) || ys.some(isNaN) || points.length < 5) return null;
 
      const A = xs.map(x => [
        Math.pow(x, 4),
        Math.pow(x, 3),
        Math.pow(x, 2),
        x,
        1
      ]);
 
      const solution = solveLinearSystem5x5(A, ys);
 
      if (!solution) return null;
 
      const [a, b, c, d, e] = solution;
      return { a, b, c, d, e };
    } catch (err) {
      console.error('Error calculating quartic coefficients:', err);
      return null;
    }
  };

  const evaluateQuartic = (coeffs, x) => {
    if (!coeffs) return 0;
    const { a, b, c, d, e } = coeffs;
    return (a * x * x * x * x) + (b * x * x * x) + (c * x * x) + (d * x) + e;
  };

  const solveLinearSystem = (A, b) => {
    try {
      const n = A.length;
      const M = A.map((row, i) => [...row, b[i]]);
      for (let col = 0; col < n; col++) {
        let pivotRow = col;
        for (let r = col + 1; r < n; r++) {
          if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
        }
        if (Math.abs(M[pivotRow][col]) < 1e-12) return null;
        if (pivotRow !== col) {
          const tmp = M[col];
          M[col] = M[pivotRow];
          M[pivotRow] = tmp;
        }
        const pivot = M[col][col];
        for (let c = col; c <= n; c++) M[col][c] /= pivot;
        for (let r = 0; r < n; r++) {
          if (r === col) continue;
          const factor = M[r][col];
          for (let c = col; c <= n; c++) {
            M[r][c] -= factor * M[col][c];
          }
        }
      }
      return M.map(row => row[n]);
    } catch (err) {
      console.error('Error solving linear system:', err);
      return null;
    }
  };

  const calculatePolynomialCoefficientsForEfficiency = (points, degree = 5, ridgeLambda = 1e-6) => {
    try {
      const valid = points
        .filter(p => p && p.flowRate !== '' && p.efficiency !== '')
        .map(p => ({ x: parseFloat(p.flowRate), y: parseFloat(p.efficiency) }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y));
      if (valid.length < 3) return null;
      const m = valid.length;
      const n = degree + 1;
      const X = valid.map(({ x }) => {
        const row = [];
        for (let d = degree; d >= 0; d--) {
          row.push(Math.pow(x, d));
        }
        return row;
      });
      const Y = valid.map(({ y }) => y);
      const XtX = Array.from({ length: n }, () => Array(n).fill(0));
      const XtY = Array(n).fill(0);
      for (let i = 0; i < m; i++) {
        for (let r = 0; r < n; r++) {
          XtY[r] += X[i][r] * Y[i];
          for (let c = 0; c < n; c++) {
            XtX[r][c] += X[i][r] * X[i][c];
          }
        }
      }
      for (let d = 0; d < n; d++) {
        XtX[d][d] += ridgeLambda;
      }
      const coeffs = solveLinearSystem(XtX, XtY);
      if (!coeffs) return null;
      return coeffs;
    } catch (err) {
      console.error('Error calculating polynomial coefficients for efficiency:', err);
      return null;
    }
  };

  const evaluatePolynomial = (coeffs, x) => {
    if (!coeffs) return 0;
    let y = 0;
    const n = coeffs.length;
    for (let i = 0; i < n; i++) {
      const power = n - 1 - i;
      y += coeffs[i] * Math.pow(x, power);
    }
    return y;
  };

  const calculateDiameter = (modelName) => {
    try {
      const numbers = modelName.match(/\d+/);
      if (numbers) {
        const diameterValue = parseInt(numbers[0]) / 1000;
        dispatch(setDiameter(diameterValue));
        return diameterValue;
      }
      dispatch(setDiameter(0.63));
      return 0.63;
    } catch (error) {
    } finally {
    }
  };

  const generatePoints = (coeffs, basePoints, pressureModel = 'quadratic') => {
    const validPoints = basePoints.filter(point => 
      point.flowRate !== '' && point.totalPressure !== '' && point.efficiency !== ''
    );
    if (validPoints.length < 2) return [];
    const sortedPoints = [...validPoints].sort((a, b) => 
      parseFloat(a.flowRate) - parseFloat(b.flowRate)
    );
    const firstPoint = sortedPoints[0];
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    const rpm = firstPoint.rpm ;
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
      const flowRate = startPoint.flowRate + (endPoint.flowRate - startPoint.flowRate) * progress;
      return Number(flowRate.toFixed(6));
    };
    const calculatePressure = (flowRate) => {
      let totalPressure;
      if (pressureModel === 'quartic' && coeffs && typeof coeffs === 'object' && Number.isFinite(coeffs.a)) {
        totalPressure = evaluateQuartic(coeffs, flowRate);
      } else if (coeffs && Number.isFinite(coeffs.a)) {
        totalPressure = (coeffs.a * flowRate * flowRate) + (coeffs.b * flowRate) + coeffs.c;
      } else {
        totalPressure = 0;
      }
      if (!Number.isFinite(totalPressure)) totalPressure = 0;
      return Number(totalPressure.toFixed(6));
    };
    const calculateBrakePower = (flowRate, totalPressure, efficiency) => {
      const flowRateNum = Number(flowRate);
      const totalPressureNum = Number(totalPressure);
      const efficiencyDecimal = Number(efficiency) / 100;
      if (!isFinite(flowRateNum) || !isFinite(totalPressureNum) || !isFinite(efficiencyDecimal) || efficiencyDecimal <= 0) {
        return 0;
      }
      const brakePower = (flowRateNum * totalPressureNum) / (efficiencyDecimal * 1000);
      return Number(brakePower.toFixed(6));
    };
    const cubicCoeffsLpa = calculateCubicCoefficientsForLpa(basePoints);
    
    // Use cubic efficiency for NBS, quintic for others
    const efficiencyDegree = (fanType === 'centrifugal' && series === 'NBS') ? 3 : 5;
    const efficiencyCoeffs = calculatePolynomialCoefficientsForEfficiency(basePoints, efficiencyDegree, 1e-6);
    for (let i = 0; i < 1000; i++) {
      let flowRate, totalPressure, efficiency;
      const keyPoint = keyPoints.find(kp => kp.index === i);
      if (keyPoint) {
        flowRate = keyPoint.flowRate;
        totalPressure = keyPoint.totalPressure;
        if (efficiencyCoeffs) {
          efficiency = evaluatePolynomial(efficiencyCoeffs, flowRate);
        } else {
          efficiency = keyPoint.efficiency;
        }
      } else {
        flowRate = calculateFlowRate(i);
        totalPressure = calculatePressure(flowRate);
        if (efficiencyCoeffs) {
          efficiency = evaluatePolynomial(efficiencyCoeffs, flowRate);
        } else {
          efficiency = generateInterpolatedEfficiency(i, sortedPoints);
        }
      }
      if (!isFinite(efficiency)) efficiency = 0;
      efficiency = Math.max(0, Math.min(100, Number(efficiency)));
      const velocity = VELOCITY_CONSTANT * flowRate;
      const brakePower = calculateBrakePower(flowRate, totalPressure, efficiency);
      const lpaValue = evaluateCubic(cubicCoeffsLpa, flowRate);
      generatedPoints.push({
        rpm: rpm,
        flowRate: flowRate.toFixed(6),
        totalPressure: totalPressure.toFixed(6),
        velocity: velocity.toFixed(6),
        efficiency: Number(efficiency).toFixed(4),
        brakePower: brakePower.toFixed(6),
        lpa: Number(lpaValue ?? 0).toFixed(6)
      });
    }
    return generatedPoints;
  };

  const generateNextRpmPoints = (basePoints, currentRpm, newRpm) => {
    const rpmRatio = newRpm / currentRpm;
    const pressureRatio = Math.pow(rpmRatio, 2);
    const velocityConstant = 4 / (Math.PI * Math.pow(diameter, 2));
    const lpaDelta = 50 * Math.log10(rpmRatio);
    const newPoints = new Array(1000);                                //up
    // Pre-parse base points once for performance
    for (let i = 0; i < 1000; i++) {
      const bp = basePoints[i];                                             //up       
      const baseFlow = Number(bp.flowRate);
      const basePressure = Number(bp.totalPressure);
      const baseEfficiency = Number(bp.efficiency);
      const baseLpa = Number(bp.lpa || 0);
      const flowRate = baseFlow * rpmRatio;
      const totalPressure = basePressure * pressureRatio;
      const efficiency = baseEfficiency;                                             //up
      const velocity = flowRate * velocityConstant;
      const efficiencyDecimal = efficiency / 100;
      const brakePower = efficiencyDecimal > 0 ? (flowRate * totalPressure) / (efficiencyDecimal * 1000) : 0;         //up
      const lpa = baseLpa + lpaDelta;
      const rpmLabel = rpmPrecision > 0 ? newRpm.toFixed(rpmPrecision) : String(Math.round(newRpm));
      newPoints[i] = {
        rpm: rpmLabel,                                                                                          //up           
        flowRate: Number(flowRate).toFixed(6),
        totalPressure: Number(totalPressure).toFixed(6),
        velocity: Number(velocity).toFixed(6),
        efficiency: Number(efficiency).toFixed(4),
        brakePower: Number(brakePower).toFixed(6),
        lpa: Number(lpa).toFixed(6)
      };
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
      let pressureCoeffs;
      let pressureModel = 'quadratic';
      if (fanType === 'centrifugal') {
        const fiveValid = dataPoints
          .map(p => ({ x: parseFloat(p.flowRate), y: parseFloat(p.totalPressure) }))
          .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (fiveValid.length < 5) {
          setIsLoading(false);
          setError('For centrifugal, please enter at least 5 valid points for quartic fit.');
          return;
        }
        pressureCoeffs = calculateQuarticCoefficients(dataPoints);
        if (!pressureCoeffs) {
          setIsLoading(false);
          setError('Failed to compute quartic coefficients. Please check input points.');
          return;
        }
        setQuarticCoefficients(pressureCoeffs);
        pressureModel = 'quartic';
      } else {
        pressureCoeffs = calculateQuadraticCoefficients(dataPoints);
        setQuadraticCoefficients(pressureCoeffs);
      }

      const points = generatePoints(pressureCoeffs, dataPoints, pressureModel);
      dispatch(setCalculatedPoints(points));
      dispatch(setAllDataGenerated(points));
      const currentRpm = parseFloat(validPoints[0].rpm) || 900;
      // Determine RPM precision from the user's first RPM input string
      const rpmStr = (validPoints[0].rpm ?? '').toString();                                                       //up
      const precision = rpmStr.includes('.') ? (rpmStr.split('.')[1]?.length || 0) : 0;
      setRpmPrecision(precision);
      const currentRpmRounded = Number(currentRpm.toFixed(precision));
      const currentRpmKey = precision > 0 ? currentRpmRounded.toFixed(precision) : String(Math.round(currentRpmRounded));
      dispatch(setAllRpmPoints({ [currentRpmKey]: points }));
      dispatch(setSelectedRpm(currentRpmRounded));
      dispatch(setNextRpmPoints(points));
      setNextRpm(((currentRpmRounded) + 1).toFixed(precision));                                                 //up
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
    setIsGenerating(true);
    setTimeout(() => {
      const allPoints = { ...allRpmPoints };
      const allGeneratedData = [...calculatedPoints];                                              //up
      // Preserve the fractional part of currentRpm while stepping by 1.00
      const frac = currentRpm - Math.floor(currentRpm);
      const startInt = Math.ceil(currentRpm); // first integer strictly > currentRpm if frac>0, else current
      const endInt = Math.floor(targetRpm);
      for (let intPart = startInt; intPart <= endInt; intPart++) {
        const rpmValue = intPart + frac;
        if (rpmValue <= currentRpm) continue; // guard
        if (rpmValue > targetRpm) break;
        const rpmRounded = rpmPrecision > 0 ? Number(rpmValue.toFixed(rpmPrecision)) : Math.round(rpmValue);
        const rpmKey = rpmPrecision > 0 ? rpmRounded.toFixed(rpmPrecision) : String(rpmRounded);
        const rpmPoints = generateNextRpmPoints(calculatedPoints, currentRpm, rpmRounded);
        allPoints[rpmKey] = rpmPoints;
        allGeneratedData.push(...rpmPoints);
      }
      // Include exact target RPM if not already included
      const targetRounded = rpmPrecision > 0 ? Number(targetRpm.toFixed(rpmPrecision)) : Math.round(targetRpm);
      const targetKey = rpmPrecision > 0 ? targetRounded.toFixed(rpmPrecision) : String(targetRounded);
      if (!(targetKey in allPoints)) {
        const rpmPoints = generateNextRpmPoints(calculatedPoints, currentRpm, targetRounded);
        allPoints[targetKey] = rpmPoints;
        allGeneratedData.push(...rpmPoints);                                                                   //up
      }
      dispatch(setAllRpmPoints(allPoints));
      dispatch(setAllDataGenerated(allGeneratedData));
      dispatch(setSelectedRpm(targetRounded));                                           //up
      dispatch(setNextRpmPoints(allPoints[targetKey]));                                         //up
      setIsGenerating(false);
    }, 0);
  };

  const handleRpmSelect = (e) => {
    const selectedRpm = parseFloat(e.target.value);                                      //up
    dispatch(setSelectedRpm(selectedRpm));
    dispatch(setNextRpmPoints(allRpmPoints[selectedRpm]));
  };

  // Helpers for UI options
  const getSeriesOptions = () => {
    if (fanType !== 'centrifugal') return [];
    if (pressureClass === 'low') {
      if (lowConfig === 'sisw') return ['NBR', 'NBS', 'NBRS', 'NC', 'NBXI'];
      if (lowConfig === 'didw') return ['NBR-D', 'NBS-D'];
      return [];
    }
    if (pressureClass === 'medium') return ['NPD', 'NPE'];
    if (pressureClass === 'high') return ['NPF'];
    return [];
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className=" bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative"
        >
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
          <h2 className="text-3xl font-bold text-[#1E3A8A] mb-8 text-center">Selector</h2>
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-4 border border-[#E5EDFF]">
              <label className="block text-lg font-semibold text-[#1F3B73] mb-3">Fan Type</label>
              <select
                value={fanType}
                onChange={(e) => {
                  setFanType(e.target.value);
                  setSelectedModel('');
                  setModels([]);
                  setPressureClass('');
                  setLowConfig('');
                  setSeries('');
                }}
                className="w-full px-4 py-3 bg-white border border-[#C7DAFF] rounded-xl text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
              >
                <option value="" className="bg-white">Select Fan Type</option>
                <option value="axial" className="bg-white">Axial</option>
                <option value="centrifugal" className="bg-white">Centrifugal</option>
              </select>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E5EDFF]">
              <label className="block text-lg font-semibold text-[#1F3B73] mb-3">Model</label>
              <select
                value={selectedModel}
                onChange={handleModelChange}
                disabled={!fanType || isLoadingModels || (fanType === 'centrifugal' && (!pressureClass || (pressureClass === 'low' && !lowConfig) || !series))}
                className="w-full px-4 py-3 bg-white border border-[#C7DAFF] rounded-xl text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent disabled:bg-[#F1F5FF] disabled:text-[#94A3B8]"
              >
                <option value="" className="bg-white">Select Model</option>
                {models.map((model) => (
                  <option key={model._id} value={model._id} className="bg-white">
                    {model.name}
                  </option>
                ))}
              </select>
              {isLoadingModels && <p className="mt-2 text-[#3B82F6] text-sm">Loading models...</p>}
              {modelError && <p className="mt-2 text-red-600 text-sm">{modelError}</p>}
            </div>
          </div>
          {fanType === 'centrifugal' && (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-4 border border-[#E5EDFF]">
                <label className="block text-lg font-semibold text-[#1F3B73] mb-3">Pressure Class</label>
                <select
                  value={pressureClass}
                  onChange={(e) => {
                    setPressureClass(e.target.value);
                    setLowConfig('');
                    setSeries('');
                    setSelectedModel('');
                  }}
                  className="w-full px-4 py-3 bg-white border border-[#C7DAFF] rounded-xl text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                >
                  <option value="" className="bg-white">Select Pressure</option>
                  <option value="low" className="bg-white">Low Pressure</option>
                  <option value="medium" className="bg-white">Medium Pressure</option>
                  <option value="high" className="bg-white">High Pressure</option>
                </select>
                {pressureClass === 'low' && (
                  <p className="mt-2 text-xs text-[#64748B]">SISW: NBR, NBS, NBRS, NC, NBXI, NP — DIDW: NBR-D, NBS-D</p>
                )}
              </div>
              {pressureClass === 'low' && (
                <div className="bg-white rounded-xl p-4 border border-[#E5EDFF]">
                  <label className="block text-lg font-semibold text-[#1F3B73] mb-3">Configuration</label>
                  <select
                    value={lowConfig}
                    onChange={(e) => {
                      setLowConfig(e.target.value);
                      setSeries('');
                      setSelectedModel('');
                    }}
                    className="w-full px-4 py-3 bg-white border border-[#C7DAFF] rounded-xl text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                  >
                    <option value="" className="bg-white">Select Configuration</option>
                    <option value="sisw" className="bg-white">SISW</option>
                    <option value="didw" className="bg-white">DIDW</option>
                  </select>
                </div>
              )}
              <div className="bg-white rounded-xl p-4 border border-[#E5EDFF]">
                <label className="block text-lg font-semibold text-[#1F3B73] mb-3">Series</label>
                <select
                  value={series}
                  onChange={(e) => {
                    setSeries(e.target.value);
                    setSelectedModel('');
                  }}
                  disabled={
                    !pressureClass || (pressureClass === 'low' && !lowConfig)
                  }
                  className="w-full px-4 py-3 bg-white border border-[#C7DAFF] rounded-xl text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent disabled:bg-[#F1F5FF] disabled:text-[#94A3B8]"
                >
                  <option value="" className="bg-white">Select Series</option>
                  {getSeriesOptions().map((s) => (
                    <option key={s} value={s} className="bg-white">
                      {s}
                    </option>
                  ))}
                </select>
                {(series === 'NC' || series === 'NBXI') && (
                  <p className="mt-2 text-xs text-[#64748B]">NC/NBXI: نفس قاعدة بيانات NBR</p>
                )}
              </div>
            </div>
          )}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-[#1E3A8A]">Data Points</h3>
              <button
                onClick={loadExampleData}
                disabled={!selectedModel}
                className="px-6 py-3 bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] text-white rounded-xl font-semibold hover:from-[#3B82F6] hover:to-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:ring-offset-2 focus:ring-offset-white disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 border border-transparent hover:border-[#F59E0B]"
              >
                Load Model Data
              </button>
            </div>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">{error}</div>
            )}
            <div className="space-y-4">
              {dataPoints.map((point, index) => (
                <div key={index} className="bg-white rounded-xl p-4 border border-[#E5EDFF] relative">
                  <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#FDBA74]"></span>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">RPM</label>
                      <input
                        type="number"
                        step="any"
                        value={point.rpm}
                        onChange={(e) => handleInputChange(index, 'rpm', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-[#C7DAFF] rounded-lg text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">Flow Rate</label>
                      <input
                        type="number"
                        value={point.flowRate}
                        onChange={(e) => handleInputChange(index, 'flowRate', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-[#C7DAFF] rounded-lg text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">Total Pressure</label>
                      <input
                        type="number"
                        value={point.totalPressure}
                        onChange={(e) => handleInputChange(index, 'totalPressure', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-[#C7DAFF] rounded-lg text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">Efficiency (%)</label>
                      <input
                        type="number"
                        value={point.efficiency}
                        onChange={(e) => handleInputChange(index, 'efficiency', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-[#C7DAFF] rounded-lg text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">LPA</label>
                      <input
                        type="number"
                        value={point.lpa}
                        onChange={(e) => handleInputChange(index, 'lpa', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-[#C7DAFF] rounded-lg text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#2563EB] transition-all duration-200 shadow disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed border border-transparent hover:border-[#F59E0B]"
            >
              {isLoading ? 'Calculating...' : 'Calculate'}
            </motion.button>
          </div>
          {showResults && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-white rounded-xl p-6 border border-[#E5EDFF] relative">
              <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#FDBA74]"></span>
              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Results</h3>
              <div className="mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[#334155] mb-2">Next RPM</label>
                    <input
                      type="number"
                      step="any"
                      value={nextRpm}
                      onChange={(e) => setNextRpm(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-[#C7DAFF] rounded-lg text-[#1F3B73] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent"
                      placeholder="Enter next RPM"
                    />
                  </div>
                  <button onClick={handleGenerateNextRpm} disabled={isGenerating} className="px-6 py-2 bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] text-white rounded-xl font-semibold hover:from-[#3B82F6] hover:to-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:ring-offset-2 focus:ring-offset-white disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 border border-transparent hover:border-[#F59E0B]">
                    {isGenerating ? (
                      <div className="flex items-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Generating...
                      </div>
                    ) : (
                      'Generate Next RPM'
                    )}
                  </button>
                </div>
                {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#334155] mb-2">Select RPM</label>
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
                                ? 'bg-[#60A5FA] text-white shadow'
                                : 'bg-white border border-[#C7DAFF] text-[#1F3B73] hover:bg-[#EEF4FF]'
                            }`}
                          >
                            {rpm} RPM
                          </button>
                        ))}
                    </div>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
                </div>
              </div>
              <div className="relative mb-6">
                <div className="overflow-x-auto">
                  <div className="max-h-[500px] overflow-y-auto rounded-lg border border-[#E5EDFF] bg-white">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[#EEF4FF] z-10">
                        <tr>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">RPM</th>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">Flow Rate</th>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">Total Pressure</th>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">Velocity</th>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">Efficiency</th>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">Brake Power</th>
                          <th className="px-4 py-3 text-[#1F3B73] font-semibold">LPA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nextRpmPoints.map((point, index) => (
                          <tr key={index} className="border-b border-[#E5EDFF] hover:bg-[#F7FAFF] transition-colors duration-150">
                            <td className="px-4 py-3 text-[#334155]">{point.rpm}</td>
                            <td className="px-4 py-3 text-[#334155]">{point.flowRate}</td>
                            <td className="px-4 py-3 text-[#334155]">{point.totalPressure}</td>
                            <td className="px-4 py-3 text-[#334155]">{point.velocity}</td>
                            <td className="px-4 py-3 text-[#334155]">{point.efficiency}%</td>
                            <td className="px-4 py-3 text-[#334155]">{point.brakePower}</td>
                            <td className="px-4 py-3 text-[#334155]">{point.lpa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-[#E5EDFF]">
                  <h4 className="text-lg font-medium text-[#1E3A8A] mb-2">Quadratic Coefficients</h4>
                  <div className="space-y-2">
                    <p className="text-[#334155]">a: {quadraticCoefficients.a?.toFixed(6) || '0.000000'}</p>
                    <p className="text-[#334155]">b: {quadraticCoefficients.b?.toFixed(6) || '0.000000'}</p>
                    <p className="text-[#334155]">c: {quadraticCoefficients.c?.toFixed(6) || '0.000000'}</p>
                  </div>
                </div>
                {fanType === 'centrifugal' && ( // Display quartic coefficients for centrifugal
                  <div className="bg-white rounded-lg p-4 border border-[#E5EDFF]">
                    <h4 className="text-lg font-medium text-[#1E3A8A] mb-2">Quartic Coefficients</h4>
                    <div className="space-y-2">
                      <p className="text-[#334155]">a: {quarticCoefficients.a?.toFixed(6) || '0.000000'}</p>
                      <p className="text-[#334155]">b: {quarticCoefficients.b?.toFixed(6) || '0.000000'}</p>
                      <p className="text-[#334155]">c: {quarticCoefficients.c?.toFixed(6) || '0.000000'}</p>
                      <p className="text-[#334155]">d: {quarticCoefficients.d?.toFixed(6) || '0.000000'}</p>
                      <p className="text-[#334155]">e: {quarticCoefficients.e?.toFixed(6) || '0.000000'}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default FlowCalculate; 