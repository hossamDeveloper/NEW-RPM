import React, { useState, useEffect } from 'react'
import axios from 'axios'

const AllModels = () => {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingModel, setEditingModel] = useState(null)
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    points: [
      {
        rpm: 0,
        flowRate: 0,
        totalPressure: 0,
        efficiency: 0,
        lpa: 0
      }
    ]
  })

  const API_URL = 'https://notaty-6ryr.onrender.com/api/v1/model/'
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  const fetchModels = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token"); 
      const response = await axios.get(API_URL,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': "application/json",
          },
        }
      )
      console.log('API Response:', response.data)
      const modelsData = Array.isArray(response.data) ? response.data : response.data.data || [];
      setModels(modelsData)
      setError(null)
    } catch (err) {
      console.error('Error details:', err)
      setError(err.response?.data?.message || 'Error fetching models. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModels()
  }, [])

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': "application/json",
        }
      })
      fetchModels()
      setError(null)
    } catch (err) {
      console.error('Delete error:', err)
      setError('Error deleting model. Please try again.')
    }
  }

  const handleEdit = (model) => {
    setEditingModel(model)
    setFormData({
      type: model.type,
      name: model.name,
      points: model.points.map(point => ({
        rpm: Number(point.rpm),
        flowRate: Number(point.flowRate),
        totalPressure: Number(point.totalPressure),
        efficiency: Number(point.efficiency),
        lpa: Number(point.lpa)
      }))
    })
  }

  const handlePointChange = (index, field, value) => {
    const newPoints = [...formData.points]
    newPoints[index] = {
      ...newPoints[index],
      [field]: Number(value)
    }
    setFormData({
      ...formData,
      points: newPoints
    })
  }

  const addPoint = () => {
    setFormData({
      ...formData,
      points: [
        ...formData.points,
        {
          rpm: 0,
          flowRate: 0,
          totalPressure: 0,
          efficiency: 0,
          lpa: 0
        }
      ]
    })
  }

  const removePoint = (index) => {
    const newPoints = formData.points.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      points: newPoints
    })
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API_URL}${editingModel._id}`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': "application/json",
        }
      })
      setEditingModel(null)
      fetchModels()
      setError(null)
    } catch (err) {
      console.error('Update error:', err)
      setError('Error updating model. Please try again.')
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="text-white text-xl">Loading...</div>
    </div>
  )
  
  if (error) return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong className="font-bold">Error! </strong>
      <span className="block sm:inline">{error}</span>
      <button 
        onClick={fetchModels}
        className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Try Again
      </button>
    </div>
  )

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">All Models</h1>
      
      {editingModel && (
        <div className="mb-4 p-4 border rounded bg-white/10 backdrop-blur-sm">
          <h2 className="text-xl mb-2 text-white">Edit Model</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="mb-2">
              <label className="block mb-1 text-white">Type:</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="border p-2 w-full rounded bg-white/5 text-white"
                required
              >
                <option value="">Select Type</option>
                <option value="axial">Axial</option>
                <option value="centrifugal">Centrifugal</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block mb-1 text-white">Name:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="border p-2 w-full rounded bg-white/5 text-white"
                required
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Points</h3>
              {formData.points.map((point, index) => (
                <div key={index} className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">RPM:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.rpm}
                        onChange={(e) => handlePointChange(index, 'rpm', e.target.value)}
                        className="w-full p-2 border border-white/20 rounded bg-white/5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Flow Rate:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.flowRate}
                        onChange={(e) => handlePointChange(index, 'flowRate', e.target.value)}
                        className="w-full p-2 border border-white/20 rounded bg-white/5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Total Pressure:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.totalPressure}
                        onChange={(e) => handlePointChange(index, 'totalPressure', e.target.value)}
                        className="w-full p-2 border border-white/20 rounded bg-white/5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Efficiency:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.efficiency}
                        onChange={(e) => handlePointChange(index, 'efficiency', e.target.value)}
                        className="w-full p-2 border border-white/20 rounded bg-white/5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">LPA:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.lpa}
                        onChange={(e) => handlePointChange(index, 'lpa', e.target.value)}
                        className="w-full p-2 border border-white/20 rounded bg-white/5 text-white"
                        required
                      />
                    </div>
                  </div>
                  {formData.points.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePoint(index)}
                      className="mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Remove Point
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPoint}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add Point
              </button>
            </div>

            <div className="mt-4">
              <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                Update
              </button>
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="ml-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models && models.length > 0 ? (
          models.map((model) => (
            <div key={model._id} className="border p-4 rounded bg-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white">{model.name}</h3>
              <p className="text-gray-300">{model.type}</p>
              <div className="mt-4">
                <h4 className="text-white font-medium mb-2">Points:</h4>
                <div className="space-y-2">
                  {model.points && model.points.map((point, index) => (
                    <div key={index} className="text-gray-300 text-sm">
                      <p>RPM: {point.rpm}</p>
                      <p>Flow Rate: {point.flowRate}</p>
                      <p>Total Pressure: {point.totalPressure}</p>
                      <p>Efficiency: {point.efficiency}</p>
                      <p>LPA: {point.lpa}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <button
                  onClick={() => handleEdit(model)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded mr-2 hover:bg-yellow-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(model._id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-white">
            No models found
          </div>
        )}
      </div>
    </div>
  )
}

export default AllModels