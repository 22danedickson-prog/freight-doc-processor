import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Create Supabase client with service role for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

// Define tools for Claude
const tools: Anthropic.Tool[] = [
  {
    name: 'list_shipments',
    description: 'List all shipments for the user, optionally filtered by status',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status: pending, in_transit, delivered, cancelled',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of shipments to return (default 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_shipment',
    description: 'Get details of a specific shipment by ID or by searching origin/destination',
    input_schema: {
      type: 'object' as const,
      properties: {
        shipment_id: {
          type: 'string',
          description: 'The UUID of the shipment',
        },
        search: {
          type: 'string',
          description: 'Search term to find shipment by city name',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_shipment_status',
    description: 'Update the status of a shipment',
    input_schema: {
      type: 'object' as const,
      properties: {
        shipment_id: {
          type: 'string',
          description: 'The UUID of the shipment to update',
        },
        search: {
          type: 'string',
          description: 'Search term to find shipment by city name (alternative to ID)',
        },
        new_status: {
          type: 'string',
          enum: ['pending', 'in_transit', 'delivered', 'cancelled'],
          description: 'The new status to set',
        },
      },
      required: ['new_status'],
    },
  },
  {
    name: 'get_shipment_stats',
    description: 'Get statistics about shipments (counts by status, total weight, etc)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'delete_shipment',
    description: 'Delete a shipment (use with caution)',
    input_schema: {
      type: 'object' as const,
      properties: {
        shipment_id: {
          type: 'string',
          description: 'The UUID of the shipment to delete',
        },
        search: {
          type: 'string',
          description: 'Search term to find shipment by city name',
        },
      },
      required: [],
    },
  },
]

// Tool execution functions
async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  switch (toolName) {
    case 'list_shipments': {
      let query = supabase
        .from('shipments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit((toolInput.limit as number) || 10)

      if (toolInput.status) {
        query = query.eq('status', toolInput.status)
      }

      const { data, error } = await query

      if (error) return `Error: ${error.message}`
      if (!data || data.length === 0) return 'No shipments found.'

      return JSON.stringify(
        data.map((s) => ({
          id: s.id,
          route: `${s.origin_city}, ${s.origin_state} → ${s.destination_city}, ${s.destination_state}`,
          shipper: s.shipper_name,
          consignee: s.consignee_name,
          weight: s.weight ? `${s.weight} lbs` : 'N/A',
          status: s.status,
          created: new Date(s.created_at).toLocaleDateString(),
        })),
        null,
        2
      )
    }

    case 'get_shipment': {
      let query = supabase.from('shipments').select('*').eq('user_id', userId)

      if (toolInput.shipment_id) {
        query = query.eq('id', toolInput.shipment_id)
      } else if (toolInput.search) {
        query = query.or(
          `origin_city.ilike.%${toolInput.search}%,destination_city.ilike.%${toolInput.search}%`
        )
      }

      const { data, error } = await query.limit(1).single()

      if (error) return `Error: ${error.message}`
      if (!data) return 'Shipment not found.'

      return JSON.stringify(
        {
          id: data.id,
          origin: `${data.origin_city}, ${data.origin_state}`,
          destination: `${data.destination_city}, ${data.destination_state}`,
          shipper: data.shipper_name,
          consignee: data.consignee_name,
          weight: data.weight ? `${data.weight} lbs` : 'N/A',
          status: data.status,
          created: new Date(data.created_at).toLocaleString(),
          updated: new Date(data.updated_at).toLocaleString(),
        },
        null,
        2
      )
    }

    case 'update_shipment_status': {
      let shipmentId = toolInput.shipment_id as string

      // If no ID provided, search for the shipment
      if (!shipmentId && toolInput.search) {
        const { data: searchData } = await supabase
          .from('shipments')
          .select('id')
          .eq('user_id', userId)
          .or(
            `origin_city.ilike.%${toolInput.search}%,destination_city.ilike.%${toolInput.search}%`
          )
          .limit(1)
          .single()

        if (searchData) shipmentId = searchData.id
      }

      if (!shipmentId) return 'Could not find shipment to update.'

      const { data, error } = await supabase
        .from('shipments')
        .update({
          status: toolInput.new_status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) return `Error: ${error.message}`
      if (!data) return 'Shipment not found or not authorized.'

      return `Successfully updated shipment to "${toolInput.new_status}". Route: ${data.origin_city}, ${data.origin_state} → ${data.destination_city}, ${data.destination_state}`
    }

    case 'get_shipment_stats': {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('user_id', userId)

      if (error) return `Error: ${error.message}`
      if (!data || data.length === 0) return 'No shipments found.'

      const stats = {
        total: data.length,
        by_status: {
          pending: data.filter((s) => s.status === 'pending').length,
          in_transit: data.filter((s) => s.status === 'in_transit').length,
          delivered: data.filter((s) => s.status === 'delivered').length,
          cancelled: data.filter((s) => s.status === 'cancelled').length,
        },
        total_weight: data.reduce((sum, s) => sum + (s.weight || 0), 0),
        heaviest: data.reduce(
          (max, s) => ((s.weight || 0) > (max.weight || 0) ? s : max),
          data[0]
        ),
      }

      return JSON.stringify(
        {
          total_shipments: stats.total,
          status_breakdown: stats.by_status,
          total_weight: `${stats.total_weight.toLocaleString()} lbs`,
          heaviest_shipment: stats.heaviest
            ? `${stats.heaviest.origin_city} → ${stats.heaviest.destination_city} (${stats.heaviest.weight} lbs)`
            : 'N/A',
        },
        null,
        2
      )
    }

    case 'delete_shipment': {
      let shipmentId = toolInput.shipment_id as string

      if (!shipmentId && toolInput.search) {
        const { data: searchData } = await supabase
          .from('shipments')
          .select('id, origin_city, destination_city')
          .eq('user_id', userId)
          .or(
            `origin_city.ilike.%${toolInput.search}%,destination_city.ilike.%${toolInput.search}%`
          )
          .limit(1)
          .single()

        if (searchData) shipmentId = searchData.id
      }

      if (!shipmentId) return 'Could not find shipment to delete.'

      // Get shipment details before deleting
      const { data: shipment } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .eq('user_id', userId)
        .single()

      if (!shipment) return 'Shipment not found or not authorized.'

      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', shipmentId)
        .eq('user_id', userId)

      if (error) return `Error: ${error.message}`

      return `Successfully deleted shipment: ${shipment.origin_city}, ${shipment.origin_state} → ${shipment.destination_city}, ${shipment.destination_state}`
    }

    default:
      return `Unknown tool: ${toolName}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: message,
      },
    ]

    // Initial request to Claude
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a helpful logistics assistant for a freight management system. You help users manage their shipments by:
- Listing and searching shipments
- Checking shipment status and details
- Updating shipment statuses
- Providing statistics and insights
- Deleting shipments when requested

Be concise and friendly. When showing shipment data, format it nicely for readability.
If the user asks to do something and you need to search for a shipment, use the search parameter with city names.
Always confirm destructive actions (like deletion) after they complete.`,
      tools,
      messages,
    })

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          userId
        )
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        })
      }

      // Continue conversation with tool results
      messages.push({
        role: 'assistant',
        content: response.content,
      })
      messages.push({
        role: 'user',
        content: toolResults,
      })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are a helpful logistics assistant for a freight management system. You help users manage their shipments by:
- Listing and searching shipments
- Checking shipment status and details
- Updating shipment statuses
- Providing statistics and insights
- Deleting shipments when requested

Be concise and friendly. When showing shipment data, format it nicely for readability.
If the user asks to do something and you need to search for a shipment, use the search parameter with city names.
Always confirm destructive actions (like deletion) after they complete.`,
        tools,
        messages,
      })
    }

    // Extract text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )

    return NextResponse.json({
      response: textBlock?.text || 'I could not process that request.',
    })
  } catch (error: any) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { status: 500 }
    )
  }
}