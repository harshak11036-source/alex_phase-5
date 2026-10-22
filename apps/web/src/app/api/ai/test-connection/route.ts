import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  testProviderConnection,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { provider, apiKey, credentialId, model, query, baseUrl } = body

    if (!credentialId && (!provider || !apiKey)) {
      return NextResponse.json(
        { error: 'Either credentialId or both provider and apiKey are required', success: false },
        { status: 400 }
      )
    }

    const result = await testProviderConnection({
      userId: user.id,
      provider,
      apiKey,
      credentialId,
      model,
      query,
      baseUrl,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[AI Test Connection] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Connection test failed')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
