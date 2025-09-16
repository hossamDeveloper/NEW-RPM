import React, { useState } from "react";
import api from "../../redux/api";
import { useMutation, useQueryClient } from '@tanstack/react-query';

const AddModel = () => {
  const [formData, setFormData] = useState({
    type: "",
    name: "",
    factor: 0,
    startRpmNumber: 0,
    endRpmNumber: 0,
    points: [
      {
        rpm: 0,
        flowRate: 0,
        totalPressure: 0,
        efficiency: 0,
        lpa: 0,
      },
    ],
  });
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: string }

  const queryClient = useQueryClient();

  const addModelMutation = useMutation({
    mutationFn: (payload) => api.post('/model', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setFormData({
        type: "",
        name: "",
        factor: 0,
        startRpmNumber: 0,
        endRpmNumber: 0,
        points: [
          { rpm: 0, flowRate: 0, totalPressure: 0, efficiency: 0, lpa: 0 },
        ],
      });
      setNotification({ type: 'success', message: 'Model has been added successfully.' });
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Failed to add model. Please try again.';
      setNotification({ type: 'error', message: msg });
    }
  });

  const handleChange = (e, index) => {
    const { name, value } = e.target;
    if (name.includes("points")) {
      const pointField = name.split(".")[1];
      const newPoints = [...formData.points];
      const numericValue = value === "" ? 0 : parseFloat(value);
      newPoints[index] = { ...newPoints[index], [pointField]: numericValue };
      setFormData({ ...formData, points: newPoints });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addPoint = () => {
    setFormData({
      ...formData,
      points: [
        ...formData.points,
        { rpm: 0, flowRate: 0, totalPressure: 0, efficiency: 0, lpa: 0 },
      ],
    });
  };

  const removePoint = (index) => {
    const newPoints = formData.points.filter((_, i) => i !== index);
    setFormData({ ...formData, points: newPoints });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSend = {
      ...formData,
      factor: Number(formData.factor),
      startRpmNumber: Number(formData.startRpmNumber),
      endRpmNumber: Number(formData.endRpmNumber),
      points: formData.points.map(point => ({
        rpm: Number(point.rpm),
        flowRate: Number(point.flowRate),
        totalPressure: Number(point.totalPressure),
        efficiency: Number(point.efficiency),
        lpa: Number(point.lpa)
      }))
    };
    console.log('AddModel payload:', dataToSend);
    setNotification(null);
    addModelMutation.mutate(dataToSend);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Add New Model
      </h2>

      {notification && (
        <div className={`mb-4 p-3 rounded ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {notification.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type:
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select Type</option>
            <option value="axial">Axial</option>
            <option value="centrifugal">Centrifugal</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name:
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Factor:
            </label>
            <input
              type="number"
              step="any"
              name="factor"
              value={formData.factor}
              onChange={handleChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start RPM Number:
            </label>
            <input
              type="number"
              step="any"
              name="startRpmNumber"
              value={formData.startRpmNumber}
              onChange={handleChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End RPM Number:
            </label>
            <input
              type="number"
              step="any"
              name="endRpmNumber"
              value={formData.endRpmNumber}
              onChange={handleChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">Points</h3>
          {formData.points.map((point, index) => (
            <div
              key={index}
              className="bg-gray-50 p-4 rounded-lg border border-gray-200"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RPM:
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="points.rpm"
                    value={point.rpm}
                    onChange={(e) => handleChange(e, index)}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Flow Rate:
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="points.flowRate"
                    value={point.flowRate}
                    onChange={(e) => handleChange(e, index)}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Pressure:
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="points.totalPressure"
                    value={point.totalPressure}
                    onChange={(e) => handleChange(e, index)}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Efficiency:
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="points.efficiency"
                    value={point.efficiency}
                    onChange={(e) => handleChange(e, index)}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LPA:
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="points.lpa"
                    value={point.lpa}
                    onChange={(e) => handleChange(e, index)}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              {formData.points.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePoint(index)}
                  className="mt-3 px-4 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors duration-200"
                >
                  Remove Point
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addPoint}
            className="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors duration-200"
          >
            Add Point
          </button>
        </div>

        <button
          type="submit"
          disabled={addModelMutation.isPending}
          className={`w-full px-6 py-2.5 rounded-md transition-colors duration-200 ${addModelMutation.isPending ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {addModelMutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Submitting...
            </span>
          ) : (
            'Submit'
          )}
        </button>
      </form>
    </div>
  );
};

export default AddModel;
