import { useState, useEffect } from 'react';
import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import AxialCategoryImg from '../assets/axial-sym.png';
import CentrifugalCategoryImg from '../assets/symbol-centrifugal.webp';
import NEI2DCatalog from '../assets/NEI2D-catalog.pdf';
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
import { getDescription } from "../Data/descriptions.js";

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
  const [lpaDistance, setLpaDistance] = useState('');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null); // {type,message}
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);
  const [apiResults, setApiResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [trackId, setTrackId] = useState('');
  const [chartView, setChartView] = useState('power'); // 'power' | 'efficiency'
  const [pressureChartView, setPressureChartView] = useState('total'); // 'total' | 'static'
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfCharts, setPdfCharts] = useState({ pressure: false, power: true, efficiency: false });
  const [pdfPressureChartType, setPdfPressureChartType] = useState('total'); // 'total' | 'static'
  const [activeTab, setActiveTab] = useState('configuration'); // 'configuration' | 'dimensions' | 'description'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  // Get user role from Redux store
  const userRole = useSelector((state) => state.auth.role);
  
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

  console.log(apiResults);
  
  // Preload critical images for faster loading
  useEffect(() => {
    const preloadImages = [
      AxialCategoryImg,
      CentrifugalCategoryImg,
      logoImg
    ];
    
    preloadImages.forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
    
    // Cleanup function to remove preload links when component unmounts
    return () => {
      preloadImages.forEach((src) => {
        const existingLink = document.querySelector(`link[href="${src}"]`);
        if (existingLink && existingLink.rel === 'preload') {
          document.head.removeChild(existingLink);
        }
      });
    };
  }, []);

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
    if (!code) return undefined;
    const wanted = String(code).trim().toUpperCase();
    let aliasWanted = wanted;
    if (wanted.includes('FAN SECTION TYPE')) {
      aliasWanted = wanted.includes('NBR-D') ? 'NBR-D FAN SECTION TYPE (NBC)' : (wanted.includes('NBS-D') ? 'NBS-D FAN SECTION TYPE (NBC)' : wanted);
    }

    // Helper to get filename without extension in UPPERCASE
    const getBase = (p) => {
      const filename = p.split('/').pop() || '';
      const noQuery = filename.split('?')[0];
      const noExt = noQuery.replace(/\.[a-zA-Z0-9]+$/, '');
      return noExt.toUpperCase();
    };

    // 1) Exact filename match (e.g., NBR.png should match code NBR and not NBR-D)
    for (const path in centrifugalImages) {
      const base = getBase(path);
      if (base === wanted || base === aliasWanted) {
        const mod = centrifugalImages[path];
        return mod?.default || mod;
      }
    }

    // 2) Fallback: substring match if exact not found
    for (const path in centrifugalImages) {
      const mod = centrifugalImages[path];
      const url = mod?.default || mod;
      const upper = path.toUpperCase();
      if (upper.includes(wanted) || upper.includes(aliasWanted)) return url;
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
    // { code: 'NEI2D', label: 'Axial jet fan (NEI2D)' }, // Hidden temporarily
    { code: 'NEI3D', label: 'Axial box inline (NEI3D)' },
    { code: 'NEI3D_FR', label: 'Axial box inline Fire Rated (NEI3D_FR)'},
    { code: 'NRT', label: 'Axial roof top (NRA)' },
    { code: 'NEIDS', label: 'Axial fire rated (NEIDS) (400°C / 2hrs)' },
    { code: 'NEID', label: 'Axial ducted (NEID)' },
    { code: 'NETD', label: 'Axial wall mounted  (NETD)' },
    { code: 'NETD_FR', label: 'Axial wall mounted Fire Rated (NETD_FR) (400°C / 2hrs)' },
    // New axial type: Range fan (shares NEIDS backend type, but different model range)
    // { code: 'HIGH_RANGE', label: 'High range axial fans' },
  ];
  const axialTypes = axialCatalog.map(item => ({
    id: `AX_${item.code}`,
    code: item.code,
    name: item.label,
    img: getImageUrl(item.imageKey || item.code) || getImageUrl(item.label)
  }));

  // Centrifugal catalog (Series gallery) - moved outside conditional rendering for PDF access
  // Temporarily hide some centrifugal series from UI
  const hiddenCentrifugalSeries = ['NC', 'NBXI', 'NP'];

  const getSeriesLabel = (code) => {
    if (code === 'NBRS') return 'Centrifugal fire rated (NBRS) (400°C / 2hrs)';
    return code;
  };

  const getSeriesOptions = () => {
    if (pressureClass === 'low') {
      if (lowConfig === 'sisw') return ['NBR', 'NBS', 'NBRS'];
      if (lowConfig === 'didw') return ['NBR-D', 'NBS-D', 'NBR-D FAN SECTION TYPE (NBC)', 'NBS-D FAN SECTION TYPE (NBC)'];
      return [];
    }
    if (pressureClass === 'medium') return ['NPD', 'NPE'];
    if (pressureClass === 'high') return ['NPF'];
    return [];
  };
  
  // Get all possible series for image mapping
  const getAllSeriesOptions = () => {
    return [
      'NBR',
      'NBS',
      'NBRS',
      'NBR-D',
      'NBS-D',
      'NBR-D FAN SECTION TYPE (NBC)',
      'NBS-D FAN SECTION TYPE (NBC)',
      'NPD',
      'NPE',
      'NPF'
    ].filter(s => !hiddenCentrifugalSeries.includes(s));
    //return ['NBR', 'NBS', 'NBRS', 'NC', 'NBXI', 'NP', 'NBR-D', 'NBS-D', 'NBR-D FAN SECTION TYPE', 'NBS-D FAN SECTION TYPE', 'NPD', 'NPE', 'NPF'];
  };
  
  const seriesCards = getAllSeriesOptions().map(s => ({
    code: s,
    name: getSeriesLabel(s),
    img: getCentrifugalImage(s) // expects files like NBR.png, NBS.png, ...
  }));
  
  const currentSeriesCards = getSeriesOptions().map(s => ({
    code: s,
    name: getSeriesLabel(s),
    img: getCentrifugalImage(s)
  }));

  // If a hidden series is currently selected, clear it
  useEffect(() => {
    if (fanCategory === 'centrifugal' && hiddenCentrifugalSeries.includes(series)) {
      setSeries('');
    }
  }, [fanCategory, series]);

  // From store we only need diameter for any client-side calc (not used now for API)
  const { diameter } = useSelector((state) => state.flow);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'staticPressure' && axialType === 'NEI2D') {
      return; // locked for NEI2D
    }
    setHasSearched(false);
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
      case 'cfm': return v / 2117.647;
      default: return v;
    }
  };
  const convertFlowFromM3S = (v, unit) => {
    const x = parseFloat(v); if (isNaN(x)) return '';
    switch (unit) {
      case 'm3/s': return x;
      case 'm3/hr': return x * 3600;
      case 'l/s': return x * 1000;
      case 'cfm': return x * 2117.647;
      default: return x;
    }
  };
  const convertPressureToPa = (value, unit) => {
    const v = parseFloat(value);
    if (isNaN(v)) return 0;
    switch (unit) {
      case 'Pa': return v;
      case 'InWc': return v * 250;
      case 'kPa': return v * 1000;
      case 'bar': return v * 100000;
      default: return v;
    }
  };
  const convertPressureFromPa = (v, unit) => {
    const x = parseFloat(v); if (isNaN(x)) return '';
    switch (unit) {
      case 'Pa': return x;
      case 'InWc': return x / 250;
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

  // Map special axial types to the effective backend type (for API payloads, dimensions, etc.)
  const getEffectiveAxialType = () => {
    if (axialType === 'HIGH_RANGE') return 'NEIDS';
    if (axialType === 'NEI3D_FR') return 'NEI3D';
    if (axialType === 'NETD_FR') return 'NETD';
    return axialType;
  };

  // Frontend-only display code for axial type (keep API code as NRT)
  const getAxialTypeDisplayCode = (code) => {
    if (!code) return '';
    if (code === 'NRT') return 'NRA';
    return code;
  };

  // LPA distance handling:
  // - Optional field
  // - If empty, use default 1.5 m (no correction applied)
  const rawLpaValue = parseFloat(lpaDistance);
  const isLpaProvided = lpaDistance !== '';
  const isLpaValid =
    !isLpaProvided ||
    (Number.isFinite(rawLpaValue) && rawLpaValue >= 1.5 && rawLpaValue <= 20);
  const effectiveLpaDistance = isLpaProvided && Number.isFinite(rawLpaValue)
    ? rawLpaValue
    : 1.5;
  const shouldApplyLpaCorrection =
    (fanCategory === 'axial' && axialType && axialType !== 'NEI2D') ||
    (fanCategory === 'centrifugal' && !!series);

  const onSelectAxial = (code) => {
    setHasSearched(false);
    setAxialType(code);
    if (code === 'NEI2D') {
      setSearchData(prev => ({ ...prev, staticPressure: '10' }));
      setPressureUnit('Pa');
    }
  };

  // Hide BELT_DRIVE for specific axial models only
  const beltHidden =
    fanCategory === 'axial' &&
    (isJetFan || ['NEI3D', 'NEI3D_FR', 'NRA', 'NEIDS', 'NETD', 'NETD_FR'].includes(axialType));
  
  // Check if it's NBR-D FAN SECTION TYPE or NBS-D FAN SECTION TYPE
  const isFanSectionType = series === 'NBR-D FAN SECTION TYPE (NBC)' || series === 'NBS-D FAN SECTION TYPE (NBC)';
  
  const driveOptions = isFanSectionType 
    ? ['BELT_DRIVE'] // Only BELT_DRIVE for Fan Section Type
    : [
        'DIRECT_DRIVE',
        ...(beltHidden ? [] : ['BELT_DRIVE']),
        'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE'
      ];

  // If BELT_DRIVE becomes invalid for selected axial model, fallback to DIRECT_DRIVE
  useEffect(() => {
    if (!isFanSectionType && beltHidden && driveType === 'BELT_DRIVE') {
      setDriveType('DIRECT_DRIVE');
    }
  }, [beltHidden, driveType, isFanSectionType]);

  // Auto-set driveType to BELT_DRIVE when Fan Section Type is selected
  useEffect(() => {
    if (isFanSectionType && driveType !== 'BELT_DRIVE') {
      setDriveType('BELT_DRIVE');
    }
  }, [isFanSectionType, driveType]);

  // Allow dimensions tab for axial without auto-redirect

  // Mapping helpers
  const mapDriveToCode = (drive) => {
    switch (drive) {
      case 'DIRECT_DRIVE': return 'DD';
      case 'BELT_DRIVE': return 'BD';
      case 'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE': return 'BDWF';
      default: return undefined;
    }
  };

  // Normalize series aliases to canonical codes for logic/API
  const normalizeSeries = (val) => {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'NBR-D FAN SECTION TYPE (NBC)') return 'NBR-D';
    if (s === 'NBS-D FAN SECTION TYPE (NBC)') return 'NBS-D';
    return s;
  };

  const searchMutation = useMutation({
    mutationFn: (payload) => api.post('/search', payload),
    onSuccess: (res) => {
      const ok = res?.data?.success;
      if (ok) {
        let results = res?.data?.data?.results || [];
        let trackId = res?.data?.data?.trackId;
        setTrackId(trackId);
        // Ensure UI returns to Search (configuration) after loading finishes
        setActiveTab('configuration');
        // If series is NBR-D/NBR_D or NBS-D/NBS_D, transform returned results per requested rules
        if (
          fanCategory === 'centrifugal' &&
          (
            ['NBR-D','NBR_D','NBS-D','NBS_D'].includes(normalizeSeries(series))
          )
        ) {
          const seriesNorm = normalizeSeries(series);
          const rpmFactor = ['NBS-D','NBS_D'].includes(seriesNorm) ? 1.012974052 : 1.0063559;
          const flowFactor = 2;
          const lpaAdd = 5.8;
          const brakePowerFactor = 2.059242;
          // const totalPressureFactor = 1.0649448;
          const dynamicPressureFactor = 1.180619;

          const efficiencyFactor = 1.023;
          results = results.map((r) => {
            const rpmObj = r?.rpm || {};
            const rpmVal = Number(rpmObj.rpm);
            const transformedRpmVal = Number.isFinite(rpmVal) ? Math.round(rpmVal * rpmFactor) : rpmObj.rpm;
            const newRpm = { ...rpmObj, rpm: transformedRpmVal };

          const cp = r?.closestPoint || {};
          const flow = Number(cp.flowRate);
          const dynP = Number(cp.dynamicPressure);
          const statP = Number(cp.staticPressure);

          const eff = Number(cp.efficiency);
          const bp = Number(cp.brakePower);
          const lpa = Number(cp.lpa);

            const newClosestPoint = {
              ...cp,
              flowRate: Number.isFinite(flow) ? flow * flowFactor : cp.flowRate,
              dynamicPressure: Number.isFinite(dynP) ? dynP * dynamicPressureFactor : cp.dynamicPressure,
              totalPressure: (Number.isFinite(dynP) ? dynP * dynamicPressureFactor : Number(cp.dynamicPressure) || 0) + (Number.isFinite(statP) ? statP : Number(cp.staticPressure) || 0),
              efficiency: Number.isFinite(eff) ? Math.min(100, eff * efficiencyFactor) : cp.efficiency,
              brakePower: Number.isFinite(bp) ? bp * brakePowerFactor : cp.brakePower,
              lpa: Number.isFinite(lpa) ? lpa + lpaAdd : cp.lpa,
            };

            return { ...r, rpm: newRpm, closestPoint: newClosestPoint };
          });
        }

        if (shouldApplyLpaCorrection && isLpaValid) {
          const referenceDistance = 1.5;
          const ratio = effectiveLpaDistance / referenceDistance;
          const delta = ratio > 0 ? 20 * Math.log10(ratio) : 0;

          results = results.map((r) => {
            const cp = r?.closestPoint || {};
            const oldLpa = Number(cp.lpa);
            const newLpa = Number.isFinite(oldLpa) && ratio > 0
              ? oldLpa - delta
              : cp.lpa;

            return {
              ...r,
              closestPoint: {
                ...cp,
                lpa: newLpa,
              },
            };
          });
        }
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
      console.error('Search request error:', err);
      console.error('Error response:', err?.response?.data);
      const msg = err?.response?.data?.message || err?.message || 'Search request failed';
      setApiResults([]);
      setNotification({ type: 'error', message: msg });
    },
    onSettled: () => {
      setActiveTab('configuration');
    }
  });

  // Mutation to fetch points for a specific RPM
  const fetchPointsMutation = useMutation({
    mutationFn: (rpmId) => api.get(`/point/?rpmId=${rpmId}`),
    onSuccess: (res, rpmId) => {
      let points = res?.data?.data || res?.data || [];
        // Apply NBR-D/NBR_D or NBS-D/NBS_D transformations to points like search results
      if (
        fanCategory === 'centrifugal' &&
        (
          ['NBR-D','NBR_D','NBS-D','NBS_D'].includes(normalizeSeries(series))
        )
      ) {
        const seriesNorm = normalizeSeries(series);
        const rpmFactor = ['NBS-D','NBS_D'].includes(seriesNorm) ? 1.012974052 : 1.0063559;
        const flowFactor = 2;
        const lpaAdd = 5.8;
        const brakePowerFactor = 2.059242;
        // const totalPressureFactor = 1.0649448;
        const dynamicPressureFactor = 1.180619;
        const efficiencyFactor = 1.023;
        points = points.map(p => {
          const rpm = Number(p.rpm);
          const flow = Number(p.flowRate);
          const statP = Number(p.staticPressure);
          // Fallback: derive dynamicPressure if missing
          const dynBase = Number.isFinite(Number(p.dynamicPressure))
            ? Number(p.dynamicPressure)
            : (Number.isFinite(Number(p.totalPressure)) && Number.isFinite(statP)
              ? Math.max(0, Number(p.totalPressure) - statP)
              : 0);
          const dynP = Number(dynBase);
          const eff = Number(p.efficiency);
          const bp = Number(p.brakePower);
          const lpa = Number(p.lpa);
          return {
            ...p,
            rpm: Number.isFinite(rpm) ? Math.round(rpm * rpmFactor) : p.rpm,
            flowRate: Number.isFinite(flow) ? flow * flowFactor : p.flowRate,
            dynamicPressure: Number.isFinite(dynP) ? dynP * dynamicPressureFactor : dynBase,
            totalPressure: (Number.isFinite(dynP) ? dynP * dynamicPressureFactor : dynBase) + (Number.isFinite(statP) ? statP : 0),

            efficiency: Number.isFinite(eff) ? Math.min(100, eff * efficiencyFactor) : p.efficiency,
            brakePower: Number.isFinite(bp) ? bp * brakePowerFactor : p.brakePower,
            lpa: Number.isFinite(lpa) ? lpa + lpaAdd : p.lpa,
          };
        });
      }
      // Log the transformed (or raw) points for debugging/verification
      console.log('[FlowSearch] Points (final, to be displayed):', points);
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
    ) &&
    (!shouldApplyLpaCorrection || isLpaValid)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setNotification(null);
    setApiResults([]);
    setHasSearched(true);

    if (!isFormComplete) {
      if (shouldApplyLpaCorrection && !isLpaValid) {
        setError('Please enter LPA distance between 1.5 and 20 meters (or leave it empty to use 1.5 m).');
      } else {
        setError('Please complete all required fields.');
      }
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
      // Use effective axial type so that special UI-only types (like NEIDS_RANGE) map to real backend enums
      payload.axialType = getEffectiveAxialType(); // enum code (NEID, NEI2D, NEIDS, ...)
      payload.axialOption = mapDriveToCode(driveType);
    }

    if (fanCategory === 'centrifugal') {
      payload.pressureType = pressureClass; // low | medium | high
      const seriesNorm = normalizeSeries(series);
      console.log('[FlowSearch] Series normalization:', { original: series, normalized: seriesNorm });

      if (['NBR-D','NBR_D','NBS-D','NBS_D'].includes(seriesNorm)) {
        payload.configurationType = 'SISW'
        payload.flowRate = Number(payload.flowRate) / 2;
        payload.centrifugalType = (seriesNorm.startsWith('NBR')) ? 'NBR' : 'NBS'
        console.log('[FlowSearch] NBR-D/NBS-D payload:', payload);

      } else if (['NBRS', 'NC', 'NBXI', 'NP'].includes(seriesNorm)) {
        // Map NBRS, NC, NBXI, NP to NBR with SISW configuration
        payload.configurationType = 'SISW'
        payload.centrifugalType = 'NBR'
  console.log('payload',payload);

      } else {
        payload.configurationType = pressureClass === 'low' ? lowConfig.toUpperCase() : undefined
        payload.centrifugalType = seriesNorm
  console.log('payload',payload);

      }
      payload.axialOption = mapDriveToCode(driveType); // BD, DD, BDWF
    }

    // Log the final payload being sent to the API
    console.log('[FlowSearch] Search payload:', payload);

    searchMutation.mutate(payload);
  };

  const selected = apiResults[selectedIndex];
  const closestPoint = selected?.closestPoint;

  // Static Efficiency = (Static Pressure (Pa) × Flow Rate (m³/s)) ÷ Brake Power × 1000
  // Note: API values are assumed to be in standard units (Pa and m³/s) as the UI already
  // converts from Pa/m³/s for charts. If the API returns different units, we convert using
  // optional fields on the point object: `flowRateUnit` and `staticPressureUnit`.
  const calculateStaticEfficiency = (point) => {
    if (!point) return null;
    const staticPressureRaw = Number(point.staticPressure);
    const flowRateRaw = Number(point.flowRate);
    const brakePowerRaw = Number(point.brakePower);

    if (!Number.isFinite(staticPressureRaw) || !Number.isFinite(flowRateRaw) || !Number.isFinite(brakePowerRaw)) {
      return null;
    }
    if (brakePowerRaw === 0) return null;

    const resultsFlowUnit = point.flowRateUnit || 'm3/s'; // optional from API
    const resultsStaticPressureUnit = point.staticPressureUnit || 'Pa'; // optional from API

    const flowRateM3S = resultsFlowUnit === 'm3/s'
      ? flowRateRaw
      : convertFlowToM3S(flowRateRaw, resultsFlowUnit);

    const staticPressurePa = resultsStaticPressureUnit === 'Pa'
      ? staticPressureRaw
      : convertPressureToPa(staticPressureRaw, resultsStaticPressureUnit);

    if (!Number.isFinite(flowRateM3S) || !Number.isFinite(staticPressurePa)) return null;

    return (staticPressurePa * flowRateM3S) / brakePowerRaw * 1000;
  };

  const workingPointStaticEfficiency = calculateStaticEfficiency(closestPoint);

  // Get points for the currently selected model from our dynamically loaded points
  const getCurrentModelPoints = () => {
    const rpmId = selected?.rpm?._id;
    return rpmId ? modelPoints[rpmId] || [] : [];
  };

  const curvePoints = getCurrentModelPoints();

  // Static and dynamic pressure now come from API; no client-side calculation needed

  // Helper functions for unit conversion and chart labels
  const getFlowUnitLabel = () => {
    switch (flowUnit) {
      case 'm3/s': return 'm³/s';
      case 'm3/hr': return 'm³/h';
      case 'l/s': return 'l/s';
      case 'cfm': return 'CFM';
      default: return 'm³/s';
    }
  };

  const getPressureUnitLabel = () => {
    switch (pressureUnit) {
      case 'Pa': return 'Pa';
      case 'InWc': return 'inWc';
      case 'kPa': return 'kPa';
      case 'bar': return 'bar';
      default: return 'Pa';
    }
  };

  const convertChartPressureValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return convertPressureFromPa(value, pressureUnit);
  };

  const convertChartFlowValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return convertFlowFromM3S(value, flowUnit);
  };

  // Extract a base model number token (e.g., "500" from "500 M624" or "500 H627")
  const getBaseModelNumber = (modelName) => {
    const s = String(modelName || '');
    // Prefer number before a letter token (e.g., 500 M..., 450 H...)
    let m = s.match(/\b(\d{2,5})\b\s*[A-Z]/i);
    if (m && m[1]) return m[1];
    // Fallback: first standalone number token
    m = s.match(/\b(\d{2,5})\b/);
    if (m && m[1]) return m[1];
    // Fallback: any digits
    m = s.match(/(\d+)/);
    return m ? m[1] : '';
  };

  // Apply model range filters for specific axial types (NEIDS/NEID <= 2240, Range fan > 2240)
  const filterResultsByAxialModelRange = (results) => {
    if (!Array.isArray(results)) return [];
    if (fanCategory !== 'axial' || !axialType) return results;

    const shouldFilter =
      axialType === 'NEIDS' ||
      axialType === 'NEID' ||
      axialType === 'HIGH_RANGE';
    if (!shouldFilter) return results;

    return results.filter((r) => {
      const modelName = r?.model?.name || '';
      const modelNumberStr = getBaseModelNumber(modelName);
      const modelNumber = Number(modelNumberStr);

      // If we can't parse a model number, drop it from these restricted views
      if (!modelNumber) return false;

      if (axialType === 'NEIDS' || axialType === 'NEID') {
        return modelNumber <= 2240;
      }
      if (axialType === 'HIGH_RANGE') {
        return modelNumber > 2240; // do NOT show 2240
      }
      return true;
    });
  };

  // Robust matcher to find the dimensions row for a given model name across naming variations
  const findDimensionsRowMatch = (rows, modelName) => {
    if (!Array.isArray(rows) || !modelName) return null;
    const full = String(modelName || '');
    const modelNumber = full.replace(/^[A-Z-]+\s*/i, '').trim();
    const base = getBaseModelNumber(full);
    const digitsOnly = (full.match(/\d+/)?.[0]) || '';
    const preMMatch = full.match(/(\d+)\s*M\d+/i);
    const preMNumber = preMMatch ? preMMatch[1] : null;

    const normalize = (s) => String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_-]/g, '');

    const normFull = normalize(full);
    const normModelNumber = normalize(modelNumber);

    // Extract all numbers from model name for exact matching
    const allNumbers = full.match(/\d+/g) || [];
    const exactNumberMatch = allNumbers.length > 0 ? allNumbers[allNumbers.length - 1] : null; // Use last number (usually the model number)

    // Priority order of strategies
    const strategies = [
      (row) => normalize(row.model) === normFull,
      (row) => normalize(row.model) === normModelNumber,
      // Exact number match - check if row.model contains the exact number as a standalone value
      (row) => {
        if (!exactNumberMatch) return false;
        const rowModelStr = String(row.model || '');
        // Check for exact number match (not substring)
        const rowNumbers = rowModelStr.match(/\d+/g) || [];
        return rowNumbers.some(num => num === exactNumberMatch);
      },
      (row) => normalize(row.model).includes(normFull) || normFull.includes(normalize(row.model)),
      (row) => normalize(row.model).includes(normModelNumber) || normModelNumber.includes(normalize(row.model)),
      (row) => base && String(row.model || '').includes(base),
      (row) => preMNumber && String(row.model || '').includes(preMNumber),
      // Last resort: check if digitsOnly matches exactly as a number in row.model
      (row) => {
        if (!digitsOnly) return false;
        const rowModelStr = String(row.model || '');
        const rowNumbers = rowModelStr.match(/\d+/g) || [];
        return rowNumbers.some(num => num === digitsOnly);
      },
    ];

    for (const test of strategies) {
      const hit = rows.find((row) => test(row));
      if (hit) return hit;
    }
    return null;
  };

  // Robust outlier filtering for curve points using rolling median + MAD
  const getMedian = (numbers) => {
    if (!numbers || numbers.length === 0) return 0;
    const arr = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  };

  const getMAD = (numbers, median) => {
    if (!numbers || numbers.length === 0) return 0;
    const deviations = numbers.map(n => Math.abs(n - median));
    return getMedian(deviations);
  };

  const filterCurveOutliers = (points) => {
    if (!Array.isArray(points) || points.length < 5) return points;
    const sorted = [...points].sort((a, b) => (a?.x ?? 0) - (b?.x ?? 0));
    const windowSize = 11; // odd number for symmetric window
    const half = Math.floor(windowSize / 2);
    const kept = [];

    for (let i = 0; i < sorted.length; i++) {
      const start = Math.max(0, i - half);
      const end = Math.min(sorted.length - 1, i + half);
      const windowYs = [];
      for (let j = start; j <= end; j++) {
        const y = sorted[j]?.y;
        if (Number.isFinite(y)) windowYs.push(y);
      }
      if (windowYs.length === 0) continue;
      const median = getMedian(windowYs);
      const mad = getMAD(windowYs, median);
      const point = sorted[i];
      const absDev = Math.abs(point.y - median);
      // Tolerance: 3 * MAD (scaled) + 2% of median as soft cushion
      const tol = (mad ? 3 * 1.4826 * mad : 0) + Math.abs(0.02 * (median || 0));
      if (absDev <= tol) kept.push(point);
    }

    // Preserve original order
    const keepSet = new Set(kept.map(p => `${p.x}|${p.y}`));
    return points.filter(p => keepSet.has(`${p.x}|${p.y}`));
  };

  // Helper function to create annotation configuration for working point
  const getWorkingPointAnnotations = (xValue, yValue, xLabel, yLabel) => {
    if (xValue === null || xValue === undefined || yValue === null || yValue === undefined || isNaN(xValue) || isNaN(yValue)) {
      return {};
    }

    return {
      annotation: {
        annotations: {
          // Vertical line (parallel to y-axis) from working point to x-axis
          verticalLine: {
            type: 'line',
            xMin: xValue,
            xMax: xValue,
            yMin: 0,
            yMax: yValue,
            borderColor: 'rgb(234,88,12)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: xLabel,
              position: 'end',
              backgroundColor: 'rgba(234,88,12,0.8)',
              color: 'white',
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 6,
              yAdjust: 25,
              xAdjust: 0
            }
          },
          // Horizontal line (parallel to x-axis) from working point to y-axis
          horizontalLine: {
            type: 'line',
            xMin: 0,
            xMax: xValue,
            yMin: yValue,
            yMax: yValue,
            borderColor: 'rgb(234,88,12)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: yLabel,
              position: 'center',
              backgroundColor: 'rgba(234,88,12,0.8)',
              color: 'white',
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 6,
              xAdjust: -25,
              yAdjust: 0
            }
          }
        }
      }
    };
  };

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    plugins: {
      legend: { position: 'top', labels: { color: '#1F2937', font: { size: 15, weight: '600' }, padding: 24 } },
      title: { display: true, text: `Flow Rate vs Total Pressure (${getFlowUnitLabel()} / ${getPressureUnitLabel()})`, color: '#1F2937', font: { size: 18, weight: 'bold' }, padding: { top: 12, bottom: 22 } },
      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, titleColor: 'white', bodyColor: 'white', titleFont: { size: 15, weight: 'bold' }, bodyFont: { size: 14 },
        callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} ${getFlowUnitLabel()}`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)} ${getPressureUnitLabel()}`]; } } }
    },
    scales: {
      x: { type: 'linear', position: 'bottom', title: { display: true, text: `Flow Rate (${getFlowUnitLabel()})`, color: '#1F2937', font: { size: 15, weight: 'bold' }, padding: { top: 12 } }, grid: { color: 'rgba(0,0,0,0.8)', lineWidth: 1 }, border: { width: 2 }, ticks: { color: '#1F2937', font: { size: 14, weight: '600' }, padding: 8 }, beginAtZero: true, min: 0 },
      y: { type: 'linear', title: { display: true, text: `Total Pressure (${getPressureUnitLabel()})`, color: '#1F2937', font: { size: 15, weight: 'bold' }, padding: { bottom: 12 } }, grid: { color: 'rgba(0,0,0,0.8)', lineWidth: 1 }, border: { width: 2 }, ticks: { color: '#1F2937', font: { size: 14, weight: '600' }, padding: 8 }, beginAtZero: true, min: 0 }
    },
    interaction: { intersect: false, mode: 'nearest' },
    elements: { point: { zIndex: 2, radius: 3.2, hoverRadius: 6, hitRadius: 3 }, line: { tension: 0.2, cubicInterpolationMode: 'monotone', borderWidth: 3.5 } },
    parsing: false,
    normalized: true
  };

  // Get chart options with annotations for working point
  const getChartOptions = () => {
    const wpX = closestPoint ? convertChartFlowValue(parseFloat(closestPoint.flowRate)) : null;
    const wpY = closestPoint ? convertChartPressureValue(parseFloat(closestPoint.totalPressure)) : null;
    const annotations = getWorkingPointAnnotations(
      wpX,
      wpY,
      wpX ? `${wpX.toFixed(4)} ${getFlowUnitLabel()}` : '',
      wpY ? `${wpY.toFixed(4)} ${getPressureUnitLabel()}` : ''
    );
    
    return {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        ...annotations
      }
    };
  };

  const chartOptions = getChartOptions();

  const getStaticPressureChartOptions = () => {
    const wpX = closestPoint ? convertChartFlowValue(parseFloat(closestPoint.flowRate)) : null;
    const wpY = closestPoint && Number(closestPoint.staticPressure) >= 0 ? convertChartPressureValue(Number(closestPoint.staticPressure)) : null;
    const annotations = getWorkingPointAnnotations(
      wpX,
      wpY,
      wpX ? `${wpX.toFixed(4)} ${getFlowUnitLabel()}` : '',
      wpY ? `${wpY.toFixed(4)} ${getPressureUnitLabel()}` : ''
    );
    
    return {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: { ...baseChartOptions.plugins.title, text: `Flow Rate vs Static Pressure (${getFlowUnitLabel()} / ${getPressureUnitLabel()})` },
        tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} ${getFlowUnitLabel()}`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)} ${getPressureUnitLabel()}`]; } } },
        ...annotations
      },
      scales: {
        ...baseChartOptions.scales,
        y: { ...baseChartOptions.scales.y, title: { ...baseChartOptions.scales.y.title, text: `Static Pressure (${getPressureUnitLabel()})` } }
      }
    };
  };

  const staticPressureChartOptions = getStaticPressureChartOptions();

  const getPowerChartOptions = () => {
    const wpX = closestPoint ? convertChartFlowValue(parseFloat(closestPoint.flowRate)) : null;
    const wpY = closestPoint ? parseFloat(closestPoint.brakePower) : null;
    const annotations = getWorkingPointAnnotations(
      wpX,
      wpY,
      wpX ? `${wpX.toFixed(4)} ${getFlowUnitLabel()}` : '',
      wpY ? `${wpY.toFixed(4)} kW` : ''
    );
    
    return {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: { ...baseChartOptions.plugins.title, text: `Flow Rate vs Brake Power (${getFlowUnitLabel()} / KW) ` },
        tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} ${getFlowUnitLabel()}`, `${ctx.dataset.label}: ${p.y?.toFixed?.(4)}`]; } } },
        ...annotations
      },
      scales: {
        ...baseChartOptions.scales,
        y: { ...baseChartOptions.scales.y, title: { ...baseChartOptions.scales.y.title, text: 'Brake Power (kW)' } }
      }
    };
  };

  const powerChartOptions = getPowerChartOptions();

  const getEfficiencyChartOptions = () => {
    const wpX = closestPoint ? convertChartFlowValue(parseFloat(closestPoint.flowRate)) : null;
    const wpY = closestPoint ? parseFloat(closestPoint.efficiency) : null;
    const annotations = getWorkingPointAnnotations(
      wpX,
      wpY,
      wpX ? `${wpX.toFixed(4)} ${getFlowUnitLabel()}` : '',
      wpY ? `${wpY.toFixed(2)}%` : ''
    );
    
    return {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: { ...baseChartOptions.plugins.title, text: `Flow Rate vs Efficiency (${getFlowUnitLabel()} / %)` },
        tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (ctx) => { const p = ctx.raw; return [`Flow Rate: ${p.x?.toFixed?.(4)} ${getFlowUnitLabel()}`, `${ctx.dataset.label}: ${p.y?.toFixed?.(2)}%`]; } } },
        ...annotations
      },
      scales: {
        ...baseChartOptions.scales,
        y: {
          ...baseChartOptions.scales.y,
          title: { ...baseChartOptions.scales.y.title, text: 'Efficiency (%)' },
          min: 0,
          max: 100,
          ticks: {
            ...baseChartOptions.scales.y.ticks,
            stepSize: 20
          }
        }
      }
    };
  };

  const efficiencyChartOptions = getEfficiencyChartOptions();

  // Build datasets for full curve + closest point overlay
  const pressureChartData = (() => {
    if (!curvePoints || curvePoints.length === 0) {
      if (!closestPoint) return { datasets: [] };
      if (Number(closestPoint.staticPressure) < 0) return { datasets: [] };
      
      return {
        datasets: [
          { 
            label: 'Working Point', 
            data: [{ 
              x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
              y: convertChartPressureValue(parseFloat(closestPoint.totalPressure)) 
            }], 
            backgroundColor: 'rgb(251,146,60)', 
            borderColor: 'rgb(234,88,12)', 
            borderWidth: 3, 
            pointRadius: 8, 
            showLine: false 
          }
        ]
      };
    }

    // Filter out any points whose staticPressure is negative; also hide their counterparts in total chart
    const filtered = (curvePoints || []).filter(p => Number(p.staticPressure) >= 0);

    return {
    datasets: [
      {
        label: 'Total Pressure Curve',
          data: filterCurveOutliers(
            filtered.map(p => ({ 
              x: convertChartFlowValue(parseFloat(p.flowRate)), 
              y: convertChartPressureValue(parseFloat(p.totalPressure)) 
            })).filter(point => !isNaN(point.x) && !isNaN(point.y))
          ),
        backgroundColor: 'rgba(59,130,246,0.3)',
        borderColor: 'rgb(59,130,246)',
        borderWidth: 2,
        pointRadius: 1.3,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(59,130,246)',
        pointBorderColor: 'rgba(59,130,246,0.7)',
        showLine: true,
        tension: 0.35,
      },
        ...((closestPoint && Number(closestPoint.staticPressure) >= 0) ? [{
        label: 'Working Point',
        data: [{ 
          x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
          y: convertChartPressureValue(parseFloat(closestPoint.totalPressure)) 
        }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 8,
        showLine: false,
      }] : [])
    ]
    };
  })();

  const staticPressureChartData = (() => {
    if (!curvePoints || curvePoints.length === 0) {
      if (!closestPoint) return { datasets: [] };
      if (Number(closestPoint.staticPressure) < 0) return { datasets: [] };
      
      return {
    datasets: [
      { 
        label: 'Working Point', 
        data: [{ 
          x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
              y: convertChartPressureValue(Number(closestPoint.staticPressure)) 
        }], 
        backgroundColor: 'rgb(251,146,60)', 
        borderColor: 'rgb(234,88,12)', 
        borderWidth: 3, 
        pointRadius: 8, 
        showLine: false 
      }
    ]
      };
    }

    // Filter out negative static pressure points entirely from this chart
    const filtered = (curvePoints || []).filter(p => Number(p.staticPressure) >= 0);

    return {
    datasets: [
      {
        label: 'Static Pressure Curve',
          data: filterCurveOutliers(
            filtered.map(p => ({
              x: convertChartFlowValue(parseFloat(p.flowRate)),
              y: convertChartPressureValue(Number(p.staticPressure))
            })).filter(point => !isNaN(point.x) && !isNaN(point.y))
          ),
          backgroundColor: 'rgba(59,130,246,0.3)',
          borderColor: 'rgb(59,130,246)',
        borderWidth: 2,
        pointRadius: 1.3,
        pointHoverRadius: 3,
          pointBackgroundColor: 'rgb(59,130,246)',
          pointBorderColor: 'rgba(59,130,246,0.7)',
        showLine: true,
        tension: 0.35,
      },
        ...((closestPoint && Number(closestPoint.staticPressure) >= 0) ? [{
        label: 'Working Point',
        data: [{ 
          x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
          y: convertChartPressureValue(Number(closestPoint.staticPressure)) 
        }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 8,
        showLine: false,
      }] : [])
    ]
    };
  })();

  const powerChartData = (() => {
    if (!curvePoints || curvePoints.length === 0) {
      if (!closestPoint) return { datasets: [] };
      
      return {
    datasets: [
      { 
        label: 'Working Point', 
        data: [{ 
          x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
              y: parseFloat(closestPoint.brakePower) 
        }], 
        backgroundColor: 'rgb(251,146,60)', 
        borderColor: 'rgb(234,88,12)', 
        borderWidth: 3, 
        pointRadius: 8, 
        showLine: false 
      }
    ]
      };
    }

    return {
    datasets: [
      {
        label: 'Brake Power Curve',
          data: filterCurveOutliers(
            curvePoints.map(p => ({ 
              x: convertChartFlowValue(parseFloat(p.flowRate)), 
              y: parseFloat(p.brakePower) 
            })).filter(point => !isNaN(point.x) && !isNaN(point.y))
          ),
        backgroundColor: 'rgba(148,148,22,0.3)',
        borderColor: 'rgb(148, 148, 22)',
        borderWidth: 2,
        pointRadius: 1.3,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(148, 148, 22)',
        pointBorderColor: 'rgba(148,148,22,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Working Point',
          data: [{ 
            x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
            y: parseFloat(closestPoint.brakePower) 
          }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 8,
        showLine: false,
      }] : [])
    ]
    };
  })();

  const efficiencyChartData = (() => {
    if (!curvePoints || curvePoints.length === 0) {
      if (!closestPoint) return { datasets: [] };
      
      return {
    datasets: [
          { 
            label: 'Working Point', 
            data: [{ 
              x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
              y: parseFloat(closestPoint.efficiency) 
            }], 
            backgroundColor: 'rgb(251,146,60)', 
            borderColor: 'rgb(234,88,12)', 
            borderWidth: 3, 
            pointRadius: 8, 
            showLine: false 
          }
        ]
      };
    }

    return {
    datasets: [
      {
        label: 'Efficiency Curve',
          data: filterCurveOutliers(
            curvePoints.map(p => ({ 
              x: convertChartFlowValue(parseFloat(p.flowRate)), 
              y: parseFloat(p.efficiency) 
            })).filter(point => !isNaN(point.x) && !isNaN(point.y))
          ),
        backgroundColor: 'rgba(16,185,129,0.25)',
        borderColor: 'rgb(5,150,105)',
        borderWidth: 2,
        pointRadius: 1.3,
        pointHoverRadius: 3,
        pointBackgroundColor: 'rgb(5,150,105)',
        pointBorderColor: 'rgba(5,150,105,0.7)',
        showLine: true,
        tension: 0.35,
      },
      ...(closestPoint ? [{
        label: 'Working Point',
          data: [{ 
            x: convertChartFlowValue(parseFloat(closestPoint.flowRate)), 
            y: parseFloat(closestPoint.efficiency) 
          }],
        backgroundColor: 'rgb(251,146,60)',
        borderColor: 'rgb(234,88,12)',
        borderWidth: 3,
        pointRadius: 8,
        showLine: false,
      }] : [])
    ]
    };
  })();

  const handleGeneratePdf = async () => {
    try {
      setPdfError('');
      setIsGeneratingPdf(true);
      // Post generation history with trackId and modelId (if available)
      try {
        const modelId = selected?.model?._id || selected?.modelId || apiResults?.[selectedIndex]?.modelId;

        console.log(trackId,'+',modelId);
        
          if (trackId && modelId) {
            await api.patch('/history/', { trackId, modelId });
          }
      } catch (historyErr) {
        console.warn('Failed to post history record:', historyErr);
        console.log(historyErr);
        
      }
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

    const drawDimensionsList = (entries, startY, options = {}) => {
      if (!entries || entries.length === 0) return startY;

      const columns = 2;
      const rowHeight = options.rowHeight || 18;
      const labelFontSize = options.labelFontSize || 8;
      const valueFontSize = options.valueFontSize || 8;
      const labelWidth = options.labelWidth || 80;
      const colWidth = options.colWidth || 200;
      const gap = options.gap || 24;
      const tableWidth = columns * colWidth + (columns - 1) * gap;
      const tableStartX = Math.max(40, (pageWidth - tableWidth) / 2);
      const rowsPerColumn = Math.ceil(entries.length / columns);

      let maxY = startY;

      for (let colIdx = 0; colIdx < columns; colIdx++) {
        const colEntries = entries.slice(colIdx * rowsPerColumn, (colIdx + 1) * rowsPerColumn);
        if (colEntries.length === 0) continue;

        const colX = tableStartX + colIdx * (colWidth + gap);

        colEntries.forEach((entry, idx) => {
          const rowTop = startY + idx * rowHeight;
          const textY = rowTop + rowHeight - 6;

          doc.setFillColor(248, 250, 255);
          doc.rect(colX, rowTop, colWidth, rowHeight, 'F');
          doc.setDrawColor(229, 237, 255);
          doc.rect(colX, rowTop, colWidth, rowHeight);

          doc.setFontSize(labelFontSize);
          doc.setTextColor(71, 85, 105);
          doc.setFont(undefined, 'bold');
          doc.text(`${entry.label}:`, colX + 8, textY);

          doc.setFontSize(valueFontSize);
          doc.setTextColor(51, 65, 85);
          doc.setFont(undefined, 'normal');
          doc.text(String(entry.value ?? ''), colX + labelWidth, textY, { maxWidth: colWidth - labelWidth - 12 });

          maxY = Math.max(maxY, rowTop + rowHeight);
        });
      }

      return maxY + 20;
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
      y += 40;

      // Selected info
      doc.setFontSize(12);
      doc.setTextColor('#334155');
      const selectedModel = selected?.model?.name || '';
      const selectedRpm = selected?.rpm?.rpm ?? '';
      const info = [
        `Category: ${fanCategory || '-'}`,
        ...(fanCategory === 'axial' ? [
          `Axial Type: ${getAxialTypeDisplayCode(axialType) || '-'}`,
        ] : []),
        ...(fanCategory === 'centrifugal' ? [
          `Pressure Type: ${pressureClass || '-'}`,
          `Configuration: ${lowConfig ? lowConfig.toUpperCase() : '-'}`,
          `Centrifugal Type: ${series || '-'}`,
        ] : []),
        `Drive Type: ${driveType || '-'}`,
        `Model: ${selectedModel || '-'}`,
      ];
      const infoStartY = y;
      info.forEach((t) => { doc.text(t, 40, y); y += 30; });

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
      y += 40;

      // Description
      const description = getDescription(fanCategory, axialType, series);
      if (description) {
        doc.setFontSize(13);
        doc.setTextColor('#1e3a8a');
        doc.text('Description', 40, y);
        y += 25;
        doc.setFontSize(13);
        doc.setTextColor('#334155');
        
        // Split description into lines and wrap text
        const splitText = doc.splitTextToSize(description, pageWidth - 80);
        splitText.forEach((line) => {
          if (y > pageHeight - 40) {
            doc.addPage();
            y = 40;
          }
          doc.text(line, 40, y);
          y += 16;
        });
        y += 40;
      }

      // Working Point
      if (closestPoint) {
        doc.setFontSize(13);
        doc.setTextColor('#1e3a8a');
        doc.text('Working Point', 40, y);
        y += 10;
        doc.setFontSize(12);
        doc.setTextColor('#334155');
        const wpRows = [
          ['RPM', `${selected?.rpm?.rpm} `],
          ['Flow Rate', `${Number(convertChartFlowValue(parseFloat(closestPoint.flowRate))).toFixed(6)} ${getFlowUnitLabel()}`],
          ['Total Pressure', `${Number(convertChartPressureValue(parseFloat(closestPoint.staticPressure + closestPoint.dynamicPressure))).toFixed(6)} ${getPressureUnitLabel()}`],
          ['Static Pressure', `${Number(convertChartPressureValue(Number(closestPoint.staticPressure))).toFixed(6)} ${getPressureUnitLabel()}`],
          ['Efficiency', `${Number(closestPoint.efficiency ?? 0).toFixed(2)} %`],
          ['Brake Power', `${Number(closestPoint.brakePower).toFixed(6)} kw`],
          // ['Installed', `${(Number(closestPoint.brakePower) * 1.15).toFixed(6)} kw`],
          ['Sound Pressure Level (LPA)', `${(Number(closestPoint.lpa)).toFixed(6)} db   @${effectiveLpaDistance} m`],
         
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
        // Determine which dimensions set to use (axial types or centrifugal NBR variants)
        const typeKeyForPdf = getCurrentDimensionsType();
        let dims = null;
        if (fanCategory === 'axial') {
          // For NEID: use NEID_DIRECT for DIRECT_DRIVE/DIRECT_DRIVE_WITH_FREQUENCY_DRIVE
          if (typeKeyForPdf === 'NEID') {
            if (driveType === 'DIRECT_DRIVE' || driveType === 'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE') {
              dims = dimensionsData['NEID_DIRECT'] || null;
            } else {
              dims = dimensionsData['NEID'] || null;
            }
          } else {
            dims = dimensionsData[typeKeyForPdf] || getDimensionsData(typeKeyForPdf, selected?.model?.name);
          }
        } else if (typeKeyForPdf === 'NBR' || typeKeyForPdf === 'NBS' || typeKeyForPdf === 'NBRS' || typeKeyForPdf === 'NBR_D' || typeKeyForPdf === 'NBS_D') {
          // Use full object with variants for NBR, NBS, NBRS, NBR-D, and NBS-D
          dims = dimensionsData[typeKeyForPdf] || null;
        } else if (typeKeyForPdf) {
          dims = getDimensionsData(typeKeyForPdf, selected?.model?.name);
        }
        // if (false && dims) {
        //   // Check if we need a new page
        //   if (y + 300 > pageHeight - 40) {
        //     doc.addPage();
        //     y = 40;
        //   }
          
        //   // Dimensions title
        //   doc.setFontSize(13);
        //   doc.setTextColor('#1e3a8a');
        //   doc.text('Dimensions', 40, y);
        //   y += 20;
          
        //   // Special handling for types with variants (NEID, NBR, NBR-D, NBS-D, NPD)
        //   if (((axialType === 'NEID') || (typeKeyForPdf === 'NBR') || (typeKeyForPdf === 'NBR_D') || (typeKeyForPdf === 'NBS_D') || (typeKeyForPdf === 'NPD')) && dims.variants) {
        //     // Filter variants based on selected series
        //     const filteredVariants = dims.variants.filter(variant => {
        //       if (series === 'NBR-D FAN SECTION TYPE' || series === 'NBS-D FAN SECTION TYPE') {
        //         return variant.name.includes('Fan Section Type');
        //       }
        //       if (series === 'NBR-D' || series === 'NBS-D') {
        //         return variant.name.includes('Dimensions'); // Show only Dimensions variant for NBR-D/NBS-D
        //       }
        //       if (axialType === 'NEID') {
        //         // For NEID, show only the variant that contains the selected model
        //         const modelName = selected?.model?.name || '';
        //         return variant.data.some(row => 
        //           row.model === modelName || 
        //           row.model.includes(modelName) || 
        //           modelName.includes(row.model)
        //         );
        //       }
        //       return true; // Show all variants for other types
        //     });
            
        //     for (const [variantIndex, variant] of filteredVariants.entries()) {
        //       // Check if we need a new page for each variant
        //       if (y + 250 > pageHeight - 40) {
        //         doc.addPage();
        //         y = 40;
        //       }
              
        //       // Variant title
        //       doc.setFontSize(12);
        //       doc.setTextColor('#1e3a8a');
        //       doc.text(variant.name, 40, y);
        //       y += 15;
              
        //         const dataSectionTop = y;
              
        //       // Left column: Dimensions data
        //       // Extract model number from selected model name (e.g., "NBR-D 310" -> "310")
        //       const modelName = selected?.model?.name || '';
        //       const modelNumber = modelName.replace(/^[A-Z-]+\s*/, '').trim();
        //       const selectedModelData = variant.data.find(row => 
        //         row.model === modelNumber || row.model.includes(modelNumber) || modelName.includes(row.model)
        //       );
              
        //       if (selectedModelData) {
        //           const variantColumns = variant.columns || dims.columns || [];
        //           const entries = variantColumns
        //             .filter(col => col.key !== 'model')
        //             .map(col => ({ label: col.label, value: selectedModelData[col.key] }))
        //             .filter(entry => entry.value !== undefined && entry.value !== null && entry.value !== '');

        //           doc.setFontSize(11);
        //           doc.setTextColor('#1e3a8a');
        //           doc.text('Dimensions Data', pageWidth / 2, y, { align: 'center' });
        //           y += 14;

        //           y = drawDimensionsList(entries, y);
        //         } else {
        //           doc.setFontSize(10);
        //           doc.setTextColor('#64748B');
        //           doc.text('Dimensions data not available for selected model', pageWidth / 2, y + 12, { align: 'center' });
        //           y += 32;
        //       }
              
        //       // Variant image: render near full width
        //       if (variant.image) {
        //         try {
        //           console.log('Loading variant image for PDF:', variant.image);
        //           const resolvedVariantUrl = resolveAnyImage(variant.image) || variant.image;
        //           console.log('Resolved variant URL:', resolvedVariantUrl);
        //           const variantImageBase64 = await loadImageAsBase64(resolvedVariantUrl);
        //           console.log('Variant image loaded successfully');
                  
        //           const img = new Image();
        //           img.src = variantImageBase64;
        //           await new Promise((resolve, reject) => {
        //             img.onload = resolve;
        //             img.onerror = reject;
        //             setTimeout(reject, 5000); // 5 second timeout
        //           });
                  
        //           const naturalW = img.naturalWidth || 400;
        //           const naturalH = img.naturalHeight || 300;
                  
        //           // Scale to fit full page width with margins
        //           const maxWidth = pageWidth - 80; // 40 margin each side
        //           const maxHeight = 420;
        //           const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH, 1);
        //           const imgW = Math.max(1, Math.round(naturalW * scale));
        //           const imgH = Math.max(1, Math.round(naturalH * scale));
        //           if (y + imgH + 40 > pageHeight - 40) {
        //             doc.addPage();
        //             y = 40;
        //           }
        //           const imageX = 40 + Math.max(0, Math.floor((maxWidth - imgW) / 2));
        //           const imageY = y + 10;
        //           doc.addImage(variantImageBase64, 'PNG', imageX, imageY, imgW, imgH);
        //           y = imageY + imgH + 20;
        //         } catch (error) {
        //           console.error(`Variant image ${variant.name} loading failed:`, error);
        //           // Add text fallback
        //           doc.setFontSize(10);
        //           doc.setTextColor('#64748B');
        //             doc.text(`Image not available for ${variant.name}`, pageWidth / 2, dataSectionTop + 20, { align: 'center' });
        //         }
        //       }
              
        //       y += 20; // Space between variants
        //     }
        //   } else {
        //     // Regular handling for other types
        //     // Left column: Dimensions data table
        //     if (dims.data && dims.data.length > 0) {
        //       const selectedModelData = dims.data.find(row => 
        //         row.model.includes(selected?.model?.name || '')
        //       );
              
        //       if (selectedModelData) {
        //         const baseColumns = dimensionsData.columns || [];
        //         const entries = baseColumns
        //           .filter(col => col.key !== 'model')
        //           .map(col => ({ label: col.label, value: selectedModelData[col.key] }))
        //           .filter(entry => entry.value !== undefined && entry.value !== null && entry.value !== '');

        //         doc.setFontSize(11);
        //         doc.setTextColor('#1e3a8a');
        //         doc.text('Dimensions Data', pageWidth / 2, y, { align: 'center' });
        //         y += 15;

        //         y = drawDimensionsList(entries, y);
        //       } else {
        //         doc.setFontSize(10);
        //         doc.setTextColor('#64748B');
        //         doc.text('Dimensions data not available for selected model', pageWidth / 2, y + 12, { align: 'center' });
        //         y += 32;
        //       }
        //     }
            
        //     // Dimensions image: render near full width
        //       if (dims.image) {
        //       try {
        //         console.log('Loading dimensions image for PDF:', dims.image);
        //         const resolvedUrl = resolveAnyImage(dims.image) || dims.image;
        //         console.log('Resolved dimensions URL:', resolvedUrl);
        //         const dimensionsImageBase64 = await loadImageAsBase64(resolvedUrl);
        //         console.log('Dimensions image loaded successfully');
                
        //         const img = new Image();
        //         img.src = dimensionsImageBase64;
        //         await new Promise((resolve, reject) => {
        //           img.onload = resolve;
        //           img.onerror = reject;
        //           setTimeout(reject, 5000); // 5 second timeout
        //         });
                
        //         const naturalW = img.naturalWidth || 400;
        //         const naturalH = img.naturalHeight || 300;
        //         const maxWidth = pageWidth - 80; // margins
        //         const maxHeight = 420;
        //         const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH, 1);
        //         const imgW = Math.max(1, Math.round(naturalW * scale));
        //         const imgH = Math.max(1, Math.round(naturalH * scale));
        //         if (y + imgH + 40 > pageHeight - 40) {
        //           doc.addPage();
        //           y = 40;
        //         }
        //         const imageX = 40 + Math.max(0, Math.floor((maxWidth - imgW) / 2));
        //         const imageY = y + 20;
        //         doc.addImage(dimensionsImageBase64, 'PNG', imageX, imageY, imgW, imgH);
        //         y = imageY + imgH + 20;
        //       } catch (error) {
        //           console.error('Dimensions image loading failed:', error);
        //         // Add text fallback
        //         doc.setFontSize(10);
        //         doc.setTextColor('#64748B');
        //         doc.text('Dimensions image not available', pageWidth / 2, y + 30, { align: 'center' });
        //       }
        //     }
        //   }
        // }
      } catch (error) {
        console.log('Dimensions section not loaded:', error);
      }

      // Charts
      const cloneDatasets = (datasets = []) =>
        datasets.map((ds) => ({
          ...ds,
          data: Array.isArray(ds.data)
            ? ds.data.map((point) =>
                point && typeof point === 'object' ? { ...point } : point
              )
            : ds.data
        }));

      const cloneScales = (scales) => {
        if (!scales) return undefined;
        return Object.fromEntries(
          Object.entries(scales).map(([key, scale]) => [
            key,
            scale
              ? {
                  ...scale,
                  ticks: scale.ticks ? { ...scale.ticks } : undefined,
                  title: scale.title ? { ...scale.title } : undefined,
                  grid: scale.grid ? { ...scale.grid } : undefined
                }
              : scale
          ])
        );
      };

      const clonePlugins = (plugins) => {
        if (!plugins) return undefined;
        return {
          ...plugins,
          legend: plugins.legend
            ? {
                ...plugins.legend,
                labels: plugins.legend.labels
                  ? { ...plugins.legend.labels }
                  : undefined
              }
            : undefined,
          title: plugins.title ? { ...plugins.title } : undefined,
          tooltip: plugins.tooltip ? { ...plugins.tooltip } : undefined
        };
      };

      const createChartImage = async (data, options) => {
        if (!data || !options) return null;
        const canvas = document.createElement('canvas');
        const width = 900;
        const height = 500;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const clonedData = {
          ...data,
          datasets: cloneDatasets(data.datasets)
        };
        const adjustedOptions = {
          ...options,
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          plugins: clonePlugins(options.plugins),
          scales: cloneScales(options.scales)
        };
        // Enhance readability for PDF: larger fonts and thicker axes
        try {
          if (adjustedOptions.plugins) {
            if (adjustedOptions.plugins.title) {
              adjustedOptions.plugins.title = {
                ...adjustedOptions.plugins.title,
                font: { ...(adjustedOptions.plugins.title.font || {}), size: 22, weight: 'bold' },
                padding: { top: 12, bottom: 22 }
              };
            }
            if (adjustedOptions.plugins.legend) {
              adjustedOptions.plugins.legend = {
                ...adjustedOptions.plugins.legend,
                labels: {
                  ...(adjustedOptions.plugins.legend.labels || {}),
                  font: { ...((adjustedOptions.plugins.legend.labels || {}).font || {}), size: 18, weight: '600' },
                  padding: 28
                }
              };
            }
            if (adjustedOptions.plugins.tooltip) {
              adjustedOptions.plugins.tooltip = {
                ...adjustedOptions.plugins.tooltip,
                titleFont: { ...((adjustedOptions.plugins.tooltip || {}).titleFont || {}), size: 17, weight: 'bold' },
                bodyFont: { ...((adjustedOptions.plugins.tooltip || {}).bodyFont || {}), size: 16 }
              };
            }
            // Make annotation labels bigger if present
            if (adjustedOptions.plugins.annotation && adjustedOptions.plugins.annotation.annotations) {
              const anns = adjustedOptions.plugins.annotation.annotations;
              Object.keys(anns).forEach((k) => {
                const ann = anns[k];
                if (ann && ann.label) {
                  ann.label = {
                    ...ann.label,
                    font: { ...(ann.label.font || {}), size: 14, weight: 'bold' },
                    padding: Math.max(6, ann.label.padding || 0)
                  };
                }
              });
            }
          }
          if (adjustedOptions.scales) {
            const sx = adjustedOptions.scales.x || adjustedOptions.scales['x'];
            const sy = adjustedOptions.scales.y || adjustedOptions.scales['y'];
            if (sx) {
              adjustedOptions.scales.x = {
                ...sx,
                title: sx.title ? { ...sx.title, font: { ...(sx.title.font || {}), size: 18, weight: 'bold' } } : sx.title,
                ticks: { ...(sx.ticks || {}), font: { ...((sx.ticks || {}).font || {}), size: 18, weight: '600' }, padding: 12 },
                grid: { ...(sx.grid || {}), lineWidth: 1 },
                border: { ...(sx.border || {}), width: 2 }
              };
            }
            if (sy) {
              adjustedOptions.scales.y = {
                ...sy,
                title: sy.title ? { ...sy.title, font: { ...(sy.title.font || {}), size: 18, weight: 'bold' } } : sy.title,
                ticks: { ...(sy.ticks || {}), font: { ...((sy.ticks || {}).font || {}), size: 18, weight: '600' }, padding: 12 },
                grid: { ...(sy.grid || {}), lineWidth: 1 },
                border: { ...(sy.border || {}), width: 2 }
              };
            }
          }
          // Make lines and points thicker/larger for PDF clarity
          adjustedOptions.elements = {
            ...(adjustedOptions.elements || {}),
            point: { ...((adjustedOptions.elements || {}).point || {}), radius: 4.5, hoverRadius: 7 },
            line: { ...((adjustedOptions.elements || {}).line || {}), borderWidth: 4 }
          };
        } catch (e) {
          // ignore enhancements errors; fallback to provided options
        }
        const chartInstance = new ChartJS(ctx, {
          type: 'scatter',
          data: clonedData,
          options: adjustedOptions
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const imgData = canvas.toDataURL('image/png');
        chartInstance.destroy();
        return imgData;
      };

      const addChart = async (title, chartRef, fallbackData, fallbackOptions) => {
        try {
          // Always render a fresh image from data/options to ensure consistent styling in PDF
          let imgData = null;
          if (fallbackData && fallbackOptions) {
            imgData = await createChartImage(fallbackData, fallbackOptions);
          }
          if (!imgData) return;
          const targetHeight = 280;
          if (y + (targetHeight + 40) > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            y = 40;
          }
          doc.setFontSize(13);
          doc.setTextColor('#1e3a8a');
          doc.text(title, 40, y);
          y += 14;
          doc.addImage(imgData, 'PNG', 40, y, pageWidth - 80, targetHeight);
          y += targetHeight + 20;
        } catch (error) {
          console.log(`Chart ${title} not loaded:`, error);
        }
      };

      if (pdfCharts.pressure) {
        const isTotal = pdfPressureChartType === 'total';
        const chartTitle = isTotal ? 'Total Pressure Chart' : 'Static Pressure Chart';
        const chartRef = isTotal ? pressureChartRef : staticPressureChartRef;
        const data = isTotal ? pressureChartData : staticPressureChartData;
        const options = isTotal ? chartOptions : staticPressureChartOptions;
        await addChart(chartTitle, chartRef, data, options);
      }
      if (pdfCharts.power) {
        await addChart('Power Chart', powerChartRef, powerChartData, powerChartOptions);
      }
      if (pdfCharts.efficiency) {
        await addChart('Efficiency Chart', efficiencyChartRef, efficiencyChartData, efficiencyChartOptions);
      }
      // Now render Dimensions after charts
      try {
        const typeKeyForPdf = getCurrentDimensionsType();
        let dims = null;
        const fullModelNameForPdf = selected?.model?.name || '';
        const preMMatchPdf = fullModelNameForPdf.match(/(\d+)\s*M\d+/i);
        const preMNumberPdf = preMMatchPdf ? preMMatchPdf[1] : (fullModelNameForPdf.match(/(\d+)/)?.[1] || '');
        if (fanCategory === 'axial') {
          // Try multiple fallbacks to ensure we load NEID dimensions structure
          // For NEID: use NEID_DIRECT for DIRECT_DRIVE/DIRECT_DRIVE_WITH_FREQUENCY_DRIVE
          if (typeKeyForPdf === 'NEID') {
            if (driveType === 'DIRECT_DRIVE' || driveType === 'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE') {
              dims = dimensionsData['NEID_DIRECT'] || null;
            } else {
              dims = dimensionsData['NEID'] || null;
            }
          } else {
            dims = dimensionsData[typeKeyForPdf]
              || getDimensionsData(typeKeyForPdf, fullModelNameForPdf)
              || (preMNumberPdf ? getDimensionsData(typeKeyForPdf, preMNumberPdf) : null)
              || getDimensionsData(typeKeyForPdf);
          }
        } else if (typeKeyForPdf === 'NBR' || typeKeyForPdf === 'NBS' || typeKeyForPdf === 'NBRS' || typeKeyForPdf === 'NBR_D' || typeKeyForPdf === 'NBS_D') {
          dims = dimensionsData[typeKeyForPdf] || null;
        } else if (typeKeyForPdf) {
          dims = getDimensionsData(typeKeyForPdf, fullModelNameForPdf) || (preMNumberPdf ? getDimensionsData(typeKeyForPdf, preMNumberPdf) : null);
        }
        if (dims) {
          // For centrifugal dimensions in Technical Submittal, always start on a fresh page
          // so that "Dimensions" / "Dimensions Data" appear at the top, not mid‑page.
          if (fanCategory === 'centrifugal' ) {
            doc.addPage();
            y = 40;
          } else if (y + 300 > pageHeight - 40) {
            doc.addPage();
            y = 40;
          }
          doc.setFontSize(13);
          doc.setTextColor('#1e3a8a');
          doc.text('Dimensions', 40, y);
          y += 20;

          if (
            (
              axialType === 'NEID' ||
              typeKeyForPdf === 'NBR' ||
              typeKeyForPdf === 'NBS' ||
              typeKeyForPdf === 'NBRS' ||
              typeKeyForPdf === 'NBR_D' ||
              typeKeyForPdf === 'NBS_D' ||
              typeKeyForPdf === 'NPD' ||
              typeKeyForPdf === 'NPE' ||
              typeKeyForPdf === 'NPF'
            ) &&
            dims.variants
          ) {
            const filteredVariants = dims.variants.filter(variant => {
              if (series === 'NBR-D FAN SECTION TYPE (NBC)' || series === 'NBS-D FAN SECTION TYPE (NBC)') return variant.name.includes('Fan Section Type');
              if (series === 'NBR-D' || series === 'NBS-D') return variant.name.includes('Dimensions');
              if (axialType === 'NEID') {
                // Do not filter NEID variants by model name; include all and pick row per variant later
                return true;
              }
              return true;
            });

            for (const variant of filteredVariants) {
              if (y + 250 > pageHeight - 40) { doc.addPage(); y = 40; }
              doc.setFontSize(12);
              doc.setTextColor('#1e3a8a');
              doc.text(variant.name, 40, y);
              y += 15;

              const dataSectionTop = y;

              if (variant.image) {
                try {
                  const resolvedVariantUrl = resolveAnyImage(variant.image) || variant.image;
                  const variantImageBase64 = await loadImageAsBase64(resolvedVariantUrl);
                  const img = new Image(); img.src = variantImageBase64;
                  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; setTimeout(reject, 5000); });
                  const naturalW = img.naturalWidth || 400; const naturalH = img.naturalHeight || 300;
                  const maxWidth = pageWidth - 80; const maxHeight = 420;
                  const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH, 1);
                  const imgW = Math.max(1, Math.round(naturalW * scale));
                  const imgH = Math.max(1, Math.round(naturalH * scale));
                  if (y + imgH + 40 > pageHeight - 40) { doc.addPage(); y = 40; }
                  const imageX = 40 + Math.max(0, Math.floor((maxWidth - imgW) / 2));
                  const imageY = y + 10;
                  doc.addImage(variantImageBase64, 'PNG', imageX, imageY, imgW, imgH);
                  y = imageY + imgH + 20;
                } catch (error) {
                  doc.setFontSize(10); doc.setTextColor('#64748B');
                  doc.text(`Image not available for ${variant.name}`, pageWidth / 2, dataSectionTop + 20, { align: 'center' });
                }
              }

              const modelName = selected?.model?.name || '';
              const selectedModelData = findDimensionsRowMatch(variant.data || [], modelName);
              if (selectedModelData) {
                const variantColumns = variant.columns || dims.columns || [];
                const entries = variantColumns.filter(col => col.key !== 'model').map(col => ({ label: col.label, value: selectedModelData[col.key] })).filter(e => e.value !== undefined && e.value !== null && e.value !== '');
                doc.setFontSize(11); doc.setTextColor('#1e3a8a');
                doc.text('Dimensions Data', pageWidth / 2, y, { align: 'center' }); y += 14;
                y = drawDimensionsList(entries, y);
              } else {
                doc.setFontSize(10); doc.setTextColor('#64748B');
                doc.text('Dimensions data not available for selected model', pageWidth / 2, y + 12, { align: 'center' }); y += 32;
              }

              y += 20;
            }
          } else {
            // Regular types: image first, then data
            if (dims.image) {
              try {
                const resolvedUrl = resolveAnyImage(dims.image) || dims.image;
                const dimensionsImageBase64 = await loadImageAsBase64(resolvedUrl);
                const img = new Image(); img.src = dimensionsImageBase64;
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; setTimeout(reject, 5000); });
                const naturalW = img.naturalWidth || 400; const naturalH = img.naturalHeight || 300;
                const maxWidth = pageWidth - 80; const maxHeight = 420;
                const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH, 1);
                const imgW = Math.max(1, Math.round(naturalW * scale));
                const imgH = Math.max(1, Math.round(naturalH * scale));
                if (y + imgH + 40 > pageHeight - 40) { doc.addPage(); y = 40; }
                const imageX = 40 + Math.max(0, Math.floor((maxWidth - imgW) / 2));
                const imageY = y + 10;
                doc.addImage(dimensionsImageBase64, 'PNG', imageX, imageY, imgW, imgH);
                y = imageY + imgH + 20;
              } catch (error) {
                doc.setFontSize(10); doc.setTextColor('#64748B');
                doc.text('Dimensions image not available', pageWidth / 2, y + 30, { align: 'center' });
              }
            }

            if (dims.data && dims.data.length > 0) {
              const fullModelName = selected?.model?.name || '';
              const selectedModelData = findDimensionsRowMatch(dims.data, fullModelName);

              if (selectedModelData) {
                const baseColumns = dims.columns || [];
                const entries = baseColumns.filter(col => col.key !== 'model').map(col => ({ label: col.label, value: selectedModelData[col.key] })).filter(e => e.value !== undefined && e.value !== null && e.value !== '');
                doc.setFontSize(11); doc.setTextColor('#1e3a8a');
                doc.text('Dimensions Data', pageWidth / 2, y, { align: 'center' }); y += 15;
                y = drawDimensionsList(entries, y);
              } else {
                doc.setFontSize(10); doc.setTextColor('#64748B');
                doc.text('Dimensions data not available for selected model', pageWidth / 2, y + 12, { align: 'center' }); y += 32;
              }
            }
          }
        }
      } catch (error) {
        console.log('Dimensions (post-charts) not loaded:', error);
      }
      doc.save(`technical-submittal-${selectedModel || 'selection'}.pdf`);
      setShowPdfModal(false);
    } catch (error) {
      console.error('PDF generation error:', error);
      setPdfError(error?.message || 'Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getCurrentDimensionsType = () => {
    if (fanCategory === 'axial') {
      // Map special UI-only axial types to real dimension keys
      if (axialType === 'HIGH_RANGE') return 'NEIDS';
      if (axialType === 'NETD_FR') return 'NETD';
      return axialType || null;
    }
    if (fanCategory === 'centrifugal') {
      if (String(series) === 'NBR') return 'NBR';
      if (String(series) === 'NBS') return 'NBS';
      if (String(series) === 'NBRS') return 'NBRS';
      if (series === 'NBR-D' || series === 'NBR_D' || series === 'NBR-D FAN SECTION TYPE (NBC)') return 'NBR_D';
      if (series === 'NBS-D' || series === 'NBS_D' || series === 'NBS-D FAN SECTION TYPE (NBC)') return 'NBS_D';
      if (String(series) === 'NPD') return 'NPD';
      if (String(series) === 'NPE') return 'NPE';
      if (String(series) === 'NPF') return 'NPF';
    }
    return null;
  };

  const getCurrentDimensionsData = () => {
    const typeKey = getCurrentDimensionsType();
    if (!typeKey || !selected?.model?.name) return null;
    // For types with multiple variants (e.g., NEID, NBR, NBS, NBRS, NBR-D, NBS-D, NPD, NPE, NPF), return the full type with variants
    if (
      typeKey === 'NBR' ||
      typeKey === 'NBS' ||
      typeKey === 'NBRS' ||
      typeKey === 'NBR_D' ||
      typeKey === 'NBS_D' ||
      typeKey === 'NPD' ||
      typeKey === 'NPE' ||
      typeKey === 'NPF'
    ) {
      return dimensionsData[typeKey] || null;
    }
    // For NEID: use NEID_DIRECT for DIRECT_DRIVE/DIRECT_DRIVE_WITH_FREQUENCY_DRIVE, otherwise NEID (BELT_DRIVE)
    if (axialType === 'NEID') {
      if (driveType === 'DIRECT_DRIVE' || driveType === 'DIRECT_DRIVE_WITH_FREQUENCY_DRIVE') {
        return dimensionsData['NEID_DIRECT'] || null;
      }
      return dimensionsData['NEID'] || null;
    }
    return getDimensionsData(typeKey, selected.model.name);
  };

  // Image cache for resolved URLs
  const imageCache = useRef(new Map());

  // In UI rendering for dimensions (non-PDF), resolve URLs too
  const resolveUiImage = (p) => {
    if (!p) return p;
    
    // Check cache first
    if (imageCache.current.has(p)) {
      return imageCache.current.get(p);
    }
    
    const resolved = resolveDimensionImage(p) || p;
    imageCache.current.set(p, resolved);
    return resolved;
  };

  // Image format optimization utility
  const getOptimizedImageSrc = (src) => {
    if (!src) return src;
    
    // For WebP support detection and fallback
    const supportsWebP = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    };
    
    // If it's already a WebP or external URL, return as is
    if (src.includes('.webp') || src.startsWith('http')) {
      return src;
    }
    
    // For local images, try to use WebP if supported
    if (supportsWebP() && (src.includes('.png') || src.includes('.jpg') || src.includes('.jpeg'))) {
      // In a real implementation, you would have WebP versions of images
      // For now, we'll keep the original format
      return src;
    }
    
    return src;
  };

  // Progressive Image Component with blur placeholder
  const ProgressiveImage = ({ src, alt, className, onError, ...props }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleLoad = () => {
      setImageLoaded(true);
    };

    const handleError = (e) => {
      setImageError(true);
      if (onError) onError(e);
    };

    return (
      <div className={`relative overflow-hidden ${className}`}>
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
          </div>
        )}
        <img
          src={getOptimizedImageSrc(src)}
          alt={alt}
          className={`transition-opacity object-contain w-full h-full duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
        {imageError && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            Image not available
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-8 p-6 ">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-[#1E3A8A]">Selector</h2>
          <p className="text-[#475569]">Optimize your system with Nobel Fans's selection tool</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className=" bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative">
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>

          {notification && (
            <div className="fixed top-4 right-4 z-50 w-80">
              <div className={`p-3 rounded shadow ${notification.type==='success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {notification.message}
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[#1F3B73] text-base font-bold mb-2">Category</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setFanCategory('axial'); setAxialType(''); setDriveType(''); setPressureClass(''); setLowConfig(''); setSeries(''); }} className={`border rounded-lg p-3 hover:shadow transition ${fanCategory==='axial' ? 'ring-2 ring-[#93C5FD] border-[#93C5FD]' : 'border-[#E5EDFF]'}`}>
                  <img 
                    src={AxialCategoryImg} 
                    alt="Axial" 
                    className="w-full h-24 object-contain" 
                    loading="eager"
                    decoding="async"
                  />
                  <div className="mt-2 text-center text-[#1F3B73] font-bold text-sm">Axial</div>
                </button>
                <button type="button" onClick={() => { setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setFanCategory('centrifugal'); setAxialType(''); setDriveType(''); setPressureClass(''); setLowConfig(''); setSeries(''); }} className={`border rounded-lg p-3 hover:shadow transition ${fanCategory==='centrifugal' ? 'ring-2 ring-[#93C5FD] border-[#93C5FD]' : 'border-[#E5EDFF]'}`}>
                  <img 
                    src={CentrifugalCategoryImg} 
                    alt="Centrifugal" 
                    className="w-full h-24 object-contain" 
                    loading="eager"
                    decoding="async"
                  />
                  <div className="mt-2 text-center text-[#1F3B73] font-bold text-sm">Centrifugal</div>
                </button>
              </div>
              {fanCategory === 'centrifugal' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[#1F3B73] text-base font-bold mb-2">Select Pressure</label>
                    <select value={pressureClass} onChange={(e)=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setPressureClass(e.target.value); setLowConfig(''); setSeries(''); }} className="w-full px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                      <option value="">Select pressure</option>
                      <option value="low">Low Pressure</option>
                      <option value="medium">Medium Pressure</option>
                      <option value="high">High Pressure</option>
                    </select>
                  </div>
                  {pressureClass === 'low' && (
                    <>
                      <div>
                        <label className="block text-[#1F3B73] text-base font-bold mb-2">Select Configuration</label>
                        <select value={lowConfig} onChange={(e)=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setLowConfig(e.target.value); setSeries(''); }} className="w-full px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                          <option value="">Select configuration</option>
                          <option value="sisw">SISW</option>
                          <option value="didw">DIDW</option>
                        </select>
                      </div>
                     
                    </>
                  )}
                </div>
              )}
            </div>

            {fanCategory === 'axial' && (
              <div>
                <label className="block text-[#0F172A] text-base font-bold mb-3">Axial Types</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {axialTypes.map(t => (
                    <button key={t.id} type="button" onClick={() => { setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); onSelectAxial(t.code); }} className={`border rounded-lg p-2 hover:shadow transition ${axialType===t.code ? 'ring-2 ring-[#93C5FD] border-[#93C5FD]' : 'border-[#E5EDFF]'}`}>
                      {t.img && <img 
                        src={t.img} 
                        alt={t.name} 
                        className="w-full h-20 object-contain" 
                        loading="lazy"
                        decoding="async"
                      />}
                      <div className="mt-2 font-bold text-sm text-[#1F3B73] text-center">{t.name}</div>
                    </button>
                  ))}
                </div>
                {axialType && (
                  <div className="mt-6 rounded-xl border border-[#E5EDFF] bg-white p-4">
                    <div className="text-[#1F3B73] font-bold text-sm mb-3">{`${getAxialTypeDisplayCode(axialType)} - ${axialTypes.find(a=>a.code === axialType)?.name}`}</div>
                    <div className="flex items-center gap-4">
                      {(() => { const sel = axialTypes.find(t => t.code === axialType); return sel?.img ? (
                        <img 
                          src={sel.img} 
                          alt={sel.name} 
                          className="w-full max-w-md h-56 object-contain mx-auto" 
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null; })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {fanCategory === 'axial' && axialType && axialType !== 'NEI2D' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#1F3B73] text-base font-bold mb-2">Drive Type</label>
                  <select
                    value={driveType}
                    onChange={(e)=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setDriveType(e.target.value); }}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none"
                  >
                    <option value="">Select drive type</option>
                    {driveOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#1F3B73] text-base font-bold mb-2">Sound Pressure Level (LPA) Distance (meters)</label>
                  <input
                    type="number"
                    step="any"
                    min="1.5"
                    max="20"
                    value={lpaDistance}
                    onChange={(e)=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setLpaDistance(e.target.value); }}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all"
                    placeholder="Enter LPA value"
                  />
                  {!isLpaValid && lpaDistance !== '' && (
                    <p className="mt-1 text-sm text-red-500">Value must be between 1.5 and 20.</p>
                  )}
                </div>
              </div>
            )}

            {fanCategory === 'centrifugal' && (
              <div>
                <label className="block text-[#0F172A] text-base font-bold mb-3">Centrifugal Type</label>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {currentSeriesCards.map(card => (
                      <button key={card.code} type="button" onClick={()=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setSeries(card.code); }} className={`border rounded-lg p-2 hover:shadow transition ${series===card.code ? 'ring-2 ring-[#93C5FD] border-[#93C5FD]' : 'border-[#E5EDFF]'} ${(!pressureClass || (pressureClass==='low' && !lowConfig)) ? 'opacity-50 pointer-events-none' : ''}`}>
                        {card.img ? (
                          <img 
                            src={card.img} 
                            alt={card.name} 
                            className="w-full h-20 object-contain" 
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center text-xs text-[#64748B]">{card.name}</div>
                        )}
                        <div className="mt-2  text-[#1F3B73] text-center font-bold text-sm ">{card.name}</div>
                      </button>
                    ))}
                  </div>
                 
                  {series && (
                    <div className="mt-2 rounded-xl border border-[#E5EDFF] bg-white p-4">
                      <div className="text-[#1F3B73] font-bold text-sm mb-3">{`${getSeriesLabel(series)} - Centrifugal Type`}</div>
                      <div className="flex items-center gap-4">
                        {(() => { const card = currentSeriesCards.find(c => c.code === series); return card?.img ? (
                          <img 
                            src={card.img} 
                            alt={card.name} 
                            className="w-full max-w-md h-56 object-contain mx-auto" 
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null; })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {fanCategory === 'centrifugal' && series && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#1F3B73] text-base font-bold mb-2">Drive Type</label>
                  <select
                    value={driveType}
                    onChange={(e)=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setDriveType(e.target.value); }}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none"
                  >
                    <option value="">Select drive type</option>
                    {driveOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#1F3B73] text-base font-bold mb-2">Sound Level (LPA) Distance (meters)</label>
                  <input
                    type="number"
                    step="any"
                    min="1.5"
                    max="20"
                    value={lpaDistance}
                    onChange={(e)=>{ setHasSearched(false); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); setLpaDistance(e.target.value); }}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all"
                    placeholder="Enter LPA value"
                  />
                  {!isLpaValid && lpaDistance !== '' && (
                    <p className="mt-1 text-sm text-red-500">Value must be between 1.5 and 20.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {axialType !== 'NEI2D' && (
          <form onSubmit={handleSubmit} onFocusCapture={()=>setHasSearched(false)} onChangeCapture={()=>setHasSearched(false)} className="space-y-6 ">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#1F3B73] text-base font-bold mb-2">Flow Rate</label>
                <div className="flex gap-2">
                  <input type="number" step="any" name="flowRate" value={searchData.flowRate} onChange={(e)=>{ searchMutation.reset(); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); handleInputChange(e); }} className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all" placeholder="Enter flow rate" />
                  <select value={flowUnit} onChange={handleFlowUnitChange} className="px-3 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] focus:outline-none">
                    <option value="m3/s">m3/s</option>
                    <option value="m3/hr">m3/hr</option>
                    <option value="l/s">l/s</option>
                    <option value="cfm">cfm</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#1F3B73] text-base font-bold mb-2">Static Pressure</label>
                <div className="flex gap-2">
                  <input type="number" step="any" name="staticPressure" value={isJetFan ? '10' : searchData.staticPressure} onChange={(e)=>{ searchMutation.reset(); setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); handleInputChange(e); }} disabled={isJetFan} readOnly={isJetFan} className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all" placeholder="Enter static pressure" />
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
                    Loading...
                  </span>
                ) : 'Search'}
              </button>
            </div>
          </form>
          )}
        </motion.div>

        {error && (<div className="text-center text-red-600">{error}</div>)}

        {apiResults.length > 0 && (() => {
          const filteredResults = filterResultsByAxialModelRange(apiResults);

          // Show message if no results after filtering
          if (filteredResults.length === 0) {
            let message = '';
            if (fanCategory === 'axial' && axialType === 'NEIDS') {
              message = 'No results.';
            } else if (fanCategory === 'axial' && axialType === 'NEID') {
              message = 'No results.';
            } else if (fanCategory === 'axial' && axialType === 'HIGH_RANGE') {
              message = 'No results.';
            } else {
              message = 'No results match the current search input';
            }

            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF] text-center">
                  <div className="text-[#64748B] text-lg mb-2">No results found</div>
                  <div className="text-[#9CA3AF] text-sm">{message}</div>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="space-y-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {filteredResults.map((r, idx) => {
                    // Find original index in apiResults for proper selection handling
                    const originalIdx = apiResults.findIndex(orig => orig === r);
                    const rpmId = r?.rpm?._id;
                    const isLoading = loadingPoints[rpmId];
                    const hasPoints = modelPoints[rpmId]?.length > 0;
                    
                    return (
                      <button 
                        key={originalIdx} 
                        onClick={() => handleModelSelect(originalIdx)} 
                        className={`text-left p-3 rounded border transition-all ${selectedIndex===originalIdx ? 'border-[#93C5FD] ring-2 ring-[#93C5FD]' : 'border-[#E5EDFF]'}`}
                      >
                        <div className="text-[#1E3A8A] font-medium">
                          Model: {(fanCategory === 'axial' ? getAxialTypeDisplayCode(axialType) : series) || ''} - {r.model?.name}
                        </div>
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
                          ) : selectedIndex === originalIdx ? (
                            <div className="text-xs text-[#64748B]">Click to load curve</div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {closestPoint && filteredResults.includes(apiResults[selectedIndex]) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                {/* Tab Navigation */}
                <div className="flex border-b border-[#E5EDFF] mb-6">
                <button
                    onClick={() => setActiveTab('description')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'description'
                        ? 'border-[#1E3A8A] text-[#1E3A8A]'
                        : 'border-transparent text-[#64748B] hover:text-[#1E3A8A]'
                    }`}
                  >
                    Description
                  </button>
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

                        <tr><td className="py-2 px-4">Flow Rate</td><td className="py-2 px-4">{Number(convertChartFlowValue(parseFloat(closestPoint.flowRate))).toFixed(6)} {getFlowUnitLabel()}</td></tr>
                        <tr><td className="py-2 px-4">Total Pressure</td><td className="py-2 px-4">{Number(convertChartPressureValue(parseFloat(closestPoint.staticPressure + closestPoint.dynamicPressure))).toFixed(6)} {getPressureUnitLabel()}</td></tr>
                        <tr><td className="py-2 px-4">Static Pressure</td><td className="py-2 px-4">{Number(convertChartPressureValue(Number(closestPoint.staticPressure))).toFixed(6)} {getPressureUnitLabel()}</td></tr>
                            <tr><td className="py-2 px-4">Velocity</td><td className="py-2 px-4">{Number(closestPoint.velocity).toFixed(6)} m/s</td></tr>
                            <tr><td className="py-2 px-4">Efficiency</td><td className="py-2 px-4">{Number(closestPoint.efficiency ?? 0).toFixed(6)} %</td></tr>
                            {/* <tr><td className="py-2 px-4">Static Efficiency</td><td className="py-2 px-4">{Number(workingPointStaticEfficiency ?? 0).toFixed(6)} %</td></tr> */}
                            <tr><td className="py-2 px-4">Brake Power</td><td className="py-2 px-4">{Number(closestPoint.brakePower).toFixed(6)} kw</td></tr>
                            {/* <tr><td className="py-2 px-4">Installed</td><td className="py-2 px-4">{(Number(closestPoint.brakePower) * 1.15).toFixed(6)} kw</td></tr> */}
                            <tr>
                              <td className="py-2 px-4">Sound Pressure Level (LPA)     <span className="text-xs text-[#64748B] ml-2">
                                  (@ {effectiveLpaDistance} m)
                                </span></td>
                              <td className="py-2 px-4">
                                {Number(closestPoint.lpa).toFixed(6)} db
                               
                              </td>
                            </tr>
                        <tr><td className="py-2 px-4">Dynamic Pressure</td><td className="py-2 px-4">{Number(convertChartPressureValue(Number(closestPoint.dynamicPressure))).toFixed(6)} {getPressureUnitLabel()}</td></tr>
                        {userRole === "admin" && (
                          <>
                            <tr><td className="py-2 px-4">Flow Rate Error</td><td className="py-2 px-4">{Number(closestPoint.flowRateError).toFixed(6)}</td></tr>
                            <tr><td className="py-2 px-4">Total Pressure Error</td><td className="py-2 px-4">{Number(closestPoint.totalPressureError).toFixed(6)}</td></tr>
                            <tr><td className="py-2 px-4">Average Error</td><td className="py-2 px-4">{Number(closestPoint.averageError).toFixed(6)}</td></tr>
                          </>
                        )}
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
                              <div className="h-96">
                                {pressureChartData.datasets.length > 0 ? (
                                  <>
                                {pressureChartView === 'total' ? (
                                  <Scatter ref={pressureChartRef} data={pressureChartData} options={chartOptions} />
                                ) : (
                                  <Scatter ref={staticPressureChartRef} data={staticPressureChartData} options={staticPressureChartOptions} />
                                )}
                                {/* Hidden counterpart to ensure refs are available for export */}
                                <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '900px', height: '500px', opacity: 0, pointerEvents: 'none' }}>
                                  {pressureChartView === 'total' ? (
                                        <Scatter ref={staticPressureChartRef} data={staticPressureChartData} options={staticPressureChartOptions} />
                                  ) : (
                                        <Scatter ref={pressureChartRef} data={pressureChartData} options={chartOptions} />
                                  )}
                                </div>
                                  </>
                                ) : (
                                  <div className="flex items-center justify-center h-full text-gray-500">
                                    <div className="text-center">
                                      <div className="text-lg mb-2">No Data Available</div>
                                      <div className="text-sm">Chart data is not available for this model</div>
                                    </div>
                                  </div>
                                )}
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
                              <div className="h-96">
                                {(() => {
                                  const currentData = chartView === 'power' ? powerChartData : efficiencyChartData;
                                  const currentOptions = chartView === 'power' ? powerChartOptions : efficiencyChartOptions;
                                  const currentRef = chartView === 'power' ? powerChartRef : efficiencyChartRef;
                                  const hiddenRef = chartView === 'power' ? efficiencyChartRef : powerChartRef;
                                  const hiddenData = chartView === 'power' ? efficiencyChartData : powerChartData;
                                  const hiddenOptions = chartView === 'power' ? efficiencyChartOptions : powerChartOptions;

                                  return currentData.datasets.length > 0 ? (
                                    <>
                                      <Scatter ref={currentRef} data={currentData} options={currentOptions} />
                                {/* Hidden counterpart to ensure refs are available for export */}
                                <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '900px', height: '500px', opacity: 0, pointerEvents: 'none' }}>
                                        <Scatter ref={hiddenRef} data={hiddenData} options={hiddenOptions} />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                      <div className="text-center">
                                        <div className="text-lg mb-2">No Data Available</div>
                                        <div className="text-sm">Chart data is not available for this model</div>
                                </div>
                                    </div>
                                  );
                                })()}
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

                      // Special handling for types with variants (NEID, NBR, NBS, NBRS, NBR-D, NBS-D, NPD, NPE, NPF)
                      const currentType = getCurrentDimensionsType();
                      if (
                        (
                          axialType === 'NEID' ||
                          currentType === 'NBR' ||
                          currentType === 'NBS' ||
                          currentType === 'NBRS' ||
                          currentType === 'NBR_D' ||
                          currentType === 'NBS_D' ||
                          currentType === 'NPD' ||
                          currentType === 'NPE' ||
                          currentType === 'NPF'
                        ) &&
                        dimensionsData.variants
                      ) {
                        // Filter variants based on selected series
                        const filteredVariants = dimensionsData.variants.filter(variant => {
                          if (series === 'NBR-D FAN SECTION TYPE (NBC)' || series === 'NBS-D FAN SECTION TYPE (NBC)') {
                            return variant.name.includes('Fan Section Type');
                          }
                          if (series === 'NBR-D' || series === 'NBS-D') {
                            return variant.name.includes('Dimensions'); // Show only Dimensions variant for NBR-D/NBS-D
                          }
                          if (axialType === 'NEID') {
                            // For NEID, show only the variant that contains the selected model
                            const modelName = selected?.model?.name || '';
                            const preMNumber = getBaseModelNumber(modelName);
                            return variant.data.some(row => {
                              const rowModel = String(row.model || '');
                              return rowModel === modelName ||
                                     rowModel.includes(modelName) ||
                                     modelName.includes(rowModel) ||
                                     (preMNumber && (rowModel === preMNumber || rowModel.includes(preMNumber)));
                            });
                          }
                          return true; // Show all variants for other types
                        });
                        
                        return (
                          <div className="space-y-6">
                            {filteredVariants.map((variant, variantIndex) => {
                              // Use findDimensionsRowMatch for accurate model matching
                              const modelName = selected?.model?.name || '';
                              const selectedModelData = findDimensionsRowMatch(variant.data || [], modelName);
                              
                              return (
                                <div key={variantIndex} className="space-y-4">
                                  {/* Variant Title and Content */}
                                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                                    <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">{variant.name}</h3>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {/* Image */}
                                      {variant.image && (
                                        <div className="flex justify-center">
                                          <ProgressiveImage 
                                            src={resolveUiImage(variant.image)} 
                                            alt={variant.name}
                                            className="max-w-full h-auto max-h-96 object-cover"
                                            loading="lazy"
                                            decoding="async"
                                          />
                                        </div>
                                      )}
                                      
                                      {/* Dimensions Data */}
                                      {selectedModelData ? (
                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EDFF]">
                                          <h4 className="text-lg font-semibold text-[#1E3A8A] mb-3">
                                            Dimensions Data - {selected?.model?.name || selectedModelData.model}
                                          </h4>
                                          <div className="space-y-2">
                                            {(() => {
                                              const allCols = (variant.columns || dimensionsData.columns || []);
                                              const filtered = allCols.filter(col => {
                                                const val = selectedModelData?.[col.key];
                                                return val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '*';
                                              });
                                              return filtered.map((col, colIdx) => (
                                                <div key={colIdx} className="flex justify-between py-1 border-b border-[#E5EDFF] last:border-b-0">
                                                  <span className="font-medium text-[#475569]">{col.label}:</span>
                                                  <span className="text-[#334155]">{col.key === 'model' ? (selected?.model?.name || selectedModelData[col.key]) : selectedModelData[col.key]}</span>
                                                </div>
                                              ));
                                            })()}
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
                      const selectedModelData = Array.isArray(dimensionsData.data)
                        ? (() => {
                            const modelName = selected?.model?.name || '';
                            const key = getBaseModelNumber(modelName) || modelName;
                            return dimensionsData.data.find(row => {
                              const rowModel = String(row?.model || '');
                              return rowModel === key || rowModel.includes(key) || key.includes(rowModel);
                            });
                          })()
                        : null;

                      const dimensionsDisplayName = axialType === 'NETD_FR'
                        ? 'Axial wall mounted (Fire Rated) (NETD) (400°C / 2hrs)'
                        : dimensionsData.name;

                      return (
                        <div className="space-y-6">
                          {/* Model Image */}
                          {dimensionsData.image && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">{dimensionsDisplayName}</h3>
                              <div className="flex justify-center">
                                <ProgressiveImage 
                                  src={resolveUiImage(dimensionsData.image)} 
                                  alt={dimensionsDisplayName}
                                  className="max-w-full h-auto max-h-96 object-contain"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            </div>
                          )}

                          {/* Dimensions Table */}
                          {selectedModelData ? (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">
                                Dimensions Data - {selected?.model?.name || selectedModelData.model}
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="min-w-full bg-white rounded-xl border border-[#E5EDFF]">
                                  {(() => {
                                    const allCols = (dimensionsData.columns || []);
                                    const filteredCols = allCols.filter(col => {
                                      const val = selectedModelData?.[col.key];
                                      return val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '*';
                                    });
                                    return (
                                      <thead className="bg-[#F8FAFF]">
                                        <tr className="text-left text-[#475569] border-b border-[#E5EDFF]">
                                          {filteredCols.map((col, idx) => (
                                            <th key={idx} className="py-3 px-4 font-semibold">{col.label}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                    );
                                  })()}
                                  <tbody className="divide-y divide-[#E5EDFF] text-[#334155]">
                                    <tr className="bg-blue-50">
                                      {(() => {
                                        const allCols = (dimensionsData.columns || []);
                                        const filteredCols = allCols.filter(col => {
                                          const val = selectedModelData?.[col.key];
                                          return val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '*';
                                        });
                                        return filteredCols.map((col, colIdx) => (
                                          <td key={colIdx} className="py-3 px-4 font-medium">
                                            {col.key === 'model' ? (selected?.model?.name || selectedModelData[col.key]) : selectedModelData[col.key]}
                                          </td>
                                        ));
                                      })()}
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
                    
                    {/* Hidden Charts for PDF Export - render only when modal is open */}
                    {showPdfModal && (
                    <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '900px', height: '500px', opacity: 0, pointerEvents: 'none' }}>
                      {/* Total Pressure Chart */}
                        {pressureChartData.datasets.length > 0 && (
                      <Scatter ref={pressureChartRef} data={pressureChartData} options={chartOptions} />
                        )}
                      
                      {/* Static Pressure Chart */}
                        {staticPressureChartData.datasets.length > 0 && (
                      <Scatter ref={staticPressureChartRef} data={staticPressureChartData} options={staticPressureChartOptions} />
                        )}
                      
                      {/* Power Chart */}
                        {powerChartData.datasets.length > 0 && (
                      <Scatter ref={powerChartRef} data={powerChartData} options={powerChartOptions} />
                        )}
                      
                      {/* Efficiency Chart */}
                        {efficiencyChartData.datasets.length > 0 && (
                      <Scatter ref={efficiencyChartRef} data={efficiencyChartData} options={efficiencyChartOptions} />
                        )}
                    </div>
                    )}
                  </div>
                )}

                {activeTab === 'description' && (
                  <div className="space-y-6">
                    {(() => {
                      const description = getDescription(fanCategory, axialType, series);
                      if (!description) {
                        return (
                          <div className="text-center py-12">
                            <div className="text-[#64748B] text-lg mb-4">Model Description</div>
                            <div className="text-[#9CA3AF] text-sm">Select a model to view description</div>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF]">
                          <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Description</h3>
                          <div className="text-[#334155] text-base leading-relaxed whitespace-pre-line">
                            {description}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            </motion.div>
          );
        })()}
        {hasSearched && !searchMutation.isPending && apiResults.length === 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5EDFF] text-center">
            <div className="text-[#64748B] text-lg mb-2">No results found  </div>
            <div className="text-[#9CA3AF] text-sm">No results matched the current search inputs.</div>
          </div>
        )}
        {axialType === 'NEI2D' ? (
          <div className="flex justify-center">
            <a href={NEI2DCatalog} download onClick={()=>{ setApiResults([]); setModelPoints({}); setLoadingPoints({}); setSelectedIndex(0); }} className="mt-2 px-6 py-3 rounded-xl shadow bg-[#1E3A8A] text-white hover:bg-[#1F3B73]">
              Download Catalog
            </a>
          </div>
        ) : (
          (() => {
            const filteredResults = filterResultsByAxialModelRange(apiResults);
            if (filteredResults.length === 0) return null;
            return (
              <div className="flex justify-center">
                <button type="button" onClick={()=>setShowPdfModal(true)} className="mt-2 px-6 py-3 rounded-xl shadow bg-[#1E3A8A] text-white hover:bg-[#1F3B73]">
                  Generate Technical Submittal
                </button>
              </div>
            );
          })()
        )}
        {showPdfModal && axialType !== 'NEI2D' && (() => {
          const filteredResults = filterResultsByAxialModelRange(apiResults);
          if (filteredResults.length === 0) return null;
          return (
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
          );
        })()}
      </div>
    </div>
  );
};

export default FlowSearch; 