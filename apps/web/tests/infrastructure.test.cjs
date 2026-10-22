const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

// Ensure global system Node modules (@babel/core, etc.) are resolvable
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

// Mock external runtime dependencies that are not installed in offline sandbox
const mockPrisma = {
  aICredential: {
    findFirst: async () => null,
    findMany: async () => [],
  },
  aIModelConfig: {
    findFirst: async () => null,
  },
  document: {
    findUnique: async () => null,
    findFirst: async () => null,
    update: async ({ where, data }) => ({ id: where.id, ...data }),
    create: async ({ data }) => ({ id: 'doc-1', ...data }),
  },
  documentChunk: {
    findMany: async () => [],
    create: async ({ data }) => ({ id: `chunk-${data.chunkIndex}`, ...data }),
    deleteMany: async () => ({ count: 0 }),
  },
  documentProcessingJob: {
    create: async ({ data }) => ({ id: 'job-1', ...data }),
    deleteMany: async () => ({ count: 0 }),
  },
  subjectEnrollment: {
    findFirst: async () => null,
    findMany: async () => [],
  },
  projectMember: {
    findFirst: async () => null,
  },
  researchNotebook: {
    findFirst: async () => null,
  },
  lecturerAssignment: {
    findFirst: async () => null,
  },
  assessment: {
    findUnique: async () => null,
  },
  user: {
    findUnique: async () => null,
  },
  $transaction: async (fn) => fn(mockPrisma),
}

const mockModules = {
  '@prisma/client': {
    PrismaClient: function PrismaClient() {
      return mockPrisma
    },
    Prisma: {
      sql: (strings, ...values) => ({ strings, values }),
      empty: {},
      join: (arr) => arr,
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
    DocumentStatus: {
      UPLOADED: 'UPLOADED',
      QUEUED: 'QUEUED',
      EXTRACTING: 'EXTRACTING',
      CHUNKING: 'CHUNKING',
      EMBEDDING: 'EMBEDDING',
      INDEXING: 'INDEXING',
      READY: 'READY',
      FAILED: 'FAILED',
    },
    DocumentType: {
      PDF: 'PDF',
      DOC: 'DOC',
      DOCX: 'DOCX',
      TXT: 'TXT',
      MARKDOWN: 'MARKDOWN',
      CSV: 'CSV',
      XLS: 'XLS',
      XLSX: 'XLSX',
      PPT: 'PPT',
      PPTX: 'PPTX',
      PNG: 'PNG',
      JPG: 'JPG',
      JPEG: 'JPEG',
      OTHER: 'OTHER',
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
      json: (body, init = {}) => ({
        status: init.status || 200,
        headers: new Map(Object.entries(init.headers || {})),
        body,
        async json() {
          return body
        },
      }),
      redirect: (url, status = 307) => {
        const parsed = new URL(typeof url === 'string' ? url : url.toString())
        return {
          status,
          headers: new Map([['Location', parsed.toString()]]),
        }
      },
      next: () => ({
        status: 200,
        headers: new Map(),
      }),
    },
  },
  'next/headers': {
    cookies: async () => ({
      get: () => undefined,
    }),
    headers: async () => new Map(),
  },
  openai: class MockOpenAI {
    constructor(opts) {
      this.opts = opts
      this.chat = {
        completions: {
          create: async (params) => ({
            choices: [{ message: { content: `Nemotron answer for: ${params.messages[1].content.slice(0, 30)} [Source 1]` } }],
            usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          }),
        },
      }
    }
  },
}

const origResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (mockModules[request]) {
    return request
  }
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
  if (mockModules[request]) {
    return mockModules[request]
  }
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

// ============================================================================
// 1. Authentication & Session Infrastructure Tests
// ============================================================================
test('local-auth: honors both AUTH_SECRET and NEXTAUTH_SECRET and validates HMAC sessions', () => {
  const localAuth = require(path.join(srcRoot, 'lib/local-auth.ts'))

  process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
  delete process.env.NEXTAUTH_SECRET

  const token = localAuth.createLocalSession('user_abc123')
  assert.equal(localAuth.getLocalUserId(token), 'user_abc123')

  // Tampering with signature must fail
  const [payload] = token.split('.')
  assert.equal(localAuth.getLocalUserId(`${payload}.tamperedsig`), null)
  assert.equal(localAuth.getLocalUserId('malformed-token'), null)
  assert.equal(localAuth.getLocalUserId(null), null)

  // Changing secret invalidates existing token
  process.env.AUTH_SECRET = 'different-secret-32-characters-long-9999'
  assert.equal(localAuth.getLocalUserId(token), null)
})

test('auth-utils: requireRole falls back to user.role when activeMembership is absent', () => {
  const authUtils = require(path.join(srcRoot, 'lib/auth-utils.ts'))

  const registeredLecturerWithoutMembership = {
    userId: 'u_lecturer',
    user: { id: 'u_lecturer', role: 'LECTURER' },
    membership: undefined,
  }

  // Previously threw Forbidden because auth.membership?.role was undefined
  const verified = authUtils.requireLecturerOrAdmin(registeredLecturerWithoutMembership)
  assert.equal(verified.userId, 'u_lecturer')

  const registeredStudent = {
    userId: 'u_student',
    user: { id: 'u_student', role: 'STUDENT' },
    membership: undefined,
  }

  assert.throws(() => authUtils.requireLecturerOrAdmin(registeredStudent), /Forbidden/)
})

test('middleware: located at src/middleware.ts, adds security headers, and enforces route protection', async () => {
  const localAuth = require(path.join(srcRoot, 'lib/local-auth.ts'))
  const mw = require(path.join(srcRoot, 'middleware.ts'))

  assert.equal(mw.runtime, 'nodejs')
  assert.equal(mw.isPublicApiRoute('/api/auth/login'), true)
  assert.equal(mw.isPublicApiRoute('/api/health'), true)
  assert.equal(mw.isPublicApiRoute('/api/documents'), false)

  // Unauthenticated request to protected API route returns 401
  const unauthApiReq = {
    cookies: { get: () => undefined },
    nextUrl: new URL('http://localhost:3000/api/documents'),
  }
  const unauthApiRes = await mw.middleware(unauthApiReq)
  assert.equal(unauthApiRes.status, 401)
  assert.equal(unauthApiRes.headers.get('X-Content-Type-Options'), 'nosniff')

  // Unauthenticated request to /roadmap (public page) succeeds
  const roadmapReq = {
    cookies: { get: () => undefined },
    nextUrl: new URL('http://localhost:3000/roadmap'),
  }
  const roadmapRes = await mw.middleware(roadmapReq)
  assert.equal(roadmapRes.status, 200)

  // Authenticated request to /login redirects to /dashboard
  process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
  const validSession = localAuth.createLocalSession('user_1')
  const authLoginReq = {
    cookies: { get: (name) => (name === localAuth.LOCAL_AUTH_COOKIE ? { value: validSession } : undefined) },
    nextUrl: new URL('http://localhost:3000/login'),
  }
  const authLoginRes = await mw.middleware(authLoginReq)
  assert.equal(authLoginRes.status, 307)
  assert.equal(authLoginRes.headers.get('Location'), 'http://localhost:3000/dashboard')
})

// ============================================================================
// 2. Encryption Infrastructure Tests
// ============================================================================
test('encryption: encrypts and decrypts lazily even when ENCRYPTION_KEY is unset at import time', async () => {
  delete process.env.ENCRYPTION_KEY
  delete process.env.AUTH_SECRET
  delete process.env.NEXTAUTH_SECRET
  process.env.NODE_ENV = 'development'

  const encryption = require(path.join(srcRoot, 'lib/encryption.ts'))

  const plaintext = 'sk-proj-super-secret-api-key-1234567890'
  const ciphertext = await encryption.encrypt(plaintext)
  assert.notEqual(ciphertext, plaintext)

  const decrypted = await encryption.decrypt(ciphertext)
  assert.equal(decrypted, plaintext)

  // Short/corrupted payload throws descriptive error
  await assert.rejects(() => encryption.decrypt('dG9vc2hvcnQ='), /Invalid encrypted payload/)
})

test('encryption: production refuses to fall back to authentication secrets', async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    encryptionKey: process.env.ENCRYPTION_KEY,
    authSecret: process.env.AUTH_SECRET,
    nextAuthSecret: process.env.NEXTAUTH_SECRET,
  }
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.ENCRYPTION_KEY
    delete process.env.AUTH_SECRET
    delete process.env.NEXTAUTH_SECRET
    const encryption = require(path.join(srcRoot, 'lib/encryption.ts'))
    await assert.rejects(() => encryption.encrypt('must-not-be-encrypted-with-a-fallback'), /ENCRYPTION_KEY environment variable is required in production/)
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous.nodeEnv
    if (previous.encryptionKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = previous.encryptionKey
    if (previous.authSecret === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = previous.authSecret
    if (previous.nextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET
    else process.env.NEXTAUTH_SECRET = previous.nextAuthSecret
  }
})

// ============================================================================
// 3. File Storage & Local Document Serving Infrastructure Tests
// ============================================================================
test('storage/client: honors STORAGE_LOCAL_ROOT, normalizes bucket prefixes, and preserves slash segments in signed URLs', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-storage-test-'))
  process.env.STORAGE_MODE = 'local'
  process.env.STORAGE_LOCAL_ROOT = tempRoot

  const storageClient = require(path.join(srcRoot, 'lib/storage/client.ts'))
  storageClient.setStorageAdapter(null) // Reset singleton to pick up new env

  assert.equal(storageClient.getLocalStorageRoot(), tempRoot)

  const content = Buffer.from('Hello ALEX storage test')
  const uploadRes = await storageClient.uploadFile('documents', 'user123/170000-notes.txt', content)
  assert.equal(uploadRes.path, 'user123/170000-notes.txt')
  assert.equal(uploadRes.size, content.length)

  // Verify exists and download work with both relative path and bucket-prefixed path
  assert.equal(await storageClient.fileExists('documents', 'user123/170000-notes.txt'), true)
  assert.equal(await storageClient.fileExists('documents', 'documents/user123/170000-notes.txt'), true)

  const downloaded = await storageClient.downloadFile('documents', 'user123/170000-notes.txt')
  assert.equal(downloaded.toString('utf8'), 'Hello ALEX storage test')

  // Verify getSignedUrl preserves slash separator between path segments for Next.js [...path] route
  const signedUrl = await storageClient.getSignedUrl('documents', 'user123/170000-notes.txt')
  assert.equal(signedUrl, '/api/documents/local/documents/user123/170000-notes.txt')

  // Path traversal must be rejected
  await assert.rejects(
    () => storageClient.downloadFile('documents', '../../etc/passwd'),
    /path traversal/
  )

  fs.rmSync(tempRoot, { recursive: true, force: true })
})

// ============================================================================
// 4. Document Processing & RAG Vector/Keyword Search Infrastructure Tests
// ============================================================================
test('chunker: accurately tracks pageNumber across multi-page documents', () => {
  const chunker = require(path.join(srcRoot, 'lib/document-processing/chunker.ts'))

  const page1Text = 'A'.repeat(2500)
  const page2Text = 'B'.repeat(2500)
  const pages = [
    { pageNumber: 1, text: page1Text },
    { pageNumber: 2, text: page2Text },
  ]

  const chunks = chunker.chunkBySemanticUnits(`${page1Text}\n\n${page2Text}`, pages, {
    chunkSize: 500,
    chunkOverlap: 0,
  })

  assert.ok(chunks.length >= 2)
  assert.equal(chunks[0].pageNumber, 1)
  assert.equal(chunks[chunks.length - 1].pageNumber, 2)
})

test('pipeline + vector-search: encodes/decodes Float32 embeddings and performs hybrid search without raw SQL crashes', async () => {
  process.env.AI_MODE = 'mock'
  const pipeline = require(path.join(srcRoot, 'lib/document-processing/pipeline.ts'))
  const embeddingsLib = require(path.join(srcRoot, 'lib/ai/embeddings.ts'))
  const vectorSearchLib = require(path.join(srcRoot, 'lib/rag/vector-search.ts'))

  const mockProvider = new embeddingsLib.MockEmbeddingProvider()
  const { embeddings } = await mockProvider.generateEmbeddings(['Binary Search Tree insertion takes O(log n)'])
  const originalVec = embeddings[0]

  const encoded = pipeline.encodeEmbeddingToBytes(originalVec)
  const decoded = pipeline.decodeEmbeddingFromBytes(encoded)
  assert.equal(decoded.length, originalVec.length)
  assert.ok(Math.abs(decoded[0] - originalVec[0]) < 1e-6)
  assert.ok(vectorSearchLib.cosineSimilarity(originalVec, decoded) > 0.9999)

  // Mock prisma.documentChunk.findMany to return our encoded chunk
  const origFindMany = mockPrisma.documentChunk.findMany
  mockPrisma.documentChunk.findMany = async () => [
    {
      id: 'chunk-bst',
      documentId: 'doc-cs201',
      content: 'Binary Search Tree insertion takes O(log n) average time complexity.',
      chunkIndex: 0,
      pageNumber: 3,
      sectionTitle: 'Trees',
      tokenCount: 15,
      embedding: encoded,
      metadata: { embeddingModel: 'mock' },
      document: {
        id: 'doc-cs201',
        title: 'CS201 Notes',
        fileName: 'cs201.pdf',
        documentType: 'PDF',
        ownerId: 'user_1',
      },
    },
  ]

  try {
    const results = await vectorSearchLib.hybridSearch({
      query: 'Binary Search Tree insertion',
      userId: 'user_1',
      limit: 5,
    })

    assert.equal(results.length, 1)
    assert.equal(results[0].id, 'chunk-bst')
    assert.equal(results[0].pageNumber, 3)
    assert.ok(results[0].similarity > 0)
  } finally {
    mockPrisma.documentChunk.findMany = origFindMany
  }
})

// ============================================================================
// 5. AI Provider Router & Embedding Provider Infrastructure Tests
// ============================================================================
test('ai/embeddings & rag/generation: supports all configured providers and safely falls back when non-embedding provider is default', async () => {
  process.env.AI_MODE = 'nemotron'
  delete process.env.OPENAI_API_KEY
  delete process.env.GOOGLE_GEMINI_API_KEY
  delete process.env.MISTRAL_API_KEY

  const embeddingsLib = require(path.join(srcRoot, 'lib/ai/embeddings.ts'))
  const generationLib = require(path.join(srcRoot, 'lib/rag/generation.ts'))

  // All chat providers in AIProviderType must instantiate without throwing Unsupported chat provider
  for (const provider of [
    'OPENAI',
    'GROQ',
    'MISTRAL',
    'OPENROUTER',
    'TOGETHER_AI',
    'GOOGLE_GEMINI',
    'ANTHROPIC',
    'NVIDIA_NEMOTRON',
    'MOCK',
  ]) {
    const instance = generationLib.createChatProvider(provider, 'test-key')
    assert.ok(instance, `Expected chat provider instance for ${provider}`)
  }

  // getUserEmbeddingProvider falls back cleanly to MockEmbeddingProvider when no embedding-capable credential exists
  const embResult = await embeddingsLib.getUserEmbeddingProvider('user_1')
  assert.equal(embResult.model, 'mock')

  // MockChatProvider responds even when context is empty (fixes AI Assistant non-response bug)
  const mockChat = generationLib.createChatProvider('MOCK', '')
  const chatRes = await mockChat.generate({
    query: 'Hello ALEX!',
    context: [],
  })
  assert.ok(chatRes.answer.includes('Hello!'))
  assert.equal(chatRes.model, 'mock')
})

// ============================================================================
// 6. Routing & Shared Types Configuration Tests
// ============================================================================
test('next.config.ts & shared-types: /dashboard rewrite uses :path+ and NotificationCategory.ATTENDANCE is spelled', async () => {
  const nextConfig = require(path.join(webRoot, 'next.config.ts')).default
  const rewrites = await nextConfig.rewrites()

  assert.deepEqual(rewrites, [
    {
      source: '/dashboard/:path+',
      destination: '/:path+',
    },
  ])

  const sharedTypes = require('@alex/shared-types')
  assert.equal(sharedTypes.NotificationCategory.ATTENDANCE, 'ATTENDANCE')
})

test('download route & worker/scripts: resolves relative local URLs for NextResponse.redirect and validates JS entrypoints', async () => {
  const localAuth = require(path.join(srcRoot, 'lib/local-auth.ts'))
  const storageClient = require(path.join(srcRoot, 'lib/storage/client.ts'))
  const downloadRoute = require(path.join(srcRoot, 'app/api/documents/[id]/download/route.ts'))

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-dl-test-'))
  process.env.STORAGE_MODE = 'local'
  process.env.STORAGE_LOCAL_ROOT = tempRoot
  process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
  storageClient.setStorageAdapter(null)

  await storageClient.uploadFile('documents', 'user_1/lecture.pdf', Buffer.from('%PDF-1.4 mock'))

  const origFindUnique = mockPrisma.document.findUnique
  const origUserFindUnique = mockPrisma.user.findUnique
  mockPrisma.document.findUnique = async () => ({
    id: 'doc-123',
    ownerId: 'user_1',
    isPublic: false,
    storageBucket: 'documents',
    storagePath: 'user_1/lecture.pdf',
    subjectId: null,
    projectId: null,
    notebookId: null,
  })
  mockPrisma.user.findUnique = async () => ({
    id: 'user_1',
    email: 'student@alex.edu',
    role: 'STUDENT',
    isActive: true,
    memberships: [],
  })

  try {
    const token = localAuth.createLocalSession('user_1')
    mockModules['next/headers'].cookies = async () => ({ get: (name) => (name === localAuth.LOCAL_AUTH_COOKIE ? { value: token } : undefined) })
    const req = {
      url: 'http://localhost:3000/api/documents/doc-123/download',
      cookies: { get: (name) => (name === localAuth.LOCAL_AUTH_COOKIE ? { value: token } : undefined) },
    }
    const res = await downloadRoute.GET(req, { params: Promise.resolve({ id: 'doc-123' }) })
    assert.equal(res.status, 307)
    assert.equal(
      res.headers.get('Location'),
      'http://localhost:3000/api/documents/local/documents/user_1/lecture.pdf'
    )
  } finally {
    mockPrisma.document.findUnique = origFindUnique
    mockPrisma.user.findUnique = origUserFindUnique
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }

  // Verify scripts/reset-dev-db.js and docker/worker-entrypoint.js load without SyntaxError
  const workerEntrypoint = require(path.join(repoRoot, 'docker/worker-entrypoint.js'))
  assert.equal(typeof workerEntrypoint.enqueueJob, 'function')
  const resetDbScript = require(path.join(repoRoot, 'scripts/reset-dev-db.js'))
  assert.equal(typeof resetDbScript.main, 'function')
})
