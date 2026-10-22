const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const Module = require('node:module')

process.env.NODE_PATH = [
  '/usr/share/nodejs',
  '/usr/lib/node_modules',
  process.env.NODE_PATH || '',
]
  .filter(Boolean)
  .join(path.delimiter)
Module._initPaths()

const babel = require('@babel/core')

const webRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(webRoot, 'src')
const repoRoot = path.resolve(webRoot, '../..')

// Capture any real provider keys present in the environment before tests mutate process.env
const initialRealProviderEnv = {
  OPENAI: process.env.OPENAI_API_KEY,
  GOOGLE_GEMINI: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  NVIDIA_NEMOTRON: process.env.NVIDIA_NEMOTRON_API_KEY || process.env.NVIDIA_API_KEY,
  GROQ: process.env.GROQ_API_KEY,
  MISTRAL: process.env.MISTRAL_API_KEY,
  OPENROUTER: process.env.OPENROUTER_API_KEY,
  TOGETHER_AI: process.env.TOGETHER_API_KEY || process.env.TOGETHER_AI_API_KEY,
}

// In-memory store for AI credentials, model configs, documents, and generated artifacts
const store = {
  user: {
    id: 'user_ai_1',
    email: 'researcher@alex.edu',
    firstName: 'Kavya',
    lastName: 'Rao',
    role: 'STUDENT',
    isActive: true,
    memberships: [
      {
        id: 'mem_ai_1',
        userId: 'user_ai_1',
        institutionId: 'inst_1',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    ],
  },
  credentials: [],
  modelConfigs: [],
  documents: [
    {
      id: 'doc_quantum',
      title: 'Quantum Computing & Shor Algorithm',
      fileName: 'quantum_shor.pdf',
      documentType: 'PDF',
      status: 'READY',
      ownerId: 'user_ai_1',
      subjectId: 'subj_qc101',
      projectId: null,
      notebookId: null,
      chunks: [
        {
          id: 'chunk_q1',
          documentId: 'doc_quantum',
          content:
            'Shor algorithm factors an integer N in polynomial time O((log N)^3) using Quantum Fourier Transform (QFT) and modular exponentiation.',
          chunkIndex: 0,
          pageNumber: 2,
          sectionTitle: 'Shor Complexity',
          tokenCount: 28,
        },
        {
          id: 'chunk_q2',
          documentId: 'doc_quantum',
          content:
            'Grover algorithm provides a quadratic speedup O(sqrt(N)) for unstructured database search using amplitude amplification.',
          chunkIndex: 1,
          pageNumber: 5,
          sectionTitle: 'Grover Search',
          tokenCount: 22,
        },
      ],
    },
  ],
  studyMaterials: [],
  flashcardDecks: [],
  quizzes: [],
  mindMaps: [],
  diagrams: [],
  conversations: [],
  messages: [],
}

const mockPrisma = {
  user: {
    findUnique: async ({ where }) => (where.id === store.user.id ? store.user : null),
  },
  aICredential: {
    findMany: async ({ where }) =>
      store.credentials.filter(
        c =>
          (!where?.userId || c.userId === where.userId) &&
          (where?.isActive === undefined || c.isActive === where.isActive)
      ),
    findFirst: async ({ where }) => {
      const candidates = store.credentials.filter(c => {
        if (where?.id && c.id !== where.id) return false
        if (where?.userId && c.userId !== where.userId) return false
        if (where?.isActive !== undefined && c.isActive !== where.isActive) return false
        if (where?.provider) {
          if (typeof where.provider === 'string' && c.provider !== where.provider) return false
          if (where.provider.in && !where.provider.in.includes(c.provider)) return false
        }
        if (where?.providerName?.in && !where.providerName.in.includes(c.providerName)) return false
        return true
      })
      candidates.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      return candidates[0] || null
    },
    findUnique: async ({ where }) => store.credentials.find(c => c.id === where.id) || null,
    create: async ({ data }) => {
      const cred = {
        id: `cred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.credentials.push(cred)
      return cred
    },
    update: async ({ where, data }) => {
      const cred = store.credentials.find(c => c.id === where.id)
      if (!cred) throw new Error('Credential not found')
      if (data.usageCount?.increment) {
        cred.usageCount += data.usageCount.increment
      }
      for (const [k, v] of Object.entries(data)) {
        if (k !== 'usageCount') cred[k] = v
      }
      cred.updatedAt = new Date()
      return cred
    },
    updateMany: async ({ where, data }) => {
      let count = 0
      for (const c of store.credentials) {
        if ((!where?.userId || c.userId === where.userId) && (!where?.isDefault || c.isDefault === where.isDefault)) {
          Object.assign(c, data)
          count++
        }
      }
      return { count }
    },
    delete: async ({ where }) => {
      store.credentials = store.credentials.filter(c => c.id !== where.id)
      return {}
    },
  },
  aIModelConfig: {
    findMany: async ({ where }) => store.modelConfigs.filter(m => !where?.userId || m.userId === where.userId),
    findFirst: async ({ where }) =>
      store.modelConfigs.find(
        m =>
          (!where?.userId || m.userId === where.userId) &&
          (!where?.taskType || m.taskType === where.taskType) &&
          (where?.isDefault === undefined || m.isDefault === where.isDefault) &&
          (!where?.provider || m.provider === where.provider)
      ) || null,
    updateMany: async ({ where, data }) => {
      for (const m of store.modelConfigs) {
        if (m.userId === where.userId && m.taskType === where.taskType) {
          Object.assign(m, data)
        }
      }
      return { count: 1 }
    },
    upsert: async ({ where, create, update }) => {
      const key = where.userId_provider_modelId_taskType
      let existing = store.modelConfigs.find(
        m =>
          m.userId === key.userId &&
          m.provider === key.provider &&
          m.modelId === key.modelId &&
          m.taskType === key.taskType
      )
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() })
        return existing
      }
      existing = {
        id: `mcfg_${Date.now()}`,
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      store.modelConfigs.push(existing)
      return existing
    },
  },
  document: {
    findFirst: async ({ where }) => store.documents.find(d => !where?.id || d.id === where.id) || null,
    findMany: async () => store.documents,
  },
  documentChunk: {
    findMany: async () =>
      store.documents[0].chunks.map(c => ({
        ...c,
        embedding: null,
        metadata: {},
        document: {
          id: store.documents[0].id,
          title: store.documents[0].title,
          fileName: store.documents[0].fileName,
          documentType: store.documents[0].documentType,
          ownerId: store.documents[0].ownerId,
        },
      })),
  },
  studyMaterial: {
    create: async ({ data }) => {
      const mat = { id: `mat_${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() }
      store.studyMaterials.push(mat)
      return mat
    },
  },
  flashcardDeck: {
    create: async ({ data }) => {
      const cards = (data.cards?.create || []).map((c, idx) => ({
        id: `fc_${idx}`,
        ...c,
      }))
      const deck = {
        id: `deck_${Date.now()}`,
        userId: data.userId,
        title: data.title,
        sourceDocId: data.sourceDocId,
        subjectId: data.subjectId,
        cards,
        _count: { cards: cards.length },
      }
      store.flashcardDecks.push(deck)
      return deck
    },
  },
  quiz: {
    create: async ({ data }) => {
      const q = { id: `quiz_${Date.now()}`, ...data, createdAt: new Date() }
      store.quizzes.push(q)
      return q
    },
  },
  mindMap: {
    create: async ({ data }) => {
      const m = { id: `mm_${Date.now()}`, ...data, createdAt: new Date() }
      store.mindMaps.push(m)
      return m
    },
  },
  diagram: {
    create: async ({ data }) => {
      const d = { id: `diag_${Date.now()}`, ...data, createdAt: new Date() }
      store.diagrams.push(d)
      return d
    },
  },
  conversation: {
    findUnique: async () => null,
    create: async ({ data }) => {
      const conv = { id: `conv_${Date.now()}`, ...data }
      store.conversations.push(conv)
      return conv
    },
  },
  message: {
    createMany: async () => ({ count: 2 }),
  },
  userMemory: {
    findMany: async () => [],
  },
  subjectEnrollment: {
    findMany: async () => [],
  },
  assignment: {
    findMany: async () => [],
  },
  attendanceRecord: {
    findMany: async () => [],
  },
  plannerEvent: {
    findMany: async () => [],
  },
}

let activeSessionToken = ''

const mockModules = {
  '@prisma/client': {
    PrismaClient: function PrismaClient() {
      return mockPrisma
    },
    UserRole: {
      STUDENT: 'STUDENT',
      LECTURER: 'LECTURER',
      PROJECT_MENTOR: 'PROJECT_MENTOR',
      ADMIN: 'ADMIN',
    },
    MembershipStatus: {
      PENDING: 'PENDING',
      ACTIVE: 'ACTIVE',
      SUSPENDED: 'SUSPENDED',
      REVOKED: 'REVOKED',
    },
    AIProviderType: {
      NVIDIA_NEMOTRON: 'NVIDIA_NEMOTRON',
      OPENAI: 'OPENAI',
      GOOGLE_GEMINI: 'GOOGLE_GEMINI',
      ANTHROPIC: 'ANTHROPIC',
      MISTRAL: 'MISTRAL',
      GROQ: 'GROQ',
      OPENROUTER: 'OPENROUTER',
      TOGETHER_AI: 'TOGETHER_AI',
      OTHER: 'OTHER',
    },
  },
  'next/server': {
    NextResponse: {
      json: (body, init = {}) => {
        const serialized = JSON.parse(JSON.stringify(body))
        return {
          status: init.status || 200,
          headers: new Map(Object.entries(init.headers || {})),
          body: serialized,
          async json() {
            return serialized
          },
        }
      },
    },
  },
  'next/headers': {
    cookies: async () => ({
      get: (name) => (name === 'alex_local_session' && activeSessionToken ? { value: activeSessionToken } : undefined),
    }),
    headers: async () => new Map(),
  },
  openai: class MockOpenAI {
    constructor(opts) {
      this.opts = opts
    }
  },
}

const origResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (mockModules[request]) return request
  if (request.startsWith('@/')) {
    const candidateBase = path.join(srcRoot, request.slice(2))
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (fs.existsSync(candidateBase + ext) && fs.statSync(candidateBase + ext).isFile()) {
        return candidateBase + ext
      }
    }
  }
  if (request === '@alex/shared-types') {
    return path.join(repoRoot, 'packages/shared-types/src/index.ts')
  }
  if (parent && parent.filename && (request.startsWith('./') || request.startsWith('../'))) {
    const candidateBase = path.resolve(path.dirname(parent.filename), request)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (fs.existsSync(candidateBase + ext) && fs.statSync(candidateBase + ext).isFile()) {
        return candidateBase + ext
      }
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options)
}

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (mockModules[request]) return mockModules[request]
  return origLoad.call(this, request, parent, isMain)
}

function compileTsExtension(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const transformed = babel.transformSync(source, {
    filename,
    presets: [
      ['/usr/share/nodejs/@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
      ['/usr/share/nodejs/@babel/preset-typescript', { isTSX: filename.endsWith('.tsx'), allExtensions: true }],
    ],
  })
  module._compile(transformed.code, filename)
}

require.extensions['.ts'] = compileTsExtension
require.extensions['.tsx'] = compileTsExtension

process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long-99999'
const localAuth = require(path.join(srcRoot, 'lib/local-auth.ts'))
activeSessionToken = localAuth.createLocalSession('user_ai_1')

// ============================================================================
// 1. Key Validation, Provider/Model Normalization & Security Tests
// ============================================================================

test('AIService: validates API keys, normalizes providers, rejects unsupported models, and never exposes keys', async () => {
  const aiService = require(path.join(srcRoot, 'lib/ai/service.ts'))
  const credsRoute = require(path.join(srcRoot, 'app/api/ai/credentials/route.ts'))
  const modelsRoute = require(path.join(srcRoot, 'app/api/ai/models/route.ts'))
  const voiceConfigRoute = require(path.join(srcRoot, 'app/api/ai/voice-config/route.ts'))

  // Provider normalization & aliases
  assert.equal(aiService.normalizeProvider('openai'), 'OPENAI')
  assert.equal(aiService.normalizeProvider('google_gemini'), 'GOOGLE_GEMINI')
  assert.equal(aiService.normalizeProvider('claude'), 'ANTHROPIC')
  assert.equal(aiService.normalizeProvider('nemotron'), 'NVIDIA_NEMOTRON')
  assert.throws(() => aiService.normalizeProvider('unknown_provider'), /Unsupported AI provider/)

  // API key validation rejects short, whitespace, or placeholder keys
  assert.throws(() => aiService.validateApiKeyFormat('OPENAI', 'short'), /too short/)
  assert.throws(() => aiService.validateApiKeyFormat('OPENAI', 'sk-has spaces-12345'), /whitespace/)
  assert.throws(() => aiService.validateApiKeyFormat('OPENAI', 'your-api-key'), /placeholder/)
  assert.throws(() => aiService.validateApiKeyFormat('OPENAI', '********'), /placeholder/)
  assert.equal(aiService.validateApiKeyFormat('OPENAI', '  sk-proj-validKey1234567890  '), 'sk-proj-validKey1234567890')

  // Cross-provider & unsupported model validation
  assert.throws(() => aiService.validateProviderModel('OPENAI', 'claude-3-5-sonnet', 'chat'), /not supported by OpenAI/)
  assert.throws(() => aiService.validateProviderModel('ANTHROPIC', 'gpt-4o', 'chat'), /not supported by Anthropic/)
  assert.throws(() => aiService.validateProviderModel('ANTHROPIC', 'claude-3-5-sonnet', 'embeddings'), /does not support task type "embeddings"/)

  // POST /api/ai/credentials rejects invalid key with HTTP 400
  const badCredRes = await credsRoute.POST({
    json: async () => ({ provider: 'OPENAI', apiKey: 'bad' }),
  })
  assert.equal(badCredRes.status, 400)
  assert.equal(badCredRes.body.code, 'INVALID_API_KEY_FORMAT')

  // POST /api/ai/models rejects mismatched provider+model with HTTP 400
  const badModelRes = await modelsRoute.POST({
    json: async () => ({ provider: 'OPENAI', modelId: 'claude-3-opus', taskType: 'chat' }),
  })
  assert.equal(badModelRes.status, 400)
  assert.equal(badModelRes.body.code, 'UNSUPPORTED_MODEL')

  // Save valid credential and verify GET /api/ai/credentials never returns encryptedKey or plaintext key
  const goodCredRes = await credsRoute.POST({
    json: async () => ({
      provider: 'OPENAI',
      providerName: 'Primary OpenAI',
      apiKey: 'sk-proj-liveSecretKey987654321',
      models: ['gpt-4o-mini', 'gpt-4o'],
      isDefault: true,
    }),
  })
  assert.equal(goodCredRes.status, 200)
  assert.equal(goodCredRes.body.provider, 'OPENAI')
  assert.equal(goodCredRes.body.encryptedKey, undefined)
  assert.equal(goodCredRes.body.apiKey, undefined)

  const listRes = await credsRoute.GET()
  assert.equal(listRes.status, 200)
  assert.equal(listRes.body.length, 1)
  assert.equal(listRes.body[0].encryptedKey, undefined)
  assert.equal(listRes.body[0].apiKey, undefined)

  // Verify /api/ai/voice-config never leaks sttApiKey or ttsApiKey to browser
  await mockPrisma.aICredential.create({
    data: {
      userId: 'user_ai_1',
      provider: 'OTHER',
      providerName: 'elevenlabs',
      encryptedKey: 'encrypted_dummy',
      keyHash: 'hash',
      isActive: true,
    },
  })
  const voiceRes = await voiceConfigRoute.GET()
  assert.equal(voiceRes.status, 200)
  assert.equal(voiceRes.body.sttApiKey, undefined)
  assert.equal(voiceRes.body.ttsApiKey, undefined)
  assert.equal(voiceRes.body.hasTtsCredential, true)
})

// ============================================================================
// 2. Missing Key, Invalid Key (401), Rate Limit (429), Usage Quota & Timeout (504) Tests
// ============================================================================

test('AIService: never fakes success when key is missing and classifies 401, 429, 400, 502, and 504 errors', async () => {
  const aiService = require(path.join(srcRoot, 'lib/ai/service.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))

  // Clear credentials & disable mock mode to verify missing key returns 422 MISSING_API_KEY (never faked)
  store.credentials = []
  store.modelConfigs = []
  process.env.AI_MODE = 'live'
  delete process.env.OPENAI_API_KEY
  delete process.env.GOOGLE_GEMINI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.NVIDIA_NEMOTRON_API_KEY
  delete process.env.GROQ_API_KEY
  delete process.env.MISTRAL_API_KEY

  const missingKeyRes = await ragQueryRoute.POST({
    json: async () => ({ query: 'Explain Shor algorithm' }),
  })
  assert.equal(missingKeyRes.status, 422)
  assert.equal(missingKeyRes.body.code, 'MISSING_API_KEY')
  assert.equal(missingKeyRes.body.success, false)

  // Start local wire-protocol HTTP server to test 401, 429, 503, and timeout
  let nextStatus = 200
  let nextBody = {}
  let delayMs = 0

  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      setTimeout(() => {
        res.writeHead(nextStatus, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(nextBody))
      }, delayMs)
    })
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}/v1`

  try {
    // 401 Invalid API Key
    nextStatus = 401
    nextBody = { error: { message: 'Incorrect API key provided' } }
    await assert.rejects(
      () =>
        aiService.generateText({
          provider: 'OPENAI',
          apiKey: 'sk-invalidKey1234567890',
          baseUrl,
          prompt: 'Test 401',
        }),
      (err) => err.statusCode === 401 && err.code === 'INVALID_API_KEY'
    )

    // 429 Rate Limit Exceeded
    nextStatus = 429
    nextBody = { error: { message: 'Rate limit reached for gpt-4o-mini' } }
    await assert.rejects(
      () =>
        aiService.generateText({
          provider: 'OPENAI',
          apiKey: 'sk-validKey1234567890',
          baseUrl,
          prompt: 'Test 429',
        }),
      (err) => err.statusCode === 429 && err.code === 'RATE_LIMIT_EXCEEDED'
    )

    // 503 Upstream Error
    nextStatus = 503
    nextBody = { error: { message: 'Service temporarily overloaded' } }
    await assert.rejects(
      () =>
        aiService.generateText({
          provider: 'OPENAI',
          apiKey: 'sk-validKey1234567890',
          baseUrl,
          prompt: 'Test 503',
        }),
      (err) => err.statusCode === 502 && err.code === 'UPSTREAM_ERROR'
    )

    // 504 Timeout
    nextStatus = 200
    delayMs = 200
    await assert.rejects(
      () =>
        aiService.generateText({
          provider: 'OPENAI',
          apiKey: 'sk-validKey1234567890',
          baseUrl,
          prompt: 'Test timeout',
          timeoutMs: 40,
        }),
      (err) => err.statusCode === 504 && err.code === 'AI_TIMEOUT'
    )
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

// ============================================================================
// 3. End-to-End Real Wire-Protocol Tests Across All AI Features & Providers
// ============================================================================

test('AIService E2E: connection test, text generation, document summarization, RAG Q&A, and structured outputs over live HTTP protocol', async () => {
  const credsRoute = require(path.join(srcRoot, 'app/api/ai/credentials/route.ts'))
  const modelsRoute = require(path.join(srcRoot, 'app/api/ai/models/route.ts'))
  const testConnRoute = require(path.join(srcRoot, 'app/api/ai/test-connection/route.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))
  const docGenRoute = require(path.join(srcRoot, 'app/api/documents/generate/route.ts'))
  const solGenRoute = require(path.join(srcRoot, 'app/api/solutions/generate/route.ts'))
  const studyMatGenRoute = require(path.join(srcRoot, 'app/api/study-materials/generate/route.ts'))
  const flashcardsGenRoute = require(path.join(srcRoot, 'app/api/flashcards/generate/route.ts'))
  const quizzesGenRoute = require(path.join(srcRoot, 'app/api/quizzes/generate/route.ts'))
  const mindmapsGenRoute = require(path.join(srcRoot, 'app/api/mindmaps/generate/route.ts'))
  const diagramsGenRoute = require(path.join(srcRoot, 'app/api/diagrams/generate/route.ts'))

  const capturedRequests = []

  // Spin up a local multi-provider wire-protocol server supporting OpenAI, Anthropic, and Google Gemini
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}
      capturedRequests.push({
        url: req.url,
        headers: req.headers,
        body,
      })

      // 1. Anthropic /v1/messages endpoint
      if (req.url.startsWith('/anthropic/messages')) {
        if (req.headers['x-api-key'] !== 'sk-ant-liveValidKey12345') {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Invalid x-api-key' } }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            content: [{ type: 'text', text: 'Anthropic Claude connection verified: OK' }],
            usage: { input_tokens: 14, output_tokens: 8 },
          })
        )
        return
      }

      // 2. Google Gemini :generateContent endpoint
      if (req.url.includes(':generateContent')) {
        if (!req.url.includes('key=AIzaSyValidGeminiKey12345')) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'API key not valid' } }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Gemini 1.5 Flash connection verified: OK' }],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 7, totalTokenCount: 17 },
          })
        )
        return
      }

      // 3. OpenAI /embeddings endpoint
      if (req.url.endsWith('/embeddings')) {
        if (req.headers.authorization !== 'Bearer sk-proj-liveOpenAIKey12345') {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Invalid Bearer token' } }))
          return
        }
        const inputs = Array.isArray(body.input) ? body.input : [String(body.input || '')]
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            data: inputs.map((_, index) => ({
              index,
              embedding: new Array(1536).fill(0.025),
            })),
            usage: { prompt_tokens: 12, total_tokens: 12 },
          })
        )
        return
      }

      // 4. OpenAI / Groq / Mistral / Nemotron /chat/completions endpoint
      if (req.headers.authorization !== 'Bearer sk-proj-liveOpenAIKey12345') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'Invalid Bearer token' } }))
        return
      }

      const messages = body.messages || []
      const sys = messages.find(m => m.role === 'system')?.content || ''
      const userPrompt = messages.find(m => m.role === 'user')?.content || ''

      let replyContent = 'OK — OpenAI gpt-4o live response'

      if (/flashcard/i.test(sys)) {
        replyContent = JSON.stringify({
          cards: [
            {
              front: 'What is the time complexity of Shor algorithm for factoring N?',
              back: 'O((log N)^3) using Quantum Fourier Transform [Source 1].',
            },
            {
              front: 'What speedup does Grover algorithm provide for unstructured search?',
              back: 'Quadratic speedup O(sqrt(N)) using amplitude amplification [Source 2].',
            },
          ],
        })
      } else if (/assessment generator|quiz/i.test(sys)) {
        replyContent = JSON.stringify({
          questions: [
            {
              id: 'q-1',
              prompt: 'Which quantum subroutine is central to Shor factoring algorithm?',
              options: [
                'Quantum Fourier Transform (QFT)',
                'Classical bubble sort',
                'Simplex linear programming',
                'Gradient descent',
              ],
              answer: 0,
              explanation: 'Shor algorithm relies on Quantum Fourier Transform and modular exponentiation [Source 1].',
            },
          ],
        })
      } else if (/mind-map/i.test(sys)) {
        replyContent = JSON.stringify({
          nodes: [
            { id: 'n-0', label: 'Quantum Algorithms', position: { x: 0, y: 0 } },
            { id: 'n-1', label: 'Shor Algorithm O((log N)^3)', position: { x: 260, y: 0 } },
            { id: 'n-2', label: 'Grover Search O(sqrt(N))', position: { x: 260, y: 140 } },
          ],
          edges: [
            { id: 'e-0', source: 'n-0', target: 'n-1' },
            { id: 'e-1', source: 'n-0', target: 'n-2' },
          ],
        })
      } else if (/diagram generator/i.test(sys)) {
        replyContent = JSON.stringify({
          type: 'mermaid',
          title: 'Shor Algorithm Pipeline',
          code: 'flowchart LR\n  A[Modular Exponentiation] --> B[Quantum Fourier Transform]\n  B --> C[Continued Fraction Expansion]',
        })
      } else if (/solution generator/i.test(sys)) {
        replyContent = JSON.stringify({
          questionNumber: '1',
          originalQuestion: 'Compare Shor and Grover algorithms',
          topic: 'Quantum Complexity',
          explanation: 'Shor algorithm achieves exponential speedup for integer factorization [Source 1], whereas Grover algorithm achieves quadratic speedup for unstructured search [Source 2].',
          definitions: ['Quantum Fourier Transform (QFT): Quantum analogue of discrete Fourier transform [Source 1].'],
          formulas: ['T_Shor(N) = O((log N)^3)', 'T_Grover(N) = O(sqrt(N))'],
          calculations: 'For a 2048-bit integer, (log N)^3 is ~8.59e9 operations.',
          tables: [{ headers: ['Algorithm', 'Complexity'], rows: [['Shor', 'O((log N)^3)'], ['Grover', 'O(sqrt(N))']] }],
          diagrams: [{ type: 'mermaid', definition: 'flowchart TD\n  Q[Quantum State] --> QFT[QFT]', title: 'QFT Step' }],
          finalAnswer: 'Shor algorithm runs in O((log N)^3) [Source 1] and Grover search runs in O(sqrt(N)) [Source 2].',
          citations: [{ id: 'chunk_q1', documentTitle: 'Quantum Computing & Shor Algorithm', pageNumber: 2, excerpt: 'Shor algorithm factors an integer N in polynomial time O((log N)^3)' }],
        })
      } else if (/summarization assistant/i.test(sys)) {
        replyContent =
          '### Key Quantum Formulas\n- **Shor Factoring Complexity**: $O((\\log N)^3)$ via Quantum Fourier Transform [Source 1]\n- **Grover Search Complexity**: $O(\\sqrt{N})$ via amplitude amplification [Source 2]'
      } else if (/document generator/i.test(sys)) {
        replyContent =
          '# Quantum Computing Study Guide\n\n## Shor Algorithm\nFactors integers in $O((\\log N)^3)$ time [Source 1].\n\n| Algorithm | Speedup |\n| --- | --- |\n| Shor | Exponential |\n| Grover | Quadratic |'
      } else if (userPrompt.includes('Shor')) {
        replyContent =
          'Shor algorithm factors an integer N in polynomial time O((log N)^3) using the Quantum Fourier Transform [Source 1], while Grover algorithm searches unsorted databases in O(sqrt(N)) [Source 2].'
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: replyContent } }],
          usage: { prompt_tokens: 45, completion_tokens: 60, total_tokens: 105 },
        })
      )
    })
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  process.env.AI_MODE = 'live'
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/openai`
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}/anthropic`
  process.env.GOOGLE_GEMINI_BASE_URL = `http://127.0.0.1:${port}/gemini`

  try {
    store.credentials = []
    store.modelConfigs = []

    // 1. Save user's OpenAI credential & configure model preference for 'chat' and 'structured'
    const saveCredRes = await credsRoute.POST({
      json: async () => ({
        provider: 'OPENAI',
        providerName: 'Research OpenAI Key',
        apiKey: 'sk-proj-liveOpenAIKey12345',
        models: ['gpt-4o', 'gpt-4o-mini'],
        isDefault: true,
        usageLimit: 100,
      }),
    })
    assert.equal(saveCredRes.status, 200)
    const savedCredId = saveCredRes.body.id

    const saveModelRes = await modelsRoute.POST({
      json: async () => ({
        provider: 'OPENAI',
        modelId: 'gpt-4o',
        taskType: 'chat',
        isDefault: true,
      }),
    })
    assert.equal(saveModelRes.status, 200)
    assert.equal(saveModelRes.body.modelId, 'gpt-4o')

    // 2. Test Connection using saved credentialId (no plaintext key sent from client)
    const connSavedRes = await testConnRoute.POST({
      json: async () => ({
        credentialId: savedCredId,
        query: 'Ping from AI Settings',
      }),
    })
    assert.equal(connSavedRes.status, 200)
    assert.equal(connSavedRes.body.success, true)
    assert.equal(connSavedRes.body.provider, 'OPENAI')
    assert.equal(connSavedRes.body.model, 'gpt-4o')
    assert.ok(connSavedRes.body.response.includes('OK'))

    // 3. Test Connection for Anthropic & Google Gemini with raw keys
    const connAnthropicRes = await testConnRoute.POST({
      json: async () => ({
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-liveValidKey12345',
        model: 'claude-3-5-sonnet-20241022',
      }),
    })
    assert.equal(connAnthropicRes.status, 200)
    assert.equal(connAnthropicRes.body.provider, 'ANTHROPIC')
    assert.ok(connAnthropicRes.body.response.includes('Anthropic Claude connection verified'))

    const connGeminiRes = await testConnRoute.POST({
      json: async () => ({
        provider: 'GOOGLE_GEMINI',
        apiKey: 'AIzaSyValidGeminiKey12345',
        model: 'gemini-1.5-flash',
      }),
    })
    assert.equal(connGeminiRes.status, 200)
    assert.equal(connGeminiRes.body.provider, 'GOOGLE_GEMINI')
    assert.ok(connGeminiRes.body.response.includes('Gemini 1.5 Flash connection verified'))

    // 4. RAG Question Answering (POST /api/rag/query) uses configured OPENAI gpt-4o & extracts citations
    const ragRes = await ragQueryRoute.POST({
      json: async () => ({
        query: 'How fast is Shor algorithm compared to Grover search?',
      }),
    })
    assert.equal(ragRes.status, 200)
    assert.equal(ragRes.body.provider, 'OPENAI')
    assert.equal(ragRes.body.model, 'gpt-4o')
    assert.ok(ragRes.body.answer.includes('O((log N)^3)'))
    assert.equal(ragRes.body.citations.length, 2)
    assert.ok([2, 5].includes(ragRes.body.citations[0].pageNumber))

    // 5. Document Analysis & Summarization (POST /api/study-materials/generate)
    const studyRes = await studyMatGenRoute.POST({
      json: async () => ({
        sourceDocId: 'doc_quantum',
        type: 'formulas',
      }),
    })
    assert.equal(studyRes.status, 200)
    assert.equal(studyRes.body.provider, 'OPENAI')
    assert.equal(studyRes.body.model, 'gpt-4o')
    assert.ok(studyRes.body.material.content.includes('Shor Factoring Complexity'))

    // 6. Text Generation in Document Studio (POST /api/documents/generate)
    const docGenRes = await docGenRoute.POST({
      json: async () => ({
        sourceType: 'prompt',
        prompt: 'Write a study guide on Shor and Grover quantum algorithms',
        title: 'Quantum Study Guide',
        outputFormat: 'markdown',
        includeTables: true,
      }),
    })
    assert.equal(docGenRes.status, 200)
    assert.equal(docGenRes.body.provider, 'OPENAI')
    assert.equal(docGenRes.body.model, 'gpt-4o')
    assert.ok(docGenRes.body.sections.some(s => s.type === 'table'))

    // 7. Structured Output: Solution Generator (POST /api/solutions/generate)
    const solRes = await solGenRoute.POST({
      json: async () => ({
        question: 'Compare Shor and Grover algorithms',
        sourceDocumentIds: ['doc_quantum'],
        answerMode: 'detailed',
      }),
    })
    assert.equal(solRes.status, 200)
    assert.equal(solRes.body.provider, 'OPENAI')
    assert.equal(solRes.body.model, 'gpt-4o')
    assert.equal(solRes.body.topic, 'Quantum Complexity')
    assert.equal(solRes.body.formulas.length, 2)

    // 8. Structured Output: Flashcards (POST /api/flashcards/generate)
    const fcRes = await flashcardsGenRoute.POST({
      json: async () => ({
        sourceDocId: 'doc_quantum',
        count: 5,
      }),
    })
    assert.equal(fcRes.status, 200)
    assert.equal(fcRes.body.provider, 'OPENAI')
    assert.equal(fcRes.body.deck.cards.length, 2)
    assert.ok(fcRes.body.deck.cards[0].front.includes('Shor'))

    // 9. Structured Output: Quizzes (POST /api/quizzes/generate)
    const quizRes = await quizzesGenRoute.POST({
      json: async () => ({
        sourceDocId: 'doc_quantum',
        count: 5,
      }),
    })
    assert.equal(quizRes.status, 200)
    assert.equal(quizRes.body.provider, 'OPENAI')
    assert.equal(quizRes.body.quiz.questions[0].options[0], 'Quantum Fourier Transform (QFT)')

    // 10. Structured Output: Mind Maps & Diagrams (POST /api/mindmaps/generate & /api/diagrams/generate)
    const mmRes = await mindmapsGenRoute.POST({
      json: async () => ({
        sourceDocId: 'doc_quantum',
      }),
    })
    assert.equal(mmRes.status, 200)
    assert.equal(mmRes.body.provider, 'OPENAI')
    assert.equal(mmRes.body.mindMap.nodes.length, 3)

    const diagRes = await diagramsGenRoute.POST({
      json: async () => ({
        sourceDocId: 'doc_quantum',
        customType: 'mermaid',
        customCode: 'flowchart TD\n  A[Source document] --> B[Key concepts]',
      }),
    })
    assert.equal(diagRes.status, 200)
    assert.equal(diagRes.body.provider, 'OPENAI')
    assert.ok(diagRes.body.definition.code.includes('Quantum Fourier Transform'))

    // Verify usageCount and lastUsedAt were updated on the saved credential after all those AI calls!
    const updatedCred = store.credentials.find(c => c.id === savedCredId)
    assert.ok(updatedCred.usageCount >= 8, `Expected usageCount >= 8, got ${updatedCred.usageCount}`)
    assert.ok(updatedCred.lastUsedAt instanceof Date)
  } finally {
    delete process.env.OPENAI_BASE_URL
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.GOOGLE_GEMINI_BASE_URL
    await new Promise(resolve => server.close(resolve))
  }
})

// ============================================================================
// 4. Conditional Live External Provider Connection & E2E Test (when env credentials exist)
// ============================================================================

test('AIService Live External Provider E2E: executes real upstream connection test and structured generation when environment credentials are provided', async () => {
  const aiService = require(path.join(srcRoot, 'lib/ai/service.ts'))

  const configuredEntry = Object.entries(initialRealProviderEnv).find(
    ([, key]) => typeof key === 'string' && key.trim().length >= 8
  )

  if (!configuredEntry) {
    // Verify that resolveAIConfig cleanly identifies when no external environment key is present
    store.credentials = []
    process.env.AI_MODE = 'live'
    await assert.rejects(
      () => aiService.resolveAIConfig({ userId: 'user_no_creds', allowMockFallback: false }),
      (err) => err.code === 'MISSING_API_KEY' && err.statusCode === 422
    )
    return
  }

  const [provider, apiKey] = configuredEntry
  const connResult = await aiService.testProviderConnection({
    provider,
    apiKey,
    query: 'Reply with OK.',
  })
  assert.equal(connResult.success, true)
  assert.equal(connResult.provider, provider)
  assert.ok(connResult.response.length > 0)

  const structured = await aiService.generateStructuredOutput({
    provider,
    apiKey,
    prompt: 'Return JSON {"status":"verified"}',
    validate: (parsed) => (parsed && typeof parsed === 'object' ? parsed : null),
  })
  assert.ok(structured.data)
})
