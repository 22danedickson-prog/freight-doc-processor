'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState('Testing...')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('shipments').select('count')
      
      if (error) {
        setConnectionStatus(`Error: ${error.message}`)
      } else {
        setConnectionStatus('Connected to Supabase successfully!')
      }
    }
    
    testConnection()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold mb-4">Freight Doc Processor</h1>
      <p className="text-lg">{connectionStatus}</p>
    </main>
  )
}