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

// Register ChartJS components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const FlowSearch = () => {
  const [searchData, setSearchData] = useState({
    flowRate: '',
    staticPressure: ''
  });
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [chartData, setChartData] = useState(null);

  // Get data from Redux store
  const allDataGenerated = useSelector((state) => state.flow.allDataGenerated);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateDynamicPressure = (flowRate) => {
    const q = parseFloat(flowRate);
    const DIAMETER = 0.63;
    const velocity = (4 * q) / (Math.PI * Math.pow(DIAMETER, 2));
    return 0.5 * 1.2 * Math.pow(velocity, 2);
  };

  const calculateErrorPercentage = (actual, target) => {
    if (target === 0) return 0;
    return Math.abs((actual - target) / target) * 100;
  };

  const findClosestPoint = (flowRate, staticPressure, points) => {
    // Calculate target total pressure
    const dynamicPressure = calculateDynamicPressure(flowRate);
    const targetTotalPressure = staticPressure + dynamicPressure;

    // Calculate errors for each point
    const pointsWithError = points.map(point => {
      const pointFlowRate = parseFloat(point.flowRate);
      const pointTotalPressure = parseFloat(point.totalPressure);
      
      // Calculate errors
      const flowRateError = calculateErrorPercentage(pointFlowRate, flowRate);
      const totalPressureError = calculateErrorPercentage(pointTotalPressure, targetTotalPressure);
      
      // Calculate average error
      const averageError = (flowRateError + totalPressureError) / 2;

      return {
        ...point,
        flowRateError,
        totalPressureError,
        averageError,
        calculatedDynamicPressure: dynamicPressure,
        calculatedTotalPressure: targetTotalPressure
      };
    });

    // Filter points to only include those with reasonable errors
    const reasonablePoints = pointsWithError.filter(point => 
      point.flowRateError < 30 && point.totalPressureError < 30
    );

    // If we have reasonable points, use them, otherwise use all points
    const pointsToUse = reasonablePoints.length > 0 ? reasonablePoints : pointsWithError;

    // Sort points by average error
    const sortedPoints = pointsToUse.sort((a, b) => a.averageError - b.averageError);

    // Get the top 5 closest points
    const topPoints = sortedPoints.slice(0, 5);

    // Among the top 5, find the one with the most balanced errors
    const bestPoint = topPoints.reduce((best, current) => {
      // Calculate the difference between flow rate error and pressure error
      const bestErrorDiff = Math.abs(best.flowRateError - best.totalPressureError);
      const currentErrorDiff = Math.abs(current.flowRateError - current.totalPressureError);
      
      // If the current point has a smaller difference between errors, use it
      if (currentErrorDiff < bestErrorDiff) {
        return current;
      }
      // If the differences are equal, use the one with lower average error
      if (currentErrorDiff === bestErrorDiff) {
        return current.averageError < best.averageError ? current : best;
      }
      return best;
    }, topPoints[0]);

    return bestPoint;
  };

  const prepareChartData = (closestPoint) => {
    if (!closestPoint) return null;

    // Filter points for the same RPM
    const rpmPoints = allDataGenerated.filter(point => point.rpm === closestPoint.rpm);
    
    // Sort points by flow rate
    const sortedPoints = rpmPoints.sort((a, b) => parseFloat(a.flowRate) - parseFloat(b.flowRate));

    // Prepare data for pressure chart
    const pressureChartData = {
      datasets: [
        {
          label: 'Total Pressure',
          data: sortedPoints.map(point => ({
            x: parseFloat(point.flowRate),
            y: parseFloat(point.totalPressure)
          })),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          showLine: true,
          lineTension: 0.4,
          borderWidth: 2,
          zIndex: 1
        },
        {
          label: 'Selected Point',
          data: [{
            x: parseFloat(closestPoint.flowRate),
            y: parseFloat(closestPoint.totalPressure)
          }],
          backgroundColor: 'rgb(255, 99, 132)',
          borderColor: 'rgb(255, 99, 132)',
          borderWidth: 3,
          pointRadius: 10,
          pointHoverRadius: 12,
          showLine: false,
          zIndex: 2
        }
      ]
    };

    // Prepare data for power chart
    const powerChartData = {
      datasets: [
        {
          label: 'Brake Power',
          data: sortedPoints.map(point => ({
            x: parseFloat(point.flowRate),
            y: parseFloat(point.brakePower)
          })),
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          showLine: true,
          lineTension: 0.4,
          borderWidth: 2,
          zIndex: 1
        },
        {
          label: 'Selected Point',
          data: [{
            x: parseFloat(closestPoint.flowRate),
            y: parseFloat(closestPoint.brakePower)
          }],
          backgroundColor: 'rgb(54, 162, 235)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 3,
          pointRadius: 10,
          pointHoverRadius: 12,
          showLine: false,
          zIndex: 2
        }
      ]
    };

    return { pressureChartData, powerChartData };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSearchResults([]);
    setChartData(null);

    const { flowRate, staticPressure } = searchData;
    
    if (!flowRate || !staticPressure) {
      setError('Please enter both Flow Rate and Static Pressure');
      return;
    }

    const flowRateNum = parseFloat(flowRate);
    const staticPressureNum = parseFloat(staticPressure);

    if (isNaN(flowRateNum) || isNaN(staticPressureNum)) {
      setError('Please enter valid numbers');
      return;
    }

    if (allDataGenerated.length === 0) {
      setError('No data available. Please generate data in Flow Calculate first.');
      return;
    }

    // Find the closest point
    const closestPoint = findClosestPoint(flowRateNum, staticPressureNum, allDataGenerated);

    if (!closestPoint) {
      setError('No matching points found');
    } else {
      // Add calculated values to the result
      const result = {
        ...closestPoint,
        searchFlowRate: flowRateNum,
        searchStaticPressure: staticPressureNum,
        calculatedDynamicPressure: closestPoint.calculatedDynamicPressure,
        calculatedTotalPressure: closestPoint.calculatedTotalPressure,
        flowRateError: closestPoint.flowRateError,
        totalPressureError: closestPoint.totalPressureError,
        averageError: closestPoint.averageError
      };
      
      setSearchResults([result]);
      setChartData(prepareChartData(closestPoint));
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'white',
          font: {
            size: 14,
            weight: 'bold'
          },
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'Flow Rate vs Total Pressure',
        color: 'white',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: 'white',
        bodyColor: 'white',
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            const point = context.raw;
            return [
              `Flow Rate: ${point.x.toFixed(4)}`,
              `${context.dataset.label}: ${point.y.toFixed(4)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'Flow Rate',
          color: 'white',
          font: {
            size: 14,
            weight: 'bold'
          },
          padding: { top: 10 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'white'
        }
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Total Pressure',
          color: 'white',
          font: {
            size: 14,
            weight: 'bold'
          },
          padding: { bottom: 10 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'white'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'nearest'
    },
    elements: {
      point: {
        zIndex: 2
      }
    }
  };

  const powerChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: 'Flow Rate vs Brake Power'
      }
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        title: {
          ...chartOptions.scales.y.title,
          text: 'Brake Power'
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#021F59] via-[#03178C] to-[#034AA6]">
      <div className="space-y-8 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-white">Flow Search</h2>
          <p className="text-white/90">Search for flow rates and pressures in your system</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-[#021F59]/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-[#034AA6]/30"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white text-sm font-semibold mb-2">
                  Flow Rate
                </label>
                <input
                  type="number"
                  step="any"
                  name="flowRate"
                  value={searchData.flowRate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-[#021F59]/20 border border-[#034AA6] text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent transition-all"
                  placeholder="Enter flow rate"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm font-semibold mb-2">
                  Static Pressure
                </label>
                <input
                  type="number"
                  step="any"
                  name="staticPressure"
                  value={searchData.staticPressure}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-[#021F59]/20 border border-[#034AA6] text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent transition-all"
                  placeholder="Enter static pressure"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl p-3"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm font-medium">{error}</p>
                </div>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
            >
              Search
            </motion.button>
          </form>
        </motion.div>

        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-[#021F59]/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-[#034AA6]/30"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Calculated Values</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-[#021F59]/10 rounded-xl border border-[#034AA6]">
                  <thead className="bg-[#03178C]/30">
                    <tr>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Flow Rate</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Dynamic Pressure</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Total Pressure</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Flow Rate Error (%)</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Pressure Error (%)</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Average Error (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((point, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-[#03178C]/20' : 'bg-[#021F59]/10'}>
                        <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.searchFlowRate.toFixed(4)}</td>
                        <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.calculatedDynamicPressure.toFixed(4)}</td>
                        <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.calculatedTotalPressure.toFixed(4)}</td>
                        <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.flowRateError.toFixed(2)}%</td>
                        <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.totalPressureError.toFixed(2)}%</td>
                        <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.averageError.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-[#021F59]/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-[#034AA6]/30"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Closest Match</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-[#021F59]/10 rounded-xl border border-[#034AA6]">
                  <thead className="bg-[#03178C]/30">
                    <tr>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">RPM</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Flow Rate</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Total Pressure</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Velocity</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Brake Power</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Efficiency (%)</th>
                      <th className="py-3 px-4 border-b border-[#034AA6] text-white">Lpa (dB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((point, index) => {
                      const rpm = parseFloat(point.rpm);
                      const lpa = 70 + 50 * Math.log10(rpm/1000);

                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-[#03178C]/20' : 'bg-[#021F59]/10'}>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.rpm}</td>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.flowRate}</td>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.totalPressure}</td>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.velocity}</td>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.brakePower}</td>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{point.efficiency}</td>
                          <td className="py-3 px-4 border-b border-[#034AA6] text-white text-center">{lpa.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {chartData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="space-y-8"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  className="bg-[#021F59]/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-[#034AA6]/30"
                >
                  <h4 className="text-xl font-semibold text-white mb-4">Flow Rate vs Total Pressure</h4>
                  <div className="h-[500px]">
                    <Scatter options={chartOptions} data={chartData.pressureChartData} />
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="bg-[#021F59]/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-[#034AA6]/30"
                >
                  <h4 className="text-xl font-semibold text-white mb-4">Flow Rate vs Brake Power</h4>
                  <div className="h-[500px]">
                    <Scatter options={powerChartOptions} data={chartData.powerChartData} />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FlowSearch; 