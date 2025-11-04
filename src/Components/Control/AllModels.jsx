import React, { useState } from 'react'
import api from '../../redux/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const AllModels = () => {
  const [editingModel, setEditingModel] = useState(null)
  const [expandedCards, setExpandedCards] = useState({})
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    factor: 0,
    startRpmNumber: 0,
    endRpmNumber: 0,
    // Centrifugal-only fields
    pressureType: '',
    configurationType: '',
    centrifugalType: '',
    points: [
      { rpm: 0, flowRate: 0, totalPressure: 0, efficiency: 0, lpa: 0 }
    ]
  })
  const [originalData, setOriginalData] = useState(null)
  const [filters, setFilters] = useState({ 
    axial: true, 
    centrifugal: true,
    // Centrifugal sub-filters
    pressureTypes: { low: true, medium: true, high: true },
    centrifugalTypes: { NBR: true, NBS: true, NBRS: true, NC: true, NBXI: true, 'NBR-D': true, 'NBS-D': true, NPD: true, NPE: true, NPF: true }
  })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 9
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' })
  const [pendingPayload, setPendingPayload] = useState(null)
  const [notification, setNotification] = useState(null) // {type:'success'|'error', message:string}

  const queryClient = useQueryClient()

  console.log('payload',pendingPayload);
  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await api.get('/model/')
      return Array.isArray(response.data) ? response.data : response.data.data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Sort models by numeric value extracted from name (e.g., 315, 400, 450) ascending
  const getNumericFromName = (name) => {
    const s = String(name || '')
    const match = s.match(/(\d+(?:\.\d+)?)/)
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY
  }
  const sortedModels = [...models].sort((a, b) => {
    const an = getNumericFromName(a?.name)
    const bn = getNumericFromName(b?.name)
    if (an === bn) {
      // fallback to lexical to stabilize order when equal or non-numeric
      return String(a?.name || '').localeCompare(String(b?.name || ''))
    }
    return an - bn
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/model/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      setNotification({ type: 'success', message: 'Model deleted successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Failed to delete model.'
      setNotification({ type: 'error', message: msg })
    }
  })

  // Update mutation style: mutationFn takes only id and uses the payload from state
  const updateMutation = useMutation({
    mutationFn: (id) => api.patch(`/model/${id}`, pendingPayload || {}),
    onSuccess: () => {
      setEditingModel(null)
      setPendingPayload(null)
      setOriginalData(null)
      queryClient.invalidateQueries({ queryKey: ['models'] })
      setNotification({ type: 'success', message: 'Model updated successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Failed to update model.'
      setNotification({ type: 'error', message: msg })
    }
  })

  const handleDelete = async (id) => {
    if (!id) return
    deleteMutation.mutate(id)
  }

  const openDeleteConfirm = (model) => {
    const modelId = model?._id || model?.id
    setConfirmDelete({ open: true, id: modelId, name: model.name })
  }

  const closeDeleteConfirm = () => {
    setConfirmDelete({ open: false, id: null, name: '' })
  }

  const confirmDeleteAction = () => {
    if (confirmDelete.id) {
      handleDelete(confirmDelete.id)
    }
    closeDeleteConfirm()
  }

  const normalizeModelToPayload = (model) => {
    const basePayload = {
      type: model.type,
      name: model.name,
      factor: Number(model.factor ?? 0),
      startRpmNumber: Number(model.startRpmNumber ?? 0),
      endRpmNumber: Number(model.endRpmNumber ?? 0),
      points: (model.points || []).map(p => ({
        rpm: Number(p.rpm),
        flowRate: Number(p.flowRate),
        totalPressure: Number(p.totalPressure),
        efficiency: Number(p.efficiency),
        lpa: Number(p.lpa)
      }))
    }

    // Add centrifugal fields if model is centrifugal
    if (model.type === 'centrifugal') {
      basePayload.pressureType = model.pressureType || ''
      basePayload.configurationType = model.configurationType || ''
      basePayload.centrifugalType = model.centrifugalType || ''
    }

    return basePayload
  }

  const handleEdit = (model) => {
    setEditingModel(model)
    const normalized = normalizeModelToPayload(model)
    setOriginalData(normalized)
    setFormData(normalized)
  }

  const toggleExpanded = (modelIdRaw) => {
    const modelId = modelIdRaw?._id || modelIdRaw?.id || modelIdRaw
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

  const getCentrifugalTypeOptions = () => {
    if (formData.type !== 'centrifugal') return []
    if (formData.pressureType === 'low') {
      if (formData.configurationType === 'SISW') return ['NBR', 'NBS', 'NBRS', 'NC', 'NBXI']
      if (formData.configurationType === 'DIDW') return ['NBR-D', 'NBS-D']
      return []
    }
    if (formData.pressureType === 'medium') return ['NPD', 'NPE']
    if (formData.pressureType === 'high') return ['NPF']
    return []
  }

  const buildDiff = (orig, updated) => {
    if (!orig) return updated
    const diff = {}
    const keys = ['type','name','factor','startRpmNumber','endRpmNumber','points','pressureType','configurationType','centrifugalType']
    keys.forEach(k => {
      const o = orig[k]
      const u = updated[k]
      if (k === 'points') {
        if (JSON.stringify(o) !== JSON.stringify(u)) {
          diff[k] = u
        }
      } else if (o !== u) {
        diff[k] = u
      }
    })
    return diff
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingModel) return
    const basePayload = {
      type: formData.type,
      name: formData.name,
      factor: Number(formData.factor),
      startRpmNumber: Number(formData.startRpmNumber),
      endRpmNumber: Number(formData.endRpmNumber),
      points: formData.points.map(p => ({
        rpm: Number(p.rpm),
        flowRate: Number(p.flowRate),
        totalPressure: Number(p.totalPressure),
        efficiency: Number(p.efficiency),
        lpa: Number(p.lpa)
      }))
    }

    // Add centrifugal fields if model is centrifugal
    const centrifugalExtras = (formData.type === 'centrifugal') ? {
      pressureType: formData.pressureType || undefined,
      configurationType: formData.pressureType === 'low' ? (formData.configurationType || undefined) : undefined,
      centrifugalType: formData.centrifugalType || undefined,
    } : {}

    const payload = { ...basePayload, ...centrifugalExtras }
    const id = editingModel?._id || editingModel?.id
    if (!id) return

    const diff = buildDiff(originalData, payload)
    if (Object.keys(diff).length === 0) {
      setNotification({ type: 'success', message: 'No changes to update.' })
      return
    }

    setPendingPayload(diff)
    updateMutation.mutate(id)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'factor' || name === 'startRpmNumber' || name === 'endRpmNumber') {
      setFormData({ ...formData, [name]: value === '' ? '' : Number(value) })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleCentrifugalChange = (e) => {
    const { name, value } = e.target
    if (name === 'pressureType') {
      // Reset dependent fields when pressure type changes
      setFormData({ ...formData, pressureType: value, configurationType: '', centrifugalType: '' })
    } else if (name === 'configurationType') {
      // Reset centrifugal type when configuration changes
      setFormData({ ...formData, configurationType: value, centrifugalType: '' })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleFilterChange = (type) => {
    setFilters(prev => {
      const next = { ...prev, [type]: !prev[type] }
      setPage(1)
      return next
    })
  }

  const handleCentrifugalFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: {
        ...prev[filterType],
        [value]: !prev[filterType][value]
      }
    }))
    setPage(1)
  }

  const filtered = sortedModels.filter(m => {
    const t = (m.type || '').toLowerCase()
    if (t === 'axial') return filters.axial
    if (t === 'centrifugal') {
      if (!filters.centrifugal) return false
      
      // Apply centrifugal sub-filters
      if (m.pressureType && !filters.pressureTypes[m.pressureType]) return false
      if (m.centrifugalType && !filters.centrifugalTypes[m.centrifugalType]) return false
      
      return true
    }
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const startIdx = (pageClamped - 1) * PAGE_SIZE
  const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE)

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

      {notification && (
        <div className={`mb-4 p-3 rounded ${notification.type==='success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {notification.message}
        </div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <label className="inline-flex items-center gap-2 text-[#334155]">
          <input
            type="checkbox"
            checked={filters.axial}
            onChange={() => handleFilterChange('axial')}
          />
          <span>Axial</span>
        </label>
        <label className="inline-flex items-center gap-2 text-[#334155]">
          <input
            type="checkbox"
            checked={filters.centrifugal}
            onChange={() => handleFilterChange('centrifugal')}
          />
          <span>Centrifugal</span>
        </label>
      </div>

      {filters.centrifugal && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-[#1E3A8A] mb-3">Centrifugal Filters</h3>
          
          <div className="mb-3">
            <h4 className="text-xs font-medium text-[#334155] mb-2">Pressure Types:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.keys(filters.pressureTypes).map(pressureType => (
                <label key={pressureType} className="inline-flex items-center gap-1 text-xs text-[#334155]">
                  <input
                    type="checkbox"
                    checked={filters.pressureTypes[pressureType]}
                    onChange={() => handleCentrifugalFilterChange('pressureTypes', pressureType)}
                  />
                  <span className="capitalize">{pressureType}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#334155] mb-2">Centrifugal Types:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.keys(filters.centrifugalTypes).map(centrifugalType => (
                <label key={centrifugalType} className="inline-flex items-center gap-1 text-xs text-[#334155]">
                  <input
                    type="checkbox"
                    checked={filters.centrifugalTypes[centrifugalType]}
                    onChange={() => handleCentrifugalFilterChange('centrifugalTypes', centrifugalType)}
                  />
                  <span>{centrifugalType}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

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
                onChange={(e) => {
                  handleInputChange(e)
                  // Reset centrifugal fields when type changes
                  if (e.target.value !== 'centrifugal') {
                    setFormData(prev => ({ ...prev, pressureType: '', configurationType: '', centrifugalType: '' }))
                  }
                }}
                className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                required
              >
                <option value="">Select Type</option>
                <option value="axial">Axial</option>
                <option value="centrifugal">Centrifugal</option>
              </select>
            </div>

            {formData.type === 'centrifugal' && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-medium text-[#1E3A8A] mb-3">Centrifugal Properties</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1 text-[#334155]">Pressure Type:</label>
                    <select
                      name="pressureType"
                      value={formData.pressureType || ''}
                      onChange={handleCentrifugalChange}
                      className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                    >
                      <option value="">Select pressure type</option>
                      <option value="low">Low Pressure</option>
                      <option value="medium">Medium Pressure</option>
                      <option value="high">High Pressure</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-[#334155]">Configuration Type:</label>
                    <select
                      name="configurationType"
                      value={formData.configurationType || ''}
                      onChange={handleCentrifugalChange}
                      disabled={formData.pressureType !== 'low'}
                      className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF] disabled:bg-gray-100"
                    >
                      <option value="">Select configuration</option>
                      <option value="SISW">SISW</option>
                      <option value="DIDW">DIDW</option>
                    </select>
                    {formData.pressureType === 'low' && (
                      <p className="mt-1 text-xs text-gray-500">SISW: NBR, NBS, NBRS, NC, NBXI — DIDW: NBR-D, NBS-D</p>
                    )}
                  </div>
                  <div>
                    <label className="block mb-1 text-[#334155]">Centrifugal Type:</label>
                    <select
                      name="centrifugalType"
                      value={formData.centrifugalType || ''}
                      onChange={handleCentrifugalChange}
                      disabled={!formData.pressureType || (formData.pressureType === 'low' && !formData.configurationType)}
                      className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF] disabled:bg-gray-100"
                    >
                      <option value="">Select centrifugal type</option>
                      {getCentrifugalTypeOptions().map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1 text-[#334155]">Factor:</label>
                <input
                  type="number"
                  step="any"
                  name="factor"
                  value={formData.factor}
                  onChange={handleInputChange}
                  className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 text-[#334155]">Start RPM Number:</label>
                <input
                  type="number"
                  step="any"
                  name="startRpmNumber"
                  value={formData.startRpmNumber}
                  onChange={handleInputChange}
                  className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 text-[#334155]">End RPM Number:</label>
                <input
                  type="number"
                  step="any"
                  name="endRpmNumber"
                  value={formData.endRpmNumber}
                  onChange={handleInputChange}
                  className="border p-2 w-full rounded bg-white text-[#1F3B73] border-[#C7DAFF]"
                  required
                />
              </div>
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
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className={`px-4 py-2 rounded transition-colors ${updateMutation.isPending ? 'bg-emerald-300 text-white cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
              >
                {updateMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Updating...
                  </span>
                ) : (
                  'Update'
                )}
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
        {paged && paged.length > 0 ? (
          paged.map((model) => {
            const modelId = model?._id || model?.id
            const isExpanded = expandedCards[modelId]
            const pointsToShow = isExpanded ? model.points : model.points?.slice(0, 2)
            const hasMorePoints = model.points && model.points.length > 2

            return (
              <div key={modelId} className="relative border p-4 rounded bg-gradient-to-br from-[#E6F0FF] via-[#DDEBFF] to-[#CFE3FF] border-[#E5EDFF]">
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[#FDBA74]"></span>
                <h3 className="text-lg font-semibold text-[#1E3A8A]">{model.name}</h3>
                <p className="text-[#64748B] capitalize">{model.type}</p>
                
                {model.type === 'centrifugal' && (
                  <div className="mt-2 p-2 bg-white/60 rounded border border-blue-200">
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      {model.pressureType && (
                        <div className="flex justify-between">
                          <span className="text-[#334155] font-medium">Pressure:</span>
                          <span className="text-[#1E3A8A] capitalize">{model.pressureType}</span>
                        </div>
                      )}
                      {model.configurationType && (
                        <div className="flex justify-between">
                          <span className="text-[#334155] font-medium">Configuration:</span>
                          <span className="text-[#1E3A8A]">{model.configurationType}</span>
                        </div>
                      )}
                      {model.centrifugalType && (
                        <div className="flex justify-between">
                          <span className="text-[#334155] font-medium">Type:</span>
                          <span className="text-[#1E3A8A] font-semibold">{model.centrifugalType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#334155] mb-1">Factor</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                      value={Number(model.factor ?? 0)}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#334155] mb-1">Start RPM</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                      value={Number(model.startRpmNumber ?? 0)}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#334155] mb-1">End RPM</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-[#C7DAFF] rounded bg-white text-[#1F3B73]"
                      value={Number(model.endRpmNumber ?? 0)}
                      readOnly
                    />
                  </div>
                </div>
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
                        onClick={() => toggleExpanded(modelId)}
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
                    onClick={() => openDeleteConfirm(model)}
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

      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          className="px-3 py-1 rounded bg-[#E5EDFF] text-[#1E3A8A] disabled:opacity-50"
          disabled={pageClamped <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="text-[#334155] text-sm">Page {pageClamped} of {totalPages}</span>
        <button
          className="px-3 py-1 rounded bg-[#E5EDFF] text-[#1E3A8A] disabled:opacity-50"
          disabled={pageClamped >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>

      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#1E3A8A] mb-2">Confirm Delete</h3>
            <p className="text-[#334155] mb-4">Are you sure you want to delete "{confirmDelete.name}"?</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={closeDeleteConfirm}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-rose-600 text-white hover:bg-rose-700"
                onClick={confirmDeleteAction}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AllModels