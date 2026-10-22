const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const zlib = require('node:zlib')
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

const tempStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-notebook-test-'))
process.env.STORAGE_MODE = 'local'
process.env.STORAGE_LOCAL_ROOT = tempStorageRoot
process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long-99999'

// ============================================================================
// Helpers: Build Representative Multi-Page PDF and DOCX Buffers
// ============================================================================

function buildCrisprPdfBuffer() {
  const page1Stream = zlib.deflateSync(
    Buffer.from(
      'BT\n/F1 12 Tf\n72 720 Td\n(CRISPR-Cas9 Guide RNA Design Principles) Tj\nT*\n(Single-guide RNA requires a 20-nucleotide spacer adjacent to a 5-NGG-3 PAM sequence.) Tj\nET',
      'latin1'
    )
  )
  const page2Stream = zlib.deflateSync(
    Buffer.from(
      'BT\n/F1 12 Tf\n72 720 Td\n(High-Fidelity Cas9 Variants) Tj\nT*\n(Engineered variants SpCas9-HF1 and eSpCas9 reduce off-target cleavage by 92 percent in human cells.) Tj\nET',
      'latin1'
    )
  )

  const header = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ' +
      page1Stream.length +
      ' /Filter /FlateDecode >>\nstream\n',
    'latin1'
  )
  const mid = Buffer.from(
    '\nendstream\nendobj\n5 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 6 0 R >>\nendobj\n6 0 obj\n<< /Length ' +
      page2Stream.length +
      ' /Filter /FlateDecode >>\nstream\n',
    'latin1'
  )
  const footer = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1')
  return Buffer.concat([header, page1Stream, mid, page2Stream, footer])
}

function createZipBuffer(files) {
  const localFileParts = []
  const centralDirParts = []
  let offset = 0

  for (const { name, content } of files) {
    const nameBuf = Buffer.from(name, 'utf8')
    const rawBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
    const compressed = zlib.deflateRawSync(rawBuf)

    let crc = 0xffffffff
    for (let i = 0; i < rawBuf.length; i++) {
      crc ^= rawBuf[i]
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(rawBuf.length, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localFileParts.push(localHeader, nameBuf, compressed)

    const cdHeader = Buffer.alloc(46)
    cdHeader.writeUInt32LE(0x02014b50, 0)
    cdHeader.writeUInt16LE(20, 4)
    cdHeader.writeUInt16LE(20, 6)
    cdHeader.writeUInt16LE(0, 8)
    cdHeader.writeUInt16LE(8, 10)
    cdHeader.writeUInt16LE(0, 12)
    cdHeader.writeUInt16LE(0, 14)
    cdHeader.writeUInt32LE(crc, 16)
    cdHeader.writeUInt32LE(compressed.length, 20)
    cdHeader.writeUInt32LE(rawBuf.length, 24)
    cdHeader.writeUInt16LE(nameBuf.length, 28)
    cdHeader.writeUInt16LE(0, 30)
    cdHeader.writeUInt16LE(0, 32)
    cdHeader.writeUInt16LE(0, 34)
    cdHeader.writeUInt16LE(0, 36)
    cdHeader.writeUInt32LE(0, 38)
    cdHeader.writeUInt32LE(offset, 42)

    centralDirParts.push(cdHeader, nameBuf)
    offset += 30 + nameBuf.length + compressed.length
  }

  const cdBuffer = Buffer.concat(centralDirParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuffer.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localFileParts, cdBuffer, eocd])
}

function buildLnpDocxBuffer() {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hepatic Delivery Systems</w:t></w:r></w:p>
    <w:p><w:r><w:t>Ionizable Lipid Nanoparticles (LNPs) encapsulate Cas9 mRNA and guide RNA for targeted hepatic delivery in vivo.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  return createZipBuffer([{ name: 'word/document.xml', content: docXml }])
}

// ============================================================================
// In-Memory Prisma Store for Research Notebooks, Sources, Documents, Chunks & Conversations
// ============================================================================

const store = {
  users: {
    user_researcher: {
      id: 'user_researcher',
      email: 'researcher@alex.edu',
      firstName: 'Ananya',
      lastName: 'Krishnan',
      role: 'STUDENT',
      isActive: true,
      memberships: [
        { id: 'm_r1', userId: 'user_researcher', institutionId: 'inst_1', role: 'STUDENT', status: 'ACTIVE' },
      ],
    },
    user_outsider: {
      id: 'user_outsider',
      email: 'outsider@alex.edu',
      firstName: 'Rohan',
      lastName: 'Verma',
      role: 'STUDENT',
      isActive: true,
      memberships: [
        { id: 'm_r2', userId: 'user_outsider', institutionId: 'inst_1', role: 'STUDENT', status: 'ACTIVE' },
      ],
    },
  },
  notebooks: [],
  sources: [],
  notes: [],
  documents: [],
  chunks: [],
  jobs: [],
  conversations: [],
  messages: [],
  quizzes: [],
  credentials: [],
}

let activeSessionToken = ''

function matchesDocumentWhere(doc, where) {
  if (!where) return true
  if (where.id) {
    if (typeof where.id === 'string' && doc.id !== where.id) return false
    if (where.id.in && !where.id.in.includes(doc.id)) return false
  }
  if (where.ownerId && doc.ownerId !== where.ownerId) return false
  if (where.notebookId && doc.notebookId !== where.notebookId) return false
  if (Array.isArray(where.AND)) {
    return where.AND.every(sub => matchesDocumentWhere(doc, sub))
  }
  if (Array.isArray(where.OR)) {
    return where.OR.some(branch => {
      if (branch.ownerId) return doc.ownerId === branch.ownerId
      if (branch.notebook?.ownerId) {
        return (
          Boolean(doc.notebookId) &&
          store.notebooks.some(n => n.id === doc.notebookId && n.ownerId === branch.notebook.ownerId)
        )
      }
      if (branch.notebook?.isPublic !== undefined) {
        return (
          Boolean(doc.notebookId) &&
          store.notebooks.some(n => n.id === doc.notebookId && n.isPublic === branch.notebook.isPublic)
        )
      }
      return false
    })
  }
  return true
}

const mockPrisma = {
  $transaction: async (fn) => fn(mockPrisma),
  user: {
    findUnique: async ({ where }) => store.users[where.id] || null,
  },
  researchNotebook: {
    create: async ({ data }) => {
      const nb = {
        id: `nb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        description: null,
        projectId: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.notebooks.push(nb)
      return nb
    },
    findMany: async ({ where }) => {
      return store.notebooks
        .filter(nb => {
          if (where?.ownerId) return nb.ownerId === where.ownerId
          if (Array.isArray(where?.OR)) {
            return where.OR.some(b => (b.ownerId && nb.ownerId === b.ownerId) || (b.isPublic !== undefined && nb.isPublic === b.isPublic))
          }
          return true
        })
        .map(nb => {
          const nbSources = store.sources.filter(s => s.notebookId === nb.id)
          const nbDocs = store.documents.filter(d => d.notebookId === nb.id)
          const nbNotes = store.notes.filter(n => n.notebookId === nb.id)
          return {
            ...nb,
            project: null,
            sources: nbSources,
            documents: nbDocs,
            _count: {
              sources: nbSources.length,
              notes: nbNotes.length,
            },
          }
        })
    },
    findUnique: async ({ where, include }) => {
      const nb = store.notebooks.find(n => n.id === where.id)
      if (!nb) return null
      const nbSources = store.sources
        .filter(s => s.notebookId === nb.id)
        .map(s => {
          const linkedDoc = s.documentId ? store.documents.find(d => d.id === s.documentId) : null
          const docChunks = linkedDoc ? store.chunks.filter(c => c.documentId === linkedDoc.id) : []
          return {
            ...s,
            document: linkedDoc ? { ...linkedDoc, _count: { chunks: docChunks.length } } : null,
          }
        })
      const nbDocs = store.documents
        .filter(d => d.notebookId === nb.id)
        .map(d => ({
          ...d,
          _count: { chunks: store.chunks.filter(c => c.documentId === d.id).length },
        }))
      const nbNotes = store.notes.filter(n => n.notebookId === nb.id)
      const nbConvs = store.conversations.filter(c => c.notebookId === nb.id)
      return {
        ...nb,
        ...(include?.sources ? { sources: nbSources } : {}),
        ...(include?.documents ? { documents: nbDocs } : {}),
        ...(include?.notes ? { notes: nbNotes } : {}),
        ...(include?.conversations ? { conversations: nbConvs } : {}),
      }
    },
    findFirst: async ({ where }) => {
      return (
        store.notebooks.find(n => {
          if (where.id && n.id !== where.id) return false
          if (where.ownerId && n.ownerId !== where.ownerId) return false
          if (Array.isArray(where.OR)) {
            return where.OR.some(b => (b.ownerId && n.ownerId === b.ownerId) || (b.isPublic !== undefined && n.isPublic === b.isPublic))
          }
          return true
        }) || null
      )
    },
    update: async ({ where, data }) => {
      const nb = store.notebooks.find(n => n.id === where.id)
      if (!nb) throw new Error('Notebook not found')
      Object.assign(nb, data, { updatedAt: new Date() })
      return nb
    },
    delete: async ({ where }) => {
      store.notebooks = store.notebooks.filter(n => n.id !== where.id)
      return {}
    },
  },
  researchSource: {
    create: async ({ data }) => {
      const s = {
        id: `rsrc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        documentId: null,
        authors: null,
        publicationYear: null,
        doi: null,
        url: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.sources.push(s)
      return s
    },
    deleteMany: async ({ where }) => {
      store.sources = store.sources.filter(s => {
        if (where.notebookId && s.notebookId !== where.notebookId) return true
        if (Array.isArray(where.OR)) {
          const matchesOr = where.OR.some(b => (b.id && s.id === b.id) || (b.documentId && s.documentId === b.documentId))
          return !matchesOr
        }
        return false
      })
      return {}
    },
  },
  researchNote: {
    create: async ({ data }) => {
      const note = {
        id: `rnote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sourceIds: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.notes.push(note)
      return note
    },
    deleteMany: async ({ where }) => {
      store.notes = store.notes.filter(n => {
        if (where.id && n.id !== where.id) return true
        if (where.notebookId && n.notebookId !== where.notebookId) return true
        return false
      })
      return {}
    },
  },
  document: {
    create: async ({ data }) => {
      const doc = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        description: null,
        errorMessage: null,
        pageCount: null,
        metadata: null,
        subjectId: null,
        projectId: null,
        notebookId: null,
        processorId: null,
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.documents.push(doc)
      return doc
    },
    update: async ({ where, data }) => {
      const doc = store.documents.find(d => d.id === where.id)
      if (!doc) throw new Error('Document not found')
      Object.assign(doc, data, { updatedAt: new Date() })
      return doc
    },
    findUnique: async ({ where }) => {
      const doc = store.documents.find(d => d.id === where.id)
      if (!doc) return null
      const docChunks = store.chunks.filter(c => c.documentId === doc.id)
      return {
        ...doc,
        _count: { chunks: docChunks.length },
      }
    },
    findMany: async ({ where }) => {
      return store.documents
        .filter(d => matchesDocumentWhere(d, where))
        .map(d => ({
          ...d,
          _count: { chunks: store.chunks.filter(c => c.documentId === d.id).length },
        }))
    },
  },
  documentChunk: {
    create: async ({ data }) => {
      const chunk = {
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        ...data,
      }
      store.chunks.push(chunk)
      return chunk
    },
    findMany: async ({ where }) => {
      return store.chunks
        .filter(c => {
          const parentDoc = store.documents.find(d => d.id === c.documentId)
          if (!parentDoc) return false
          if (where?.documentId) {
            if (typeof where.documentId === 'string' && c.documentId !== where.documentId) return false
            if (where.documentId.in && !where.documentId.in.includes(c.documentId)) return false
          }
          if (where?.document && !matchesDocumentWhere(parentDoc, where.document)) {
            return false
          }
          return true
        })
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map(c => {
          const parentDoc = store.documents.find(d => d.id === c.documentId)
          return {
            ...c,
            document: {
              id: parentDoc.id,
              title: parentDoc.title,
              fileName: parentDoc.fileName,
              documentType: parentDoc.documentType,
              ownerId: parentDoc.ownerId,
            },
          }
        })
    },
  },
  documentProcessingJob: {
    create: async ({ data }) => {
      const j = { id: `job_${Date.now()}`, ...data, createdAt: new Date() }
      store.jobs.push(j)
      return j
    },
  },
  conversation: {
    create: async ({ data }) => {
      const conv = {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.conversations.push(conv)
      return conv
    },
    findUnique: async ({ where }) => {
      const conv = store.conversations.find(c => c.id === where.id)
      if (!conv) return null
      const msgs = store.messages.filter(m => m.conversationId === conv.id)
      return {
        ...conv,
        messages: msgs,
        _count: { messages: msgs.length },
      }
    },
  },
  message: {
    createMany: async ({ data }) => {
      for (const item of data) {
        store.messages.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date(),
          ...item,
        })
      }
      return { count: data.length }
    },
  },
  quiz: {
    create: async ({ data }) => {
      const q = { id: `quiz_${Date.now()}`, ...data, createdAt: new Date() }
      store.quizzes.push(q)
      return q
    },
  },
  aICredential: {
    findFirst: async ({ where }) =>
      store.credentials.find(c => !where?.userId || c.userId === where.userId) || null,
    findUnique: async ({ where }) => store.credentials.find(c => c.id === where.id) || null,
    create: async ({ data }) => {
      const c = { id: `cred_${Date.now()}`, usageCount: 0, ...data, createdAt: new Date(), updatedAt: new Date() }
      store.credentials.push(c)
      return c
    },
    update: async ({ where, data }) => {
      const c = store.credentials.find(x => x.id === where.id)
      if (c && data.usageCount?.increment) c.usageCount += data.usageCount.increment
      return c
    },
    updateMany: async () => ({ count: 0 }),
  },
  aIModelConfig: { findFirst: async () => null },
  userMemory: { findMany: async () => [] },
  subjectEnrollment: { findMany: async () => [], findFirst: async () => null },
  lecturerAssignment: { findFirst: async () => null },
  projectMember: { findFirst: async () => null },
  assignment: { findMany: async () => [] },
  attendanceRecord: { findMany: async () => [] },
  plannerEvent: { findMany: async () => [] },
}

class CustomNextResponse {
  static json(body, init = {}) {
    const serialized = JSON.parse(JSON.stringify(body))
    return {
      status: init.status || 200,
      headers: new Map(Object.entries(init.headers || {})),
      body: serialized,
      async json() {
        return serialized
      },
    }
  }
}

const mockModules = {
  '@prisma/client': {
    PrismaClient: function PrismaClient() {
      return mockPrisma
    },
    Prisma: {},
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
    NextResponse: CustomNextResponse,
  },
  'next/headers': {
    cookies: async () => ({
      get: (name) =>
        name === 'alex_local_session' && activeSessionToken ? { value: activeSessionToken } : undefined,
    }),
    headers: async () => new Map(),
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

const localAuth = require(path.join(srcRoot, 'lib/local-auth.ts'))
function switchUser(userId) {
  activeSessionToken = localAuth.createLocalSession(userId)
}
switchUser('user_researcher')

function makeUploadRequest(fileObj, extraFields = {}) {
  const map = new Map()
  if (fileObj) {
    const buf = Buffer.isBuffer(fileObj.buffer) ? fileObj.buffer : Buffer.from(fileObj.buffer || '')
    map.set('file', {
      name: fileObj.name,
      type: fileObj.type || 'application/octet-stream',
      size: buf.byteLength,
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    })
  }
  for (const [k, v] of Object.entries(extraFields)) {
    map.set(k, v)
  }
  return {
    url: 'http://localhost:3000/api/documents',
    formData: async () => ({
      get: (key) => (map.has(key) ? map.get(key) : null),
    }),
  }
}

let sharedNotebookId = ''

// ============================================================================
// Test 1: Notebook Creation, Multi-Source Ingestion (PDF Upload, Pasted Text, Linked DOCX) & Persistence
// ============================================================================

test('Research Notebook E2E 1: creates notebook, ingests multiple sources via shared pipeline, and persists associations', async () => {
  const notebooksRoute = require(path.join(srcRoot, 'app/api/research/notebooks/route.ts'))
  const notebookByIdRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/route.ts'))
  const sourcesRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/sources/route.ts'))
  const docsRoute = require(path.join(srcRoot, 'app/api/documents/route.ts'))

  process.env.AI_MODE = 'mock'

  // 1. Reject empty notebook title with 400
  const badCreate = await notebooksRoute.POST({
    json: async () => ({ title: '   ' }),
  })
  assert.equal(badCreate.status, 400)
  assert.equal(badCreate.body.code, 'MISSING_TITLE')

  // 2. Create a valid research notebook
  const createRes = await notebooksRoute.POST({
    json: async () => ({
      title: 'CRISPR & Gene Delivery Research',
      description: 'Multi-source investigation of Cas9 fidelity, base editing, and LNP vectors',
    }),
  })
  assert.equal(createRes.status, 200)
  assert.equal(createRes.body.notebook.title, 'CRISPR & Gene Delivery Research')
  assert.equal(createRes.body.notebook._count.sources, 0)
  sharedNotebookId = createRes.body.notebook.id

  // 3. Ingest Source #1: Upload 2-page PDF directly into the notebook
  const pdfUploadRes = await docsRoute.POST(
    makeUploadRequest(
      {
        name: 'crispr_gene_editing.pdf',
        type: 'application/pdf',
        buffer: buildCrisprPdfBuffer(),
      },
      { notebookId: sharedNotebookId, title: 'CRISPR-Cas9 High-Fidelity Study' }
    )
  )
  assert.equal(pdfUploadRes.status, 200)
  assert.equal(pdfUploadRes.body.document.status, 'READY')
  assert.equal(pdfUploadRes.body.document.pageCount, 2)

  // 4. Ingest Source #2: Paste raw Markdown / Lecture Notes directly via POST /api/research/notebooks/[id]/sources
  const pastedSourceRes = await sourcesRoute.POST(
    {
      json: async () => ({
        title: 'Adenine Base Editing Lecture Notes',
        content:
          '# Adenine Base Editors (ABE8e)\n\nAdenine Base Editors (ABE8e) convert A-T base pairs to G-C with 88% efficiency without inducing double-strand DNA breaks.',
        authors: { primary: 'Dr. Liu' },
        publicationYear: 2024,
      }),
    },
    { params: Promise.resolve({ id: sharedNotebookId }) }
  )
  assert.equal(pastedSourceRes.status, 200)
  assert.equal(pastedSourceRes.body.source.status, 'READY')
  assert.ok(pastedSourceRes.body.source.chunksCount >= 1)

  // 5. Ingest Source #3: Upload DOCX to personal library, then link it into the notebook
  const docxUploadRes = await docsRoute.POST(
    makeUploadRequest({
      name: 'delivery_lipid_nanoparticles.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildLnpDocxBuffer(),
    })
  )
  assert.equal(docxUploadRes.status, 200)
  const docxId = docxUploadRes.body.document.id

  const linkDocxRes = await sourcesRoute.POST(
    {
      json: async () => ({
        documentId: docxId,
        title: 'Lipid Nanoparticle Hepatic Delivery',
      }),
    },
    { params: Promise.resolve({ id: sharedNotebookId }) }
  )
  assert.equal(linkDocxRes.status, 200)
  assert.equal(linkDocxRes.body.source.documentId, docxId)
  assert.equal(linkDocxRes.body.source.status, 'READY')

  // 6. Verify GET /api/research/notebooks/[id]/sources lists all 3 processed sources with real metadata
  const listSourcesRes = await sourcesRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(listSourcesRes.status, 200)
  assert.equal(listSourcesRes.body.sources.length, 3)
  assert.ok(listSourcesRes.body.sources.every(s => s.status === 'READY' && s.chunksCount >= 1))

  // 7. Verify GET /api/research/notebooks and GET /api/research/notebooks/[id] persist the 3 sources
  const listNbRes = await notebooksRoute.GET({ url: 'http://localhost:3000/api/research/notebooks' })
  assert.equal(listNbRes.status, 200)
  const foundNb = listNbRes.body.notebooks.find(n => n.id === sharedNotebookId)
  assert.ok(foundNb)
  assert.equal(foundNb._count.sources, 3)

  const detailNbRes = await notebookByIdRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(detailNbRes.status, 200)
  assert.equal(detailNbRes.body.notebook.id, sharedNotebookId)
})

// ============================================================================
// Test 2: Grounded Q&A, Citations (Source/Page/Section), Follow-Up Questions & Unsupported Distinction
// ============================================================================

test('Research Notebook E2E 2: answers grounded questions with source/page/section citations, handles multi-turn follow-ups, and flags unsupported questions', async () => {
  const credsRoute = require(path.join(srcRoot, 'app/api/ai/credentials/route.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))
  const convByIdRoute = require(path.join(srcRoot, 'app/api/conversations/[id]/route.ts'))

  const capturedMessages = []

  const aiServer = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}

      if (req.url.endsWith('/embeddings')) {
        // Return empty or error so hybridSearch uses MockEmbeddingProvider + keywordSearch
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'Use local semantic embeddings' } }))
        return
      }

      const messages = body.messages || []
      const sys = messages.find(m => m.role === 'system')?.content || ''
      const userMsg = messages.find(m => m.role === 'user')?.content || ''
      const questionOnly = userMsg.split('\n\nSources:')[0]
      capturedMessages.push({ sys, userMsg })

      let reply = ''
      if (userMsg.includes('No document sources retrieved') || questionOnly.includes('tungsten carbide')) {
        reply =
          'Not supported by the provided notebook sources: The uploaded CRISPR, base editing, and LNP sources do not contain information about the melting point of tungsten carbide.'
      } else if (questionOnly.includes('hepatic delivery') || questionOnly.includes('encapsulate')) {
        reply =
          'Building on the Cas9 and base editing systems discussed earlier, Ionizable Lipid Nanoparticles (LNPs) encapsulate Cas9 mRNA and guide RNA for targeted hepatic delivery in vivo [Source 1].'
      } else {
        reply =
          'Engineered high-fidelity variants SpCas9-HF1 and eSpCas9 reduce off-target cleavage by 92 percent in human cells [Source 1], while Adenine Base Editors (ABE8e) convert A-T base pairs to G-C with 88% efficiency without double-strand breaks [Source 2].'
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: reply } }],
          usage: { prompt_tokens: 60, completion_tokens: 45, total_tokens: 105 },
        })
      )
    })
  })

  await new Promise(resolve => aiServer.listen(0, '127.0.0.1', resolve))
  const { port } = aiServer.address()

  process.env.AI_MODE = 'live'
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`

  try {
    store.credentials = []
    await credsRoute.POST({
      json: async () => ({
        provider: 'OPENAI',
        providerName: 'Notebook OpenAI Key',
        apiKey: 'sk-proj-notebookLiveKey123456',
        models: ['gpt-4o-mini'],
        isDefault: true,
      }),
    })

    // Turn 1: Ask a source-supported question across the notebook
    const turn1Res = await ragQueryRoute.POST({
      json: async () => ({
        notebookId: sharedNotebookId,
        query: 'Which engineered Cas9 variants reduce off-target cleavage and how do Adenine Base Editors work?',
      }),
    })
    assert.equal(turn1Res.status, 200)
    assert.equal(turn1Res.body.isSourceSupported, true)
    assert.equal(turn1Res.body.groundingStatus, 'SUPPORTED')
    assert.ok(turn1Res.body.answer.includes('92 percent'))
    assert.ok(turn1Res.body.citations.length >= 1)
    assert.ok(
      turn1Res.body.citations.some(
        c => c.documentTitle === 'CRISPR-Cas9 High-Fidelity Study' && c.pageNumber === 2
      ),
      `Expected citation to CRISPR-Cas9 High-Fidelity Study p.2, got: ${JSON.stringify(turn1Res.body.citations)}`
    )

    const convId = turn1Res.body.conversationId
    assert.ok(convId)

    // Turn 2: Ask a follow-up question in the same conversationId
    const turn2Res = await ragQueryRoute.POST({
      json: async () => ({
        notebookId: sharedNotebookId,
        conversationId: convId,
        query: 'How are they encapsulated for hepatic delivery in vivo?',
      }),
    })
    assert.equal(turn2Res.status, 200)
    assert.equal(turn2Res.body.conversationId, convId)
    assert.equal(turn2Res.body.isSourceSupported, true)
    assert.equal(turn2Res.body.groundingStatus, 'SUPPORTED')
    assert.ok(turn2Res.body.answer.includes('Ionizable Lipid Nanoparticles'))
    // Verify conversation history from Turn 1 was passed in the system prompt of Turn 2!
    assert.ok(
      capturedMessages[1].sys.includes('Which engineered Cas9 variants reduce off-target cleavage'),
      'Expected Turn 2 system prompt to include Turn 1 conversation history'
    )

    // Turn 3: Ask an UNSUPPORTED question that is not in any of the notebook's sources
    const turn3Res = await ragQueryRoute.POST({
      json: async () => ({
        notebookId: sharedNotebookId,
        conversationId: convId,
        query: 'What is the melting point of tungsten carbide in jet turbines?',
      }),
    })
    assert.equal(turn3Res.status, 200)
    assert.equal(turn3Res.body.isSourceSupported, false)
    assert.equal(turn3Res.body.groundingStatus, 'UNSUPPORTED')
    assert.equal(turn3Res.body.citations.length, 0)
    assert.ok(
      turn3Res.body.answer.toLowerCase().includes('not supported by the provided notebook sources'),
      `Expected unsupported prefix in answer, got: ${turn3Res.body.answer}`
    )

    // Verify all 3 turns (6 messages) and their grounding metadata are persisted in the conversation
    const convHistoryRes = await convByIdRoute.GET({}, { params: Promise.resolve({ id: convId }) })
    assert.equal(convHistoryRes.status, 200)
    assert.equal(convHistoryRes.body.messages.length, 6)
    const savedAssistantMsgs = convHistoryRes.body.messages.filter(m => m.role === 'assistant')
    assert.equal(savedAssistantMsgs[0].metadata.isSourceSupported, true)
    assert.equal(savedAssistantMsgs[1].metadata.isSourceSupported, true)
    assert.equal(savedAssistantMsgs[2].metadata.isSourceSupported, false)
    assert.equal(savedAssistantMsgs[2].metadata.groundingStatus, 'UNSUPPORTED')
  } finally {
    delete process.env.OPENAI_BASE_URL
    await new Promise(resolve => aiServer.close(resolve))
  }
})

// ============================================================================
// Test 3: Notebook Summaries, Study Guides, FAQs, and Quizzes with Citations
// ============================================================================

test('Research Notebook E2E 3: generates source-grounded Summaries, Study Guides, FAQs, and Quizzes and persists notes', async () => {
  const generateRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/generate/route.ts'))
  const notesRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/notes/route.ts'))

  const aiServer = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}
      const messages = body.messages || []
      const sys = messages.find(m => m.role === 'system')?.content || ''

      let reply = ''
      if (/Study Guide/i.test(sys)) {
        reply =
          '## CRISPR & Delivery Study Guide\n- **SpCas9-HF1 & eSpCas9**: Reduce off-target cleavage by 92% [Source 2].\n- **ABE8e Base Editor**: Converts A-T to G-C with 88% efficiency [Source 3].\n- **LNP Delivery**: Encapsulates mRNA and guide RNA for hepatic delivery [Source 4].'
      } else if (/Executive Briefing/i.test(sys)) {
        reply =
          '## Executive Summary\nThis notebook synthesizes high-fidelity CRISPR-Cas9 variants (92% off-target reduction) [Source 2], Adenine Base Editors (ABE8e) [Source 3], and Ionizable Lipid Nanoparticle delivery vectors [Source 4].'
      } else if (/FAQ generator/i.test(sys)) {
        reply = JSON.stringify({
          faqs: [
            {
              question: 'How much do SpCas9-HF1 and eSpCas9 reduce off-target cleavage?',
              answer: 'They reduce off-target cleavage by 92 percent in human cells [Source 2].',
              sourceNumbers: [2],
            },
            {
              question: 'How does ABE8e edit DNA without double-strand breaks?',
              answer: 'ABE8e converts A-T base pairs to G-C with 88% efficiency [Source 3].',
              sourceNumbers: [3],
            },
          ],
        })
      } else if (/assessment generator/i.test(sys)) {
        reply = JSON.stringify({
          questions: [
            {
              id: 'q-1',
              prompt: 'Which vector encapsulates Cas9 mRNA and guide RNA for hepatic delivery?',
              options: [
                'Ionizable Lipid Nanoparticles (LNPs)',
                'Calcium phosphate precipitates',
                'Naked plasmid electroporation',
                'Bacteriophage lambda',
              ],
              answer: 0,
              explanation: 'Ionizable Lipid Nanoparticles (LNPs) encapsulate Cas9 mRNA and guide RNA for hepatic delivery [Source 4].',
            },
          ],
        })
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: reply } }],
          usage: { prompt_tokens: 70, completion_tokens: 55, total_tokens: 125 },
        })
      )
    })
  })

  await new Promise(resolve => aiServer.listen(0, '127.0.0.1', resolve))
  const { port } = aiServer.address()

  process.env.AI_MODE = 'live'
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`

  try {
    // 1. Generate Executive Summary
    const summaryRes = await generateRoute.POST(
      { json: async () => ({ type: 'summary' }) },
      { params: Promise.resolve({ id: sharedNotebookId }) }
    )
    assert.equal(summaryRes.status, 200)
    assert.equal(summaryRes.body.type, 'summary')
    assert.equal(summaryRes.body.isSourceSupported, true)
    assert.equal(summaryRes.body.sourcesUsed, 3)
    assert.ok(summaryRes.body.content.includes('92% off-target reduction'))
    assert.ok(summaryRes.body.citations.length >= 2)

    // 2. Generate Study Guide
    const guideRes = await generateRoute.POST(
      { json: async () => ({ type: 'study_guide' }) },
      { params: Promise.resolve({ id: sharedNotebookId }) }
    )
    assert.equal(guideRes.status, 200)
    assert.equal(guideRes.body.type, 'study_guide')
    assert.ok(guideRes.body.content.includes('CRISPR & Delivery Study Guide'))
    assert.ok(guideRes.body.citations.some(c => c.pageNumber === 2))

    // 3. Generate FAQs
    const faqRes = await generateRoute.POST(
      { json: async () => ({ type: 'faq', count: 5 }) },
      { params: Promise.resolve({ id: sharedNotebookId }) }
    )
    assert.equal(faqRes.status, 200)
    assert.equal(faqRes.body.type, 'faq')
    assert.equal(faqRes.body.faqs.length, 2)
    assert.ok(faqRes.body.faqs[0].citations.length >= 1)
    assert.equal(faqRes.body.faqs[0].citations[0].pageNumber, 2)

    // 4. Generate Grounded Quiz
    const quizRes = await generateRoute.POST(
      { json: async () => ({ type: 'quiz', count: 5, difficulty: 'medium' }) },
      { params: Promise.resolve({ id: sharedNotebookId }) }
    )
    assert.equal(quizRes.status, 200)
    assert.equal(quizRes.body.type, 'quiz')
    assert.equal(quizRes.body.quiz.questions.length, 1)
    assert.equal(quizRes.body.quiz.questions[0].options[0], 'Ionizable Lipid Nanoparticles (LNPs)')
    assert.ok(quizRes.body.quiz.questions[0].citations.length >= 1)

    // 5. Verify Summary, Study Guide, and FAQ were persisted as ResearchNotes in the notebook
    const notesListRes = await notesRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
    assert.equal(notesListRes.status, 200)
    assert.equal(notesListRes.body.notes.length, 3)
  } finally {
    delete process.env.OPENAI_BASE_URL
    await new Promise(resolve => aiServer.close(resolve))
  }
})

// ============================================================================
// Test 4: Empty Notebook Failure Cases, Source Removal & Access Control Enforcement
// ============================================================================

test('Research Notebook E2E 4: handles empty notebooks with 422 NO_PROCESSED_SOURCES and blocks unauthorized users with 403 Forbidden', async () => {
  const notebooksRoute = require(path.join(srcRoot, 'app/api/research/notebooks/route.ts'))
  const notebookByIdRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/route.ts'))
  const sourcesRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/sources/route.ts'))
  const notesRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/notes/route.ts'))
  const generateRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/generate/route.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))

  process.env.AI_MODE = 'mock'
  switchUser('user_researcher')

  // 1. Create an empty notebook with 0 sources
  const emptyNbRes = await notebooksRoute.POST({
    json: async () => ({ title: 'Empty Notebook Without Sources' }),
  })
  assert.equal(emptyNbRes.status, 200)
  const emptyNbId = emptyNbRes.body.notebook.id

  // 2. Attempting to generate summary, study_guide, faq, or quiz on an empty notebook returns 422 NO_PROCESSED_SOURCES
  for (const artifactType of ['summary', 'study_guide', 'faq', 'quiz']) {
    const genFailRes = await generateRoute.POST(
      { json: async () => ({ type: artifactType }) },
      { params: Promise.resolve({ id: emptyNbId }) }
    )
    assert.equal(genFailRes.status, 422)
    assert.equal(genFailRes.body.code, 'NO_PROCESSED_SOURCES')
  }

  // 3. Asking a question on an empty notebook returns isSourceSupported: false and groundingStatus: 'NO_SOURCES'
  const emptyQueryRes = await ragQueryRoute.POST({
    json: async () => ({
      notebookId: emptyNbId,
      query: 'What are the key findings in this notebook?',
    }),
  })
  assert.equal(emptyQueryRes.status, 200)
  assert.equal(emptyQueryRes.body.isSourceSupported, false)
  assert.equal(emptyQueryRes.body.groundingStatus, 'NO_SOURCES')
  assert.equal(emptyQueryRes.body.citations.length, 0)

  // 4. Switch to user_outsider -> verify 403 Forbidden across all private notebook endpoints
  switchUser('user_outsider')

  const getNbDenied = await notebookByIdRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(getNbDenied.status, 403)

  const patchNbDenied = await notebookByIdRoute.PATCH(
    { json: async () => ({ title: 'Hijacked Title' }) },
    { params: Promise.resolve({ id: sharedNotebookId }) }
  )
  assert.equal(patchNbDenied.status, 403)

  const getSourcesDenied = await sourcesRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(getSourcesDenied.status, 403)

  const addSourceDenied = await sourcesRoute.POST(
    { json: async () => ({ title: 'Unauthorized Source', content: 'Test' }) },
    { params: Promise.resolve({ id: sharedNotebookId }) }
  )
  assert.equal(addSourceDenied.status, 403)

  const getNotesDenied = await notesRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(getNotesDenied.status, 403)

  const genDenied = await generateRoute.POST(
    { json: async () => ({ type: 'summary' }) },
    { params: Promise.resolve({ id: sharedNotebookId }) }
  )
  assert.equal(genDenied.status, 403)

  const queryDenied = await ragQueryRoute.POST({
    json: async () => ({
      notebookId: sharedNotebookId,
      query: 'Try to read private notebook sources',
    }),
  })
  assert.equal(queryDenied.status, 403)

  const delNbDenied = await notebookByIdRoute.DELETE({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(delNbDenied.status, 403)

  // 5. Switch back to owner -> verify source removal works cleanly
  switchUser('user_researcher')
  const sourcesBefore = await sourcesRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(sourcesBefore.body.sources.length, 3)

  const sourceToRemove = sourcesBefore.body.sources[0]
  const delSourceRes = await sourcesRoute.DELETE(
    {
      url: `http://localhost:3000/api/research/notebooks/${sharedNotebookId}/sources?sourceId=${sourceToRemove.id}`,
    },
    { params: Promise.resolve({ id: sharedNotebookId }) }
  )
  assert.equal(delSourceRes.status, 200)

  const sourcesAfter = await sourcesRoute.GET({}, { params: Promise.resolve({ id: sharedNotebookId }) })
  assert.equal(sourcesAfter.body.sources.length, 2)

  fs.rmSync(tempStorageRoot, { recursive: true, force: true })
})
