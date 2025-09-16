import { useState } from 'react';
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
    'DIRECT_DRIVE_WITH_FREQUANCY_DRIVE'
  ];

  // Mapping helpers
  const mapDriveToCode = (drive) => {
    switch (drive) {
      case 'DIRECT_DRIVE': return 'DD';
      case 'BELT_DRIVE': return 'BD';
      case 'DIRECT_DRIVE_WITH_FREQUANCY_DRIVE': return 'BDWF';
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
        setSelectedIndex(0);
        setError('');
        setNotification({ type: 'success', message: 'Search created successfully' });
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

  const isFormComplete = (
    searchData.flowRate !== '' &&
    (isJetFan ? true : searchData.staticPressure !== '') &&
    fanCategory !== '' &&
    (fanCategory !== 'axial' || (axialType !== '' && driveType !== ''))
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

    searchMutation.mutate(payload);
  };

  const selected = apiResults[selectedIndex];
  const closestPoint = selected?.closestPoint;

  // Try to detect the 1000-point series from API result
  const findPointSeries = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    // Prefer common property names first
    const candidateKeys = [
      'points',
      'generatedPoints',
      'curvePoints',
      'curve',
      'dataPoints',
      'allPoints',
      'series',
      'samples'
    ];
    for (const key of candidateKeys) {
      const v = obj?.[key];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        const p = v[0];
        if ('flowRate' in p && ('totalPressure' in p || 'brakePower' in p)) return v;
      }
    }
    // Fallback: scan all object values to find an array of points
    for (const key in obj) {
      const v = obj[key];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        const p = v[0];
        if ('flowRate' in p && ('totalPressure' in p || 'brakePower' in p)) return v;
      }
    }
    return [];
  };

  const curvePoints = findPointSeries(selected);

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
      x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Flow Rate (m3/s)', color: '#1F2937', font: { size: 14, weight: 'bold' }, padding: { top: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: {}, beginAtZero: true, min: 0 },
      y: { type: 'linear', title: { display: true, text: 'Total Pressure (Pa)', color: '#1F2937', font: { size: 14, weight: 'bold' }, padding: { bottom: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: {}, beginAtZero: true, min: 0 }
    },
    interaction: { intersect: false, mode: 'nearest' },
    elements: { point: { zIndex: 2 }, line: { tension: 0.4, cubicInterpolationMode: 'monotone' } }
  };

  const powerChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: { ...chartOptions.plugins.title, text: 'Flow Rate vs Brake Power (m3/s)' },
      tooltip: { ...chartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} m3/s`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)}`]; } } }
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
        label: 'Curve',
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
        label: 'Closest Point',
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
      { label: 'Closest Point', data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.totalPressure) }], backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(234,88,12)', borderWidth: 3, pointRadius: 8, showLine: false }
    ]
  } : null);

  const powerChartData = (curvePoints && curvePoints.length > 0) ? {
    datasets: [
      {
        label: 'Brake Power Curve',
        data: curvePoints.map(p => ({ x: parseFloat(p.flowRate), y: parseFloat(p.brakePower) })),
        backgroundColor: 'rgba(99,163,255,0.3)',
        borderColor: 'rgb(56,132,255)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(56,132,255)',
        pointBorderColor: 'rgba(56,132,255,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Closest Point',
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
      { label: 'Closest Point', data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.brakePower) }], backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(234,88,12)', borderWidth: 3, pointRadius: 8, showLine: false }
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
        label: 'Closest Point',
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
      { label: 'Closest Point', data: [{ x: parseFloat(closestPoint.flowRate), y: parseFloat(closestPoint.efficiency) }], backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(234,88,12)', borderWidth: 3, pointRadius: 8, showLine: false }
    ]
  } : null);

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-8 p-6 ">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-[#1E3A8A]">Flow Search</h2>
          <p className="text-[#475569]">Search for flow rates and pressures in your system</p>
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
                  <input type="radio" name="fanCategory" checked={fanCategory==='axial'} onChange={() => { setFanCategory('axial'); setAxialType(''); setDriveType(''); }} />
                  <span>Axial</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="fanCategory" checked={fanCategory==='centrifugal'} onChange={() => { setFanCategory('centrifugal'); setAxialType(''); setDriveType(''); }} />
                  <span>Centrifugal</span>
                </label>
              </div>
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
                {apiResults.map((r, idx) => (
                  <button key={idx} onClick={() => setSelectedIndex(idx)} className={`text-left p-3 rounded border ${selectedIndex===idx ? 'border-[#93C5FD] ring-2 ring-[#93C5FD]' : 'border-[#E5EDFF]'}`}>
                    <div className="text-[#1E3A8A] font-medium">Model: {r.model?.name}</div>
                    <div className="text-[#334155] text-sm">RPM: {r.rpm?.rpm}</div>
                    <div className="text-[#64748B] text-xs">Avg Err: {r.closestPoint?.averageError?.toFixed?.(4)}</div>
                  </button>
                ))}
              </div>
            </div>

            {closestPoint && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                  <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Closest Point</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white rounded-xl border border-[#E5EDFF]">
                      <tbody className="divide-y divide-[#E5EDFF] text-[#334155]">
                        <tr><td className="py-2 px-4">Flow Rate</td><td className="py-2 px-4">{Number(closestPoint.flowRate).toFixed(6)} m3/s</td></tr>
                        <tr><td className="py-2 px-4">Total Pressure</td><td className="py-2 px-4">{Number(closestPoint.totalPressure).toFixed(6)} Pa</td></tr>
                        <tr><td className="py-2 px-4">Velocity</td><td className="py-2 px-4">{Number(closestPoint.velocity).toFixed(6)} m/s</td></tr>
                        <tr><td className="py-2 px-4">Efficiency</td><td className="py-2 px-4">{Number(closestPoint.efficiency).toFixed(6)} %</td></tr>
                        <tr><td className="py-2 px-4">Brake Power</td><td className="py-2 px-4">{Number(closestPoint.brakePower).toFixed(6)} kw</td></tr>
                        <tr><td className="py-2 px-4">LPA</td><td className="py-2 px-4">{Number(closestPoint.lpa).toFixed(6)} db</td></tr>
                        <tr><td className="py-2 px-4">Dynamic Pressure</td><td className="py-2 px-4">{Number(closestPoint.dynamicPressure).toFixed(6)} Pa</td></tr>
                        <tr><td className="py-2 px-4">Flow Rate Error</td><td className="py-2 px-4">{Number(closestPoint.flowRateError).toFixed(6)}</td></tr>
                        <tr><td className="py-2 px-4">Total Pressure Error</td><td className="py-2 px-4">{Number(closestPoint.totalPressureError).toFixed(6)}</td></tr>
                        <tr><td className="py-2 px-4">Average Error</td><td className="py-2 px-4">{Number(closestPoint.averageError).toFixed(6)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  {/* <div className="mt-4">
                    <h4 className="text-[#1E3A8A] font-medium mb-2">Raw closestPoint (from API)</h4>
                    <pre className="text-xs bg-[#F8FAFF] border border-[#E5EDFF] rounded p-3 overflow-auto max-h-64 text-[#334155]">
{JSON.stringify(closestPoint, null, 2)}
                    </pre>
                  </div> */}
                </div>

                <div className="grid grid-cols-1 gap-8">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                    <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Pressure Chart</h3>
                    <div className="h-80">
                      <Scatter data={pressureChartData} options={chartOptions} />
                    </div>
                  </div>
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
                        <Scatter data={powerChartData} options={powerChartOptions} />
                      ) : (
                        <Scatter data={efficiencyChartData} options={efficiencyChartOptions} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FlowSearch; 