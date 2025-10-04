import { useState } from 'react';
import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useSelector } from 'react-redux';
import { Scatter } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { useMutation } from '@tanstack/react-query';
import api from '../redux/api';
import logoImg from '../assets/logo.png';
import { dimensionsData, getDimensionsData, getModelDimensions } from "../Data/dimensions.js";

// Register ChartJS components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const FlowSearch = () => {
  const [searchData, setSearchData] = useState({
    flowRate: '',
    staticPressure: ''
  });
  const [flowUnit, setFlowUnit] = useState('m3/s');
  const [pressureUnit, setPressureUnit] = useState('Pa');
  const [fanCategory, setFanCategory] = useState('');
  const [axialType, setAxialType] = useState(''); // store enum code like NEID, NEI2D
  const [driveType, setDriveType] = useState('');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null); // {type,message}
  const [apiResults, setApiResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [chartView, setChartView] = useState('power'); // 'power' | 'efficiency'
  const [pressureChartView, setPressureChartView] = useState('total'); // 'total' | 'static'
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfCharts, setPdfCharts] = useState({ pressure: false, power: true, efficiency: false });
  const [pdfPressureChartType, setPdfPressureChartType] = useState('total'); // 'total' | 'static'
  const [activeTab, setActiveTab] = useState('configuration'); // 'configuration' | 'dimensions'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  
  // New state for dynamically loaded points
  const [modelPoints, setModelPoints] = useState({}); // { rpmId: points[] }
  const [loadingPoints, setLoadingPoints] = useState({}); // { rpmId: boolean }

  // Centrifugal selection state
  const [pressureClass, setPressureClass] = useState(''); // low | medium | high
  const [lowConfig, setLowConfig] = useState(''); // sisw | didw (for low)
  const [series, setSeries] = useState(''); // NBR, NBS, NBRS, NC, NBXI, NBR-D, NBS-D, NPD, NPE, NPF

  // Chart refs for exporting images
  const pressureChartRef = useRef(null);
  const staticPressureChartRef = useRef(null);
  const powerChartRef = useRef(null);
  const efficiencyChartRef = useRef(null);

  // Dynamically import all axial images (handles spaces/parentheses)
  const axialImages = import.meta.glob('../assets/axial/*', { eager: true });
  const getImageUrl = (codeOrLabel) => {
    for (const path in axialImages) {
      const mod = axialImages[path];
      const url = mod?.default || mod;
      if (path.includes(codeOrLabel)) return url;
    }
    return undefined;
  };

  // Centrifugal series images (placeholders under assets/centrifugal)
  const centrifugalImages = import.meta.glob('../assets/centrifugal/*', { eager: true });
  const getCentrifugalImage = (code) => {
    for (const path in centrifugalImages) {
      const mod = centrifugalImages[path];
      const url = mod?.default || mod;
      if (path.toUpperCase().includes(code.toUpperCase())) return url;
    }
    return undefined;
  };

  // Dimensions images resolver for Vercel/static builds
  const dimensionImages = import.meta.glob('../assets/dimensions/*', { eager: true });
  const resolveDimensionImage = (maybePath) => {
    if (!maybePath) return undefined;
    // Already a full URL
    if (/^https?:\/\//i.test(maybePath)) return maybePath;
    // Normalize and extract filename (case-insensitive)
    const needle = String(maybePath).split('/').pop();
    if (!needle) return undefined;
    const needleLower = needle.toLowerCase();
    for (const path in dimensionImages) {
      const mod = dimensionImages[path];
      const url = mod?.default || mod;
      const pathLower = path.toLowerCase();
      if (pathLower.endsWith(needleLower) || pathLower.includes(`/${needleLower}`)) return url;
    }
    // Fallback: try constructing URL relative to this module (vite will rewrite)
    try {
      const url = new URL(`../assets/dimensions/${needle}`, import.meta.url).href;
      return url;
    } catch (e) {
      console.warn('resolveDimensionImage failed for', maybePath, e);
      return undefined;
    }
  };

  // Universal image resolver for PDF (logo, axial types, centrifugal series, dimensions)
  const resolveAnyImage = (src) => {
    if (!src) return undefined;
    console.log('Resolving image:', src);
    
    // Already a full URL
    if (/^https?:\/\//i.test(src)) {
      console.log('Already full URL:', src);
      return src;
    }
    
    // Already a built asset URL (starts with /assets)
    if (typeof src === 'string' && src.startsWith('/assets/')) {
      console.log('Already asset URL:', src);
      return src;
    }
    
    // Try dimensions first
    const dim = resolveDimensionImage(src);
    if (dim) {
      console.log('Resolved via dimensions:', dim);
      return dim;
    }
    
    // Try match against axialImages
    const s = String(src).toLowerCase();
    for (const path in axialImages) {
      const mod = axialImages[path];
      const url = mod?.default || mod;
      if (path.toLowerCase().includes(s)) {
        console.log('Resolved via axialImages:', url);
        return url;
      }
    }
    
    // Try centrifugal images by code filename
    for (const path in centrifugalImages) {
      const mod = centrifugalImages[path];
      const url = mod?.default || mod;
      if (path.toLowerCase().includes(s)) {
        console.log('Resolved via centrifugalImages:', url);
        return url;
      }
    }
    
    // Try to extract filename and construct URL
    const filename = String(src).split('/').pop();
    if (filename) {
      // Try as asset URL
      const assetUrl = `/assets/${filename}`;
      console.log('Trying asset URL:', assetUrl);
      return assetUrl;
    }
    
    console.log('Using original src:', src);
    return src;
  };

  const axialCatalog = [
    { code: 'NEI2D', label: 'Axial jet fan (NEI2D)' },
    { code: 'NEI3D', label: 'Axial box inline (NEI3D)' },
    { code: 'NRT', label: 'Axial roof top (NRT)' },
    { code: 'NEIDS', label: 'Axial fire rated smoke (NEIDS)' },
    { code: 'NEID', label: 'Axial ducted (NEID)' },
    { code: 'NETD', label: 'Axial wall mounted  (NETD)' },
  ];
  const axialTypes = axialCatalog.map(item => ({
    id: `AX_${item.code}`,
    code: item.code,
    name: item.label,
    img: getImageUrl(item.code) || getImageUrl(item.label)
  }));

  // Centrifugal catalog (Series gallery) - moved outside conditional rendering for PDF access
  const getSeriesOptions = () => {
    if (pressureClass === 'low') {
      if (lowConfig === 'sisw') return ['NBR', 'NBS', 'NBRS', 'NC', 'NBXI'];
      if (lowConfig === 'didw') return ['NBR-D', 'NBS-D'];
      return [];
    }
    if (pressureClass === 'medium') return ['NPD', 'NPE'];
    if (pressureClass === 'high') return ['NPF'];
    return [];
  };
  
  // Get all possible series for image mapping
  const getAllSeriesOptions = () => {
    return ['NBR', 'NBS', 'NBRS', 'NC', 'NBXI', 'NBR-D', 'NBS-D', 'NPD', 'NPE', 'NPF'];
  };
  
  const seriesCards = getAllSeriesOptions().map(s => ({
    code: s,
    name: s,
    img: getCentrifugalImage(s) // expects files like NBR.png, NBS.png, ...
  }));
  
  const currentSeriesCards = getSeriesOptions().map(s => ({
    code: s,
    name: s,
    img: getCentrifugalImage(s)
  }));

  // From store we only need diameter for any client-side calc (not used now for API)
  const { diameter } = useSelector((state) => state.flow);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'staticPressure' && axialType === 'NEI2D') {
      return; // locked for NEI2D
    }
    setSearchData(prev => ({ ...prev, [name]: value }));
  };

  // Unit conversions kept for toggling input values only
  const convertFlowToM3S = (value, unit) => {
    const v = parseFloat(value);
    if (isNaN(v)) return 0;
    switch (unit) {
      case 'm3/s': return v;
      case 'm3/hr': return v / 3600;
      case 'l/s': return v / 1000;
      case 'cfm': return v * 0.00047194745;
      default: return v;
    }
  };
  const convertFlowFromM3S = (v, unit) => {
    const x = parseFloat(v); if (isNaN(x)) return '';
    switch (unit) {
      case 'm3/s': return x;
      case 'm3/hr': return x * 3600;
      case 'l/s': return x * 1000;
      case 'cfm': return x / 0.00047194745;
      default: return x;
    }
  };
  const convertPressureToPa = (value, unit) => {
    const v = parseFloat(value);
    if (isNaN(v)) return 0;
    switch (unit) {
      case 'Pa': return v;
      case 'InWc': return v * 249.08891;
      case 'kPa': return v * 1000;
      case 'bar': return v * 100000;
      default: return v;
    }
  };
  const convertPressureFromPa = (v, unit) => {
    const x = parseFloat(v); if (isNaN(x)) return '';
    switch (unit) {
      case 'Pa': return x;
      case 'InWc': return x / 249.08891;
      case 'kPa': return x / 1000;
      case 'bar': return x / 100000;
      default: return x;
    }
  };
  const handleFlowUnitChange = (e) => {
    const newUnit = e.target.value;
    if (searchData.flowRate === '' || searchData.flowRate === null) { setFlowUnit(newUnit); return; }
    const si = convertFlowToM3S(searchData.flowRate, flowUnit);
    const converted = convertFlowFromM3S(si, newUnit);
    setSearchData(prev => ({ ...prev, flowRate: String(converted) }));
    setFlowUnit(newUnit);
  };
  const handlePressureUnitChange = (e) => {
    const newUnit = e.target.value;
    if (axialType === 'NEI2D') { return; } // locked for NEI2D
    if (searchData.staticPressure === '' || searchData.staticPressure === null) { setPressureUnit(newUnit); return; }
    const si = convertPressureToPa(searchData.staticPressure, pressureUnit);
    const converted = convertPressureFromPa(si, newUnit);
    setSearchData(prev => ({ ...prev, staticPressure: String(converted) }));
    setPressureUnit(newUnit);
  };

  const isJetFan = axialType === 'NEI2D';
  const onSelectAxial = (code) => {
    setAxialType(code);
    if (code === 'NEI2D') {
      setSearchData(prev => ({ ...prev, staticPressure: '10' }));
      setPressureUnit('Pa');
    }
  };

  const beltHidden = isJetFan;
  const driveOptions = [
    'DIRECT_DRIVE',
    ...(beltHidden ? [] : ['BELT_DRIVE']),
    'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE'
  ];

  // Mapping helpers
  const mapDriveToCode = (drive) => {
    switch (drive) {
      case 'DIRECT_DRIVE': return 'DD';
      case 'BELT_DRIVE': return 'BD';
      case 'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE': return 'BDWF';
      default: return undefined;
    }
  };

  const searchMutation = useMutation({
    mutationFn: (payload) => api.post('/search', payload),
    onSuccess: (res) => {
      const ok = res?.data?.success;
      if (ok) {
        const results = res?.data?.data?.results || [];
        setApiResults(results);
        console.log(results);
        
        setSelectedIndex(0);
        setError('');
        setNotification({ type: 'success', message: 'Search created successfully' });
        
        // Clear previous points data when new search is performed
        setModelPoints({});
        setLoadingPoints({});
        
        // Automatically load points for the first model
        if (results.length > 0) {
          const firstResult = results[0];
          const rpmId = firstResult?.rpm?._id;
          if (rpmId) {
            setLoadingPoints(prev => ({ ...prev, [rpmId]: true }));
            fetchPointsMutation.mutate(rpmId);
          }
        }
      } else {
        setApiResults([]);
        setNotification({ type: 'error', message: res?.data?.message || 'Search failed' });
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Search request failed';
      setApiResults([]);
      setNotification({ type: 'error', message: msg });
    }
  });

  // Mutation to fetch points for a specific RPM
  const fetchPointsMutation = useMutation({
    mutationFn: (rpmId) => api.get(`/point/?rpmId=${rpmId}`),
    onSuccess: (res, rpmId) => {
      const points = res?.data?.data || res?.data || [];
      setModelPoints(prev => ({ ...prev, [rpmId]: points }));
      setLoadingPoints(prev => ({ ...prev, [rpmId]: false }));
    },
    onError: (err, rpmId) => {
      console.error('Failed to fetch points:', err);
      setLoadingPoints(prev => ({ ...prev, [rpmId]: false }));
      setNotification({ 
        type: 'error', 
        message: err?.response?.data?.message || 'Failed to load curve points' 
      });
    }
  });

  // Function to fetch points for a selected model
  const handleModelSelect = (index) => {
    setSelectedIndex(index);
    const selectedResult = apiResults[index];
    const rpmId = selectedResult?.rpm?._id;
    
    if (rpmId && !modelPoints[rpmId] && !loadingPoints[rpmId]) {
      setLoadingPoints(prev => ({ ...prev, [rpmId]: true }));
      fetchPointsMutation.mutate(rpmId);
    }
  };

  const isFormComplete = (
    searchData.flowRate !== '' &&
    (isJetFan ? true : searchData.staticPressure !== '') &&
    fanCategory !== '' &&
    (
      (fanCategory === 'axial' && axialType !== '' && driveType !== '') ||
      (fanCategory === 'centrifugal' && pressureClass !== '' && (pressureClass !== 'low' || lowConfig !== '') && series !== '' && driveType !== '')
    )
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setNotification(null);
    setApiResults([]);

    if (!isFormComplete) {
      setError('Please complete all required fields.');
      return;
    }

    const payload = {
      flowRate: Number(searchData.flowRate),
      flowRateUnit: flowUnit,
      staticPressure: Number(isJetFan ? 10 : searchData.staticPressure),
      staticPressureUnit: pressureUnit,
      modelType: fanCategory
    };

    if (fanCategory === 'axial') {
      payload.axialType = axialType; // enum code (NEID, NEI2D, ...)
      payload.axialOption = mapDriveToCode(driveType);
    }

    if (fanCategory === 'centrifugal') {
      payload.pressureType = pressureClass; // low | medium | high
      payload.configurationType = pressureClass === 'low' ? lowConfig.toUpperCase() : undefined; // SISW | DIDW
      payload.centrifugalType = series; // NBR, NBS, NBRS, etc.
      payload.axialOption = mapDriveToCode(driveType); // BD, DD, BDWF
    }

    searchMutation.mutate(payload);
  };

  const selected = apiResults[selectedIndex];
  const closestPoint = selected?.closestPoint;

  // Get points for the currently selected model from our dynamically loaded points
  const getCurrentModelPoints = () => {
    const rpmId = selected?.rpm?._id;
    return rpmId ? modelPoints[rpmId] || [] : [];
  };

  const curvePoints = getCurrentModelPoints();

  // Function to calculate static pressure from total pressure and velocity
  const calculateStaticPressure = (totalPressure, velocity) => {
    if (!totalPressure || !velocity) return 0;
    const rho = 1.225; // Air density at sea level (kg/m³)
    const dynamicPressure = 0.5 * rho * velocity * velocity;
    const staticPressure = totalPressure - dynamicPressure;
    return Math.max(0, staticPressure); // Ensure non-negative
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#1F2937', font: { size: 14, weight: 'bold' }, padding: 20 } },
      title: { display: true, text: 'Flow Rate vs Total Pressure (m3/s / Pa)', color: '#1F2937', font: { size: 16, weight: 'bold' }, padding: { top: 10, bottom: 20 } },
      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, titleColor: 'white', bodyColor: 'white', titleFont: { size: 14, weight: 'bold' }, bodyFont: { size: 13 },
        callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} m3/s`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)} Pa`]; } } }
    },
    scales: {
      x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Flow Rate (m3/s)', color: '#1F2937', font: { size: 14, weight: 'bold' }, padding: { top: 10 } }, grid: { color: 'rgba(0,0,0,0.8)' }, ticks: {}, beginAtZero: true, min: 0 },
      y: { type: 'linear', title: { display: true, text: 'Total Pressure (Pa)', color: '#1F2937', font: { size: 14, weight: 'bold' }, padding: { bottom: 10 } }, grid: { color: 'rgba(0,0,0,0.8)' }, ticks: {}, beginAtZero: true, min: 0 }
    },
    interaction: { intersect: false, mode: 'nearest' },
    elements: { point: { zIndex: 2 }, line: { tension: 0.4, cubicInterpolationMode: 'monotone' } }
  };

  const staticPressureChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: { ...chartOptions.plugins.title, text: 'Flow Rate vs Static Pressure (m3/s / Pa)' },
      tooltip: { ...chartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} m3/s`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)} Pa`]; } } }
    },
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, title: { ...chartOptions.scales.y.title, text: 'Static Pressure (Pa)' } }
    }
  };

  const powerChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: { ...chartOptions.plugins.title, text: 'Flow Rate vs Brake Power (m3/s)' },
      tooltip: { ...chartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} m3/s`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)}`]; } } }
    },
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, title: { ...chartOptions.scales.y.title, text: 'Brake Power (kW)' } }
    }
  };

  const efficiencyChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: { ...chartOptions.plugins.title, text: 'Flow Rate vs Efficiency (m3/s / %)' },
      tooltip: { ...chartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} m3/s`, `${ctx.dataset.label}: ${p.y?.toFixed?.(2)}%`]; } } }
    },
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, title: { ...chartOptions.scales.y.title, text: 'Efficiency (%)' }, min: 0, max: 100 }
    }
  };

  // Build datasets for full curve + closest point overlay
  const pressureChartData = (curvePoints && curvePoints.length > 0) ? {
    datasets: [
      {
        label: 'Total Pressure Curve',
        data: curvePoints.map(p => ({ x: parseFloat(p.flowRate), y: parseFloat(p.totalPressure) })),
        backgroundColor: 'rgba(59,130,246,0.3)',
        borderColor: 'rgb(59,130,246)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(59,130,246)',
        pointBorderColor: 'rgba(59,130,246,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Working Point',
        data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.totalPressure) }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 6,
        showLine: false,
      }] : [])
    ]
  } : (closestPoint ? {
    datasets: [
      { label: 'Working Point', data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.totalPressure) }], backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(234,88,12)', borderWidth: 3, pointRadius: 8, showLine: false }
    ]
  } : null);

  const staticPressureChartData = (curvePoints && curvePoints.length > 0) ? {
    datasets: [
      {
        label: 'Static Pressure Curve',
        data: curvePoints.map(p => {
          const totalPressure = parseFloat(p.totalPressure);
          const velocity = parseFloat(p.velocity);
          const staticPressure = calculateStaticPressure(totalPressure, velocity);
          return { x: parseFloat(p.flowRate), y: staticPressure };
        }),
        backgroundColor: 'rgba(168,85,247,0.3)',
        borderColor: 'rgb(168,85,247)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(168,85,247)',
        pointBorderColor: 'rgba(168,85,247,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Working Point',
        data: [{
          x: parseFloat(closestPoint.flowRate), 
          y: calculateStaticPressure(parseFloat(closestPoint.totalPressure), parseFloat(closestPoint.velocity))
        }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 6,
        showLine: false,
      }] : [])
    ]
  } : (closestPoint ? {
    datasets: [
      { 
        label: 'Working Point', 
        data: [{ 
          x: parseFloat(closestPoint.flowRate), 
          y: calculateStaticPressure(parseFloat(closestPoint.totalPressure), parseFloat(closestPoint.velocity))
        }], 
        backgroundColor: 'rgb(251,146,60)', 
        borderColor: 'rgb(234,88,12)', 
        borderWidth: 3, 
        pointRadius: 8, 
        showLine: false 
      }
    ]
  } : null);

  const powerChartData = (curvePoints && curvePoints.length > 0) ? {
    datasets: [
      {
        label: 'Brake Power Curve',
        data: curvePoints.map(p => ({ x: parseFloat(p.flowRate), y: parseFloat(p.brakePower) })),
        backgroundColor: 'rgb(148, 148, 22 ,.3)',
        borderColor: 'rgb(148, 148, 22)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(99,102,241)',
        pointBorderColor: 'rgba(150,150,20,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Working Point',
        data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.brakePower) }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 6,
        showLine: false,
      }] : [])
    ]
  } : (closestPoint ? {
    datasets: [
      { label: 'Working Point', data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.brakePower) }], backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(234,88,12)', borderWidth: 3, pointRadius: 8, showLine: false }
    ]
  } : null);

  const efficiencyChartData = (curvePoints && curvePoints.length > 0) ? {
    datasets: [
      {
        label: 'Efficiency Curve',
        data: curvePoints.map(p => ({ x: parseFloat(p.flowRate), y: parseFloat(p.efficiency) })),
        backgroundColor: 'rgba(16,185,129,0.25)',
        borderColor: 'rgb(5,150,105)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(5,150,105)',
        pointBorderColor: 'rgba(5,150,105,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Working Point',
        data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.efficiency) }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 6,
        showLine: false,
      }] : [])
    ]
  } : (closestPoint ? {
    datasets: [
      { label: 'Working Point', data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.efficiency) }], backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(234,88,12)', borderWidth: 3, pointRadius: 8, showLine: false }
    ]
  } : null);

  const handleGeneratePdf = async () => {
    try {
      setPdfError('');
      setIsGeneratingPdf(true);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 40;

      // Prefer fetch->blob->FileReader for same-origin built assets
      const loadImageAsBase64 = (imageSrc) => {
        const resolved = resolveAnyImage(imageSrc) || imageSrc;
        console.log('Loading image for PDF:', resolved);
        
        return new Promise(async (resolve, reject) => {
          try {
            // First attempt: Direct fetch with blob conversion
            console.log('Attempting fetch for:', resolved);
            const resp = await fetch(resolved, { 
              cache: 'no-store',
              mode: 'cors',
              credentials: 'same-origin'
            });
            
            if (!resp.ok) {
              console.warn(`HTTP ${resp.status} for ${resolved}`);
              throw new Error(`HTTP ${resp.status}`);
            }
            
            const contentType = resp.headers.get('content-type') || '';
            console.log('Content type:', contentType);
            
            if (!contentType.toLowerCase().startsWith('image/')) {
              console.warn(`Non-image content-type: ${contentType} for ${resolved}`);
              throw new Error(`Non-image content-type: ${contentType}`);
            }
            
            const blob = await resp.blob();
            console.log('Blob size:', blob.size);
            
            const reader = new FileReader();
            reader.onloadend = () => {
              console.log('Successfully loaded image via fetch');
              resolve(reader.result);
            };
            reader.onerror = (e) => {
              console.error('FileReader error:', e);
              reject(e);
            };
            reader.readAsDataURL(blob);
            return;
            
          } catch (fetchError) {
            console.warn('Fetch failed, trying canvas method:', fetchError);
            
            // Fallback: Canvas method with multiple URL attempts
            const tryCanvasMethod = async (src) => {
              return new Promise((res, rej) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                  try {
                    console.log('Image loaded, creating canvas');
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    console.log('Canvas size:', canvas.width, 'x', canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    const dataURL = canvas.toDataURL('image/png');
                    console.log('Canvas conversion successful');
                    res(dataURL);
                  } catch (canvasError) {
                    console.error('Canvas error:', canvasError);
                    rej(canvasError);
                  }
                };
                
                img.onerror = (imgError) => {
                  console.error('Image load error:', imgError);
                  rej(imgError);
                };
                
                console.log('Setting image src:', src);
                img.src = src;
              });
            };

            try {
              // Try with resolved URL
              const dataURL = await tryCanvasMethod(resolved);
              resolve(dataURL);
            } catch (e1) {
              console.warn('Canvas method with resolved URL failed:', e1);
              
              try {
                // Try with original imageSrc
                if (imageSrc !== resolved) {
                  console.log('Trying with original imageSrc:', imageSrc);
                  const dataURL2 = await tryCanvasMethod(imageSrc);
                  resolve(dataURL2);
                  return;
                }
                
                // Try constructing public URL
                const filename = String(imageSrc).split('/').pop();
                if (filename && !filename.includes('http')) {
                  const publicUrl = `/${filename}`;
                  console.log('Trying public URL:', publicUrl);
                  const dataURL3 = await tryCanvasMethod(publicUrl);
                  resolve(dataURL3);
                  return;
                }
                
                throw e1;
              } catch (e2) {
                console.error('All image loading methods failed:', e2);
                reject(new Error(`Failed to load image: ${resolved}. Original error: ${fetchError.message}`));
              }
            }
          }
        });
      };

      // Helper function to draw table
      const drawTable = (data, columns, startX, startY, maxWidth) => {
        const colCount = columns.length;
        const colWidth = maxWidth / colCount;
        const rowHeight = 20;
        const headerHeight = 25;
        
        // Draw header
        doc.setFillColor(248, 250, 255);
        doc.rect(startX, startY, maxWidth, headerHeight, 'F');
        doc.setDrawColor(229, 237, 255);
        doc.setLineWidth(0.5);
        doc.rect(startX, startY, maxWidth, headerHeight);
        
        // Header text
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.setFont(undefined, 'bold');
        columns.forEach((col, idx) => {
          const x = startX + (idx * colWidth) + 5;
          const y = startY + 16;
          doc.text(col.label, x, y);
        });
        
        // Draw data rows
        data.forEach((row, rowIdx) => {
          const rowY = startY + headerHeight + (rowIdx * rowHeight);
          
          // Highlight selected model row
          if (row.model.includes(selected?.model?.name || '')) {
            doc.setFillColor(239, 246, 255);
            doc.rect(startX, rowY, maxWidth, rowHeight, 'F');
          }
          
          // Draw row border
          doc.setDrawColor(229, 237, 255);
          doc.rect(startX, rowY, maxWidth, rowHeight);
          
          // Draw column separators
          for (let i = 1; i < colCount; i++) {
            const x = startX + (i * colWidth);
            doc.line(x, rowY, x, rowY + rowHeight);
          }
          
          // Row text
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          doc.setFont(undefined, 'normal');
          columns.forEach((col, colIdx) => {
            const x = startX + (colIdx * colWidth) + 5;
            const y = rowY + 14;
            doc.text(String(row[col.key] || ''), x, y);
          });
        });
        
        return startY + headerHeight + (data.length * rowHeight) + 10;
      };

      // Header with logo and company details
      try {
        console.log('Loading logo for PDF:', logoImg);
        const logoBase64 = await loadImageAsBase64(logoImg);
        console.log('Logo loaded successfully');
        doc.addImage(logoBase64, 'PNG', 30, y, 200, 70);
      } catch (error) {
        console.error('Logo loading failed:', error);
        // Add text fallback
        doc.setFontSize(16);
        doc.setTextColor('#1e3a8a');
        doc.text('NOBEL ENGINEERING', 30, y + 35);
      }

      doc.setFontSize(11);
      doc.setTextColor('#0f172a');
      const rightX = 260;
      const lines = [
        '14th Helmy Abd El Aty St. Eight Zone, Nasr City, Cairo, Egypt',
        'E-mail: nobeleng@yahoo.com',
        'Tel&Fax: (00202)22718121 - (00202)22718125',
        'Customer service : (+2) 01065000130 – (+2) 01065000128',
        'Factories : Industrial area Anshas road in front of Abaza factory.'
      ];
      lines.forEach((t, i) => doc.text(t, rightX, y + 14 + i * 14));
      y += 100;

      // Title
      doc.setFontSize(16);
      doc.setTextColor('#1e3a8a');
      doc.text('Technical Submittal', pageWidth / 2, y, { align: 'center' });
      y += 22;

      // Selected info
      doc.setFontSize(12);
      doc.setTextColor('#334155');
      const selectedModel = selected?.model?.name || '';
      const selectedRpm = selected?.rpm?.rpm ?? '';
      const info = [
        `Category: ${fanCategory || '-'}`,
        ...(fanCategory === 'axial' ? [
          `Axial Type: ${axialType || '-'}`,
        ] : []),
        ...(fanCategory === 'centrifugal' ? [
          `Pressure Type: ${pressureClass || '-'}`,
          `Configuration: ${lowConfig ? lowConfig.toUpperCase() : '-'}`,
          `Centrifugal Type: ${series || '-'}`,
        ] : []),
        `Drive Type: ${driveType || '-'}`,
        `Model: ${selectedModel || '-'}`,
        `RPM: ${selectedRpm || '-'}`,
      ];
      const infoStartY = y;
      info.forEach((t) => { doc.text(t, 40, y); y += 16; });

      // Add selected product type image (axial or centrifugal)
      try {
        let productImage = null;
        let productName = '';
        
        if (fanCategory === 'axial') {
          const selAxial = axialTypes.find(t => t.code === axialType);
          productImage = selAxial?.img;
          productName = selAxial?.name || axialType;
        } else if (fanCategory === 'centrifugal') {
          const selCentrifugal = seriesCards.find(c => c.code === series);
          productImage = selCentrifugal?.img;
          productName = selCentrifugal?.name || series;
        }
        
        if (productImage) {
          console.log(`Loading ${fanCategory} product image for PDF:`, productImage);
          const productImageBase64 = await loadImageAsBase64(productImage);
          console.log(`${fanCategory} product image loaded successfully`);
          
          const img = new Image();
          img.src = productImageBase64;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            setTimeout(reject, 5000); // 5 second timeout
          });
          
          const naturalW = img.naturalWidth || 200;
          const naturalH = img.naturalHeight || 140;
          const maxW = 220;
          const maxH = 160;
          const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
          const imgW = Math.max(1, Math.round(naturalW * scale));
          const imgH = Math.max(1, Math.round(naturalH * scale));
          const imgX = pageWidth - 40 - imgW;
          const imgY = infoStartY - 4;
          
          doc.addImage(productImageBase64, 'PNG', imgX, imgY, imgW, imgH);
          y = Math.max(y, imgY + imgH + 8);
        } else {
          console.warn(`No ${fanCategory} product image found for:`, fanCategory === 'axial' ? axialType : series);
        }
      } catch (error) {
        console.error(`${fanCategory} product image loading failed:`, error);
        // Add text fallback
        doc.setFontSize(10);
        doc.setTextColor('#64748B');
        const productType = fanCategory === 'axial' ? axialType : series;
        doc.text(`Image not available for ${productType}`, pageWidth - 200, infoStartY + 20);
      }
      y += 8;

      // Working Point
      if (closestPoint) {
        doc.setFontSize(13);
        doc.setTextColor('#1e3a8a');
        doc.text('Working Point', 40, y);
        y += 10;
        doc.setFontSize(12);
        doc.setTextColor('#334155');
        const wpRows = [
          ['Flow Rate', `${Number(closestPoint.flowRate).toFixed(6)} m3/s`],
          ['Total Pressure', `${Number(closestPoint.totalPressure).toFixed(6)} Pa`],
          ['Static Pressure', `${calculateStaticPressure(Number(closestPoint.totalPressure), Number(closestPoint.velocity)).toFixed(6)} Pa`],
          ['Efficiency', `${Number(closestPoint.efficiency).toFixed(2)} %`],
          ['Brake Power', `${Number(closestPoint.brakePower).toFixed(6)} kw`],
          ['Installed', `${(Number(closestPoint.brakePower) * 1.15).toFixed(6)} kw`],
        ];
        const marginX = 40;
        const gap = 24;
        const colWidth = (pageWidth - marginX * 2 - gap) / 2;
        const rowsPerCol = Math.ceil(wpRows.length / 2);
        const leftRows = wpRows.slice(0, rowsPerCol);
        const rightRows = wpRows.slice(rowsPerCol);
        const rowHeight = 24;
        const cellPadding = 8;
        
        const drawCol = (x, startY, rows) => {
          doc.setDrawColor(229, 237, 255);
          doc.setLineWidth(0.5);
          rows.forEach((row, idx) => {
            const rowTop = startY + idx * rowHeight;
            const textY = rowTop + 16;
            doc.rect(x, rowTop, colWidth, rowHeight);
            doc.setFont(undefined, 'bold');
            doc.text(`${row[0]}:`, x + cellPadding, textY);
            doc.setFont(undefined, 'normal');
            doc.text(String(row[1]), x + cellPadding + 110, textY);
          });
        };
        
        const tableTop = y + 8;
        drawCol(marginX, tableTop, leftRows);
        drawCol(marginX + colWidth + gap, tableTop, rightRows);
        y = tableTop + rowsPerCol * rowHeight + 22;
      }

      // Add dimensions section
      try {
        const dimensionsData = getDimensionsData(axialType, selected?.model?.name);
        if (dimensionsData) {
          // Check if we need a new page
          if (y + 300 > pageHeight - 40) {
            doc.addPage();
            y = 40;
          }
          
          // Dimensions title
          doc.setFontSize(13);
          doc.setTextColor('#1e3a8a');
          doc.text('Dimensions', 40, y);
          y += 20;
          
          // Special handling for NEID with variants
          if (axialType === 'NEID' && dimensionsData.variants) {
            for (const [variantIndex, variant] of dimensionsData.variants.entries()) {
              // Check if we need a new page for each variant
              if (y + 250 > pageHeight - 40) {
                doc.addPage();
                y = 40;
              }
              
              // Variant title
              doc.setFontSize(12);
              doc.setTextColor('#1e3a8a');
              doc.text(variant.name, 40, y);
              y += 15;
              
              const leftColumnX = 40;
              const rightColumnX = pageWidth / 2 + 20;
              const columnWidth = (pageWidth - 100) / 2;
              const startY = y;
              
              // Left column: Dimensions data
              const selectedModelData = variant.data.find(row => 
                row.model.includes(selected?.model?.name || '')
              );
              
              if (selectedModelData) {
                doc.setFontSize(10);
                doc.setTextColor('#1e3a8a');
                doc.text('Dimensions Data', leftColumnX, y);
                y += 12;
                
                const rowHeight = 14;
                const labelWidth = 60;
                
                dimensionsData.columns.forEach((col, idx) => {
                  if (col.key === 'model') return; // Skip model column
                  
                  const rowY = y + (idx * rowHeight);
                  
                  // Draw background for each row
                  doc.setFillColor(248, 250, 255);
                  doc.rect(leftColumnX, rowY, columnWidth, rowHeight, 'F');
                  
                  // Draw border
                  doc.setDrawColor(229, 237, 255);
                  doc.setLineWidth(0.5);
                  doc.rect(leftColumnX, rowY, columnWidth, rowHeight);
                  
                  // Label (bold)
                  doc.setFontSize(8);
                  doc.setTextColor(71, 85, 105);
                  doc.setFont(undefined, 'bold');
                  doc.text(`${col.label}:`, leftColumnX + 3, rowY + 9);
                  
                  // Value
                  doc.setFontSize(8);
                  doc.setTextColor(51, 65, 85);
                  doc.setFont(undefined, 'normal');
                  doc.text(String(selectedModelData[col.key] || ''), leftColumnX + labelWidth, rowY + 9);
                });
                
                y += (dimensionsData.columns.length - 1) * rowHeight + 15;
              }
              
              // Right column: Variant image
              if (variant.image) {
                try {
                  console.log('Loading variant image for PDF:', variant.image);
                  const resolvedVariantUrl = resolveAnyImage(variant.image) || variant.image;
                  console.log('Resolved variant URL:', resolvedVariantUrl);
                  const variantImageBase64 = await loadImageAsBase64(resolvedVariantUrl);
                  console.log('Variant image loaded successfully');
                  
                  const img = new Image();
                  img.src = variantImageBase64;
                  await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    setTimeout(reject, 5000); // 5 second timeout
                  });
                  
                  const naturalW = img.naturalWidth || 400;
                  const naturalH = img.naturalHeight || 300;
                  
                  // Scale to fit right column
                  const maxWidth = columnWidth;
                  const maxHeight = 180;
                  const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH, 1);
                  const imgW = Math.max(1, Math.round(naturalW * scale));
                  const imgH = Math.max(1, Math.round(naturalH * scale));
                  
                  // Center image vertically in right column
                  const imageY = startY + 10;
                  
                  doc.addImage(variantImageBase64, 'PNG', rightColumnX, imageY, imgW, imgH);
                  
                  // Update y position to the bottom of the tallest column
                  y = Math.max(y, imageY + imgH + 20);
                } catch (error) {
                  console.error(`Variant image ${variant.name} loading failed:`, error);
                  // Add text fallback
                  doc.setFontSize(10);
                  doc.setTextColor('#64748B');
                  doc.text(`Image not available for ${variant.name}`, rightColumnX, startY + 20);
                }
              }
              
              y += 20; // Space between variants
            }
          } else {
            // Regular handling for other types
            const leftColumnX = 40;
            const rightColumnX = pageWidth / 2 + 20;
            const columnWidth = (pageWidth - 100) / 2;
            const startY = y;
            
            // Left column: Dimensions data table
            if (dimensionsData.data && dimensionsData.data.length > 0) {
              doc.setFontSize(11);
              doc.setTextColor('#1e3a8a');
              doc.text('Dimensions Data', leftColumnX, y);
              y += 15;
              
              const selectedModelData = dimensionsData.data.find(row => 
                row.model.includes(selected?.model?.name || '')
              );
              
              if (selectedModelData) {
                // Draw vertical list format
                const rowHeight = 16;
                const labelWidth = 80;
                
                dimensionsData.columns.forEach((col, idx) => {
                  if (col.key === 'model') return;
                  
                  const rowY = y + (idx * rowHeight);
                  
                  doc.setFillColor(248, 250, 255);
                  doc.rect(leftColumnX, rowY, columnWidth, rowHeight, 'F');
                  
                  doc.setDrawColor(229, 237, 255);
                  doc.setLineWidth(0.5);
                  doc.rect(leftColumnX, rowY, columnWidth, rowHeight);
                  
                  doc.setFontSize(9);
                  doc.setTextColor(71, 85, 105);
                  doc.setFont(undefined, 'bold');
                  doc.text(`${col.label}:`, leftColumnX + 5, rowY + 11);
                  
                  doc.setFontSize(9);
                  doc.setTextColor(51, 65, 85);
                  doc.setFont(undefined, 'normal');
                  doc.text(String(selectedModelData[col.key] || ''), leftColumnX + labelWidth, rowY + 11);
                });
                
                y += (dimensionsData.columns.length - 1) * rowHeight + 20;
              }
            }
            
            // Right column: Dimensions image
            if (dimensionsData.image) {
              try {
                console.log('Loading dimensions image for PDF:', dimensionsData.image);
                const resolvedUrl = resolveAnyImage(dimensionsData.image) || dimensionsData.image;
                console.log('Resolved dimensions URL:', resolvedUrl);
                const dimensionsImageBase64 = await loadImageAsBase64(resolvedUrl);
                console.log('Dimensions image loaded successfully');
                
                const img = new Image();
                img.src = dimensionsImageBase64;
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
                  setTimeout(reject, 5000); // 5 second timeout
                });
                
                const naturalW = img.naturalWidth || 400;
                const naturalH = img.naturalHeight || 300;
                const maxWidth = columnWidth;
                const maxHeight = 200;
                const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH, 1);
                const imgW = Math.max(1, Math.round(naturalW * scale));
                const imgH = Math.max(1, Math.round(naturalH * scale));
                
                const imageY = startY + 20;
                
                doc.addImage(dimensionsImageBase64, 'PNG', rightColumnX, imageY, imgW, imgH);
                
                y = Math.max(y, imageY + imgH + 20);
              } catch (error) {
                console.error('Dimensions image loading failed:', error);
                // Add text fallback
                doc.setFontSize(10);
                doc.setTextColor('#64748B');
                doc.text('Dimensions image not available', rightColumnX, startY + 40);
              }
            }
          }
        }
      } catch (error) {
        console.log('Dimensions section not loaded:', error);
      }

      // Charts
      const addChart = (title, chartRef) => {
        try {
          const chart = chartRef?.current;
          const imgData = chart?.toBase64Image?.();
          if (imgData) {
            if (y + 260 > doc.internal.pageSize.getHeight() - 40) {
              doc.addPage();
              y = 40;
            }
            doc.setFontSize(13);
            doc.setTextColor('#1e3a8a');
            doc.text(title, 40, y);
            y += 12;
            doc.addImage(imgData, 'PNG', 40, y, pageWidth - 80, 220);
            y += 236;
          }
        } catch (error) {
          console.log(`Chart ${title} not loaded:`, error);
        }
      };

      if (pdfCharts.pressure) {
        const chartTitle = pdfPressureChartType === 'total' ? 'Total Pressure Chart' : 'Static Pressure Chart';
        const chartRef = pdfPressureChartType === 'total' ? pressureChartRef : staticPressureChartRef;
        addChart(chartTitle, chartRef);
      }
      if (pdfCharts.power) addChart('Power Chart', powerChartRef);
      if (pdfCharts.efficiency) addChart('Efficiency Chart', efficiencyChartRef);

      doc.save(`technical-submittal-${selectedModel || 'selection'}.pdf`);
      setShowPdfModal(false);
    } catch (error) {
      console.error('PDF generation error:', error);
      setPdfError(error?.message || 'Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getCurrentDimensionsData = () => {
    if (!axialType || !selected?.model?.name) return null;
    return getDimensionsData(axialType, selected.model.name);
  };

  // In UI rendering for dimensions (non-PDF), resolve URLs too
  const resolveUiImage = (p) => resolveDimensionImage(p) || p;


  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-8 p-6 ">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-[#1E3A8A]">Selector</h2>
          <p className="text-[#475569]">Optimize your system with Nobel Fans's flow search tool</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className=" bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative">
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>

          {notification && (
            <div className={`mb-4 p-3 rounded ${notification.type==='success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {notification.message}
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Category</label>
              <div className="flex gap-3">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="fanCategory" checked={fanCategory==='axial'} onChange={() => { setFanCategory('axial'); setAxialType(''); setDriveType(''); setPressureClass(''); setLowConfig(''); setSeries(''); }} />
                  <span>Axial</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="fanCategory" checked={fanCategory==='centrifugal'} onChange={() => { setFanCategory('centrifugal'); setAxialType(''); setDriveType(''); setPressureClass(''); setLowConfig(''); setSeries(''); }} />
                  <span>Centrifugal</span>
                </label>
              </div>
              {fanCategory === 'centrifugal' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Select Pressure</label>
                    <select value={pressureClass} onChange={(e)=>{ setPressureClass(e.target.value); setLowConfig(''); setSeries(''); }} className="w-full px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                      <option value="">Select pressure</option>
                      <option value="low">Low Pressure</option>
                      <option value="medium">Medium Pressure</option>
                      <option value="high">High Pressure</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Select Configuration</label>
                    <select value={lowConfig} onChange={(e)=>{ setLowConfig(e.target.value); setSeries(''); }} className="w-full px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none" disabled={pressureClass !== 'low'}>
                      <option value="">Select configuration</option>
                      <option value="sisw">SISW</option>
                      <option value="didw">DIDW</option>
                    </select>
                  </div>
                  {pressureClass === 'low' && (
                    <p className="text-xs text-[#64748B]">SISW: NBR, NBS, NBRS, NC, NBXI — DIDW: NBR-D, NBS-D</p>
                  )}
                </div>
              )}
            </div>

            {fanCategory === 'axial' && (
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Axial Types</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {axialTypes.map(t => (
                    <button key={t.id} type="button" onClick={() => onSelectAxial(t.code)} className={`border rounded-lg p-2 hover:shadow transition ${axialType===t.code ? 'ring-2 ring-[#93C5FD] border-[#93C5FD]' : 'border-[#E5EDFF]'}`}>
                      {t.img && <img src={t.img} alt={t.name} className="w-full h-20 object-contain" />}
                      <div className="mt-2 text-xs text-[#1F3B73] text-center">{t.name}</div>
                    </button>
                  ))}
                </div>
                {axialType && (
                  <div className="mt-6 rounded-xl border border-[#E5EDFF] bg-white p-4">
                    <div className="text-[#1F3B73] text-sm font-semibold mb-3">{`${axialType} - ${axialTypes.find(a=>a.code === axialType)?.name}`}</div>
                    <div className="flex items-center gap-4">
                      {(() => { const sel = axialTypes.find(t => t.code === axialType); return sel?.img ? (
                        <img src={sel.img} alt={sel.name} className="w-full max-w-md h-56 object-contain mx-auto" />
                      ) : null; })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {fanCategory === 'axial' && axialType && (
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Drive Type</label>
                <select value={driveType} onChange={(e)=>setDriveType(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                  <option value="">Select drive type</option>
                  {driveOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {fanCategory === 'centrifugal' && (
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Centrifugal Type</label>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {currentSeriesCards.map(card => (
                      <button key={card.code} type="button" onClick={()=>setSeries(card.code)} className={`border rounded-lg p-2 hover:shadow transition ${series===card.code ? 'ring-2 ring-[#93C5FD] border-[#93C5FD]' : 'border-[#E5EDFF]'} ${(!pressureClass || (pressureClass==='low' && !lowConfig)) ? 'opacity-50 pointer-events-none' : ''}`}>
                        {card.img ? (
                          <img src={card.img} alt={card.name} className="w-full h-20 object-contain" />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center text-xs text-[#64748B]">{card.name}</div>
                        )}
                        <div className="mt-2 text-xs text-[#1F3B73] text-center">{card.name}</div>
                      </button>
                    ))}
                  </div>
                  {(series === 'NC' || series === 'NBXI') && (
                    <p className="text-xs text-[#64748B]">NC/NBXI: نفس قاعدة بيانات NBR</p>
                  )}
                  {series && (
                    <div className="mt-2 rounded-xl border border-[#E5EDFF] bg-white p-4">
                      <div className="text-[#1F3B73] text-sm font-semibold mb-3">{`${series} - Centrifugal Type`}</div>
                      <div className="flex items-center gap-4">
                        {(() => { const card = currentSeriesCards.find(c => c.code === series); return card?.img ? (
                          <img src={card.img} alt={card.name} className="w-full max-w-md h-56 object-contain mx-auto" />
                        ) : null; })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
           {fanCategory === 'centrifugal' && series && (
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Drive Type</label>
                <select value={driveType} onChange={(e)=>setDriveType(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                  <option value="">Select drive type</option>
                  {driveOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 ">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Flow Rate</label>
                <div className="flex gap-2">
                  <input type="number" step="any" name="flowRate" value={searchData.flowRate} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all" placeholder="Enter flow rate" />
                  <select value={flowUnit} onChange={handleFlowUnitChange} className="px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                    <option value="m3/s">m3/s</option>
                    <option value="m3/hr">m3/hr</option>
                    <option value="l/s">l/s</option>
                    <option value="cfm">cfm</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">Static Pressure</label>
                <div className="flex gap-2">
                  <input type="number" step="any" name="staticPressure" value={isJetFan ? '10' : searchData.staticPressure} onChange={handleInputChange} disabled={isJetFan} readOnly={isJetFan} className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all" placeholder="Enter static pressure" />
                  <select value={pressureUnit} onChange={handlePressureUnitChange} disabled={isJetFan} className="px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                    <option value="Pa">Pa</option>
                    <option value="InWc">InWc</option>
                    <option value="kPa">kPa</option>
                    <option value="bar">bar</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button type="submit" disabled={!isFormComplete || searchMutation.isPending} className={`px-6 py-3 rounded-xl shadow transition-all ${(!isFormComplete || searchMutation.isPending) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#1E3A8A] text-white hover:bg-[#1F3B73]'}`}>
                {searchMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Searching...
                  </span>
                ) : 'Search'}
              </button>
            </div>
          </form>
        </motion.div>

        {error && (<div className="text-center text-red-600">{error}</div>)}

        {apiResults.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="space-y-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {apiResults.map((r, idx) => {
                  const rpmId = r?.rpm?._id;
                  const isLoading = loadingPoints[rpmId];
                  const hasPoints = modelPoints[rpmId]?.length > 0;
                  
                  return (
                    <button 
                      key={idx} 
                      onClick={() => handleModelSelect(idx)} 
                      className={`text-left p-3 rounded border transition-all ${selectedIndex===idx ? 'border-[#93C5FD] ring-2 ring-[#93C5FD]' : 'border-[#E5EDFF]'}`}
                    >
                      <div className="text-[#1E3A8A] font-medium">Model: {r.model?.name} - {axialType}</div>
                      <div className="text-[#334155] text-sm">RPM: {r.rpm?.rpm}</div>
                      <div className="flex items-center gap-2 mt-2">
                        {isLoading ? (
                          <div className="flex items-center gap-1 text-xs text-[#64748B]">
                            <span className="w-3 h-3 border-2 border-[#93C5FD] border-t-transparent rounded-full animate-spin"></span>
                            Loading curve...
                          </div>
                        ) : hasPoints ? (
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Curve loaded
                          </div>
                        ) : selectedIndex === idx ? (
                          <div className="text-xs text-[#64748B]">Click to load curve</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {closestPoint && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                {/* Tab Navigation */}
                <div className="flex border-b border-[#E5EDFF] mb-6">
                  <button
                    onClick={() => setActiveTab('configuration')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'configuration'
                        ? 'border-[#1E3A8A] text-[#1E3A8A]'
                        : 'border-transparent text-[#64748B] hover:text-[#1E3A8A]'
                    }`}
                  >
                    Configuration
                  </button>
                  <button
                    onClick={() => setActiveTab('dimensions')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'dimensions'
                        ? 'border-[#1E3A8A] text-[#1E3A8A]'
                        : 'border-transparent text-[#64748B] hover:text-[#1E3A8A]'
                    }`}
                  >
                    Dimensions
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'configuration' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Working Point Table */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                      <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Working Point</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white rounded-xl border border-[#E5EDFF]">
                      <tbody className="divide-y divide-[#E5EDFF] text-[#334155]">
                          <tr><td className="py-2 px-4">RPM</td><td className="py-2 px-4">{selected?.rpm?.rpm}</td></tr>

                        <tr><td className="py-2 px-4">Flow Rate</td><td className="py-2 px-4">{Number(closestPoint.flowRate).toFixed(6)} m3/s</td></tr>
                        <tr><td className="py-2 px-4">Total Pressure</td><td className="py-2 px-4">{Number(closestPoint.totalPressure).toFixed(6)} Pa</td></tr>
                        <tr><td className="py-2 px-4">Static Pressure</td><td className="py-2 px-4">{calculateStaticPressure(Number(closestPoint.totalPressure), Number(closestPoint.velocity)).toFixed(6)} Pa</td></tr>
                            <tr><td className="py-2 px-4">Velocity</td><td className="py-2 px-4">{Number(closestPoint.velocity).toFixed(6)} m/s</td></tr>
                            <tr><td className="py-2 px-4">Efficiency</td><td className="py-2 px-4">{Number(closestPoint.efficiency).toFixed(6)} %</td></tr>
                            <tr><td className="py-2 px-4">Brake Power</td><td className="py-2 px-4">{Number(closestPoint.brakePower).toFixed(6)} kw</td></tr>
                            <tr><td className="py-2 px-4">Installed</td><td className="py-2 px-4">{(Number(closestPoint.brakePower) * 1.15).toFixed(6)} kw</td></tr>
                            <tr><td className="py-2 px-4">LPA</td><td className="py-2 px-4">{Number(closestPoint.lpa).toFixed(6)} db</td></tr>
                        <tr><td className="py-2 px-4">Dynamic Pressure</td><td className="py-2 px-4">{(0.5 * 1.225 * Number(closestPoint.velocity) * Number(closestPoint.velocity)).toFixed(6)} Pa</td></tr>
                        <tr><td className="py-2 px-4">Flow Rate Error</td><td className="py-2 px-4">{Number(closestPoint.flowRateError).toFixed(6)}</td></tr>
                        <tr><td className="py-2 px-4">Total Pressure Error</td><td className="py-2 px-4">{Number(closestPoint.totalPressureError).toFixed(6)}</td></tr>
                        <tr><td className="py-2 px-4">Average Error</td><td className="py-2 px-4">{Number(closestPoint.averageError).toFixed(6)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  
                </div>

                <div className="grid grid-cols-1 gap-8">
                      {/* Charts Section */}
                      {(() => {
                        const rpmId = selected?.rpm?._id;
                        const isLoadingPoints = loadingPoints[rpmId];
                        const hasPoints = curvePoints.length > 0;
                        
                        if (isLoadingPoints) {
                          return (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <div className="flex items-center justify-center py-12">
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 border-2 border-[#93C5FD] border-t-transparent rounded-full animate-spin"></span>
                                  <span className="text-[#64748B]">Loading curve data...</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        if (!hasPoints) {
                          return (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <div className="text-center py-12">
                                <div className="text-[#64748B] text-lg mb-2">No Curve Data</div>
                                <div className="text-[#9CA3AF] text-sm">Click on a model to load curve data</div>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <>
                            {/* Pressure Chart */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-[#1E3A8A]">{pressureChartView === 'total' ? 'Total Pressure Chart' : 'Static Pressure Chart'}</h3>
                                <div className="inline-flex bg-[#F1F5FF] rounded-lg border border-[#E5EDFF] overflow-hidden">
                                  <button type="button" onClick={()=>setPressureChartView('total')} className={`px-3 py-1 text-sm ${pressureChartView==='total' ? 'bg-white text-[#1E3A8A]' : 'text-[#475569]'}`}>Total</button>
                                  <button type="button" onClick={()=>setPressureChartView('static')} className={`px-3 py-1 text-sm ${pressureChartView==='static' ? 'bg-white text-[#1E3A8A]' : 'text-[#475569]'}`}>Static</button>
                                </div>
                              </div>
                              <div className="h-80">
                                {pressureChartView === 'total' ? (
                                  <Scatter ref={pressureChartRef} data={pressureChartData} options={chartOptions} />
                                ) : (
                                  <Scatter ref={staticPressureChartRef} data={staticPressureChartData} options={staticPressureChartOptions} />
                                )}
                                {/* Hidden counterpart to ensure refs are available for export */}
                                <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '900px', height: '500px', opacity: 0, pointerEvents: 'none' }}>
                                  {pressureChartView === 'total' ? (
                                    <Scatter ref={staticPressureChartRef} data={staticPressureChartData || { datasets: [] }} options={staticPressureChartOptions} />
                                  ) : (
                                    <Scatter ref={pressureChartRef} data={pressureChartData || { datasets: [] }} options={chartOptions} />
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Power/Efficiency Chart */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-[#1E3A8A]">{chartView === 'power' ? 'Power Chart' : 'Efficiency Chart'}</h3>
                                <div className="inline-flex bg-[#F1F5FF] rounded-lg border border-[#E5EDFF] overflow-hidden">
                                  <button type="button" onClick={()=>setChartView('power')} className={`px-3 py-1 text-sm ${chartView==='power' ? 'bg-white text-[#1E3A8A]' : 'text-[#475569]'}`}>Power</button>
                                  <button type="button" onClick={()=>setChartView('efficiency')} className={`px-3 py-1 text-sm ${chartView==='efficiency' ? 'bg-white text-[#1E3A8A]' : 'text-[#475569]'}`}>Efficiency</button>
                                </div>
                              </div>
                              <div className="h-80">
                                {chartView === 'power' ? (
                                  <Scatter ref={powerChartRef} data={powerChartData} options={powerChartOptions} />
                                ) : (
                                  <Scatter ref={efficiencyChartRef} data={efficiencyChartData} options={efficiencyChartOptions} />
                                )}
                                {/* Hidden counterpart to ensure refs are available for export */}
                                <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '900px', height: '500px', opacity: 0, pointerEvents: 'none' }}>
                                  {chartView === 'power' ? (
                                    <Scatter ref={efficiencyChartRef} data={efficiencyChartData || { datasets: [] }} options={efficiencyChartOptions} />
                                  ) : (
                                    <Scatter ref={powerChartRef} data={powerChartData || { datasets: [] }} options={powerChartOptions} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {activeTab === 'dimensions' && (
                  <div className="space-y-6">
                    {(() => {
                      const dimensionsData = getCurrentDimensionsData();
                      if (!dimensionsData) {
                        return (
                          <div className="text-center py-12">
                            <div className="text-[#64748B] text-lg mb-4">Model Dimensions</div>
                            <div className="text-[#9CA3AF] text-sm">Select a model to view dimensions</div>
                          </div>
                        );
                      }

                      // Special handling for NEID with variants
                      if (axialType === 'NEID' && dimensionsData.variants) {
                        return (
                          <div className="space-y-6">
                            {dimensionsData.variants.map((variant, variantIndex) => {
                              const selectedModelData = variant.data.find(row => 
                                row.model.includes(selected?.model?.name || '')
                              );
                              
                              return (
                                <div key={variantIndex} className="space-y-4">
                                  {/* Variant Title and Content */}
                                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                                    <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">{variant.name}</h3>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {/* Image */}
                                      {variant.image && (
                                        <div className="flex justify-center">
                                          <img 
                                            src={resolveUiImage(variant.image)} 
                                            alt={variant.name}
                                            className="max-w-full h-auto max-h-96 object-contain"
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              e.target.nextSibling.style.display = 'block';
                                            }}
                                          />
                                          <div style={{display: 'none'}} className="text-[#9CA3AF] text-sm">
                                            Image not available
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Dimensions Data */}
                                      {selectedModelData ? (
                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EDFF]">
                                          <h4 className="text-lg font-semibold text-[#1E3A8A] mb-3">
                                            Dimensions Data - {selectedModelData.model}
                                          </h4>
                                          <div className="space-y-2">
                                            {dimensionsData.columns.map((col, colIdx) => (
                                              <div key={colIdx} className="flex justify-between py-1 border-b border-[#E5EDFF] last:border-b-0">
                                                <span className="font-medium text-[#475569]">{col.label}:</span>
                                                <span className="text-[#334155]">{selectedModelData[col.key]}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-8">
                                          <div className="text-[#64748B] text-sm">No dimensions data found for this variant</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // Regular handling for other types
                      const selectedModelData = dimensionsData.data.find(row => 
                        row.model.includes(selected?.model?.name || '')
                      );

                      return (
                        <div className="space-y-6">
                          {/* Model Image */}
                          {dimensionsData.image && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">{dimensionsData.name}</h3>
                              <div className="flex justify-center">
                                <img 
                                  src={resolveUiImage(dimensionsData.image)} 
                                  alt={dimensionsData.name}
                                  className="max-w-full h-auto max-h-96 object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                  }}
                                />
                                <div style={{display: 'none'}} className="text-[#9CA3AF] text-sm">
                                  Image not available
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Dimensions Table */}
                          {selectedModelData ? (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">
                                Dimensions Data - {selectedModelData.model}
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="min-w-full bg-white rounded-xl border border-[#E5EDFF]">
                                  <thead className="bg-[#F8FAFF]">
                                    <tr className="text-left text-[#475569] border-b border-[#E5EDFF]">
                                      {dimensionsData.columns.map((col, idx) => (
                                        <th key={idx} className="py-3 px-4 font-semibold">{col.label}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#E5EDFF] text-[#334155]">
                                    <tr className="bg-blue-50">
                                      {dimensionsData.columns.map((col, colIdx) => (
                                        <td key={colIdx} className="py-3 px-4 font-medium">
                                          {selectedModelData[col.key]}
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <div className="text-center py-8">
                                <div className="text-[#64748B] text-lg mb-2">No dimensions data found</div>
                                <div className="text-[#9CA3AF] text-sm">Dimensions data not available for the selected model</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Hidden Charts for PDF Export - Always render these charts but hide them */}
                    <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '900px', height: '500px', opacity: 0, pointerEvents: 'none' }}>
                      {/* Total Pressure Chart */}
                      <Scatter ref={pressureChartRef} data={pressureChartData} options={chartOptions} />
                      
                      {/* Static Pressure Chart */}
                      <Scatter ref={staticPressureChartRef} data={staticPressureChartData} options={staticPressureChartOptions} />
                      
                      {/* Power Chart */}
                      <Scatter ref={powerChartRef} data={powerChartData} options={powerChartOptions} />
                      
                      {/* Efficiency Chart */}
                      <Scatter ref={efficiencyChartRef} data={efficiencyChartData} options={efficiencyChartOptions} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
        {apiResults.length > 0 && (
          <div className="flex justify-center">
            <button type="button" onClick={()=>setShowPdfModal(true)} className="mt-2 px-6 py-3 rounded-xl shadow bg-[#1E3A8A] text-white hover:bg-[#1F3B73]">
              Generate Technical Submittal
            </button>
          </div>
        )}
        {showPdfModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={()=>setShowPdfModal(false)} />
            <div className="relative bg-white rounded-xl border border-[#E5EDFF] p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-[#1E3A8A] mb-4">Generate Technical Submittal</h3>
              <div className="space-y-3 text-[#334155]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={pdfCharts.pressure} onChange={(e)=>setPdfCharts(prev=>({...prev, pressure: e.target.checked}))} />
                  <span>Include Pressure Chart</span>
                </label>
                {pdfCharts.pressure && (
                  <div className="ml-6 space-y-2">
                    <div className="text-sm font-medium text-[#475569]">Pressure Chart Type:</div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="pdfPressureType" 
                          value="total" 
                          checked={pdfPressureChartType === 'total'} 
                          onChange={(e)=>setPdfPressureChartType(e.target.value)} 
                        />
                        <span>Total Pressure</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="pdfPressureType" 
                          value="static" 
                          checked={pdfPressureChartType === 'static'} 
                          onChange={(e)=>setPdfPressureChartType(e.target.value)} 
                        />
                        <span>Static Pressure</span>
                      </label>
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={pdfCharts.power} onChange={(e)=>setPdfCharts(prev=>({...prev, power: e.target.checked}))} />
                  <span>Include Power Chart</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={pdfCharts.efficiency} onChange={(e)=>setPdfCharts(prev=>({...prev, efficiency: e.target.checked}))} />
                  <span>Include Efficiency Chart</span>
                </label>
                {pdfError && (
                  <div className="mt-2 p-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm">{pdfError}</div>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={()=>{ if(!isGeneratingPdf) setShowPdfModal(false); }} className="px-4 py-2 rounded-lg border border-[#E5EDFF] text-[#475569] disabled:opacity-50" disabled={isGeneratingPdf}>Cancel</button>
                <button type="button" onClick={handleGeneratePdf} disabled={isGeneratingPdf} className={`px-4 py-2 rounded-lg text-white ${isGeneratingPdf ? 'bg-[#93C5FD] cursor-not-allowed' : 'bg-[#1E3A8A] hover:bg-[#1F3B73]'}`}>
                  {isGeneratingPdf ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Generating...
                    </span>
                  ) : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowSearch; 