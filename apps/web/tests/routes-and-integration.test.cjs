const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { deflateRawSync } = require('node:zlib')

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

// In-memory stateful database store for realistic route & integration testing
const dbState = {
  currentUser: {
    id: 'user_student_1',
    email: 'student@alex.edu',
    firstName: 'Aarav',
    lastName: 'Sharma',
    role: 'STUDENT',
    isActive: true,
    passwordHash: '$2a$12$mockhash',
    memberships: [
      {
        id: 'mem_1',
        userId: 'user_student_1',
        institutionId: 'inst_1',
        departmentId: 'dept_cs',
        courseId: 'course_btech',
        semesterId: 'sem_5',
        academicYearId: 'ay_2026',
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: 'CS2026001',
      },
    ],
  },
  institutions: [
    {
      id: 'inst_1',
      name: 'ALEX Institute of Technology',
      code: 'AIT',
      departments: [{ id: 'dept_cs', name: 'Computer Science', code: 'CS' }],
      courses: [{ id: 'course_btech', name: 'B.Tech CS', code: 'BTCS' }],
      semesters: [{ id: 'sem_5', name: 'Semester 5', number: 5, isActive: true }],
      academicYears: [{ id: 'ay_2026', name: '2026-2027', isActive: true }],
    },
  ],
  subjects: [
    {
      id: 'subj_cs301',
      name: 'Algorithms & Data Structures',
      code: 'CS301',
      institutionId: 'inst_1',
      departmentId: 'dept_cs',
      semesterId: 'sem_5',
      credits: 4,
      description: 'Core algorithms course',
      institution: { id: 'inst_1', name: 'ALEX Institute of Technology' },
      department: { id: 'dept_cs', name: 'Computer Science', code: 'CS' },
      semester: { id: 'sem_5', name: 'Semester 5', number: 5 },
      lecturers: [{ id: 'la_1', userId: 'user_lecturer_1', user: { id: 'user_lecturer_1', firstName: 'Priya', lastName: 'Nair' } }],
      enrollments: [{ id: 'enr_1', userId: 'user_student_1', subjectId: 'subj_cs301', isActive: true }],
      _count: { enrollments: 1, resources: 1 },
    },
  ],
  assignments: [
    {
      id: 'asgn_1',
      subjectId: 'subj_cs301',
      title: 'Graph Traversal Implementation',
      description: 'Implement BFS and DFS in TypeScript',
      instructions: 'Submit source code and complexity analysis',
      maxMarks: 100,
      weight: 1.0,
      assignedDate: new Date('2026-10-01T00:00:00Z'),
      dueDate: new Date('2026-11-15T23:59:59Z'),
      allowedFormats: ['PDF', 'DOCX', 'TXT'],
      allowResubmission: true,
      maxSubmissions: 3,
      isPublished: true,
      createdBy: 'user_lecturer_1',
      subject: { id: 'subj_cs301', name: 'Algorithms & Data Structures', code: 'CS301' },
      _count: { submissions: 0 },
    },
  ],
  submissions: [],
  assessments: [
    {
      id: 'assess_1',
      subjectId: 'subj_cs301',
      semesterId: 'sem_5',
      name: 'Midterm Exam 1',
      type: 'INTERNAL_ASSESSMENT',
      maxMarks: 50,
      weight: 1.0,
      assessmentDate: new Date('2026-11-01T10:00:00Z'),
      description: 'Covers Trees and Graphs',
      isPublished: true,
      publishedAt: new Date(),
      createdBy: 'user_lecturer_1',
      subject: { id: 'subj_cs301', name: 'Algorithms & Data Structures', code: 'CS301', semesterId: 'sem_5', institutionId: 'inst_1' },
      semester: { id: 'sem_5', name: 'Semester 5', number: 5 },
      results: [
        {
          id: 'res_1',
          assessmentId: 'assess_1',
          userId: 'user_student_1',
          marksObtained: 44,
          feedback: 'Excellent work on Dijkstra proof',
          isPublished: true,
          user: {
            id: 'user_student_1',
            firstName: 'Aarav',
            lastName: 'Sharma',
            email: 'student@alex.edu',
            memberships: [{ studentId: 'CS2026001' }],
          },
        },
      ],
      _count: { results: 1 },
    },
  ],
  attendanceSessions: [
    {
      id: 'sess_1',
      subjectId: 'subj_cs301',
      semesterId: 'sem_5',
      date: new Date(),
      period: 1,
      topic: 'Shortest Path Algorithms',
      conductedBy: 'user_lecturer_1',
      isCancelled: false,
      subject: { id: 'subj_cs301', name: 'Algorithms & Data Structures', code: 'CS301' },
      records: [
        {
          id: 'att_1',
          sessionId: 'sess_1',
          userId: 'user_student_1',
          status: 'PRESENT',
          markedBy: 'user_lecturer_1',
          markedAt: new Date(),
          user: {
            id: 'user_student_1',
            firstName: 'Aarav',
            lastName: 'Sharma',
            memberships: [{ studentId: 'CS2026001' }],
          },
        },
      ],
      _count: { records: 1 },
    },
  ],
  conversations: [],
  messages: [],
  documents: [
    {
      id: 'doc_algo',
      title: 'Lecture 4: Dijkstra & Bellman-Ford',
      description: 'Shortest path lecture notes',
      fileName: 'lecture4.pdf',
      fileSize: BigInt(2048576),
      mimeType: 'application/pdf',
      documentType: 'PDF',
      status: 'READY',
      errorMessage: null,
      pageCount: 12,
      metadata: {},
      ownerId: 'user_student_1',
      subjectId: 'subj_cs301',
      projectId: null,
      notebookId: 'nb_1',
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: new Date(),
      subject: { id: 'subj_cs301', name: 'Algorithms & Data Structures', code: 'CS301' },
      project: null,
      notebook: { id: 'nb_1', title: 'Graph Theory Research' },
      chunks: [
        {
          id: 'chunk_dijkstra',
          documentId: 'doc_algo',
          content: 'Dijkstra algorithm finds shortest paths from a source vertex in O((V + E) log V) time using a min-priority queue.',
          chunkIndex: 0,
          pageNumber: 4,
          sectionTitle: 'Dijkstra Complexity',
          tokenCount: 24,
        },
      ],
      processingJobs: [],
      versions: [
        {
          id: 'ver_1',
          documentId: 'doc_algo',
          version: 1,
          fileName: 'lecture4.pdf',
          fileSize: BigInt(2048576),
          storagePath: 'user_student_1/lecture4.pdf',
          checksum: 'abc123',
          createdBy: 'user_student_1',
          createdAt: new Date(),
        },
      ],
    },
  ],
  decks: [
    {
      id: 'deck_1',
      userId: 'user_student_1',
      title: 'Algorithms Deck',
      description: 'Key complexity bounds',
      subjectId: 'subj_cs301',
      sourceDocId: 'doc_algo',
      algorithm: 'SM2',
      cards: [
        {
          id: 'card_1',
          deckId: 'deck_1',
          front: 'What is Dijkstra time complexity?',
          back: 'O((V + E) log V)',
          difficulty: 0.3,
          interval: 1,
          repetitions: 1,
          easeFactor: 2.5,
          nextReview: new Date(),
          lastReviewed: null,
        },
      ],
      _count: { cards: 1 },
    },
  ],
  projects: [
    {
      id: 'proj_1',
      title: 'Autonomous Campus Rover',
      description: 'ROS2 navigation stack',
      category: 'ai-ml',
      tags: ['robotics', 'ai'],
      ownerId: 'user_student_1',
      status: 'ACTIVE',
      members: [
        {
          id: 'pm_1',
          projectId: 'proj_1',
          userId: 'user_student_1',
          role: 'OWNER',
          joinedAt: new Date(),
          user: { id: 'user_student_1', firstName: 'Aarav', lastName: 'Sharma', email: 'student@alex.edu', avatarUrl: null },
        },
      ],
      tasks: [],
      milestones: [],
      _count: { members: 1, tasks: 0, milestones: 0, documents: 0 },
    },
  ],
  notebooks: [
    {
      id: 'nb_1',
      title: 'Graph Theory Research',
      description: 'Shortest path heuristics',
      ownerId: 'user_student_1',
      projectId: 'proj_1',
      isPublic: false,
      sources: [],
      notes: [],
      documents: [],
      _count: { sources: 0, notes: 0 },
    },
  ],
  notifications: [
    {
      id: 'notif_1',
      userId: 'user_student_1',
      category: 'ASSIGNMENT',
      title: 'New Assignment Posted',
      message: 'Graph Traversal Implementation is due Nov 15',
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    },
  ],
  subjectResources: [
    {
      id: 'res_doc_1',
      subjectId: 'subj_cs301',
      title: 'Syllabus PDF',
      description: 'Course syllabus',
      category: 'SYLLABUS',
      fileName: 'syllabus.pdf',
      storagePath: 'subj_cs301/syllabus.pdf',
      fileSize: BigInt(512000),
      mimeType: 'application/pdf',
      version: 1,
      isPublished: true,
      uploadedBy: 'user_lecturer_1',
      createdAt: new Date(),
      uploader: { id: 'user_lecturer_1', firstName: 'Priya', lastName: 'Nair' },
    },
  ],
}

const mockPrisma = {
  $queryRaw: async () => [{ '?column?': 1 }],
  $transaction: async (fn) => fn(mockPrisma),
  user: {
    findUnique: async ({ where }) => {
      if (where.id === dbState.currentUser.id || where.email === dbState.currentUser.email) {
        return dbState.currentUser
      }
      if (where.email === 'teammate@alex.edu') {
        return { id: 'user_2', firstName: 'Diya', lastName: 'Patel', email: 'teammate@alex.edu', avatarUrl: null, role: 'STUDENT', isActive: true }
      }
      return null
    },
    create: async ({ data }) => ({ id: 'user_new', ...data, memberships: [] }),
    update: async ({ where, data }) => ({ ...dbState.currentUser, id: where.id, ...data }),
    count: async () => 42,
    findMany: async () => [dbState.currentUser],
  },
  institution: {
    findFirst: async () => dbState.institutions[0],
  },
  department: {
    count: async () => 4,
  },
  collegeMembership: {
    findFirst: async () => dbState.currentUser.memberships?.[0] || null,
    findMany: async () => [],
    create: async ({ data }) => ({ id: 'mem_new', ...data }),
  },
  subject: {
    findMany: async () => dbState.subjects.map(s => ({ ...s, attendanceSessions: dbState.attendanceSessions })),
    findUnique: async ({ where }) => dbState.subjects.find(s => s.id === where.id) || null,
    create: async ({ data }) => {
      const created = {
        id: `subj_${Date.now()}`,
        ...data,
        institution: dbState.institutions[0],
        department: dbState.institutions[0].departments[0],
        semester: dbState.institutions[0].semesters[0],
        lecturers: [],
        _count: { enrollments: 0, resources: 0 },
      }
      dbState.subjects.push(created)
      return created
    },
    count: async () => dbState.subjects.length,
  },
  subjectEnrollment: {
    findFirst: async () => ({ id: 'enr_1', userId: dbState.currentUser.id, subjectId: 'subj_cs301', isActive: true }),
    findMany: async () => [
      {
        id: 'enr_1',
        userId: dbState.currentUser.id,
        subjectId: 'subj_cs301',
        isActive: true,
        subject: {
          ...dbState.subjects[0],
          assignments: dbState.assignments,
          assessments: dbState.assessments,
          attendanceSessions: dbState.attendanceSessions,
        },
      },
    ],
  },
  lecturerAssignment: {
    findFirst: async () => ({ id: 'la_1', userId: dbState.currentUser.id, subjectId: 'subj_cs301' }),
    findMany: async () => [{ id: 'la_1', userId: dbState.currentUser.id, subjectId: 'subj_cs301' }],
  },
  subjectResource: {
    findMany: async () => dbState.subjectResources,
    create: async ({ data }) => {
      const created = { id: `sr_${Date.now()}`, ...data, createdAt: new Date() }
      dbState.subjectResources.push(created)
      return created
    },
  },
  assignment: {
    findMany: async () => dbState.assignments,
    findUnique: async ({ where }) => dbState.assignments.find(a => a.id === where.id) || null,
    create: async ({ data }) => {
      const created = {
        id: `asgn_${Date.now()}`,
        ...data,
        subject: { id: 'subj_cs301', name: 'Algorithms & Data Structures', code: 'CS301' },
        _count: { submissions: 0 },
      }
      dbState.assignments.push(created)
      return created
    },
  },
  assignmentSubmission: {
    findMany: async () => dbState.submissions,
    count: async () => dbState.submissions.length,
    create: async ({ data }) => {
      const created = {
        id: `sub_${Date.now()}`,
        ...data,
        user: { id: dbState.currentUser.id, firstName: dbState.currentUser.firstName, lastName: dbState.currentUser.lastName, email: dbState.currentUser.email },
        attachments: [],
      }
      dbState.submissions.push(created)
      return created
    },
  },
  submissionAttachment: {
    create: async ({ data }) => {
      const att = { id: `att_${Date.now()}`, ...data, createdAt: new Date() }
      const sub = dbState.submissions.find(s => s.id === data.submissionId)
      if (sub) sub.attachments.push(att)
      return att
    },
  },
  assessment: {
    findMany: async () => dbState.assessments,
    findUnique: async ({ where }) => dbState.assessments.find(a => a.id === where.id) || null,
    create: async ({ data }) => {
      const created = {
        id: `assess_${Date.now()}`,
        ...data,
        subject: { id: data.subjectId, name: 'Algorithms & Data Structures', code: 'CS301' },
        results: [],
        _count: { results: 0 },
      }
      dbState.assessments.push(created)
      return created
    },
    update: async ({ where, data }) => {
      const target = dbState.assessments.find(a => a.id === where.id)
      if (target) Object.assign(target, data)
      return target
    },
  },
  assessmentResult: {
    findMany: async () => dbState.assessments[0].results,
    upsert: async ({ create, update }) => ({ id: 'res_1', ...create, ...update }),
  },
  attendanceSession: {
    findMany: async () => dbState.attendanceSessions,
    create: async ({ data }) => {
      const created = {
        id: `sess_${Date.now()}`,
        subjectId: data.subjectId,
        semesterId: data.semesterId,
        date: data.date,
        period: data.period,
        topic: data.topic,
        conductedBy: data.conductedBy,
        isCancelled: false,
        subject: { id: 'subj_cs301', name: 'Algorithms & Data Structures', code: 'CS301' },
        records: (data.records?.create || []).map((r, i) => ({
          id: `rec_${i}`,
          sessionId: 'sess_new',
          ...r,
          user: { id: r.userId, firstName: 'Aarav', lastName: 'Sharma', memberships: [{ studentId: 'CS2026001' }] },
        })),
        _count: { records: 1 },
      }
      dbState.attendanceSessions.push(created)
      return created
    },
  },
  attendanceRecord: {
    findMany: async () => dbState.attendanceSessions[0].records.map(r => ({
      ...r,
      session: { subject: dbState.subjects[0] },
    })),
    upsert: async ({ create, update }) => ({ id: 'att_1', ...create, ...update }),
  },
  document: {
    count: async () => dbState.documents.length,
    findMany: async () => dbState.documents,
    findUnique: async ({ where }) => dbState.documents.find(d => d.id === where.id) || null,
    findFirst: async ({ where }) => dbState.documents.find(d => d.id === where?.id) || dbState.documents[0] || null,
    update: async ({ where, data }) => {
      const doc = dbState.documents.find(d => d.id === where.id)
      if (doc) Object.assign(doc, data)
      return doc
    },
    delete: async () => ({}),
  },
  documentChunk: {
    findMany: async () =>
      dbState.documents[0].chunks.map(c => ({
        ...c,
        embedding: null,
        metadata: {},
        document: {
          id: dbState.documents[0].id,
          title: dbState.documents[0].title,
          fileName: dbState.documents[0].fileName,
          documentType: dbState.documents[0].documentType,
          ownerId: dbState.documents[0].ownerId,
        },
      })),
    deleteMany: async () => ({ count: 1 }),
  },
  documentProcessingJob: {
    deleteMany: async () => ({ count: 0 }),
  },
  studyMaterial: {
    count: async () => 2,
    findMany: async () => [],
  },
  project: {
    count: async () => dbState.projects.length,
    findMany: async () => dbState.projects,
    findUnique: async ({ where }) => dbState.projects.find(p => p.id === where.id) || null,
  },
  projectTask: {
    findMany: async ({ where }) => dbState.projects.find(p => p.id === where.projectId)?.tasks || [],
    create: async ({ data }) => {
      const task = {
        id: `pt_${Date.now()}`,
        ...data,
        assignee: { id: dbState.currentUser.id, firstName: 'Aarav', lastName: 'Sharma' },
      }
      dbState.projects[0].tasks.push(task)
      return task
    },
    update: async ({ where, data }) => {
      const t = dbState.projects[0].tasks.find(item => item.id === where.id)
      if (t) Object.assign(t, data)
      return t
    },
  },
  projectMilestone: {
    findMany: async ({ where }) => dbState.projects.find(p => p.id === where.projectId)?.milestones || [],
    create: async ({ data }) => {
      const ms = { id: `pm_${Date.now()}`, isCompleted: false, ...data }
      dbState.projects[0].milestones.push(ms)
      return ms
    },
    update: async ({ where, data }) => {
      const ms = dbState.projects[0].milestones.find(item => item.id === where.id)
      if (ms) Object.assign(ms, data)
      return ms
    },
  },
  projectMember: {
    findFirst: async () => dbState.projects[0].members[0],
    findMany: async () => dbState.projects[0].members,
    upsert: async ({ create }) => {
      const member = {
        id: `mem_${Date.now()}`,
        ...create,
        joinedAt: new Date(),
        user: { id: create.userId, firstName: 'Diya', lastName: 'Patel', email: 'teammate@alex.edu', avatarUrl: null },
      }
      dbState.projects[0].members.push(member)
      return member
    },
  },
  researchNotebook: {
    findFirst: async () => dbState.notebooks[0],
    findUnique: async ({ where }) => {
      const nb = dbState.notebooks.find(n => n.id === where.id)
      if (!nb) return null
      return {
        ...nb,
        documents: dbState.documents.filter(d => d.notebookId === nb.id),
      }
    },
  },
  researchSource: {
    create: async ({ data }) => {
      const src = { id: `rsrc_${Date.now()}`, ...data, createdAt: new Date() }
      dbState.notebooks[0].sources.push(src)
      return src
    },
  },
  researchNote: {
    create: async ({ data }) => {
      const note = { id: `rnote_${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() }
      dbState.notebooks[0].notes.push(note)
      return note
    },
  },
  flashcardDeck: {
    findUnique: async ({ where }) => dbState.decks.find(d => d.id === where.id) || null,
  },
  flashcard: {
    create: async ({ data }) => {
      const card = {
        id: `card_${Date.now()}`,
        ...data,
        difficulty: 0,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: new Date(),
      }
      dbState.decks[0].cards.push(card)
      return card
    },
  },
  conversation: {
    findMany: async () => dbState.conversations,
    findUnique: async ({ where }) => {
      const c = dbState.conversations.find(conv => conv.id === where.id)
      if (!c) return null
      return {
        ...c,
        messages: dbState.messages.filter(m => m.conversationId === c.id),
        _count: { messages: dbState.messages.filter(m => m.conversationId === c.id).length },
      }
    },
    create: async ({ data }) => {
      const id = `conv_${Date.now()}`
      const createdMsgs = (data.messages?.create || []).map((m, i) => ({
        id: `msg_${Date.now()}_${i}`,
        conversationId: id,
        ...m,
        createdAt: new Date(),
      }))
      dbState.messages.push(...createdMsgs)
      const conv = {
        id,
        userId: data.userId,
        title: data.title,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { messages: createdMsgs.length },
      }
      dbState.conversations.push(conv)
      return conv
    },
    delete: async ({ where }) => {
      dbState.conversations = dbState.conversations.filter(c => c.id !== where.id)
      return {}
    },
  },
  message: {
    createMany: async ({ data }) => {
      for (const m of data) {
        dbState.messages.push({ id: `msg_${Date.now()}_${Math.random()}`, ...m, createdAt: new Date() })
      }
      return { count: data.length }
    },
  },
  userMemory: {
    findMany: async () => [{ id: 'mem_fact_1', userId: 'user_student_1', category: 'ACADEMIC_CONTEXT', key: 'major', value: 'Computer Science' }],
  },
  plannerEvent: {
    findMany: async () => [],
  },
  task: {
    findMany: async () => [],
  },
  notification: {
    findMany: async () => dbState.notifications,
    updateMany: async () => {
      let count = 0
      for (const n of dbState.notifications) {
        if (!n.isRead) {
          n.isRead = true
          n.readAt = new Date()
          count++
        }
      }
      return { count }
    },
  },
  aICredential: {
    findFirst: async () => null,
    findMany: async () => [],
  },
  aIModelConfig: {
    findFirst: async () => null,
  },
  auditLog: {
    create: async ({ data }) => ({ id: 'audit_1', ...data }),
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
      json: (body, init = {}) => {
        // Verify JSON serializability (catches any unserialized BigInt!)
        const serialized = JSON.parse(JSON.stringify(body))
        const cookiesMap = new Map()
        return {
          status: init.status || 200,
          headers: new Map(Object.entries(init.headers || {})),
          cookies: {
            set: (k, v, opts) => cookiesMap.set(k, { value: v, opts }),
            get: (k) => cookiesMap.get(k),
          },
          body: serialized,
          async json() {
            return serialized
          },
        }
      },
      redirect: (url, status = 307) => {
        const parsed = new URL(typeof url === 'string' ? url : url.toString())
        const cookiesMap = new Map()
        return {
          status,
          headers: new Map([['Location', parsed.toString()]]),
          cookies: {
            set: (k, v, opts) => cookiesMap.set(k, { value: v, opts }),
            get: (k) => cookiesMap.get(k),
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
  bcryptjs: {
    compare: async (plain, hashStr) => plain === 'correct-password' && Boolean(hashStr),
    hash: async (plain) => `hashed:${plain}`,
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

// Initialize session token for tests
process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
process.env.AI_MODE = 'mock'
const localAuth = require(path.join(srcRoot, 'lib/local-auth.ts'))
activeSessionToken = localAuth.createLocalSession('user_student_1')

// ============================================================================
// Route & Integration Verification Suite
// ============================================================================

test('1. Database health & BigInt JSON serialization safety', async () => {
  const prismaMod = require(path.join(srcRoot, 'lib/prisma.ts'))
  const healthRoute = require(path.join(srcRoot, 'app/api/health/route.ts'))

  const conn = await prismaMod.checkDatabaseConnection()
  assert.equal(conn.ok, true)

  const payload = { fileSize: BigInt(987654321), nested: [{ size: BigInt(1024) }] }
  const jsonStr = JSON.stringify(payload)
  assert.equal(JSON.parse(jsonStr).fileSize, 987654321)

  const healthRes = await healthRoute.GET()
  assert.equal(healthRes.status, 200)
  assert.equal(healthRes.body.status, 'ok')
  assert.equal(healthRes.body.database, 'ok')
})

test('2. Request timeout handling in AI fetchWithTimeout', async () => {
  const embeddingsLib = require(path.join(srcRoot, 'lib/ai/embeddings.ts'))
  const origFetch = global.fetch

  global.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      if (init?.signal) {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }
    })

  try {
    await assert.rejects(
      () => embeddingsLib.fetchWithTimeout('https://api.openai.com/v1/embeddings', { method: 'POST' }, 50),
      /timed out after 50ms/
    )
  } finally {
    global.fetch = origFetch
  }
})

test('3. Authentication routes: /api/auth/register, /api/auth/login, /api/auth/me, /api/auth/logout', async () => {
  const registerRoute = require(path.join(srcRoot, 'app/api/auth/register/route.ts'))
  const loginRoute = require(path.join(srcRoot, 'app/api/auth/login/route.ts'))
  const meRoute = require(path.join(srcRoot, 'app/api/auth/me/route.ts'))
  const logoutRoute = require(path.join(srcRoot, 'app/api/auth/logout/route.ts'))

  // Register new user with camelCase fields
  const regRes = await registerRoute.POST({
    json: async () => ({
      firstName: 'Neha',
      lastName: 'Verma',
      email: 'neha@alex.edu',
      password: 'securePassword123',
      role: 'STUDENT',
    }),
  })
  assert.equal(regRes.status, 200)
  assert.equal(regRes.body.ok, true)
  assert.equal(regRes.body.user.firstName, 'Neha')
  assert.ok(regRes.cookies.get('alex_local_session')?.value)

  // Login with existing user
  const loginRes = await loginRoute.POST({
    json: async () => ({
      email: 'student@alex.edu',
      password: 'correct-password',
    }),
  })
  assert.equal(loginRes.status, 200)
  assert.equal(loginRes.body.ok, true)

  // GET /api/auth/me
  const meRes = await meRoute.GET()
  assert.equal(meRes.status, 200)
  assert.equal(meRes.body.user.email, 'student@alex.edu')

  // Logout GET & POST
  const logoutGetRes = await logoutRoute.GET({ url: 'http://localhost:3000/api/auth/logout' })
  assert.equal(logoutGetRes.status, 307)
  assert.equal(logoutGetRes.headers.get('Location'), 'http://localhost:3000/login')

  const logoutPostRes = await logoutRoute.POST()
  assert.equal(logoutPostRes.status, 200)
  assert.equal(logoutPostRes.body.ok, true)
})

test('4. Dashboard stats route (/api/dashboard/stats) for STUDENT, LECTURER, and ADMIN roles', async () => {
  const dashboardStatsRoute = require(path.join(srcRoot, 'app/api/dashboard/stats/route.ts'))

  // STUDENT role
  dbState.currentUser.role = 'STUDENT'
  dbState.currentUser.memberships[0].role = 'STUDENT'
  const studentRes = await dashboardStatsRoute.GET()
  assert.equal(studentRes.status, 200)
  assert.equal(studentRes.body.role, 'STUDENT')
  assert.equal(studentRes.body.stats.documentsCount, 1)
  assert.equal(studentRes.body.upcomingDeadlines.length, 1)
  assert.equal(studentRes.body.attendanceSummary[0].percentage, 100)

  // LECTURER role
  dbState.currentUser.role = 'LECTURER'
  dbState.currentUser.memberships[0].role = 'LECTURER'
  const lecturerRes = await dashboardStatsRoute.GET()
  assert.equal(lecturerRes.status, 200)
  assert.equal(lecturerRes.body.role, 'LECTURER')
  assert.equal(lecturerRes.body.stats.assignedSubjects, 1)

  // ADMIN role
  dbState.currentUser.role = 'ADMIN'
  dbState.currentUser.memberships[0].role = 'ADMIN'
  const adminRes = await dashboardStatsRoute.GET()
  assert.equal(adminRes.status, 200)
  assert.equal(adminRes.body.role, 'ADMIN')
  assert.equal(adminRes.body.stats.totalStudents, 42)

  // Restore STUDENT role
  dbState.currentUser.role = 'STUDENT'
  dbState.currentUser.memberships[0].role = 'STUDENT'
})

test('5. Assignments routes: /api/assignments/my, /api/assignments/submit, /api/assignments/[id]/submissions', async () => {
  const myAssignmentsRoute = require(path.join(srcRoot, 'app/api/assignments/my/route.ts'))
  const submitRoute = require(path.join(srcRoot, 'app/api/assignments/submit/route.ts'))
  const submissionsRoute = require(path.join(srcRoot, 'app/api/assignments/[id]/submissions/route.ts'))
  const storageClient = require(path.join(srcRoot, 'lib/storage/client.ts'))

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-assign-test-'))
  process.env.STORAGE_MODE = 'local'
  process.env.STORAGE_LOCAL_ROOT = tempRoot
  storageClient.setStorageAdapter(null)

  try {
    const listRes = await myAssignmentsRoute.GET()
    assert.equal(listRes.status, 200)
    assert.equal(listRes.body.assignments.length, 1)
    assert.equal(listRes.body.assignments[0].title, 'Graph Traversal Implementation')

    // Submit assignment with attached file (tests File -> Buffer conversion & BigInt fileSize serialization)
    const mockFile = {
      name: 'bfs_dfs_solution.txt',
      size: 48,
      type: 'text/plain',
      arrayBuffer: async () => Buffer.from('function bfs(graph, root) { return [root]; }'),
    }
    const submitRes = await submitRoute.POST({
      headers: new Map([['content-type', 'multipart/form-data']]),
      formData: async () => ({
        get: (k) => (k === 'assignmentId' ? 'asgn_1' : k === 'content' ? 'Completed BFS and DFS' : null),
        getAll: (k) => (k === 'files' ? [mockFile] : []),
      }),
    })
    assert.equal(submitRes.status, 200)
    assert.equal(submitRes.body.submission.status, 'SUBMITTED')
    assert.equal(submitRes.body.submission.attachments.length, 1)
    assert.equal(submitRes.body.submission.attachments[0].fileSize, 48)

    // Fetch submissions and verify BigInt serialization + user relation
    const subsRes = await submissionsRoute.GET({}, { params: Promise.resolve({ id: 'asgn_1' }) })
    assert.equal(subsRes.status, 200)
    assert.equal(subsRes.body.submissions.length, 1)
    assert.equal(subsRes.body.submissions[0].user.firstName, 'Aarav')
    assert.equal(subsRes.body.submissions[0].attachments[0].fileSize, 48)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('6. AI Assistant & Conversations routes: /api/conversations, /api/rag/query, /api/conversations/[id]', async () => {
  const conversationsRoute = require(path.join(srcRoot, 'app/api/conversations/route.ts'))
  const conversationDetailRoute = require(path.join(srcRoot, 'app/api/conversations/[id]/route.ts'))
  const ragQueryRoute = require(path.join(srcRoot, 'app/api/rag/query/route.ts'))

  // Create conversation
  const createRes = await conversationsRoute.POST({
    json: async () => ({ title: 'Dijkstra Study Session' }),
  })
  assert.equal(createRes.status, 200)
  const convId = createRes.body.conversation.id
  assert.ok(convId)

  // Send query to /api/rag/query with conversationId
  const ragRes = await ragQueryRoute.POST({
    json: async () => ({
      query: 'What is Dijkstra algorithm time complexity?',
      conversationId: convId,
    }),
  })
  assert.equal(ragRes.status, 200)
  assert.equal(ragRes.body.conversationId, convId)
  assert.ok(ragRes.body.answer.length > 0)

  // Load conversation messages via GET /api/conversations/[id]
  const detailRes = await conversationDetailRoute.GET({}, { params: Promise.resolve({ id: convId }) })
  assert.equal(detailRes.status, 200)
  assert.equal(detailRes.body.messages.length, 2)
  assert.equal(detailRes.body.messages[0].role, 'user')
  assert.equal(detailRes.body.messages[1].role, 'assistant')
})

test('7. Subjects, Assessments & Attendance routes across STUDENT and LECTURER roles', async () => {
  const mySubjectsRoute = require(path.join(srcRoot, 'app/api/subjects/my/route.ts'))
  const subjectResourcesRoute = require(path.join(srcRoot, 'app/api/subjects/[id]/resources/route.ts'))
  const myAssessmentsRoute = require(path.join(srcRoot, 'app/api/assessments/my/route.ts'))
  const assessmentDetailRoute = require(path.join(srcRoot, 'app/api/assessments/[id]/route.ts'))
  const attendanceSessionsRoute = require(path.join(srcRoot, 'app/api/attendance/sessions/route.ts'))
  const myAttendanceRoute = require(path.join(srcRoot, 'app/api/attendance/my/route.ts'))

  // Subjects & BigInt resources
  const subjRes = await mySubjectsRoute.GET()
  assert.equal(subjRes.status, 200)
  assert.equal(subjRes.body.subjects.length, 1)

  const resList = await subjectResourcesRoute.GET({}, { params: Promise.resolve({ id: 'subj_cs301' }) })
  assert.equal(resList.status, 200)
  assert.equal(resList.body.resources[0].fileSize, '512000')

  // Assessments list & detail (with normalized studentId)
  const assessList = await myAssessmentsRoute.GET()
  assert.equal(assessList.status, 200)
  assert.equal(assessList.body.assessments.length, 1)

  const assessDetail = await assessmentDetailRoute.GET({}, { params: Promise.resolve({ id: 'assess_1' }) })
  assert.equal(assessDetail.status, 200)
  assert.equal(assessDetail.body.assessment.name, 'Midterm Exam 1')
  assert.equal(assessDetail.body.assessment.results[0].user.studentId, 'CS2026001')

  // Attendance session creation as LECTURER resolves semesterId from Subject
  dbState.currentUser.role = 'LECTURER'
  dbState.currentUser.memberships[0].role = 'LECTURER'
  const createSessRes = await attendanceSessionsRoute.POST({
    json: async () => ({
      subjectId: 'subj_cs301',
      date: new Date().toISOString(),
      period: 2,
      topic: 'Minimum Spanning Trees',
    }),
  })
  assert.equal(createSessRes.status, 200)
  assert.equal(createSessRes.body.session.semesterId, 'sem_5')
  assert.equal(createSessRes.body.session.records.length, 1)

  const lectAttRes = await myAttendanceRoute.GET()
  assert.equal(lectAttRes.status, 200)
  assert.equal(lectAttRes.body.subjects.length, 1)

  dbState.currentUser.role = 'STUDENT'
  dbState.currentUser.memberships[0].role = 'STUDENT'
})

test('8. Newly implemented sub-routes: Flashcards, Projects (tasks/milestones/members), Research (sources/notes), Notifications (read-all)', async () => {
  const deckCardsRoute = require(path.join(srcRoot, 'app/api/flashcards/decks/[id]/cards/route.ts'))
  const projTasksRoute = require(path.join(srcRoot, 'app/api/projects/[id]/tasks/route.ts'))
  const projMilestonesRoute = require(path.join(srcRoot, 'app/api/projects/[id]/milestones/route.ts'))
  const projMembersRoute = require(path.join(srcRoot, 'app/api/projects/[id]/members/route.ts'))
  const nbSourcesRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/sources/route.ts'))
  const nbNotesRoute = require(path.join(srcRoot, 'app/api/research/notebooks/[id]/notes/route.ts'))
  const notifReadAllRoute = require(path.join(srcRoot, 'app/api/notifications/read-all/route.ts'))

  // Flashcard deck cards
  const cardsRes = await deckCardsRoute.GET({}, { params: Promise.resolve({ id: 'deck_1' }) })
  assert.equal(cardsRes.status, 200)
  assert.equal(cardsRes.body.cards.length, 1)

  const addCardRes = await deckCardsRoute.POST(
    { json: async () => ({ front: 'Bellman-Ford complexity?', back: 'O(VE)' }) },
    { params: Promise.resolve({ id: 'deck_1' }) }
  )
  assert.equal(addCardRes.status, 200)
  assert.equal(addCardRes.body.card.back, 'O(VE)')

  // Project tasks, milestones, members
  const addTaskRes = await projTasksRoute.POST(
    { json: async () => ({ title: 'Calibrate LiDAR sensor', priority: 2 }) },
    { params: Promise.resolve({ id: 'proj_1' }) }
  )
  assert.equal(addTaskRes.status, 200)
  assert.equal(addTaskRes.body.task.title, 'Calibrate LiDAR sensor')

  const addMsRes = await projMilestonesRoute.POST(
    { json: async () => ({ title: 'Prototype Demo', dueDate: '2026-12-01' }) },
    { params: Promise.resolve({ id: 'proj_1' }) }
  )
  assert.equal(addMsRes.status, 200)
  assert.equal(addMsRes.body.milestone.title, 'Prototype Demo')

  const addMemRes = await projMembersRoute.POST(
    { json: async () => ({ email: 'teammate@alex.edu', role: 'MEMBER' }) },
    { params: Promise.resolve({ id: 'proj_1' }) }
  )
  assert.equal(addMemRes.status, 200)
  assert.equal(addMemRes.body.member.user.firstName, 'Diya')

  // Research notebook sources & notes
  const sourcesRes = await nbSourcesRoute.GET({}, { params: Promise.resolve({ id: 'nb_1' }) })
  assert.equal(sourcesRes.status, 200)
  assert.equal(sourcesRes.body.sources.length, 1) // Includes linked document doc_algo

  const addNoteRes = await nbNotesRoute.POST(
    { json: async () => ({ title: 'A* Heuristic Admissibility', content: 'h(n) <= h*(n) guarantees optimality.' }) },
    { params: Promise.resolve({ id: 'nb_1' }) }
  )
  assert.equal(addNoteRes.status, 200)
  assert.equal(addNoteRes.body.note.title, 'A* Heuristic Admissibility')

  // Notifications mark all read
  const readAllRes = await notifReadAllRoute.POST()
  assert.equal(readAllRes.status, 200)
  assert.equal(readAllRes.body.success, true)
  assert.equal(readAllRes.body.updatedCount, 1)
})

test('9. Document Studio, Solution Generator, DiagramRenderer, and PPTX Extractor', async () => {
  const docGenRoute = require(path.join(srcRoot, 'app/api/documents/generate/route.ts'))
  const solGenRoute = require(path.join(srcRoot, 'app/api/solutions/generate/route.ts'))
  const diagramRendererMod = require(path.join(srcRoot, 'lib/diagrams/renderer.ts'))
  const extractorsMod = require(path.join(srcRoot, 'lib/document-processing/extractors.ts'))

  // Document Studio generation
  const docRes = await docGenRoute.POST({
    json: async () => ({
      sourceType: 'prompt',
      prompt: '# Graph Algorithms Study Guide\n\nOverview of Dijkstra and BFS.',
      title: 'Graph Study Guide',
      outputFormat: 'markdown',
      includeDiagrams: true,
      includeTables: true,
      includeCitations: true,
    }),
  })
  assert.equal(docRes.status, 200)
  assert.equal(docRes.body.title, 'Graph Study Guide')
  assert.ok(docRes.body.sections.length > 0)

  // Solution Generator (without supportingDocumentIds and using questionBank)
  const solRes = await solGenRoute.POST({
    json: async () => ({
      question: '',
      questionBank: 'Explain Dijkstra time complexity with a binary heap\nSecond question',
      sourceDocumentIds: ['doc_algo'],
      answerMode: 'exam',
    }),
  })
  assert.equal(solRes.status, 200)
  assert.equal(solRes.body.originalQuestion, 'Explain Dijkstra time complexity with a binary heap')
  assert.ok(solRes.body.finalAnswer.length > 0)
  assert.ok(solRes.body.citations.length > 0)

  // DiagramRenderer in-process SVG rendering
  const mermaidSvg = await diagramRendererMod.DiagramRenderer.render('mermaid', 'flowchart TD\n  A[Start] --> B[End]')
  assert.equal(mermaidSvg.success, true)
  assert.ok(mermaidSvg.svg.includes('<svg'))
  assert.ok(mermaidSvg.svg.includes('Start'))

  // PPTX Extractor with synthetic ZIP local file header containing ppt/slides/slide1.xml
  const slideXml = '<p:sld><a:t>Slide 1 Title: Dynamic Programming</a:t><a:t>Bellman Optimality Principle</a:t></p:sld>'
  const compressed = deflateRawSync(Buffer.from(slideXml, 'utf8'))
  const fileNameBuf = Buffer.from('ppt/slides/slide1.xml', 'utf8')
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0) // signature
  header.writeUInt16LE(8, 8) // deflate compression
  header.writeUInt32LE(compressed.length, 18) // compressed size
  header.writeUInt16LE(fileNameBuf.length, 26) // filename length
  header.writeUInt16LE(0, 28) // extra field length
  const fakePptxBuffer = Buffer.concat([header, fileNameBuf, compressed])

  const extractedPptx = await extractorsMod.extractTextFromPPTX(fakePptxBuffer)
  assert.equal(extractedPptx.pages.length, 1)
  assert.ok(extractedPptx.text.includes('Dynamic Programming'))
  assert.ok(extractedPptx.text.includes('Bellman Optimality Principle'))
})

test('10. Frontend pages & components compilation and contract verification', () => {
  const pagesToCompile = [
    'app/(dashboard)/dashboard/page.tsx',
    'app/(dashboard)/dashboard/student-dashboard.tsx',
    'app/(dashboard)/dashboard/lecturer-dashboard.tsx',
    'app/(dashboard)/dashboard/admin-dashboard.tsx',
    'app/(dashboard)/assistant/page.tsx',
    'components/rag/rag-chat.tsx',
    'app/(dashboard)/assignments/page.tsx',
    'app/(dashboard)/document-studio/page.tsx',
    'app/(dashboard)/solution-generator/page.tsx',
    'app/(dashboard)/assessments/page.tsx',
    'app/(dashboard)/settings/page.tsx',
    'app/(dashboard)/study-studio/page.tsx',
    'app/(dashboard)/projects/page.tsx',
    'app/(dashboard)/research/page.tsx',
    'app/(dashboard)/notifications/page.tsx',
    'app/(dashboard)/attendance/page.tsx',
    'app/(dashboard)/documents/page.tsx',
    'app/(dashboard)/subjects/page.tsx',
    'app/(dashboard)/planner/page.tsx',
    'app/(dashboard)/achievements/page.tsx',
    'app/(dashboard)/drive/page.tsx',
    'app/(dashboard)/ai-settings/page.tsx',
    'components/layout/sidebar.tsx',
    'components/layout/header.tsx',
  ]

  for (const relPath of pagesToCompile) {
    const fullPath = path.join(srcRoot, relPath)
    const source = fs.readFileSync(fullPath, 'utf8')
    const result = babel.transformSync(source, {
      filename: fullPath,
      presets: [
        ['/usr/share/nodejs/@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['/usr/share/nodejs/@babel/preset-typescript', { isTSX: true, allExtensions: true }],
      ],
    })
    assert.ok(result && result.code && result.code.length > 0, `Failed to compile ${relPath}`)
  }
})
