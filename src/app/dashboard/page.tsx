'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
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
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          // Remove the data:image/...;base64, prefix
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.readAsDataURL(file)
      })

      // Send to extraction API
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
        // Auto-fill the form with extracted data
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
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Log Out
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Shipments</h2>
            <div className="flex gap-2">
              <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm cursor-pointer">
                {extracting ? 'Extracting...' : '📄 Upload Document'}
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
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
              >
                {showForm ? 'Cancel' : '+ New Shipment'}
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="bg-gray-700 p-4 rounded-lg mb-6">
              {extracting && (
                <div className="mb-4 p-3 bg-purple-900 rounded text-center">
                  <p>🔍 AI is reading your document...</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Origin City</label>
                  <input
                    type="text"
                    value={formData.origin_city}
                    onChange={(e) => setFormData({...formData, origin_city: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Origin State</label>
                  <input
                    type="text"
                    value={formData.origin_state}
                    onChange={(e) => setFormData({...formData, origin_state: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Destination City</label>
                  <input
                    type="text"
                    value={formData.destination_city}
                    onChange={(e) => setFormData({...formData, destination_city: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Destination State</label>
                  <input
                    type="text"
                    value={formData.destination_state}
                    onChange={(e) => setFormData({...formData, destination_state: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Shipper Name</label>
                  <input
                    type="text"
                    value={formData.shipper_name}
                    onChange={(e) => setFormData({...formData, shipper_name: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Consignee Name</label>
                  <input
                    type="text"
                    value={formData.consignee_name}
                    onChange={(e) => setFormData({...formData, consignee_name: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    className="w-full p-2 border rounded bg-gray-800 border-gray-600"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={formLoading || extracting}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {formLoading ? 'Creating...' : 'Create Shipment'}
              </button>
            </form>
          )}
          
          {shipments.length === 0 ? (
            <p className="text-gray-400">No shipments yet.</p>
          ) : (
            <div className="space-y-4">
              {shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="bg-gray-700 p-4 rounded-lg"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">
                        {shipment.origin_city}, {shipment.origin_state} →{' '}
                        {shipment.destination_city}, {shipment.destination_state}
                      </p>
                      <p className="text-sm text-gray-400">
                        {shipment.shipper_name} → {shipment.consignee_name}
                      </p>
                      {shipment.weight && (
                        <p className="text-sm text-gray-400">{shipment.weight} lbs</p>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-blue-600 rounded text-sm h-fit">
                      {shipment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}