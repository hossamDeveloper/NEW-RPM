import React, { useState } from 'react'
import api from '../../redux/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const AllModels = () => {
  const [editingModel, setEditingModel] = useState(null)
  const [expandedCards, setExpandedCards] = useState({})
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    points: [
      { rpm: 0, flowRate: 0, totalPressure: 0, efficiency: 0, lpa: 0 }
    ]
  })

  const queryClient = useQueryClient()

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await api.get('/model/')
      return Array.isArray(response.data) ? response.data : response.data.data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/model/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] })
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/model/${id}`, payload),
    onSuccess: () => {
      setEditingModel(null)
      queryClient.invalidateQueries({ queryKey: ['models'] })
    }
  })

  const handleDelete = async (id) => {
    deleteMutation.mutate(id)
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

  const toggleExpanded = (modelId) => {
    setExpandedCards(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }))
  }

  const handlePointChange = (index, field, value) => {
    const newPoints = [...formData.points]
    newPoints[index] = { ...newPoints[index], [field]: Number(value) }
    setFormData({ ...formData, points: newPoints })
  }

  const addPoint = () => {
    setFormData({
      ...formData,
      points: [...formData.points, { rpm: 0, flowRate: 0, totalPressure: 0, efficiency: 0, lpa: 0 }]
    })
  }

  const removePoint = (index) => {
    const newPoints = formData.points.filter((_, i) => i !== index)
    setFormData({ ...formData, points: newPoints })
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingModel) return
    updateMutation.mutate({ id: editingModel._id, payload: formData })
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (isLoading) return (
    <div className="relative bg-white rounded-lg shadow-sm p-8 border border-[#E5EDFF]">
      <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#93C5FD] border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-[#334155]">Loading Models...</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="relative bg-white rounded-lg shadow-sm p-8 border border-[#E5EDFF]">
      <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
        {error}
      </div>
    </div>
  )

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-[#1E3A8A]">All Models</h1>
      {editingModel && (
        <div className="relative mb-4 p-4 border rounded bg-white border-[#E5EDFF]">
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
          <h2 className="text-xl mb-2 text-[#1E3A8A]">Edit Model</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="mb-2">
              <label className="block mb-1 text-[#334155]">Type:</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                required
              >
                <option value="">Select Type</option>
                <option value="axial">Axial</option>
                <option value="centrifugal">Centrifugal</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block mb-1 text-[#334155]">Name:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                required
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-[#1E3A8A]">Points</h3>
              {formData.points.map((point, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-[#E5EDFF]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">RPM:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.rpm}
                        onChange={(e) => handlePointChange(index, 'rpm', e.target.value)}
                        className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">Flow Rate:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.flowRate}
                        onChange={(e) => handlePointChange(index, 'flowRate', e.target.value)}
                        className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">Total Pressure:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.totalPressure}
                        onChange={(e) => handlePointChange(index, 'totalPressure', e.target.value)}
                        className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">Efficiency:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.efficiency}
                        onChange={(e) => handlePointChange(index, 'efficiency', e.target.value)}
                        className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">LPA:</label>
                      <input
                        type="number"
                        step="any"
                        value={point.lpa}
                        onChange={(e) => handlePointChange(index, 'lpa', e.target.value)}
                        className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                        required
                      />
                    </div>
                  </div>
                  {formData.points.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePoint(index)}
                      className="mt-3 px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >
                      Remove Point
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPoint}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
              >
                Add Point
              </button>
            </div>

            <div className="mt-4">
              <button type="submit" className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded hover:bg-emerald-100">
                Update
              </button>
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="ml-2 bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models && models.length > 0 ? (
          models.map((model) => {
            const isExpanded = expandedCards[model._id]
            const pointsToShow = isExpanded ? model.points : model.points?.slice(0, 2)
            const hasMorePoints = model.points && model.points.length > 2

            return (
              <div key={model._id} className="relative border p-4 rounded bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] border-[#E5EDFF]">
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
                <h3 className="text-lg font-semibold text-[#1E3A8A]">{model.name}</h3>
                <p className="text-[#64748B] capitalize">{model.type}</p>
                <div className="mt-4">
                  <h4 className="text-[#1E3A8A] font-medium mb-2">Points ({model.points?.length || 0}):</h4>
                  <div className="space-y-2">
                    {pointsToShow && pointsToShow.map((point, index) => (
                      <div key={index} className="text-[#334155] text-sm bg-white/50 p-2 rounded">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span>RPM: {point.rpm}</span>
                          <span>Flow: {point.flowRate}</span>
                          <span>Pressure: {point.totalPressure}</span>
                          <span>Eff: {point.efficiency}%</span>
                          <span className="col-span-2">LPA: {point.lpa}</span>
                        </div>
                      </div>
                    ))}
                    {hasMorePoints && (
                      <button
                        onClick={() => toggleExpanded(model._id)}
                        className="text-[#1E40AF] text-sm hover:text-[#1E3A8A] font-medium"
                      >
                        {isExpanded ? 'See less' : `See more (${model.points.length - 2} more)`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleEdit(model)}
                    className="bg-amber-50 text-amber-600 px-3 py-1 rounded text-sm hover:bg-amber-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(model._id)}
                    className="bg-rose-50 text-rose-600 px-3 py-1 rounded text-sm hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full text-center text-[#334155]">
            No models found
          </div>
        )}
      </div>
    </div>
  )
}

export default AllModels