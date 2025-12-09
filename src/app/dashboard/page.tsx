'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import ChatWidget from '@/components/ChatWidget'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_transit: '#3b82f6',
  delivered: '#10b981',
  cancelled: '#ef4444',
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_transit: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

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

  const stats = {
    total: shipments.length,
    pending: shipments.filter(s => s.status === 'pending').length,
    in_transit: shipments.filter(s => s.status === 'in_transit').length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    cancelled: shipments.filter(s => s.status === 'cancelled').length,
    totalWeight: shipments.reduce((sum, s) => sum + (s.weight || 0), 0),
    avgWeight: shipments.length > 0 ? Math.round(shipments.reduce((sum, s) => sum + (s.weight || 0), 0) / shipments.length) : 0,
  }

  const statusData = [
    { name: 'Pending', value: stats.pending, color: STATUS_COLORS.pending },
    { name: 'In Transit', value: stats.in_transit, color: STATUS_COLORS.in_transit },
    { name: 'Delivered', value: stats.delivered, color: STATUS_COLORS.delivered },
    { name: 'Cancelled', value: stats.cancelled, color: STATUS_COLORS.cancelled },
  ].filter(d => d.value > 0)

  const laneCounts: Record<string, number> = {}
  shipments.forEach(s => {
    const lane = `${s.origin_city} → ${s.destination_city}`
    laneCounts[lane] = (laneCounts[lane] || 0) + 1
  })
  const topLanes = Object.entries(laneCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lane, count]) => ({ lane, count }))

  const recentShipments = shipments.slice(0, 5)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

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
                <a href="/dashboard" className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">Dashboard</a>
                <a href="/shipments" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">Shipments</a>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Overview of your freight operations</p>
          </div>
          <a
            href="/shipments"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Shipment
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Shipments</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pending</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">In Transit</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{stats.in_transit}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Delivered</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.delivered}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Weight</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{(stats.totalWeight / 1000).toFixed(0)}<span className="text-lg font-normal text-slate-500">k lbs</span></p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Avg Weight</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{(stats.avgWeight / 1000).toFixed(1)}<span className="text-lg font-normal text-slate-500">k lbs</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Shipments by Status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-sm text-slate-600">{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Lanes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topLanes} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="lane" 
                    width={180}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} shipments`, 'Count']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Recent Shipments</h3>
              <a href="/shipments" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all →</a>
            </div>
            <div className="divide-y divide-slate-200">
              {recentShipments.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-slate-500">No shipments yet</p>
                  <a href="/shipments" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">Create your first shipment →</a>
                </div>
              ) : (
                recentShipments.map((shipment) => (
                  <div key={shipment.id} className="px-6 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {shipment.origin_city}, {shipment.origin_state} → {shipment.destination_city}, {shipment.destination_state}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {shipment.shipper_name} • {shipment.weight?.toLocaleString() || '—'} lbs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[shipment.status]}`}>
                          {shipment.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-slate-400">{formatDate(shipment.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <a
                href="/shipments"
                className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl hover:bg-slate-100 transition border border-slate-200"
              >
                <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium text-slate-700">New Shipment</span>
              </a>
              <a
                href="/shipments"
                className="flex flex-col items-center justify-center p-6 bg-amber-50 rounded-xl hover:bg-amber-100 transition border border-amber-200"
              >
                <svg className="w-8 h-8 text-amber-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Pending ({stats.pending})</span>
              </a>
              <a
                href="/shipments"
                className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl hover:bg-blue-100 transition border border-blue-200"
              >
                <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm font-medium text-slate-700">In Transit ({stats.in_transit})</span>
              </a>
              <a
                href="/shipments"
                className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl hover:bg-slate-100 transition border border-slate-200"
              >
                <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Upload BOL</span>
              </a>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-500 uppercase mb-3">This Week</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Active shipments</span>
                  <span className="text-sm font-semibold text-slate-900">{stats.pending + stats.in_transit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Completion rate</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    {stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total freight moved</span>
                  <span className="text-sm font-semibold text-slate-900">{(stats.totalWeight / 1000).toFixed(0)}k lbs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {user && <ChatWidget userId={user.id} onShipmentChange={loadData} />}
    </main>
  )
}