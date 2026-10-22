import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  normalizeProvider,
  validateProviderModel,
  formatAIServiceErrorResponse,
  SUPPORTED_AI_PROVIDERS,
  type AITaskType,
} from '@/lib/ai/service'

export async function GET() {
  try {
    const user = await requireAuth()

    const configs = await prisma.aIModelConfig.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('[AI Models] Fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch model configs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { provider: rawProvider, modelId: rawModelId, taskType = 'chat', isDefault = true, parameters } = body

    if (!rawProvider || !rawModelId || !taskType) {
      return NextResponse.json({ error: 'Provider, modelId, and taskType are required' }, { status: 400 })
    }

    const provider = normalizeProvider(rawProvider)
    const validTaskType = (['chat', 'embeddings', 'reasoning', 'vision', 'structured'].includes(taskType)
      ? taskType
      : 'chat') as AITaskType

    const meta = SUPPORTED_AI_PROVIDERS[provider]
    const modelId = validateProviderModel(
      provider,
      String(rawModelId).trim(),
      validTaskType,
      meta ? [...meta.models, ...meta.embeddingModels] : []
    )

    if (isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { userId: user.id, taskType, isDefault: true },
        data: { isDefault: false },
      })
    }

    const config = await prisma.aIModelConfig.upsert({
      where: {
        userId_provider_modelId_taskType: {
          userId: user.id,
          provider,
          modelId,
          taskType,
        },
      },
      update: {
        isDefault: Boolean(isDefault),
        parameters: parameters || {},
      },
      create: {
        userId: user.id,
        provider,
        modelId,
        taskType,
        isDefault: Boolean(isDefault),
        parameters: parameters || {},
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('[AI Models] Create/update error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to update model configuration')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
