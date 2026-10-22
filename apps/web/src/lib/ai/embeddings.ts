import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

type AIProviderType = PrismaAIProviderType | 'MOCK'

const EMBEDDING_CAPABLE_PROVIDERS: PrismaAIProviderType[] = [
  'OPENAI',
  'GOOGLE_GEMINI',
  'MISTRAL',
]

export function getAIRequestTimeoutMs(): number {
  const parsed = Number(process.env.AI_REQUEST_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = getAIRequestTimeoutMs()
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[AI Embeddings] Request timed out after ${timeoutMs}ms: ${url}`)
      throw new Error(`AI embedding request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export interface EmbeddingResult {
  embeddings: number[][]
  tokenCount: number
  model: string
}

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<EmbeddingResult>
}

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.model }
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    const response = await fetchWithTimeout(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        encoding_format: 'float',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`OpenAI embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage?.total_tokens ?? texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-004') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.model }
    }

    const baseUrl = (process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')
    const response = await fetchWithTimeout(
      `${baseUrl}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          })),
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Google embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.embeddings?.map((e: { values: number[] }) => e.values) || [],
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'mistral-embed') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.model }
    }

    const baseUrl = (process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1').replace(/\/+$/, '')
    const response = await fetchWithTimeout(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Mistral embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage?.total_tokens ?? texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export function createEmbeddingProvider(
  provider: AIProviderType,
  apiKey: string,
  model?: string
): EmbeddingProvider {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIEmbeddingProvider(apiKey, model)
    case 'GOOGLE_GEMINI':
      return new GoogleEmbeddingProvider(apiKey, model)
    case 'MISTRAL':
      return new MistralEmbeddingProvider(apiKey, model)
    case 'MOCK':
      return new MockEmbeddingProvider()
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}

function hashTokenToIndex(token: string, seed = 0, dims = 1536): { idx: number; sign: number } {
  let h = 2166136261 ^ seed

  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  const unsigned = h >>> 0
  return {
    idx: unsigned % dims,
    sign: (unsigned & 1) === 0 ? 1 : -1,
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const dims = 1536

    const embeddings = texts.map(text => {
      const vec = new Array(dims).fill(0)
      const normalized = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1)

      if (normalized.length === 0) {
        vec[0] = 1
        return vec
      }

      for (let i = 0; i < normalized.length; i++) {
        const word = normalized[i]
        const stem = word.length > 4 ? word.slice(0, 4) : word
        const h1 = hashTokenToIndex(word, 1, dims)
        const h2 = hashTokenToIndex(stem, 2, dims)

        vec[h1.idx] += h1.sign * 1.5
        vec[h2.idx] += h2.sign * 0.75

        if (i + 1 < normalized.length) {
          const bigram = `${word}_${normalized[i + 1]}`
          const hb = hashTokenToIndex(bigram, 3, dims)
          vec[hb.idx] += hb.sign
        }
      }

      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1
      return vec.map(val => val / norm)
    })

    return {
      embeddings,
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: 'mock',
    }
  }
}

export async function getUserEmbeddingProvider(
  userId: string,
  provider?: AIProviderType
): Promise<{ provider: EmbeddingProvider; model: string; credential: AICredential | null }> {
  const mockAllowed =
    process.env.NODE_ENV !== 'production' &&
    (provider === 'MOCK' || (process.env.AI_MODE || '').toLowerCase() === 'mock')

  if (mockAllowed) {
    return { provider: new MockEmbeddingProvider(), model: 'mock', credential: null }
  }

  const embeddingConfig = await prisma.aIModelConfig.findFirst({
    where: { userId, taskType: 'embeddings', isDefault: true },
    orderBy: { updatedAt: 'desc' },
  })

  const requestedProvider = provider && provider !== 'MOCK'
    ? provider as PrismaAIProviderType
    : embeddingConfig?.provider

  if (requestedProvider && !EMBEDDING_CAPABLE_PROVIDERS.includes(requestedProvider)) {
    throw new Error(
      `The configured ${requestedProvider} provider does not support embeddings in this application. Configure an embeddings model with OpenAI, Google Gemini, or Mistral in AI Settings.`
    )
  }

  const allowedProviders = requestedProvider
    ? [requestedProvider]
    : EMBEDDING_CAPABLE_PROVIDERS

  const cred = await prisma.aICredential.findFirst({
    where: {
      userId,
      provider: { in: allowedProviders },
      isActive: true,
    },
    orderBy: [
      ...(requestedProvider ? [] : [{ isDefault: 'desc' as const }]),
      { updatedAt: 'desc' },
    ],
  })

  if (cred) {
    let apiKey: string

    try {
      apiKey = await getCredentialKey(cred)
    } catch {
      throw new Error(
        'The saved embeddings API key could not be decrypted. Verify that ENCRYPTION_KEY matches the key used when it was saved, then re-save the credential if necessary.'
      )
    }

    const modelConfig = await prisma.aIModelConfig.findFirst({
      where: { userId, provider: cred.provider, taskType: 'embeddings', isDefault: true },
      orderBy: { updatedAt: 'desc' },
    })

    const defaultModel =
      cred.provider === 'OPENAI'
        ? 'text-embedding-3-small'
        : cred.provider === 'GOOGLE_GEMINI'
          ? 'text-embedding-004'
          : 'mistral-embed'

    return {
      provider: createEmbeddingProvider(cred.provider, apiKey, modelConfig?.modelId),
      model: modelConfig?.modelId || defaultModel,
      credential: cred,
    }
  }

  const envProviders: Array<{ provider: PrismaAIProviderType; key?: string; model: string }> = [
    { provider: 'OPENAI', key: process.env.OPENAI_API_KEY, model: 'text-embedding-3-small' },
    {
      provider: 'GOOGLE_GEMINI',
      key: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      model: 'text-embedding-004',
    },
    { provider: 'MISTRAL', key: process.env.MISTRAL_API_KEY, model: 'mistral-embed' },
  ]

  const envCredential = envProviders.find(item =>
    (!requestedProvider || item.provider === requestedProvider) && item.key?.trim()
  )

  if (envCredential?.key) {
    return {
      provider: createEmbeddingProvider(envCredential.provider, envCredential.key.trim()),
      model: envCredential.model,
      credential: null,
    }
  }

  throw new Error(
    requestedProvider
      ? `No active ${requestedProvider} API credential is configured for embeddings. Add a valid key in AI Settings or choose a supported embeddings provider.`
      : 'No embeddings API key is configured. Add an OpenAI, Google Gemini, or Mistral credential and select an embeddings model in AI Settings.'
  )
}