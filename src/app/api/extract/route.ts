import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { documentText, imageBase64, mimeType } = await request.json()

    let content: any[] = []

    // If image is provided, use vision
    if (imageBase64) {
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType || 'image/png',
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: `Extract shipping information from this freight document (BOL, rate confirmation, or similar). 
          
Return ONLY a JSON object with these fields (use null for any field you cannot find):
{
  "origin_city": string,
  "origin_state": string (2-letter code),
  "destination_city": string,
  "destination_state": string (2-letter code),
  "shipper_name": string,
  "consignee_name": string,
  "weight": number (in lbs, no commas),
  "po_number": string,
  "pickup_date": string (YYYY-MM-DD format)
}

Return ONLY the JSON object, no other text.`,
        },
      ]
    } else if (documentText) {
      // Text-based extraction
      content = [
        {
          type: 'text',
          text: `Extract shipping information from this freight document text:

---
${documentText}
---

Return ONLY a JSON object with these fields (use null for any field you cannot find):
{
  "origin_city": string,
  "origin_state": string (2-letter code),
  "destination_city": string,
  "destination_state": string (2-letter code),
  "shipper_name": string,
  "consignee_name": string,
  "weight": number (in lbs, no commas),
  "po_number": string,
  "pickup_date": string (YYYY-MM-DD format)
}

Return ONLY the JSON object, no other text.`,
        },
      ]
    } else {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

    // Extract the text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse the JSON response
    // Clean up the response - remove markdown code blocks if present
let jsonText = textBlock.text.trim()
if (jsonText.startsWith('```json')) {
  jsonText = jsonText.slice(7)
}
if (jsonText.startsWith('```')) {
  jsonText = jsonText.slice(3)
}
if (jsonText.endsWith('```')) {
  jsonText = jsonText.slice(0, -3)
}
jsonText = jsonText.trim()

const extracted = JSON.parse(jsonText)

    return NextResponse.json(extracted)
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Extraction failed' },
      { status: 500 }
    )
  }
}