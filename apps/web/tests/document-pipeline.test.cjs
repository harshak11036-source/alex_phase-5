const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const zlib = require('node:zlib')
const crypto = require('node:crypto')
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

const tempStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-doc-pipeline-test-'))
process.env.STORAGE_MODE = 'local'
process.env.STORAGE_LOCAL_ROOT = tempStorageRoot
process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long-99999'

// ============================================================================
// Helper: Build valid ZIP archive buffer (for .docx, .xlsx, .pptx)
// ============================================================================

function createZipBuffer(files) {
  const localFileParts = []
  const centralDirParts = []
  let offset = 0

  for (const { name, content } of files) {
    const nameBuf = Buffer.from(name, 'utf8')
    const rawBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
    const compressed = zlib.deflateRawSync(rawBuf)

    // CRC32 calculation
    let crc = 0xffffffff
    for (let i = 0; i < rawBuf.length; i++) {
      crc ^= rawBuf[i]
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(8, 8) // Deflate
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(rawBuf.length, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localFileParts.push(localHeader, nameBuf, compressed)

    // Central directory header (46 bytes + name)
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

// ============================================================================
// Helper: Build Representative Multi-Page PDF, DOCX, XLSX, PPTX, PNG, JPEG
// ============================================================================

function buildRepresentativePdfBuffer() {
  const page1Stream = zlib.deflateSync(
    Buffer.from(
      'BT\n/F1 12 Tf\n72 720 Td\n(Thermodynamics First Law: dU = dQ - dW conservation of internal energy.) Tj\nT*\n(Enthalpy definition: H = U + P * V for constant pressure processes.) Tj\nET',
      'latin1'
    )
  )
  const page2Stream = zlib.deflateSync(
    Buffer.from(
      'BT\n/F1 12 Tf\n72 720 Td\n(Second Law and Carnot Efficiency: eta_max = 1 - T_cold / T_hot.) Tj\nT*\n(Entropy change dS >= dQ / T_reversible in isolated systems.) Tj\nET',
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

function buildRepresentativeDocxBuffer() {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Operating Systems Deadlock Prevention Guide</w:t></w:r></w:p>
    <w:p><w:r><w:t>Coffman four conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.</w:t></w:r></w:p>
    <w:br w:type="page"/>
    <w:p><w:r><w:t>Banker Algorithm checks safety state using Available, Max, Allocation, and Need matrices.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Process</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Max Need</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>P0</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>7 instances</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
  return createZipBuffer([{ name: 'word/document.xml', content: docXml }])
}

function buildRepresentativeXlsxBuffer() {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets>
    <sheet name="LabScores" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>Experiment</t></si>
  <si><t>Voltage_V</t></si>
  <si><t>Current_mA</t></si>
  <si><t>OhmLaw_Trial_Alpha</t></si>
</sst>`
  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2" t="n"><v>12.5</v></c>
      <c r="C2" t="n"><v>250</v></c>
    </row>
  </sheetData>
</worksheet>`
  return createZipBuffer([
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/sharedStrings.xml', content: sharedStringsXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
  ])
}

function buildRepresentativePptxBuffer() {
  const slide1 = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>Neural Network Backpropagation Lecture</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`
  const slide2 = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>Chain Rule Gradient Descent: w_new = w_old - eta * dL/dw</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`
  const notes1 = `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <a:p><a:r><a:t>Emphasize vanishing gradients in deep sigmoid networks.</a:t></a:r></a:p>
</p:notes>`
  return createZipBuffer([
    { name: 'ppt/slides/slide1.xml', content: slide1 },
    { name: 'ppt/slides/slide2.xml', content: slide2 },
    { name: 'ppt/notesSlides/notesSlide1.xml', content: notes1 },
  ])
}

function buildRepresentativePngBuffer() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(640, 0)
  ihdrData.writeUInt32BE(480, 4)
  ihdrData[8] = 8
  ihdrData[9] = 2
  const ihdrLen = Buffer.alloc(4)
  ihdrLen.writeUInt32BE(13, 0)
  const ihdrChunk = Buffer.concat([ihdrLen, Buffer.from('IHDR'), ihdrData, Buffer.alloc(4)])

  const textPayload = Buffer.from(
    'Description\0Krebs Citric Acid Cycle ATP Yield Diagram: 3 NADH, 1 FADH2, 1 GTP per Acetyl-CoA',
    'utf8'
  )
  const textLen = Buffer.alloc(4)
  textLen.writeUInt32BE(textPayload.length, 0)
  const textChunk = Buffer.concat([textLen, Buffer.from('tEXt'), textPayload, Buffer.alloc(4)])

  const iendChunk = Buffer.concat([Buffer.alloc(4), Buffer.from('IEND'), Buffer.alloc(4)])
  return Buffer.concat([signature, ihdrChunk, textChunk, iendChunk])
}

function buildRepresentativeJpegBuffer() {
  const soi = Buffer.from([0xff, 0xd8])
  const commentText = Buffer.from('Maxwell Equations Summary Chart: Gauss, Faraday, and Ampere-Maxwell Laws', 'utf8')
  const comHeader = Buffer.alloc(4)
  comHeader[0] = 0xff
  comHeader[1] = 0xfe
  comHeader.writeUInt16BE(commentText.length + 2, 2)
  const eoi = Buffer.from([0xff, 0xd9])
  return Buffer.concat([soi, comHeader, commentText, eoi])
}

// ============================================================================
// In-Memory Prisma Store for Full Upload -> Processing -> Storage -> AI E2E
// ============================================================================

const store = {
  users: {
    user_owner: {
      id: 'user_owner',
      email: 'owner@alex.edu',
      firstName: 'Aarav',
      lastName: 'Sharma',
      role: 'STUDENT',
      isActive: true,
      memberships: [{ id: 'm1', userId: 'user_owner', institutionId: 'inst_1', role: 'STUDENT', status: 'ACTIVE' }],
    },
    user_outsider: {
      id: 'user_outsider',
      email: 'outsider@alex.edu',
      firstName: 'Vikram',
      lastName: 'Patel',
      role: 'STUDENT',
      isActive: true,
      memberships: [{ id: 'm2', userId: 'user_outsider', institutionId: 'inst_1', role: 'STUDENT', status: 'ACTIVE' }],
    },
    user_classmate: {
      id: 'user_classmate',
      email: 'classmate@alex.edu',
      firstName: 'Meera',
      lastName: 'Nair',
      role: 'STUDENT',
      isActive: true,
      memberships: [{ id: 'm3', userId: 'user_classmate', institutionId: 'inst_1', role: 'STUDENT', status: 'ACTIVE' }],
    },
  },
  enrollments: [
    { id: 'enr_1', userId: 'user_owner', subjectId: 'subj_thermo', isActive: true },
    { id: 'enr_2', userId: 'user_classmate', subjectId: 'subj_thermo', isActive: true },
  ],
  lecturerAssignments: [],
  projectMembers: [{ id: 'pm_1', userId: 'user_owner', projectId: 'proj_1' }],
  notebooks: [{ id: 'nb_1', title: 'Thermo Lab Notebook', ownerId: 'user_owner', isPublic: false }],
  researchSources: [],
  credentials: [],
  modelConfigs: [],
  documents: [],
  chunks: [],
  jobs: [],
  studyMaterials: [],
  flashcardDecks: [],
  quizzes: [],
  mindMaps: [],
  diagrams: [],
  conversations: [],
  messages: [],
}

let activeSessionToken = ''

function matchesDocumentWhere(doc, where) {
  if (!where) return true
  if (where.id) {
    if (typeof where.id === 'string' && doc.id !== where.id) return false
    if (where.id.in && !where.id.in.includes(doc.id)) return false
  }
  if (where.ownerId && doc.ownerId !== where.ownerId) return false
  if (where.subjectId && doc.subjectId !== where.subjectId) return false
  if (where.projectId && doc.projectId !== where.projectId) return false
  if (where.notebookId && doc.notebookId !== where.notebookId) return false
  if (where.status && doc.status !== where.status) return false
  if (where.storageBucket && doc.storageBucket !== where.storageBucket) return false

  if (Array.isArray(where.AND)) {
    return where.AND.every(sub => matchesDocumentWhere(doc, sub))
  }

  if (Array.isArray(where.OR)) {
    return where.OR.some(branch => {
      if (branch.ownerId) return doc.ownerId === branch.ownerId
      if (branch.storagePath) return doc.storagePath === branch.storagePath
      if (branch.subject?.enrollments?.some) {
        const { userId, isActive } = branch.subject.enrollments.some
        return (
          Boolean(doc.subjectId) &&
          store.enrollments.some(
            e =>
              e.subjectId === doc.subjectId &&
              e.userId === userId &&
              (isActive === undefined || e.isActive === isActive)
          )
        )
      }
      if (branch.subject?.lecturers?.some) {
        const { userId } = branch.subject.lecturers.some
        return (
          Boolean(doc.subjectId) &&
          store.lecturerAssignments.some(l => l.subjectId === doc.subjectId && l.userId === userId)
        )
      }
      if (branch.project?.members?.some) {
        const { userId } = branch.project.members.some
        return (
          Boolean(doc.projectId) &&
          store.projectMembers.some(m => m.projectId === doc.projectId && m.userId === userId)
        )
      }
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
      if (branch.title?.contains) {
        return doc.title.toLowerCase().includes(branch.title.contains.toLowerCase())
      }
      if (branch.fileName?.contains) {
        return doc.fileName.toLowerCase().includes(branch.fileName.contains.toLowerCase())
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
  subjectEnrollment: {
    findFirst: async ({ where }) =>
      store.enrollments.find(
        e =>
          e.userId === where.userId &&
          e.subjectId === where.subjectId &&
          (where.isActive === undefined || e.isActive === where.isActive)
      ) || null,
    findMany: async () => [],
  },
  lecturerAssignment: {
    findFirst: async ({ where }) =>
      store.lecturerAssignments.find(l => l.userId === where.userId && l.subjectId === where.subjectId) || null,
  },
  projectMember: {
    findFirst: async ({ where }) =>
      store.projectMembers.find(m => m.userId === where.userId && m.projectId === where.projectId) || null,
  },
  researchNotebook: {
    findFirst: async ({ where }) =>
      store.notebooks.find(n => {
        if (where.id && n.id !== where.id) return false
        if (where.ownerId && n.ownerId !== where.ownerId) return false
        if (where.isPublic !== undefined && n.isPublic !== where.isPublic) return false
        if (Array.isArray(where.OR)) {
          return where.OR.some(
            b => (b.ownerId && n.ownerId === b.ownerId) || (b.isPublic !== undefined && n.isPublic === b.isPublic)
          )
        }
        return true
      }) || null,
  },
  researchSource: {
    create: async ({ data }) => {
      const s = { id: `src_${Date.now()}`, ...data, createdAt: new Date() }
      store.researchSources.push(s)
      return s
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
  aIModelConfig: {
    findFirst: async () => null,
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
    findUnique: async ({ where, include }) => {
      const doc = store.documents.find(d => d.id === where.id)
      if (!doc) return null
      const docChunks = store.chunks
        .filter(c => c.documentId === doc.id)
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
      const docJobs = store.jobs.filter(j => j.documentId === doc.id)
      return {
        ...doc,
        ...(include?.chunks ? { chunks: docChunks } : {}),
        ...(include?.processingJobs ? { processingJobs: docJobs } : {}),
        ...(include?.versions ? { versions: [] } : {}),
        ...(include?._count ? { _count: { chunks: docChunks.length } } : {}),
        subject: doc.subjectId ? { id: doc.subjectId, name: 'Thermodynamics', code: 'ME201' } : null,
        project: doc.projectId ? { id: doc.projectId, title: 'Project 1' } : null,
        notebook: doc.notebookId ? { id: doc.notebookId, title: 'Thermo Lab Notebook' } : null,
      }
    },
    findFirst: async ({ where, include }) => {
      const doc = store.documents.find(d => matchesDocumentWhere(d, where))
      if (!doc) return null
      const docChunks = store.chunks
        .filter(c => c.documentId === doc.id)
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
      return {
        ...doc,
        ...(include?.chunks ? { chunks: docChunks } : {}),
        _count: { chunks: docChunks.length },
      }
    },
    findMany: async ({ where }) => {
      const matched = store.documents.filter(d => matchesDocumentWhere(d, where))
      return matched.map(doc => {
        const docChunks = store.chunks.filter(c => c.documentId === doc.id)
        return {
          ...doc,
          subject: doc.subjectId ? { id: doc.subjectId, name: 'Thermodynamics', code: 'ME201' } : null,
          project: doc.projectId ? { id: doc.projectId, title: 'Project 1' } : null,
          notebook: doc.notebookId ? { id: doc.notebookId, title: 'Thermo Lab Notebook' } : null,
          _count: { chunks: docChunks.length },
        }
      })
    },
    count: async ({ where }) => store.documents.filter(d => matchesDocumentWhere(d, where)).length,
    delete: async ({ where }) => {
      store.documents = store.documents.filter(d => d.id !== where.id)
      return {}
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
    deleteMany: async ({ where }) => {
      store.chunks = store.chunks.filter(c => c.documentId !== where.documentId)
      return {}
    },
  },
  documentProcessingJob: {
    create: async ({ data }) => {
      const job = { id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, createdAt: new Date(), ...data }
      store.jobs.push(job)
      return job
    },
    deleteMany: async ({ where }) => {
      store.jobs = store.jobs.filter(j => j.documentId !== where.documentId)
      return {}
    },
  },
  studyMaterial: {
    create: async ({ data }) => {
      const mat = { id: `mat_${Date.now()}`, ...data, createdAt: new Date() }
      store.studyMaterials.push(mat)
      return mat
    },
  },
  flashcardDeck: {
    create: async ({ data }) => {
      const cards = (data.cards?.create || []).map((c, idx) => ({ id: `fc_${idx}`, ...c }))
      const deck = { id: `deck_${Date.now()}`, ...data, cards, _count: { cards: cards.length } }
      store.flashcardDecks.push(deck)
      return deck
    },
  },
  quiz: {
    create: async ({ data }) => {
      const q = { id: `quiz_${Date.now()}`, ...data }
      store.quizzes.push(q)
      return q
    },
  },
  mindMap: {
    create: async ({ data }) => {
      const m = { id: `mm_${Date.now()}`, ...data }
      store.mindMaps.push(m)
      return m
    },
  },
  diagram: {
    create: async ({ data }) => {
      const d = { id: `diag_${Date.now()}`, ...data }
      store.diagrams.push(d)
      return d
    },
  },
  conversation: {
    findUnique: async () => null,
    create: async ({ data }) => ({ id: `conv_${Date.now()}`, ...data }),
  },
  message: {
    createMany: async () => ({ count: 2 }),
  },
  userMemory: { findMany: async () => [] },
  assignment: { findMany: async () => [] },
  attendanceRecord: { findMany: async () => [] },
  plannerEvent: { findMany: async () => [] },
}

class CustomNextResponse {
  constructor(body, init = {}) {
    this.rawBody = body
    this.status = init.status || 200
    this.headers = new Map(Object.entries(init.headers || {}))
  }
  async arrayBuffer() {
    return this.rawBody.buffer.slice(
      this.rawBody.byteOffset,
      this.rawBody.byteOffset + this.rawBody.byteLength
    )
  }
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
  static redirect(url, status = 307) {
    return {
      status,
      headers: new Map([['location', String(url)]]),
      url: String(url),
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
switchUser('user_owner')

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

// ============================================================================
// Test 1: Representative Multi-Format File Upload, Storage, Parsing & Retrieval
// ============================================================================

test('Document Pipeline E2E: uploads, validates, stores, extracts text, chunks, indexes, and retrieves PDF, DOCX, DOC, XLSX, CSV, PPTX, MD, TXT, PNG, and JPEG files', async () => {
  const docsRoute = require(path.join(srcRoot, 'app/api/documents/route.ts'))
  const docByIdRoute = require(path.join(srcRoot, 'app/api/documents/[id]/route.ts'))
  const downloadRoute = require(path.join(srcRoot, 'app/api/documents/[id]/download/route.ts'))
  const localServeRoute = require(path.join(srcRoot, 'app/api/documents/local/[...path]/route.ts'))

  process.env.AI_MODE = 'mock'

  const representativeFiles = [
    {
      name: 'thermodynamics_lecture.pdf',
      type: 'application/pdf',
      buffer: buildRepresentativePdfBuffer(),
      expectedType: 'PDF',
      expectedMinPages: 2,
      expectedSubstring: 'Thermodynamics First Law: dU = dQ - dW',
    },
    {
      name: 'os_deadlocks.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildRepresentativeDocxBuffer(),
      expectedType: 'DOCX',
      expectedMinPages: 2,
      expectedSubstring: 'Banker Algorithm checks safety state',
    },
    {
      name: 'legacy_notes.doc',
      type: 'application/msword',
      buffer: Buffer.from(
        '{\\rtf1\\ansi\\deff0 Fourier Series expansion represents periodic functions as sums of sines and cosines.\\par}',
        'latin1'
      ),
      expectedType: 'DOC',
      expectedMinPages: 1,
      expectedSubstring: 'Fourier Series expansion',
    },
    {
      name: 'circuit_lab_data.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildRepresentativeXlsxBuffer(),
      expectedType: 'XLSX',
      expectedMinPages: 1,
      expectedSubstring: 'OhmLaw_Trial_Alpha',
    },
    {
      name: 'titration_results.csv',
      type: 'text/csv',
      buffer: Buffer.from('Sample,pH,Molarity_M\n"Buffer A, Acetate",4.76,0.10\n"Buffer B, Phosphate",7.20,0.25\n', 'utf8'),
      expectedType: 'CSV',
      expectedMinPages: 1,
      expectedSubstring: 'Buffer A, Acetate',
    },
    {
      name: 'deep_learning_slides.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: buildRepresentativePptxBuffer(),
      expectedType: 'PPTX',
      expectedMinPages: 2,
      expectedSubstring: 'Chain Rule Gradient Descent',
    },
    {
      name: 'algorithms_cheatsheet.md',
      type: 'text/markdown',
      buffer: Buffer.from(
        '# Dijkstra Shortest Path\n\nUses a min-priority queue to achieve O((V + E) log V) time complexity on non-negative weighted graphs.',
        'utf8'
      ),
      expectedType: 'MARKDOWN',
      expectedMinPages: 1,
      expectedSubstring: 'Dijkstra Shortest Path',
    },
    {
      name: 'lab_procedure.txt',
      type: 'text/plain',
      buffer: Buffer.from('Step 1: Calibrate the spectrophotometer at 540 nm wavelength before measuring absorbance.', 'utf8'),
      expectedType: 'TXT',
      expectedMinPages: 1,
      expectedSubstring: 'spectrophotometer at 540 nm',
    },
    {
      name: 'krebs_cycle_diagram.png',
      type: 'image/png',
      buffer: buildRepresentativePngBuffer(),
      expectedType: 'PNG',
      expectedMinPages: 1,
      expectedSubstring: 'Krebs Citric Acid Cycle',
    },
    {
      name: 'maxwell_chart.jpg',
      type: 'image/jpeg',
      buffer: buildRepresentativeJpegBuffer(),
      expectedType: 'JPG',
      expectedMinPages: 1,
      expectedSubstring: 'Maxwell Equations Summary Chart',
    },
  ]

  for (const item of representativeFiles) {
    const uploadRes = await docsRoute.POST(
      makeUploadRequest(item, { subjectId: 'subj_thermo', notebookId: 'nb_1' })
    )
    assert.equal(uploadRes.status, 200, `Upload failed for ${item.name}: ${JSON.stringify(uploadRes.body)}`)
    const doc = uploadRes.body.document
    assert.equal(doc.status, 'READY', `Expected status READY for ${item.name}, got ${doc.status}`)
    assert.equal(doc.documentType, item.expectedType)
    assert.ok(
      doc.pageCount >= item.expectedMinPages,
      `Expected >= ${item.expectedMinPages} pages for ${item.name}, got ${doc.pageCount}`
    )
    assert.ok(doc.chunksCount >= 1, `Expected >= 1 chunk for ${item.name}`)

    // Verify GET /api/documents/[id] returns extracted text & chunks
    const detailRes = await docByIdRoute.GET({}, { params: Promise.resolve({ id: doc.id }) })
    assert.equal(detailRes.status, 200)
    assert.ok(
      detailRes.body.document.extractedText.includes(item.expectedSubstring),
      `Expected extractedText for ${item.name} to include "${item.expectedSubstring}", got: ${detailRes.body.document.extractedText}`
    )

    // Verify GET /api/documents/[id]/download redirects and GET /api/documents/local/[...path] returns exact stored bytes
    const dlRes = await downloadRoute.GET(
      { url: `http://localhost:3000/api/documents/${doc.id}/download` },
      { params: Promise.resolve({ id: doc.id }) }
    )
    assert.equal(dlRes.status, 307)
    const redirectUrl = new URL(dlRes.url)
    const pathParts = redirectUrl.pathname.replace(/^\/api\/documents\/local\//, '').split('/')
    const fileRes = await localServeRoute.GET({}, { params: Promise.resolve({ path: pathParts }) })
    assert.equal(fileRes.status, 200)
    const servedBytes = Buffer.from(await fileRes.arrayBuffer())
    assert.equal(
      crypto.createHash('sha256').update(servedBytes).digest('hex'),
      crypto.createHash('sha256').update(item.buffer).digest('hex'),
      `Stored file checksum mismatch for ${item.name}`
    )
  }
})

// ============================================================================
// Test 2: File Size, Type & Magic-Byte Validation (Never Reports False Success)
// ============================================================================

test('Document Pipeline Validation: rejects missing, empty, oversized, unsupported, and corrupted files with clear errors', async () => {
  const docsRoute = require(path.join(srcRoot, 'app/api/documents/route.ts'))

  // 1. Missing file -> 400 MISSING_FILE
  const noFileRes = await docsRoute.POST(makeUploadRequest(null))
  assert.equal(noFileRes.status, 400)
  assert.equal(noFileRes.body.code, 'MISSING_FILE')

  // 2. Empty 0-byte file -> 400 EMPTY_FILE
  const emptyRes = await docsRoute.POST(
    makeUploadRequest({ name: 'empty.pdf', type: 'application/pdf', buffer: Buffer.alloc(0) })
  )
  assert.equal(emptyRes.status, 400)
  assert.equal(emptyRes.body.code, 'EMPTY_FILE')

  // 3. Oversized file -> 413 FILE_TOO_LARGE
  process.env.MAX_FILE_SIZE_MB = '1'
  try {
    const bigBuffer = Buffer.alloc(1.5 * 1024 * 1024, 'a')
    const bigRes = await docsRoute.POST(
      makeUploadRequest({ name: 'huge_notes.txt', type: 'text/plain', buffer: bigBuffer })
    )
    assert.equal(bigRes.status, 413)
    assert.equal(bigRes.body.code, 'FILE_TOO_LARGE')
  } finally {
    process.env.MAX_FILE_SIZE_MB = '50'
  }

  // 4. Unsupported extension (.exe) -> 400 UNSUPPORTED_FILE_TYPE
  const exeRes = await docsRoute.POST(
    makeUploadRequest({ name: 'malware.exe', type: 'application/x-msdownload', buffer: Buffer.from('MZ9000') })
  )
  assert.equal(exeRes.status, 400)
  assert.equal(exeRes.body.code, 'UNSUPPORTED_FILE_TYPE')

  // 5. Corrupted PDF (missing %PDF- signature) -> 422 CORRUPTED_FILE
  const badPdfRes = await docsRoute.POST(
    makeUploadRequest({ name: 'spoofed.pdf', type: 'application/pdf', buffer: Buffer.from('NOT_A_PDF_HEADER') })
  )
  assert.equal(badPdfRes.status, 422)
  assert.equal(badPdfRes.body.code, 'CORRUPTED_FILE')

  // 6. Whitespace-only text file -> 422 PROCESSING_FAILED with status FAILED
  const whitespaceRes = await docsRoute.POST(
    makeUploadRequest({ name: 'blank.txt', type: 'text/plain', buffer: Buffer.from('   \n\t  ') })
  )
  assert.equal(whitespaceRes.status, 422)
  assert.equal(whitespaceRes.body.code, 'PROCESSING_FAILED')
  assert.equal(whitespaceRes.body.document.status, 'FAILED')
})

// ============================================================================
// Test 3: Secure Access Controls Across Upload, Retrieval, Download & AI Routes
// ============================================================================

test('Document Pipeline Security: enforces access control across upload targets, document viewing, download, deletion, and AI endpoints', async () => {
  const docsRoute = require(path.join(srcRoot, 'app/api/documents/route.ts'))
  const docByIdRoute = require(path.join(srcRoot, 'app/api/documents/[id]/route.ts'))
  const downloadRoute = require(path.join(srcRoot, 'app/api/documents/[id]/download/route.ts'))
  const studyMatRoute = require(path.join(srcRoot, 'app/api/study-materials/generate/route.ts'))
  const flashcardsRoute = require(path.join(srcRoot, 'app/api/flashcards/generate/route.ts'))
  const solutionsRoute = require(path.join(srcRoot, 'app/api/solutions/generate/route.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))

  // Upload a private personal document as user_owner
  switchUser('user_owner')
  const privateUpload = await docsRoute.POST(
    makeUploadRequest({
      name: 'private_research.md',
      type: 'text/markdown',
      buffer: Buffer.from('# Secret Quantum Key Distribution\n\nBB84 protocol uses polarized photons.', 'utf8'),
    })
  )
  assert.equal(privateUpload.status, 200)
  const privateDocId = privateUpload.body.document.id

  // Also find a shared subject document uploaded in Test 1 (subjectId: 'subj_thermo')
  const sharedSubjectDoc = store.documents.find(d => d.subjectId === 'subj_thermo' && d.status === 'READY')
  assert.ok(sharedSubjectDoc)

  // Switch to user_outsider (not enrolled in subj_thermo, not owner of privateDocId)
  switchUser('user_outsider')

  // Outsider cannot view, download, or delete privateDocId
  const viewDenied = await docByIdRoute.GET({}, { params: Promise.resolve({ id: privateDocId }) })
  assert.equal(viewDenied.status, 403)

  const dlDenied = await downloadRoute.GET(
    { url: `http://localhost:3000/api/documents/${privateDocId}/download` },
    { params: Promise.resolve({ id: privateDocId }) }
  )
  assert.equal(dlDenied.status, 403)

  const delDenied = await docByIdRoute.DELETE({}, { params: Promise.resolve({ id: privateDocId }) })
  assert.equal(delDenied.status, 403)

  // Outsider cannot upload to subj_thermo or nb_1
  const uploadForbidden = await docsRoute.POST(
    makeUploadRequest(
      { name: 'intruder.txt', type: 'text/plain', buffer: Buffer.from('Unauthorized upload') },
      { subjectId: 'subj_thermo' }
    )
  )
  assert.equal(uploadForbidden.status, 403)

  // Outsider cannot run AI summarization, flashcards, solutions, or RAG query on privateDocId
  const studyForbidden = await studyMatRoute.POST({
    json: async () => ({ sourceDocId: privateDocId, type: 'concise' }),
  })
  assert.equal(studyForbidden.status, 403)

  const fcForbidden = await flashcardsRoute.POST({
    json: async () => ({ sourceDocId: privateDocId, count: 5 }),
  })
  assert.equal(fcForbidden.status, 403)

  const solForbidden = await solutionsRoute.POST({
    json: async () => ({ question: 'What is BB84?', sourceDocumentIds: [privateDocId] }),
  })
  assert.equal(solForbidden.status, 403)

  const ragForbidden = await ragQueryRoute.POST({
    json: async () => ({ query: 'Explain BB84 protocol', documentIds: [privateDocId] }),
  })
  assert.equal(ragForbidden.status, 403)

  // Switch to user_classmate (enrolled in subj_thermo) -> CAN view & download sharedSubjectDoc, CANNOT delete it
  switchUser('user_classmate')
  const classmateView = await docByIdRoute.GET({}, { params: Promise.resolve({ id: sharedSubjectDoc.id }) })
  assert.equal(classmateView.status, 200)

  const classmateDelete = await docByIdRoute.DELETE({}, { params: Promise.resolve({ id: sharedSubjectDoc.id }) })
  assert.equal(classmateDelete.status, 403)

  switchUser('user_owner')
})

// ============================================================================
// Test 4: Uploaded Documents Connected to Live AI Engine (Summarize, Analyze, Query)
// ============================================================================

test('Document Pipeline -> AI Engine E2E: summarizes, analyzes, generates flashcards/solutions, and answers RAG queries from newly uploaded PDF, DOCX, XLSX, and PPTX files', async () => {
  const credsRoute = require(path.join(srcRoot, 'app/api/ai/credentials/route.ts'))
  const studyMatRoute = require(path.join(srcRoot, 'app/api/study-materials/generate/route.ts'))
  const flashcardsRoute = require(path.join(srcRoot, 'app/api/flashcards/generate/route.ts'))
  const solutionsRoute = require(path.join(srcRoot, 'app/api/solutions/generate/route.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))
  const docGenRoute = require(path.join(srcRoot, 'app/api/documents/generate/route.ts'))

  switchUser('user_owner')

  const capturedPrompts = []

  const aiServer = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}

      if (req.url.endsWith('/embeddings')) {
        const inputs = Array.isArray(body.input) ? body.input : [String(body.input || '')]
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            data: inputs.map((_, index) => ({
              index,
              embedding: new Array(1536).fill(0.025),
            })),
            usage: { prompt_tokens: 15, total_tokens: 15 },
          })
        )
        return
      }

      const messages = body.messages || []
      const sys = messages.find(m => m.role === 'system')?.content || ''
      const userPrompt = messages.find(m => m.role === 'user')?.content || ''
      capturedPrompts.push({ sys, userPrompt })

      let reply = 'Verified AI response'
      if (/summarization assistant/i.test(sys)) {
        reply =
          '### Thermodynamics Summary\n- **First Law**: $dU = dQ - dW$ [Source 1]\n- **Carnot Efficiency**: $\\eta_{max} = 1 - T_{cold}/T_{hot}$ [Source 2]'
      } else if (/flashcard/i.test(sys)) {
        reply = JSON.stringify({
          cards: [
            {
              front: 'What are the four Coffman deadlock conditions?',
              back: 'Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait [Source 1].',
            },
          ],
        })
      } else if (/solution generator/i.test(sys)) {
        reply = JSON.stringify({
          questionNumber: '1',
          originalQuestion: 'Calculate resistance from Voltage_V and Current_mA in OhmLaw_Trial_Alpha',
          topic: 'Ohm Law Circuit Analysis',
          explanation: 'Using V = 12.5 V and I = 250 mA (0.25 A) from LabScores [Source 1], R = V / I = 50 Ohms.',
          definitions: ['Ohm Law: R = V / I'],
          formulas: ['R = 12.5 / 0.25 = 50 Ohms'],
          calculations: '12.5 V / 0.25 A = 50 Ohms',
          tables: [],
          diagrams: [],
          finalAnswer: 'R = 50 Ohms [Source 1].',
        })
      } else {
        reply =
          'According to the uploaded thermodynamics and backpropagation documents, the First Law is dU = dQ - dW [Source 1] and gradient descent updates weights via w_new = w_old - eta * dL/dw [Source 2].'
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: reply } }],
          usage: { prompt_tokens: 50, completion_tokens: 40, total_tokens: 90 },
        })
      )
    })
  })

  await new Promise(resolve => aiServer.listen(0, '127.0.0.1', resolve))
  const { port } = aiServer.address()

  process.env.AI_MODE = 'live'
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`

  try {
    await credsRoute.POST({
      json: async () => ({
        provider: 'OPENAI',
        providerName: 'Test OpenAI Key',
        apiKey: 'sk-proj-docPipelineKey123456',
        models: ['gpt-4o-mini'],
        isDefault: true,
      }),
    })

    const pdfDoc = store.documents.find(d => d.fileName === 'thermodynamics_lecture.pdf')
    const docxDoc = store.documents.find(d => d.fileName === 'os_deadlocks.docx')
    const xlsxDoc = store.documents.find(d => d.fileName === 'circuit_lab_data.xlsx')
    const pptxDoc = store.documents.find(d => d.fileName === 'deep_learning_slides.pptx')

    // 1. Summarize uploaded multi-page PDF
    const summaryRes = await studyMatRoute.POST({
      json: async () => ({ sourceDocId: pdfDoc.id, type: 'formulas' }),
    })
    assert.equal(summaryRes.status, 200)
    assert.ok(summaryRes.body.material.content.includes('Carnot Efficiency'))
    assert.ok(
      capturedPrompts.some(p => p.userPrompt.includes('Thermodynamics First Law: dU = dQ - dW')),
      'Expected AI prompt to contain extracted PDF text'
    )

    // 2. Generate flashcards from uploaded DOCX
    const fcRes = await flashcardsRoute.POST({
      json: async () => ({ sourceDocId: docxDoc.id, count: 5 }),
    })
    assert.equal(fcRes.status, 200)
    assert.equal(fcRes.body.deck.cards[0].front, 'What are the four Coffman deadlock conditions?')
    assert.ok(
      capturedPrompts.some(p => p.userPrompt.includes('Coffman four conditions')),
      'Expected AI prompt to contain extracted DOCX text'
    )

    // 3. Generate solution from uploaded XLSX spreadsheet
    const solRes = await solutionsRoute.POST({
      json: async () => ({
        question: 'Calculate resistance from Voltage_V and Current_mA in OhmLaw_Trial_Alpha',
        sourceDocumentIds: [xlsxDoc.id],
        answerMode: 'detailed',
      }),
    })
    assert.equal(solRes.status, 200)
    assert.ok(solRes.body.finalAnswer.includes('50 Ohms'))
    assert.ok(
      capturedPrompts.some(p => p.userPrompt.includes('OhmLaw_Trial_Alpha') && p.userPrompt.includes('250')),
      'Expected AI prompt to contain extracted XLSX cells'
    )

    // 4. Query uploaded PDF & PPTX via RAG Assistant (POST /api/rag/query)
    const ragRes = await ragQueryRoute.POST({
      json: async () => ({
        query: 'What is the First Law of Thermodynamics and the Chain Rule Gradient Descent update?',
        documentIds: [pdfDoc.id, pptxDoc.id],
      }),
    })
    assert.equal(ragRes.status, 200)
    assert.ok(ragRes.body.answer.includes('dU = dQ - dW'))
    assert.ok(ragRes.body.sources.length >= 2)

    // 5. Generate RAG-grounded document in Document Studio from uploaded PPTX
    const genDocRes = await docGenRoute.POST({
      json: async () => ({
        sourceType: 'rag',
        prompt: 'Summarize the backpropagation lecture slides and speaker notes',
        documentIds: [pptxDoc.id],
        outputFormat: 'markdown',
        includeCitations: true,
      }),
    })
    assert.equal(genDocRes.status, 200)
    assert.ok(genDocRes.body.metadata.sourcesUsed >= 1)
  } finally {
    delete process.env.OPENAI_BASE_URL
    await new Promise(resolve => aiServer.close(resolve))
    fs.rmSync(tempStorageRoot, { recursive: true, force: true })
  }
})
