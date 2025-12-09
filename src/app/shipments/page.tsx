'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import ChatWidget from '@/components/ChatWidget'

type StatusFilter = 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled'
type SortField = 'created_at' | 'origin_city' | 'destination_city' | 'weight' | 'status'
type SortDirection = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_transit: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_DOTS: Record<string, string> = {
  pending: 'bg-amber-500',
  in_transit: 'bg-blue-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-red-500',
}

export default function ShipmentsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    shipper_name: '',
    consignee_name: '',
    weight: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }
    
    setUser(user)

    const { data } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setShipments(data || [])
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    const { error } = await supabase
      .from('shipments')
      .insert([{
        user_id: user?.id,
        origin_city: formData.origin_city,
        origin_state: formData.origin_state,
        destination_city: formData.destination_city,
        destination_state: formData.destination_state,
        shipper_name: formData.shipper_name,
        consignee_name: formData.consignee_name,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        status: 'pending'
      }])

    if (!error) {
      setFormData({
        origin_city: '',
        origin_state: '',
        destination_city: '',
        destination_state: '',
        shipper_name: '',
        consignee_name: '',
        weight: '',
      })
      setShowForm(false)
      loadData()
    }

    setFormLoading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExtracting(true)
    setShowForm(true)

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.readAsDataURL(file)
      })

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
        }),
      })

      const extracted = await response.json()

      if (extracted.error) {
        alert('Extraction failed: ' + extracted.error)
      } else {
        setFormData({
          origin_city: extracted.origin_city || '',
          origin_state: extracted.origin_state || '',
          destination_city: extracted.destination_city || '',
          destination_state: extracted.destination_state || '',
          shipper_name: extracted.shipper_name || '',
          consignee_name: extracted.consignee_name || '',
          weight: extracted.weight?.toString() || '',
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to process document')
    }

    setExtracting(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleStatusChange = async (shipmentId: string, newStatus: string) => {
    const { error } = await supabase
      .from('shipments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', shipmentId)

    if (!error) {
      loadData()
      if (selectedShipment?.id === shipmentId) {
        setSelectedShipment({ ...selectedShipment, status: newStatus })
      }
    }
  }

  const handleDelete = async (shipmentId: string) => {
    if (!confirm('Are you sure you want to delete this shipment?')) return

    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('id', shipmentId)

    if (!error) {
      setSelectedShipment(null)
      loadData()
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const stats = {
    total: shipments.length,
    pending: shipments.filter(s => s.status === 'pending').length,
    in_transit: shipments.filter(s => s.status === 'in_transit').length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    cancelled: shipments.filter(s => s.status === 'cancelled').length,
  }

  const filteredShipments = shipments
    .filter(s => statusFilter === 'all' || s.status === statusFilter)
    .filter(s => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        s.origin_city?.toLowerCase().includes(query) ||
        s.destination_city?.toLowerCase().includes(query) ||
        s.shipper_name?.toLowerCase().includes(query) ||
        s.consignee_name?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      if (sortField === 'weight') {
        aVal = aVal || 0
        bVal = bVal || 0
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-900 text-lg">FreightFlow</span>
              </a>
              <div className="hidden md:flex items-center gap-1">
                <a href="/dashboard" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">Dashboard</a>
                <a href="/shipments" className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">Shipments</a>
                <a href="#" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">Carriers</a>
                <a href="#" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">Documents</a>
                <a href="#" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">Analytics</a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
            <p className="text-slate-500 mt-1">Manage and track all your shipments</p>
          </div>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-50 transition shadow-sm">
              {extracting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                  Extracting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload BOL
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={extracting}
              />
            </label>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Shipment
            </button>
          </div>
        </div>

        {/* New Shipment Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                {extracting ? 'AI Extracting Document...' : 'Create New Shipment'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {extracting && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="text-blue-700 font-medium">AI is reading your document and extracting shipment details...</p>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Origin City</label>
                  <input
                    type="text"
                    value={formData.origin_city}
                    onChange={(e) => setFormData({...formData, origin_city: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Los Angeles"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Origin State</label>
                  <input
                    type="text"
                    value={formData.origin_state}
                    onChange={(e) => setFormData({...formData, origin_state: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="CA"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Shipper Name</label>
                  <input
                    type="text"
                    value={formData.shipper_name}
                    onChange={(e) => setFormData({...formData, shipper_name: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="ABC Logistics"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Destination City</label>
                  <input
                    type="text"
                    value={formData.destination_city}
                    onChange={(e) => setFormData({...formData, destination_city: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Phoenix"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Destination State</label>
                  <input
                    type="text"
                    value={formData.destination_state}
                    onChange={(e) => setFormData({...formData, destination_state: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="AZ"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Consignee Name</label>
                  <input
                    type="text"
                    value={formData.consignee_name}
                    onChange={(e) => setFormData({...formData, consignee_name: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="XYZ Warehouse"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Weight (lbs)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="15000"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={formLoading || extracting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {formLoading ? 'Creating...' : 'Create Shipment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Shipments Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex gap-1 overflow-x-auto">
                {(['all', 'pending', 'in_transit', 'delivered', 'cancelled'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
                      statusFilter === status
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      statusFilter === status ? 'bg-slate-700' : 'bg-slate-200'
                    }`}>
                      {status === 'all' ? stats.total : stats[status as keyof typeof stats]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search shipments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('origin_city')}>
                    <div className="flex items-center gap-1">Origin {sortField === 'origin_city' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('destination_city')}>
                    <div className="flex items-center gap-1">Destination {sortField === 'destination_city' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Shipper / Consignee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('weight')}>
                    <div className="flex items-center gap-1">Weight {sortField === 'weight' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status {sortField === 'status' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1">Created {sortField === 'created_at' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <p className="text-slate-500">No shipments found</p>
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-slate-50 cursor-pointer transition" onClick={() => setSelectedShipment(shipment)}>
                      <td className="px-6 py-4 font-medium text-slate-900">{shipment.origin_city}, {shipment.origin_state}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{shipment.destination_city}, {shipment.destination_state}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">{shipment.shipper_name}</div>
                        <div className="text-sm text-slate-500">{shipment.consignee_name}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-900">{shipment.weight ? `${shipment.weight.toLocaleString()} lbs` : '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[shipment.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[shipment.status]}`}></span>
                          {shipment.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(shipment.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedShipment(shipment); }} className="text-slate-400 hover:text-slate-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">Showing {filteredShipments.length} of {stats.total} shipments</p>
          </div>
        </div>
      </div>

      {/* Shipment Detail Slide-over */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSelectedShipment(null)}></div>
          <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl">
            <div className="h-full flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Shipment Details</h2>
                <button onClick={() => setSelectedShipment(null)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">Origin</p>
                      <p className="text-lg font-semibold text-slate-900">{selectedShipment.origin_city}, {selectedShipment.origin_state}</p>
                      <p className="text-sm text-slate-500">{selectedShipment.shipper_name}</p>
                    </div>
                    <svg className="w-6 h-6 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="flex-1 text-right">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">Destination</p>
                      <p className="text-lg font-semibold text-slate-900">{selectedShipment.destination_city}, {selectedShipment.destination_state}</p>
                      <p className="text-sm text-slate-500">{selectedShipment.consignee_name}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Status</p>
                  <select
                    value={selectedShipment.status}
                    onChange={(e) => handleStatusChange(selectedShipment.id, e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border-2 font-medium ${STATUS_COLORS[selectedShipment.status]} border-current`}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Weight</p>
                    <p className="text-lg font-semibold text-slate-900">{selectedShipment.weight ? `${selectedShipment.weight.toLocaleString()} lbs` : '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Created</p>
                    <p className="text-lg font-semibold text-slate-900">{formatDate(selectedShipment.created_at)}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Shipment ID</p>
                  <code className="block bg-slate-100 px-4 py-3 rounded-lg text-sm text-slate-700 font-mono break-all">{selectedShipment.id}</code>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-900">{formatDateTime(selectedShipment.created_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-slate-500">Last Updated</span>
                    <span className="text-slate-900">{formatDateTime(selectedShipment.updated_at)}</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => handleDelete(selectedShipment.id)}
                  className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                >
                  Delete Shipment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user && <ChatWidget userId={user.id} onShipmentChange={loadData} />}
    </main>
  )
}