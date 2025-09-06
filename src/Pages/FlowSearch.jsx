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
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [chartData, setChartData] = useState(null);

  // Get data from Redux store
  const { allDataGenerated, diameter } = useSelector((state) => state.flow);

  console.log(allDataGenerated);
  console.log('diameter=',diameter);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateDynamicPressure = (flowRate) => {
    const q = parseFloat(flowRate);
    const velocity = (4 * q) / (Math.PI * Math.pow(diameter, 2));
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

    // Get the selected point coordinates
    const selectedX = parseFloat(closestPoint.flowRate);
    const selectedY = parseFloat(closestPoint.totalPressure);

    // Prepare data for pressure chart
    const pressureChartData = {
      datasets: [
        {
          label: 'Total Pressure',
          data: sortedPoints.map(point => ({
            x: parseFloat(point.flowRate),
            y: parseFloat(point.totalPressure)
          })),
          backgroundColor: 'rgba(99, 163, 255, 0.8)',
          borderColor: 'rgba(56, 132, 255, 1)',
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
            x: selectedX,
            y: selectedY
          }],
          backgroundColor: 'rgb(251, 146, 60)',
          borderColor: 'rgb(234, 88, 12)',
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
          backgroundColor: 'rgba(99, 163, 255, 0.8)',
          borderColor: 'rgba(56, 132, 255, 1)',
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
            x: selectedX,
            y: parseFloat(closestPoint.brakePower)
          }],
          backgroundColor: 'rgb(234, 88, 12)',
          borderColor: 'rgb(234, 88, 12)',
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
    setError("");
    setSearchResults([]);
    setChartData(null);

    const { flowRate, staticPressure } = searchData;
    const flowRateNum = parseFloat(flowRate);
    const staticPressureNum = parseFloat(staticPressure);

    // Find the closest point (even if input is invalid, let the logic handle it)
    const closestPoint = findClosestPoint(flowRateNum, staticPressureNum, allDataGenerated);

    if (!closestPoint) {
      setError("No matching points found");
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
          color: '#1F2937',
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
        color: '#1F2937',
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
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
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
      },
      annotation: {
        annotations: {
          line1: {
            type: 'line',
            xMin: searchResults[0]?.flowRate,
            xMax: searchResults[0]?.flowRate,
            yMin: 0,
            yMax: searchResults[0]?.totalPressure,
            borderColor: 'rgba(234, 88, 12, 0.4)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: parseFloat(searchResults[0]?.flowRate).toFixed(4),
              position: 'start',
              backgroundColor: 'rgba(234, 88, 12, 0.5)',
              color: 'white'
            }
          },
          line2: {
            type: 'line',
            xMin: 0,
            xMax: searchResults[0]?.flowRate,
            yMin: searchResults[0]?.totalPressure,
            yMax: searchResults[0]?.totalPressure,
            borderColor: 'rgba(234, 88, 12, 0.4)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: parseFloat(searchResults[0]?.totalPressure).toFixed(4),
              position: 'start',
              backgroundColor: 'rgba(234, 88, 12, 0.5)',
              color: 'white'
            }
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
          color: '#1F2937',
          font: {
            size: 14,
            weight: 'bold'
          },
          padding: { top: 10 }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.06)'
        },
        ticks: {
          color: '#334155'
        },
        beginAtZero: true,
        min: 0
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Total Pressure',
          color: '#1F2937',
          font: {
            size: 14,
            weight: 'bold'
          },
          padding: { bottom: 10 }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.06)'
        },
        ticks: {
          color: '#334155'
        },
        beginAtZero: true,
        min: 0
      }
    },
    interaction: {
      intersect: false,
      mode: 'nearest'
    },
    elements: {
      point: {
        zIndex: 2
      },
      line: {
        tension: 0.4,
        cubicInterpolationMode: 'monotone'
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
      },
      annotation: {
        annotations: {
          line1: {
            type: 'line',
            xMin: searchResults[0]?.flowRate,
            xMax: searchResults[0]?.flowRate,
            yMin: 0,
            yMax: searchResults[0]?.brakePower,
            borderColor: 'rgba(234, 88, 12, 0.4)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: parseFloat(searchResults[0]?.flowRate).toFixed(4),
              position: 'start',
              backgroundColor: 'rgba(234, 88, 12, 0.5)',
              color: 'white'
            }
          },
          line2: {
            type: 'line',
            xMin: 0,
            xMax: searchResults[0]?.flowRate,
            yMin: searchResults[0]?.brakePower,
            yMax: searchResults[0]?.brakePower,
            borderColor: 'rgba(234, 88, 12, 0.4)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: parseFloat(searchResults[0]?.brakePower).toFixed(4),
              position: 'start',
              backgroundColor: 'rgba(234, 88, 12, 0.5)',
              color: 'white'
            }
          }
        }
      }
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        title: {
          ...chartOptions.scales.y.title,
          text: 'Brake Power'
        },
        beginAtZero: true,
        min: 0
      }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-8 p-6 ">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-[#1E3A8A]">Flow Search</h2>
          <p className="text-[#475569]">Search for flow rates and pressures in your system</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className=" bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative"
        >
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
          <form onSubmit={handleSubmit} className="space-y-6 ">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">
                  Flow Rate
                </label>
                <input
                  type="number"
                  step="any"
                  name="flowRate"
                  value={searchData.flowRate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all"
                  placeholder="Enter flow rate"
                />
              </div>
              
              <div>
                <label className="block text-[#1F3B73] text-sm font-semibold mb-2">
                  Static Pressure
                </label>
                <input
                  type="number"
                  step="any"
                  name="staticPressure"
                  value={searchData.staticPressure}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#C7DAFF] text-[#1F3B73] placeholder-[#9DB7EE] focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent transition-all"
                  placeholder="Enter static pressure"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#2563EB] transition-all duration-200 shadow border border-transparent hover:border-[#F59E0B]"
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
              className="bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative"
            >
              <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Calculated Values</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-xl border border-[#E5EDFF]">
                  <thead className="bg-[#EEF4FF]">
                    <tr>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Flow Rate</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Dynamic Pressure</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Total Pressure</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Flow Rate Error (%)</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Pressure Error (%)</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Average Error (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((point, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-[#F7FAFF]'}>
                        <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.searchFlowRate.toFixed(4)}</td>
                        <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.calculatedDynamicPressure.toFixed(4)}</td>
                        <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.calculatedTotalPressure.toFixed(4)}</td>
                        <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.flowRateError.toFixed(2)}%</td>
                        <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.totalPressureError.toFixed(2)}%</td>
                        <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.averageError.toFixed(2)}%</td>
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
              className="bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative"
            >
              <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
              <h3 className="text-xl font-semibold text-[#1E3A8A] mb-4">Closest Match</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-xl border border-[#E5EDFF]">
                  <thead className="bg-[#EEF4FF]">
                    <tr>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">RPM</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Flow Rate</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Total Pressure</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Velocity</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Brake Power</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Efficiency (%)</th>
                      <th className="py-3 px-4 border-b border-[#E5EDFF] text-[#1F3B73]">Lpa (dB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((point, index) => {
                      const rpm = parseFloat(point.rpm);
                      const lpa = 70 + 50 * Math.log10(rpm/1000);

                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-[#F7FAFF]'}>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.rpm}</td>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.flowRate}</td>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.totalPressure}</td>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.velocity}</td>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.brakePower}</td>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.efficiency}</td>
                          <td className="py-3 px-4 border-b border-[#E5EDFF] text-[#334155] text-center">{point.lpa}</td>
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
                  className="bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative"
                >
                  <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
                  <h4 className="text-xl font-semibold text-[#1E3A8A] mb-4">Flow Rate vs Total Pressure</h4>
                  <div className="h-[500px]">
                    <Scatter options={chartOptions} data={chartData.pressureChartData} />
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] rounded-2xl p-6 shadow-sm border border-[#E5EDFF] relative"
                >
                  <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
                  <h4 className="text-xl font-semibold text-[#1E3A8A] mb-4">Flow Rate vs Brake Power</h4>
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