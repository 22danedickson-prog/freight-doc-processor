import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://yupiqrnfyfgaivsrarhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cGlxcm5meWZnYWl2c3JhcmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5Mjg4MSwiZXhwIjoyMDgwNjY4ODgxfQ.Y4Gm4r7WMDvMs6EyoAJ9piZpu4NyQa1_1WkobJMre2I'
)

const demoShipments = [
  // PENDING (5)
  { origin_city: 'Los Angeles', origin_state: 'CA', destination_city: 'Phoenix', destination_state: 'AZ', shipper_name: 'West Coast Distributors', consignee_name: 'Arizona Retail Co', weight: 12500, status: 'pending' },
  { origin_city: 'Seattle', origin_state: 'WA', destination_city: 'Portland', destination_state: 'OR', shipper_name: 'Pacific Northwest Supply', consignee_name: 'Oregon Depot', weight: 8200, status: 'pending' },
  { origin_city: 'Denver', origin_state: 'CO', destination_city: 'Salt Lake City', destination_state: 'UT', shipper_name: 'Mountain Freight Inc', consignee_name: 'Utah Warehousing', weight: 15000, status: 'pending' },
  { origin_city: 'Minneapolis', origin_state: 'MN', destination_city: 'Milwaukee', destination_state: 'WI', shipper_name: 'Midwest Manufacturing', consignee_name: 'Great Lakes Storage', weight: 9800, status: 'pending' },
  { origin_city: 'Boston', origin_state: 'MA', destination_city: 'Hartford', destination_state: 'CT', shipper_name: 'New England Goods', consignee_name: 'Connecticut Logistics', weight: 6500, status: 'pending' },

  // IN TRANSIT (8)
  { origin_city: 'Chicago', origin_state: 'IL', destination_city: 'Detroit', destination_state: 'MI', shipper_name: 'Windy City Exports', consignee_name: 'Motor City Imports', weight: 22000, status: 'in_transit' },
  { origin_city: 'Dallas', origin_state: 'TX', destination_city: 'Houston', destination_state: 'TX', shipper_name: 'Lone Star Freight', consignee_name: 'Gulf Coast Receiving', weight: 18500, status: 'in_transit' },
  { origin_city: 'Atlanta', origin_state: 'GA', destination_city: 'Miami', destination_state: 'FL', shipper_name: 'Southern Express', consignee_name: 'Florida Distribution', weight: 14200, status: 'in_transit' },
  { origin_city: 'New York', origin_state: 'NY', destination_city: 'Philadelphia', destination_state: 'PA', shipper_name: 'Empire State Shipping', consignee_name: 'Liberty Logistics', weight: 11000, status: 'in_transit' },
  { origin_city: 'San Francisco', origin_state: 'CA', destination_city: 'Las Vegas', destination_state: 'NV', shipper_name: 'Bay Area Transport', consignee_name: 'Vegas Wholesale', weight: 16800, status: 'in_transit' },
  { origin_city: 'Nashville', origin_state: 'TN', destination_city: 'Memphis', destination_state: 'TN', shipper_name: 'Music City Movers', consignee_name: 'Bluff City Warehouse', weight: 7500, status: 'in_transit' },
  { origin_city: 'Kansas City', origin_state: 'MO', destination_city: 'St. Louis', destination_state: 'MO', shipper_name: 'Gateway Freight', consignee_name: 'Arch City Receiving', weight: 13200, status: 'in_transit' },
  { origin_city: 'Indianapolis', origin_state: 'IN', destination_city: 'Columbus', destination_state: 'OH', shipper_name: 'Crossroads Shipping', consignee_name: 'Buckeye Distribution', weight: 10500, status: 'in_transit' },

  // DELIVERED (5)
  { origin_city: 'Charlotte', origin_state: 'NC', destination_city: 'Raleigh', destination_state: 'NC', shipper_name: 'Carolina Carriers', consignee_name: 'Triangle Logistics', weight: 8900, status: 'delivered' },
  { origin_city: 'San Diego', origin_state: 'CA', destination_city: 'Tucson', destination_state: 'AZ', shipper_name: 'Border Express', consignee_name: 'Desert Depot', weight: 11200, status: 'delivered' },
  { origin_city: 'Pittsburgh', origin_state: 'PA', destination_city: 'Cleveland', destination_state: 'OH', shipper_name: 'Steel City Transport', consignee_name: 'Rock & Roll Receiving', weight: 19500, status: 'delivered' },
  { origin_city: 'Tampa', origin_state: 'FL', destination_city: 'Orlando', destination_state: 'FL', shipper_name: 'Sunshine Shipping', consignee_name: 'Theme Park Supply', weight: 7200, status: 'delivered' },
  { origin_city: 'Sacramento', origin_state: 'CA', destination_city: 'Reno', destination_state: 'NV', shipper_name: 'Capital Freight', consignee_name: 'Silver State Storage', weight: 14800, status: 'delivered' },

  // CANCELLED (2)
  { origin_city: 'Baltimore', origin_state: 'MD', destination_city: 'Washington', destination_state: 'DC', shipper_name: 'Charm City Cargo', consignee_name: 'DC Distribution', weight: 5500, status: 'cancelled' },
  { origin_city: 'Austin', origin_state: 'TX', destination_city: 'San Antonio', destination_state: 'TX', shipper_name: 'Capitol Express', consignee_name: 'Alamo Logistics', weight: 9100, status: 'cancelled' },
]

async function seedDemoData(userId: string) {
  console.log('Seeding demo shipments...')
  
  const shipmentsWithUser = demoShipments.map((shipment, index) => ({
    ...shipment,
    user_id: userId,
    created_at: new Date(Date.now() - (index * 86400000)).toISOString(), // Stagger creation dates
    updated_at: new Date(Date.now() - (index * 43200000)).toISOString(),
  }))

  const { data, error } = await supabase
    .from('shipments')
    .insert(shipmentsWithUser)
    .select()

  if (error) {
    console.error('Error seeding:', error)
  } else {
    console.log(`✅ Created ${data.length} demo shipments`)
  }
}

// Replace with your actual user ID from Supabase
const YOUR_USER_ID = 'c1110f73-bd24-4814-b5a6-208d73b129e7'
seedDemoData(YOUR_USER_ID)