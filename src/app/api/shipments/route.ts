import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/shipments - List all shipments
export async function GET() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/shipments - Create a new shipment
export async function POST(request: NextRequest) {
  const body = await request.json()

  const { data, error } = await supabase
    .from('shipments')
    .insert([{
      user_id: body.user_id,
      origin_city: body.origin_city,
      origin_state: body.origin_state,
      destination_city: body.destination_city,
      destination_state: body.destination_state,
      shipper_name: body.shipper_name,
      consignee_name: body.consignee_name,
      weight: body.weight,
      status: body.status || 'pending'
    }])
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}