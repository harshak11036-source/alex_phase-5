import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt, generateKeyHash } from '@/lib/encryption'
import type { SearchResult } from '@/lib/rag/vector-search'

export type AIProviderType = PrismaAIProviderType | 'MOCK'

export type AITaskType = 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' | 'summarization'

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface ProviderMetadata {
  id: PrismaAIProviderType
  name: string
  defaultChatModel: string
  defaultEmbeddingModel?: string
  models: string[]
  embeddingModels: string[]
  capabilities: AITaskType[]
  envKey: string
  baseUrlEnv: string
  defaultBaseUrl: string
  keyPrefixHint?: string
}

export const SUPPORTED_AI_PROVIDERS: Record<PrismaAIProviderType, ProviderMetadata> = {
  OPENAI: {
    id: 'OPENAI',
    name: 'OpenAI',
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o3-mini'],
    embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    capabilities: ['chat', 'embeddings', 'reasoning', 'vision', 'structured', 'summarization'],
    envKey: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPrefixHint: 'sk-',
  },
  GOOGLE_GEMINI: {
    id: 'GOOGLE_GEMINI',
    name: 'Google Gemini',
    defaultChatModel: 'gemini-1.5-flash',
    defaultEmbeddingModel: 'text-embedding-004',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.0-pro'],
    embeddingModels: ['text-embedding-004', 'embedding-001'],
    capabilities: ['chat', 'embeddings', 'reasoning', 'vision', 'structured', 'summarization'],
    envKey: 'GOOGLE_GEMINI_API_KEY',
    baseUrlEnv: 'GOOGLE_GEMINI_BASE_URL',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  ANTHROPIC: {
    id: 'ANTHROPIC',
    name: 'Anthropic',
    defaultChatModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet',
      'claude-3-opus-20240229',
      'claude-3-opus',
      'claude-3-haiku-20240307',
      'claude-3-5-haiku-20241022',
    ],
    embeddingModels: [],
    capabilities: ['chat', 'reasoning', 'vision', 'structured', 'summarization'],
    envKey: 'ANTHROPIC_API_KEY',
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyPrefixHint: 'sk-ant-',
  },
  NVIDIA_NEMOTRON: {
    id: 'NVIDIA_NEMOTRON',
    name: 'NVIDIA Nemotron',
    defaultChatModel: 'nvidia/nemotron-3-ultra',
    models: [
      'nvidia/nemotron-3-ultra',
      'nvidia/nemotron-3-ultra-550b-a55b',
      'nvidia/nemotron-3-large',
      'nvidia/llama-3.1-nemotron-70b-instruct',
    ],
    embeddingModels: [],
    capabilities: ['chat', 'reasoning', 'structured', 'summarization'],
    envKey: 'NVIDIA_NEMOTRON_API_KEY',
    baseUrlEnv: 'NVIDIA_NEMOTRON_BASE_URL',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyPrefixHint: 'nvapi-',
  },
  GROQ: {
    id: 'GROQ',
    name: 'Groq',
    defaultChatModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
    ],
    embeddingModels: [],
    capabilities: ['chat', 'reasoning', 'structured', 'summarization'],
    envKey: 'GROQ_API_KEY',
    baseUrlEnv: 'GROQ_BASE_URL',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyPrefixHint: 'gsk_',
  },
  MISTRAL: {
    id: 'MISTRAL',
    name: 'Mistral AI',
    defaultChatModel: 'mistral-small-latest',
    defaultEmbeddingModel: 'mistral-embed',
    models: [
      'mistral-large-latest',
      'mistral-small-latest',
      'mistral-medium-latest',
      'open-mistral-7b',
      'mistral-large',
      'mistral-medium',
      'codestral-latest',
    ],
    embeddingModels: ['mistral-embed'],
    capabilities: ['chat', 'embeddings', 'reasoning', 'structured', 'summarization'],
    envKey: 'MISTRAL_API_KEY',
    baseUrlEnv: 'MISTRAL_BASE_URL',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
  },
  OPENROUTER: {
    id: 'OPENROUTER',
    name: 'OpenRouter',
    defaultChatModel: 'openrouter/auto',
    models: [
      'openrouter/auto',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-pro',
      'google/gemini-flash-1.5',
      'meta-llama/llama-3.1-70b-instruct',
      'openai/gpt-4o-mini',
    ],
    embeddingModels: [],
    capabilities: ['chat', 'reasoning', 'vision', 'structured', 'summarization'],
    envKey: 'OPENROUTER_API_KEY',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyPrefixHint: 'sk-or-',
  },
  TOGETHER_AI: {
    id: 'TOGETHER_AI',
    name: 'Together AI',
    defaultChatModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    models: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-70B',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'mistralai/Mixtral-8x7B',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ],
    embeddingModels: [],
    capabilities: ['chat', 'reasoning', 'structured', 'summarization'],
    envKey: 'TOGETHER_AI_API_KEY',
    baseUrlEnv: 'TOGETHER_AI_BASE_URL',
    defaultBaseUrl: 'https://api.together.xyz/v1',
  },
  OTHER: {
    id: 'OTHER',
    name: 'Custom OpenAI-Compatible Provider',
    defaultChatModel: 'default',
    models: ['default'],
    embeddingModels: [],
    capabilities: ['chat', 'structured', 'summarization'],
    envKey: 'CUSTOM_AI_API_KEY',
    baseUrlEnv: 'CUSTOM_AI_BASE_URL',
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
}

// ============================================================================
// Structured Error Hierarchy
// ============================================================================

export class AIServiceError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly provider?: string
  public readonly model?: string

  constructor(
    message: string,
    statusCode = 500,
    code = 'AI_SERVICE_ERROR',
    provider?: string,
    model?: string
  ) {
    super(message)
    this.name = 'AIServiceError'
    this.statusCode = statusCode
    this.code = code
    this.provider = provider
    this.model = model
  }
}

export class AIConfigError extends AIServiceError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 422, 'MISSING_API_KEY', provider, model)
    this.name = 'AIConfigError'
  }
}

export class AIAuthError extends AIServiceError {
  constructor(message: string, provider?: string, statusCode = 401, code = 'INVALID_API_KEY') {
    super(message, statusCode, code, provider)
    this.name = 'AIAuthError'
  }
}

export class AIRateLimitError extends AIServiceError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', provider, model)
    this.name = 'AIRateLimitError'
  }
}

export class AIModelNotSupportedError extends AIServiceError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 400, 'UNSUPPORTED_MODEL', provider, model)
    this.name = 'AIModelNotSupportedError'
  }
}

export class AITimeoutError extends AIServiceError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 504, 'AI_TIMEOUT', provider, model)
    this.name = 'AITimeoutError'
  }
}

export class AINetworkError extends AIServiceError {
  constructor(message: string, provider?: string, model?: string, statusCode = 502) {
    super(message, statusCode, 'UPSTREAM_ERROR', provider, model)
    this.name = 'AINetworkError'
  }
}

// ============================================================================
// Validation & Normalization Helpers
// ============================================================================

const PROVIDER_ALIASES: Record<string, PrismaAIProviderType> = {
  openai: 'OPENAI',
  google: 'GOOGLE_GEMINI',
  google_gemini: 'GOOGLE_GEMINI',
  gemini: 'GOOGLE_GEMINI',
  anthropic: 'ANTHROPIC',
  claude: 'ANTHROPIC',
  nvidia: 'NVIDIA_NEMOTRON',
  nvidia_nemotron: 'NVIDIA_NEMOTRON',
  nemotron: 'NVIDIA_NEMOTRON',
  groq: 'GROQ',
  mistral: 'MISTRAL',
  openrouter: 'OPENROUTER',
  together: 'TOGETHER_AI',
  together_ai: 'TOGETHER_AI',
  other: 'OTHER',
}

export function normalizeProvider(input: string): PrismaAIProviderType {
  if (!input || typeof input !== 'string') {
    throw new AIModelNotSupportedError('AI provider is required')
  }
  const trimmed = input.trim()
  const upper = trimmed.toUpperCase() as PrismaAIProviderType
  if (SUPPORTED_AI_PROVIDERS[upper]) {
    return upper
  }
  const alias = PROVIDER_ALIASES[trimmed.toLowerCase()]
  if (alias) {
    return alias
  }
  throw new AIModelNotSupportedError(`Unsupported AI provider: ${input}`, input)
}

export function validateApiKeyFormat(provider: string, apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new AIAuthError('API key is required', provider, 400, 'INVALID_API_KEY_FORMAT')
  }
  const trimmed = apiKey.trim()
  if (trimmed.length < 8) {
    throw new AIAuthError(
      'API key is too short (must be at least 8 characters)',
      provider,
      400,
      'INVALID_API_KEY_FORMAT'
    )
  }
  if (/\s/.test(trimmed)) {
    throw new AIAuthError(
      'API key must not contain spaces or whitespace',
      provider,
      400,
      'INVALID_API_KEY_FORMAT'
    )
  }
  if (/^(\*+|your[-_]?api[-_]?key|placeholder|insert[-_]?key)$/i.test(trimmed)) {
    throw new AIAuthError(
      'Please provide a real API key rather than a placeholder',
      provider,
      400,
      'INVALID_API_KEY_FORMAT'
    )
  }
  return trimmed
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) return '••••••••'
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`
}

export function validateProviderModel(
  provider: PrismaAIProviderType,
  model?: string,
  taskType: AITaskType = 'chat',
  customAllowedModels: string[] = []
): string {
  const meta = SUPPORTED_AI_PROVIDERS[provider]
  if (!meta) {
    throw new AIModelNotSupportedError(`Unsupported AI provider: ${provider}`, provider, model)
  }

  if (!meta.capabilities.includes(taskType)) {
    throw new AIModelNotSupportedError(
      `Provider ${meta.name} (${provider}) does not support task type "${taskType}"`,
      provider,
      model
    )
  }

  const defaultModel =
    taskType === 'embeddings'
      ? meta.defaultEmbeddingModel || meta.defaultChatModel
      : meta.defaultChatModel

  if (!model || !model.trim()) {
    return defaultModel
  }

  const requested = model.trim()

  // Reject cross-provider model mistakes (e.g., passing claude-* to OPENAI or gpt-* to ANTHROPIC)
  if (provider === 'OPENAI' && /^(claude-|gemini-|mistral-|nvidia\/)/i.test(requested)) {
    throw new AIModelNotSupportedError(
      `Model "${requested}" is not supported by OpenAI`,
      provider,
      requested
    )
  }
  if (provider === 'ANTHROPIC' && /^(gpt-|text-embedding-|gemini-|mistral-|nvidia\/|llama-)/i.test(requested)) {
    throw new AIModelNotSupportedError(
      `Model "${requested}" is not supported by Anthropic`,
      provider,
      requested
    )
  }
  if (provider === 'GOOGLE_GEMINI' && /^(gpt-|claude-|mistral-|nvidia\/|llama-)/i.test(requested)) {
    throw new AIModelNotSupportedError(
      `Model "${requested}" is not supported by Google Gemini`,
      provider,
      requested
    )
  }

  const knownModels =
    taskType === 'embeddings'
      ? [...meta.embeddingModels, ...customAllowedModels]
      : [...meta.models, ...customAllowedModels]

  if (knownModels.includes(requested)) {
    return requested
  }

  // Allow provider-prefixed or valid model identifiers for extensible providers
  if (
    (provider === 'OPENROUTER' && requested.includes('/')) ||
    (provider === 'TOGETHER_AI' && requested.includes('/')) ||
    (provider === 'NVIDIA_NEMOTRON' && requested.startsWith('nvidia/')) ||
    (provider === 'OPENAI' && /^(gpt-|o1|o3|ft:|text-embedding-)/.test(requested)) ||
    (provider === 'GOOGLE_GEMINI' && /^(gemini-|text-embedding-|embedding-)/.test(requested)) ||
    (provider === 'ANTHROPIC' && /^claude-/.test(requested)) ||
    (provider === 'MISTRAL' && /^(mistral-|open-mistral|codestral|pixtral)/.test(requested)) ||
    (provider === 'GROQ' && /^(llama|mixtral|gemma|qwen|deepseek)/.test(requested)) ||
    provider === 'OTHER'
  ) {
    return requested
  }

  throw new AIModelNotSupportedError(
    `Model "${requested}" is not supported for provider ${meta.name} (${provider}). Supported models: ${knownModels.join(', ')}`,
    provider,
    requested
  )
}

export function getAIRequestTimeoutMs(): number {
  const parsed = Number(process.env.AI_REQUEST_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000
}

export async function fetchWithAISafeTimeout(
  url: string,
  init: RequestInit,
  provider: string,
  model: string,
  timeoutMs = getAIRequestTimeoutMs()
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[AIService] Request timed out after ${timeoutMs}ms (${provider} / ${model})`)
      throw new AITimeoutError(
        `Request to ${provider} (${model}) timed out after ${timeoutMs}ms`,
        provider,
        model
      )
    }
    console.error(`[AIService] Network failure calling ${provider} (${model})`)
    throw new AINetworkError(
      `Network error communicating with ${provider}. Check server connectivity and provider status.`,
      provider,
      model,
      502
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function classifyProviderHttpError(
  response: Response,
  provider: string,
  model: string
): Promise<never> {
  let detail = response.statusText || `HTTP ${response.status}`
  try {
    const body = await response.json()
    const extracted =
      body?.error?.message ||
      body?.error ||
      body?.message ||
      body?.detail
    if (typeof extracted === 'string' && extracted.trim()) {
      detail = extracted.trim()
    }
  } catch {
    // Ignore JSON parse errors on error body
  }

  if (response.status === 401 || response.status === 403) {
    throw new AIAuthError(
      `${provider} authentication failed (${response.status}): ${detail}`,
      provider,
      response.status === 403 ? 403 : 401,
      'INVALID_API_KEY'
    )
  }

  if (response.status === 429) {
    throw new AIRateLimitError(
      `${provider} rate limit or quota exceeded: ${detail}`,
      provider,
      model
    )
  }

  if (
    response.status === 404 ||
    (response.status === 400 && /model|not found|unsupported|does not exist/i.test(detail))
  ) {
    throw new AIModelNotSupportedError(
      `${provider} rejected model "${model}": ${detail}`,
      provider,
      model
    )
  }

  if (response.status >= 400 && response.status < 500) {
    throw new AIServiceError(
      `${provider} request error (${response.status}): ${detail}`,
      400,
      'AI_BAD_REQUEST',
      provider,
      model
    )
  }

  throw new AINetworkError(
    `${provider} upstream error (${response.status}): ${detail}`,
    provider,
    model,
    502
  )
}

// ============================================================================
// Resolved Provider Configuration & Usage Tracking
// ============================================================================

export interface ResolvedAIConfig {
  provider: PrismaAIProviderType | 'MOCK'
  model: string
  apiKey: string
  baseUrl: string
  credential: AICredential | null
}

function getProviderBaseUrl(provider: PrismaAIProviderType, customBaseUrl?: string): string {
  if (customBaseUrl && customBaseUrl.trim()) {
    return customBaseUrl.trim().replace(/\/+$/, '')
  }
  const meta = SUPPORTED_AI_PROVIDERS[provider]
  const fromEnv = process.env[meta.baseUrlEnv] || process.env.AI_BASE_URL
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '')
  }
  return meta.defaultBaseUrl
}

function isMockFallbackAllowed(explicitProvider?: string): boolean {
  if (explicitProvider === 'MOCK') return true
  const aiMode = (process.env.AI_MODE || '').toLowerCase()
  return aiMode === 'mock' && process.env.NODE_ENV !== 'production' && process.env.AI_STRICT_REAL_ONLY !== 'true'
}

export async function resolveAIConfig(options: {
  userId?: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  taskType?: AITaskType
}): Promise<ResolvedAIConfig> {
  const taskType = options.taskType || 'chat'

  // 1. Explicit raw API key + provider (e.g., connection test before saving)
  if (options.apiKey && options.provider) {
    if (options.provider === 'MOCK') {
      return {
        provider: 'MOCK',
        model: 'mock',
        apiKey: 'mock',
        baseUrl: '',
        credential: null,
      }
    }
    const normalizedProvider = normalizeProvider(options.provider)
    const cleanKey = validateApiKeyFormat(normalizedProvider, options.apiKey)
    const validatedModel = validateProviderModel(normalizedProvider, options.model, taskType)
    return {
      provider: normalizedProvider,
      model: validatedModel,
      apiKey: cleanKey,
      baseUrl: getProviderBaseUrl(normalizedProvider, options.baseUrl),
      credential: null,
    }
  }

  // 2. Explicit saved credentialId for the user
  if (options.credentialId && options.userId) {
    const cred = await prisma.aICredential.findFirst({
      where: { id: options.credentialId, userId: options.userId, isActive: true },
    })
    if (!cred) {
      throw new AIConfigError('The selected AI credential was not found or is inactive.')
    }
    if (cred.usageLimit && cred.usageCount >= cred.usageLimit) {
      throw new AIRateLimitError(
        `Usage limit (${cred.usageLimit} requests) reached for ${cred.providerName || cred.provider}.`,
        cred.provider
      )
    }
    let apiKey: string
    try {
      apiKey = await decrypt(cred.encryptedKey)
    } catch {
      throw new AIConfigError(
        'The saved API key could not be decrypted. Verify that Render ENCRYPTION_KEY exactly matches the key used when this credential was saved; existing credentials must be re-saved only after confirming the original encryption key.'
      )
    }
    const customModels = Array.isArray(cred.models) ? (cred.models as string[]) : []
    let modelToUse = options.model
    if (!modelToUse) {
      const modelCfg = await prisma.aIModelConfig.findFirst({
        where: { userId: options.userId, provider: cred.provider, taskType, isDefault: true },
      })
      modelToUse = modelCfg?.modelId || customModels[0]
    }
    const validatedModel = validateProviderModel(cred.provider, modelToUse, taskType, customModels)
    return {
      provider: cred.provider,
      model: validatedModel,
      apiKey,
      baseUrl: getProviderBaseUrl(cred.provider, options.baseUrl),
      credential: cred,
    }
  }

  const requestedProvider =
    options.provider && options.provider !== 'MOCK'
      ? normalizeProvider(options.provider)
      : undefined

  // 3. Look up user's saved AIModelConfig + AICredential in database
  if (options.userId) {
    let targetProvider = requestedProvider
    let configuredModel = options.model

    if (!targetProvider || !configuredModel) {
      const modelConfig = await prisma.aIModelConfig.findFirst({
        where: {
          userId: options.userId,
          taskType: taskType === "structured" ? "chat" : taskType,
          isDefault: true,
          ...(targetProvider ? { provider: targetProvider } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      })
      if (modelConfig) {
        if (!targetProvider) targetProvider = modelConfig.provider
        if (!configuredModel) configuredModel = modelConfig.modelId
      }
    }

    const capabilityCompatibleProviders = (Object.keys(SUPPORTED_AI_PROVIDERS) as PrismaAIProviderType[]).filter(
      p => SUPPORTED_AI_PROVIDERS[p].capabilities.includes(taskType)
    )

    const cred = await prisma.aICredential.findFirst({
      where: {
        userId: options.userId,
        isActive: true,
        provider: targetProvider
          ? targetProvider
          : { in: capabilityCompatibleProviders },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    if (cred) {
      if (cred.usageLimit && cred.usageCount >= cred.usageLimit) {
        throw new AIRateLimitError(
          `Usage limit (${cred.usageLimit} requests) reached for ${cred.providerName || cred.provider}.`,
          cred.provider
        )
      }
      let apiKey: string
      try {
        apiKey = await decrypt(cred.encryptedKey)
      } catch {
        throw new AIConfigError(
          'The saved API key could not be decrypted. Verify that Render ENCRYPTION_KEY exactly matches the key used when this credential was saved; existing credentials must be re-saved only after confirming the original encryption key.'
        )
      }
      const customModels = Array.isArray(cred.models) ? (cred.models as string[]) : []
      const modelToUse =
        cred.provider === targetProvider
          ? configuredModel || customModels[0]
          : options.model || customModels[0]
      const validatedModel = validateProviderModel(cred.provider, modelToUse, taskType, customModels)
      return {
        provider: cred.provider,
        model: validatedModel,
        apiKey,
        baseUrl: getProviderBaseUrl(cred.provider, options.baseUrl),
        credential: cred,
      }
    }
  }

  // 4. Environment variable credentials
  const providerOrder: PrismaAIProviderType[] = requestedProvider
    ? [requestedProvider]
    : [
        'OPENAI',
        'GOOGLE_GEMINI',
        'ANTHROPIC',
        'NVIDIA_NEMOTRON',
        'GROQ',
        'MISTRAL',
        'OPENROUTER',
        'TOGETHER_AI',
      ]

  for (const prov of providerOrder) {
    const meta = SUPPORTED_AI_PROVIDERS[prov]
    if (!meta.capabilities.includes(taskType)) continue
    const envVal =
      process.env[meta.envKey] ||
      (prov === 'GOOGLE_GEMINI' ? process.env.GEMINI_API_KEY : undefined)
    if (envVal && envVal.trim().length >= 8) {
      const validatedModel = validateProviderModel(prov, options.model, taskType)
      return {
        provider: prov,
        model: validatedModel,
        apiKey: envVal.trim(),
        baseUrl: getProviderBaseUrl(prov, options.baseUrl),
        credential: null,
      }
    }
  }

  // 5. Test-only mock mode if explicitly enabled in non-production test environment
  if (isMockFallbackAllowed(options.provider)) {
    return {
      provider: 'MOCK',
      model: 'mock',
      apiKey: 'mock',
      baseUrl: '',
      credential: null,
    }
  }

  throw new AIConfigError(
    requestedProvider
      ? `No active API key configured for ${SUPPORTED_AI_PROVIDERS[requestedProvider].name}. Please add your API key in AI Settings.`
      : 'No AI provider API key is configured. Please add an API key in AI Settings.'
  )
}

async function recordCredentialUsage(credential: AICredential | null): Promise<void> {
  if (!credential?.id) return
  try {
    await prisma.aICredential.update({
      where: { id: credential.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })
  } catch (err) {
    console.warn('[AIService] Non-fatal error updating credential usage:', err)
  }
}

// ============================================================================
// Core Execution: Chat / Text Generation / Structured Output / Embeddings
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TextGenerationInput {
  userId?: string
  prompt: string
  systemPrompt?: string
  messages?: ChatMessage[]
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  taskType?: AITaskType
  jsonMode?: boolean
  timeoutMs?: number
}

export interface TextGenerationOutput {
  text: string
  provider: string
  model: string
  tokenUsage: TokenUsage
  latencyMs: number
}

export async function generateText(input: TextGenerationInput): Promise<TextGenerationOutput> {
  if (!input.prompt || typeof input.prompt !== 'string' || !input.prompt.trim()) {
    throw new AIServiceError('Prompt is required for text generation', 400, 'EMPTY_PROMPT')
  }

  const start = Date.now()
  const config = await resolveAIConfig({
    userId: input.userId,
    provider: input.provider,
    model: input.model,
    credentialId: input.credentialId,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    taskType: input.taskType || 'chat',
  })

  if (config.provider === 'MOCK') {
    const mockText = buildDeterministicTestResponse(input.prompt, input.systemPrompt, input.jsonMode)
    return {
      text: mockText,
      provider: 'MOCK',
      model: 'mock',
      tokenUsage: { prompt: 12, completion: 24, total: 36 },
      latencyMs: Date.now() - start,
    }
  }

  const temperature = input.temperature ?? 0.3
  const maxTokens = input.maxTokens ?? 2048
  const timeoutMs = input.timeoutMs ?? getAIRequestTimeoutMs()

  let text = ''
  let tokenUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 }

  if (config.provider === 'GOOGLE_GEMINI') {
    const combinedSystem = input.systemPrompt ? `${input.systemPrompt}\n\n` : ''
    const historyText =
      input.messages && input.messages.length > 0
        ? input.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') + '\n\n'
        : ''
    const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`
    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: maxTokens,
    }
    if (input.jsonMode) {
      generationConfig.responseMimeType = 'application/json'
    }

    const res = await fetchWithAISafeTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${combinedSystem}${historyText}${input.prompt}` }],
            },
          ],
          generationConfig,
        }),
      },
      config.provider,
      config.model,
      timeoutMs
    )

    if (!res.ok) {
      await classifyProviderHttpError(res, config.provider, config.model)
    }

    const data = await res.json()
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    tokenUsage = {
      prompt: data.usageMetadata?.promptTokenCount ?? 0,
      completion: data.usageMetadata?.candidatesTokenCount ?? 0,
      total: data.usageMetadata?.totalTokenCount ?? 0,
    }
  } else if (config.provider === 'ANTHROPIC') {
    const url = `${config.baseUrl}/messages`
    const anthropicMessages = [
      ...(input.messages || [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: input.prompt },
    ]

    const res = await fetchWithAISafeTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
          messages: anthropicMessages,
          temperature,
          max_tokens: maxTokens,
        }),
      },
      config.provider,
      config.model,
      timeoutMs
    )

    if (!res.ok) {
      await classifyProviderHttpError(res, config.provider, config.model)
    }

    const data = await res.json()
    text = data.content?.[0]?.text || ''
    const promptTokens = data.usage?.input_tokens ?? 0
    const completionTokens = data.usage?.output_tokens ?? 0
    tokenUsage = {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    }
  } else {
    // OpenAI-compatible protocol: OPENAI, GROQ, MISTRAL, OPENROUTER, TOGETHER_AI, NVIDIA_NEMOTRON, OTHER
    const url = `${config.baseUrl}/chat/completions`
    const extraHeaders: Record<string, string> = {}
    if (config.provider === 'OPENROUTER') {
      extraHeaders['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      extraHeaders['X-Title'] = 'ALEX Academic ERP'
    }

    const messages: ChatMessage[] = []
    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt })
    }
    if (input.messages && input.messages.length > 0) {
      messages.push(...input.messages)
    }
    messages.push({ role: 'user', content: input.prompt })

    const payload: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }
    if (input.jsonMode && ['OPENAI', 'GROQ', 'MISTRAL'].includes(config.provider)) {
      payload.response_format = { type: 'json_object' }
    }

    const res = await fetchWithAISafeTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify(payload),
      },
      config.provider,
      config.model,
      timeoutMs
    )

    if (!res.ok) {
      await classifyProviderHttpError(res, config.provider, config.model)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part: any) => typeof part === 'string' ? part : part?.text || '').join('')
        : ''
    tokenUsage = {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    }
  }

  if (!text || !text.trim()) {
    throw new AINetworkError(
      `Provider ${config.provider} (${config.model}) returned an empty response`,
      config.provider,
      config.model
    )
  }

  await recordCredentialUsage(config.credential)

  return {
    text,
    provider: config.provider,
    model: config.model,
    tokenUsage,
    latencyMs: Date.now() - start,
  }
}

// ============================================================================
// Structured JSON Output Generation
// ============================================================================

export interface StructuredOutputInput<T> {
  userId?: string
  prompt: string
  systemPrompt: string
  schemaDescription: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  validate?: (parsed: any) => T
}

export function extractJsonFromModelOutput(rawText: string): any {
  const trimmed = rawText.trim()
  // Strip ```json ... ``` fences if present
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    // Try locating the outermost JSON object or array
    const objStart = candidate.indexOf('{')
    const objEnd = candidate.lastIndexOf('}')
    const arrStart = candidate.indexOf('[')
    const arrEnd = candidate.lastIndexOf(']')

    if (objStart !== -1 && objEnd > objStart && (arrStart === -1 || objStart < arrStart)) {
      return JSON.parse(candidate.slice(objStart, objEnd + 1))
    }
    if (arrStart !== -1 && arrEnd > arrStart) {
      return JSON.parse(candidate.slice(arrStart, arrEnd + 1))
    }
    throw new Error('Response did not contain valid JSON')
  }
}

export async function generateStructuredOutput<T = any>(
  input: StructuredOutputInput<T>
): Promise<{
  data: T
  rawText: string
  provider: string
  model: string
  tokenUsage: TokenUsage
  latencyMs: number
}> {
  const fullSystemPrompt = `${input.systemPrompt}\n\nYou MUST respond with valid JSON only (no markdown prose outside JSON) matching this schema:\n${input.schemaDescription}`

  const result = await generateText({
    userId: input.userId,
    prompt: input.prompt,
    systemPrompt: fullSystemPrompt,
    provider: input.provider,
    model: input.model,
    credentialId: input.credentialId,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    temperature: input.temperature ?? 0.2,
    maxTokens: input.maxTokens ?? 3000,
    taskType: 'structured',
    jsonMode: true,
  })

  let parsed: any
  try {
    parsed = extractJsonFromModelOutput(result.text)
  } catch (err) {
    throw new AIServiceError(
      `Failed to parse structured JSON output from ${result.provider} (${result.model}): ${err instanceof Error ? err.message : 'Invalid JSON'}`,
      502,
      'INVALID_STRUCTURED_OUTPUT',
      result.provider,
      result.model
    )
  }

  const validated = input.validate ? input.validate(parsed) : (parsed as T)
  return {
    data: validated,
    rawText: result.text,
    provider: result.provider,
    model: result.model,
    tokenUsage: result.tokenUsage,
    latencyMs: result.latencyMs,
  }
}

// ============================================================================
// Document Analysis & Summarization
// ============================================================================

export type DocumentSummaryType =
  | 'concise'
  | 'detailed'
  | 'exam'
  | 'formulas'
  | 'definitions'
  | 'comparison'

export interface DocumentAnalysisInput {
  userId?: string
  documentTitle: string
  chunks: Array<{ content: string; pageNumber?: number | null; sectionTitle?: string | null }>
  analysisType: DocumentSummaryType
  customInstructions?: string
  provider?: string
  model?: string
}

export async function summarizeAndAnalyzeDocument(
  input: DocumentAnalysisInput
): Promise<{
  title: string
  content: string
  type: DocumentSummaryType
  provider: string
  model: string
  tokenUsage: TokenUsage
}> {
  if (!input.chunks || input.chunks.length === 0) {
    throw new AIServiceError('Document has no extracted text chunks to analyze', 422, 'EMPTY_DOCUMENT')
  }

  const formattedChunks = input.chunks
    .slice(0, 40)
    .map(
      (c, idx) =>
        `[Source ${idx + 1}] (${input.documentTitle}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content.trim()}`
    )
    .join('\n\n---\n\n')

  const typeInstructions: Record<DocumentSummaryType, string> = {
    concise:
      'Produce concise, high-signal bullet-point study notes capturing the core thesis, key takeaways, and essential facts. Cite sources as [Source X].',
    detailed:
      'Produce comprehensive, structured study notes with section headings, thorough explanations of every concept, examples, and citations [Source X].',
    exam:
      'Produce high-yield exam revision notes highlighting testable concepts, common pitfalls, key definitions, and likely exam questions with answers. Cite [Source X].',
    formulas:
      'Extract and explain all mathematical formulas, equations, complexity bounds, constants, and variable definitions from the document. Cite [Source X].',
    definitions:
      'Compile a structured glossary of key terms, theorems, and technical definitions from the document with clear explanations and [Source X] citations.',
    comparison:
      'Create a structured Markdown comparison (including a Markdown table) contrasting the methods, concepts, algorithms, or theories discussed in the document. Cite [Source X].',
  }

  const instruction =
    typeInstructions[input.analysisType] || typeInstructions.concise

  const systemPrompt = `You are ALEX, an academic document analysis and summarization assistant.
Analyze the provided document sources and generate ${input.analysisType} study material.
- Ground every claim in the provided sources and cite [Source X]
- Do not fabricate facts not present in the document
${input.customInstructions ? `- Additional instructions: ${input.customInstructions}` : ''}`

  const gen = await generateText({
    userId: input.userId,
    prompt: `Document Title: ${input.documentTitle}\nAnalysis Type: ${input.analysisType}\nTask: ${instruction}\n\nDocument Sources:\n${formattedChunks}`,
    systemPrompt,
    provider: input.provider,
    model: input.model,
    temperature: 0.25,
    maxTokens: 3000,
  })

  return {
    title: `${input.documentTitle} — ${input.analysisType} notes`,
    content: gen.text,
    type: input.analysisType,
    provider: gen.provider,
    model: gen.model,
    tokenUsage: gen.tokenUsage,
  }
}

// ============================================================================
// Connection Test Service
// ============================================================================

export interface TestConnectionInput {
  userId?: string
  provider?: string
  apiKey?: string
  credentialId?: string
  model?: string
  query?: string
  baseUrl?: string
}

export interface TestConnectionOutput {
  success: boolean
  provider: string
  model: string
  response: string
  latencyMs: number
  tokenUsage: TokenUsage
}

export async function testProviderConnection(
  input: TestConnectionInput
): Promise<TestConnectionOutput> {
  const testPrompt =
    input.query && input.query.trim()
      ? input.query.trim()
      : 'Respond with "OK" to confirm the API connection is working.'

  const result = await generateText({
    userId: input.userId,
    provider: input.provider,
    apiKey: input.apiKey,
    credentialId: input.credentialId,
    model: input.model,
    baseUrl: input.baseUrl,
    prompt: testPrompt,
    systemPrompt: 'You are an API connectivity health check assistant. Keep your reply concise.',
    maxTokens: 64,
    temperature: 0,
    timeoutMs: 15000,
  })

  return {
    success: true,
    provider: result.provider,
    model: result.model,
    response: result.text.slice(0, 500),
    latencyMs: result.latencyMs,
    tokenUsage: result.tokenUsage,
  }
}

// ============================================================================
// Credential Persistence Service
// ============================================================================

export async function saveUserAICredential(input: {
  userId: string
  provider: string
  providerName?: string
  apiKey: string
  models?: string[]
  isDefault?: boolean
  usageLimit?: number | null
}) {
  const normalizedProvider = normalizeProvider(input.provider)
  const cleanKey = validateApiKeyFormat(normalizedProvider, input.apiKey)
  const meta = SUPPORTED_AI_PROVIDERS[normalizedProvider]

  const validatedModels: string[] = []
  if (Array.isArray(input.models) && input.models.length > 0) {
    for (const m of input.models) {
      if (m && String(m).trim()) {
        validatedModels.push(validateProviderModel(normalizedProvider, String(m).trim(), 'chat', meta.models))
      }
    }
  } else {
    validatedModels.push(meta.defaultChatModel)
  }

  if (input.isDefault) {
    await prisma.aICredential.updateMany({
      where: { userId: input.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const encryptedKey = await encrypt(cleanKey)
  const keyHash = generateKeyHash(cleanKey)

  const credential = await prisma.aICredential.create({
    data: {
      userId: input.userId,
      provider: normalizedProvider,
      providerName: input.providerName?.trim() || meta.name,
      encryptedKey,
      keyHash,
      models: validatedModels,
      isDefault: Boolean(input.isDefault),
      usageLimit: input.usageLimit ? Number(input.usageLimit) : null,
      isActive: true,
    },
  })

  return {
    id: credential.id,
    provider: credential.provider,
    providerName: credential.providerName,
    maskedKey: maskApiKey(cleanKey),
    isActive: credential.isActive,
    isDefault: credential.isDefault,
    models: credential.models,
    usageLimit: credential.usageLimit,
    usageCount: credential.usageCount,
    lastUsedAt: credential.lastUsedAt,
    createdAt: credential.createdAt,
  }
}

// ============================================================================
// Error-to-HTTP Response Helper for Route Handlers
// ============================================================================

export function formatAIServiceErrorResponse(error: unknown, fallbackMessage = 'AI request failed'): {
  status: number
  body: { error: string; code: string; provider?: string; model?: string; success: false }
} {
  if (error instanceof AIServiceError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        provider: error.provider,
        model: error.model,
        success: false,
      },
    }
  }

  const message = error instanceof Error ? error.message : fallbackMessage
  return {
    status: 500,
    body: {
      error: message || fallbackMessage,
      code: 'INTERNAL_AI_ERROR',
      success: false,
    },
  }
}

// ============================================================================
// Test-Only Deterministic Response Builder (Used ONLY when AI_MODE=mock in non-prod)
// ============================================================================

function buildDeterministicTestResponse(
  prompt: string,
  systemPrompt?: string,
  jsonMode?: boolean
): string {
  if (jsonMode || (systemPrompt && /MUST respond with valid JSON/i.test(systemPrompt))) {
    if (/flashcard/i.test(systemPrompt || '') || /"front"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        cards: [
          {
            front: 'What is the time complexity of Dijkstra algorithm with a min-priority queue?',
            back: 'O((V + E) log V) [Source 1]',
          },
          {
            front: 'What data structure is used to select the next vertex in Dijkstra algorithm?',
            back: 'A min-priority queue (binary heap or Fibonacci heap) [Source 1]',
          },
        ],
      })
    }
    if (/quiz/i.test(systemPrompt || '') || /"options"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        questions: [
          {
            id: 'q-1',
            prompt: 'What is the time complexity of Dijkstra algorithm using a min-priority queue?',
            options: ['O((V + E) log V)', 'O(V^3)', 'O(E)', 'O(log V)'],
            answer: 0,
            explanation: 'Using a binary heap priority queue, extracting the minimum takes O(log V) across V vertices and E edge relaxations [Source 1].',
          },
        ],
      })
    }
    if (/mind\s*map/i.test(systemPrompt || '') || /"nodes"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        nodes: [
          { id: 'node-0', label: 'Shortest Path Algorithms', position: { x: 0, y: 0 } },
          { id: 'node-1', label: 'Dijkstra O((V+E) log V)', position: { x: 260, y: 0 } },
        ],
        edges: [{ id: 'edge-0', source: 'node-0', target: 'node-1' }],
      })
    }
    if (/diagram/i.test(systemPrompt || '') || /"code"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        type: 'mermaid',
        title: 'Algorithm Flowchart',
        code: 'flowchart TD\n  A[Initialize Priority Queue] --> B[Extract Min Vertex]\n  B --> C[Relax Outgoing Edges]',
      })
    }
    return JSON.stringify({
      questionNumber: '1',
      originalQuestion: prompt.slice(0, 120),
      topic: 'Algorithms & Data Structures',
      explanation: 'Based on the provided lecture notes [Source 1], Dijkstra algorithm computes single-source shortest paths using greedy edge relaxation.',
      definitions: ['Shortest Path: Minimum weight path between two vertices [Source 1].'],
      formulas: ['T(V, E) = O((V + E) log V)'],
      calculations: 'Extracting min V times takes O(V log V) and relaxing E edges takes O(E log V).',
      tables: [{ headers: ['Operation', 'Cost'], rows: [['Extract-Min', 'O(log V)'], ['Decrease-Key', 'O(log V)']] }],
      diagrams: [{ type: 'mermaid', definition: 'flowchart LR\n  S[Source] --> U[Vertex U] --> V[Vertex V]', title: 'Edge Relaxation' }],
      finalAnswer: 'The time complexity is O((V + E) log V) [Source 1].',
      citations: [{ id: 'cite-1', documentTitle: 'Document Source', pageNumber: 1, excerpt: 'Dijkstra algorithm finds shortest paths [Source 1].' }],
    })
  }

  const lower = prompt.toLowerCase()
  if (lower.includes('hello') || lower.includes('hi')) {
    return "Hello! I'm your ALEX AI academic assistant. Ask me about your uploaded documents, assignments, or study materials!"
  }
  return `Based on your academic context and documents [Source 1]: ${prompt.slice(0, 240)}`
}
