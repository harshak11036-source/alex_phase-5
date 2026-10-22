import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  saveUserAICredential,
  formatAIServiceErrorResponse,
  SUPPORTED_AI_PROVIDERS,
} from '@/lib/ai/service'

export async function GET() {
  try {
    const user = await requireAuth()

    const credentials = await prisma.aICredential.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    // Never expose encryptedKey or plaintext API keys to the client
    const safeCredentials = credentials.map(c => ({
      id: c.id,
      provider: c.provider,
      providerName: c.providerName || SUPPORTED_AI_PROVIDERS[c.provider]?.name || c.provider,
      isActive: c.isActive,
      isDefault: c.isDefault,
      models: Array.isArray(c.models) ? c.models : [],
      usageLimit: c.usageLimit,
      usageCount: c.usageCount,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    }))

    return NextResponse.json(safeCredentials)
  } catch (error) {
    console.error('[AI Credentials] Fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { provider, providerName, apiKey, models, isDefault, usageLimit } = body

    const saved = await saveUserAICredential({
      userId: user.id,
      provider,
      providerName,
      apiKey,
      models,
      isDefault,
      usageLimit,
    })

    return NextResponse.json(saved)
  } catch (error) {
    console.error('[AI Credentials] Create error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to create credential')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
