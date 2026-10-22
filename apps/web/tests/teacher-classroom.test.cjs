const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
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

process.env.AUTH_SECRET = 'test-auth-secret-32-characters-long-12345'
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long-99999'

// ============================================================================
// Stateful In-Memory Prisma Store for Teacher & Classroom Management Tests
// ============================================================================

const store = {
  institutions: [{ id: 'inst_1', name: 'ALEX Institute of Technology' }],
  departments: [{ id: 'dept_cs', name: 'Computer Science', code: 'CSE', institutionId: 'inst_1' }],
  semesters: [{ id: 'sem_5', name: 'Semester 5', number: 5, institutionId: 'inst_1', isActive: true }],
  users: {
    user_lecturer_cs301: {
      id: 'user_lecturer_cs301',
      email: 'prof.sharma@alex.edu',
      firstName: 'Vikram',
      lastName: 'Sharma',
      role: 'LECTURER',
      isActive: true,
      memberships: [
        {
          id: 'mem_lec_1',
          userId: 'user_lecturer_cs301',
          institutionId: 'inst_1',
          role: 'LECTURER',
          status: 'ACTIVE',
          studentId: null,
        },
      ],
    },
    user_lecturer_other: {
      id: 'user_lecturer_other',
      email: 'prof.iyer@alex.edu',
      firstName: 'Meera',
      lastName: 'Iyer',
      role: 'LECTURER',
      isActive: true,
      memberships: [
        {
          id: 'mem_lec_2',
          userId: 'user_lecturer_other',
          institutionId: 'inst_1',
          role: 'LECTURER',
          status: 'ACTIVE',
          studentId: null,
        },
      ],
    },
    user_admin: {
      id: 'user_admin',
      email: 'admin@alex.edu',
      firstName: 'Arjun',
      lastName: 'Nair',
      role: 'ADMIN',
      isActive: true,
      memberships: [
        {
          id: 'mem_adm_1',
          userId: 'user_admin',
          institutionId: 'inst_1',
          role: 'ADMIN',
          status: 'ACTIVE',
          studentId: null,
        },
      ],
    },
    user_student_1: {
      id: 'user_student_1',
      email: 'priya.patel@alex.edu',
      firstName: 'Priya',
      lastName: 'Patel',
      role: 'STUDENT',
      isActive: true,
      memberships: [
        {
          id: 'mem_stu_1',
          userId: 'user_student_1',
          institutionId: 'inst_1',
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'CS2024001',
        },
      ],
    },
    user_student_2: {
      id: 'user_student_2',
      email: 'rahul.menon@alex.edu',
      firstName: 'Rahul',
      lastName: 'Menon',
      role: 'STUDENT',
      isActive: true,
      memberships: [
        {
          id: 'mem_stu_2',
          userId: 'user_student_2',
          institutionId: 'inst_1',
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'CS2024002',
        },
      ],
    },
    user_student_outsider: {
      id: 'user_student_outsider',
      email: 'outsider.student@alex.edu',
      firstName: 'Kiran',
      lastName: 'Rao',
      role: 'STUDENT',
      isActive: true,
      memberships: [
        {
          id: 'mem_stu_3',
          userId: 'user_student_outsider',
          institutionId: 'inst_1',
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'ME2024099',
        },
      ],
    },
  },
  subjects: [
    {
      id: 'subj_cs301',
      name: 'Design & Analysis of Algorithms',
      code: 'CS301',
      credits: 4,
      description: 'Core algorithms course',
      syllabus: 'Divide and Conquer, Dynamic Programming, Graphs',
      institutionId: 'inst_1',
      departmentId: 'dept_cs',
      semesterId: 'sem_5',
    },
  ],
  lecturerAssignments: [
    {
      id: 'la_1',
      userId: 'user_lecturer_cs301',
      subjectId: 'subj_cs301',
      isPrimary: true,
    },
  ],
  subjectEnrollments: [
    {
      id: 'enr_1',
      userId: 'user_student_1',
      subjectId: 'subj_cs301',
      isActive: true,
      enrolledAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    {
      id: 'enr_2',
      userId: 'user_student_2',
      subjectId: 'subj_cs301',
      isActive: true,
      enrolledAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  ],
  plannerEvents: [],
  plannerTasks: [],
  attendanceSessions: [],
  attendanceRecords: [],
  assessments: [],
  assessmentResults: [],
  assignments: [],
  assignmentSubmissions: [],
  auditLogs: [],
}

let activeSessionToken = ''

function hydrateSubject(subj) {
  if (!subj) return null
  const enrollments = store.subjectEnrollments
    .filter((e) => e.subjectId === subj.id && e.isActive)
    .map((e) => ({
      ...e,
      user: store.users[e.userId],
    }))
  const lecturers = store.lecturerAssignments
    .filter((l) => l.subjectId === subj.id)
    .map((l) => ({
      ...l,
      user: store.users[l.userId],
    }))
  const attendanceSessions = store.attendanceSessions
    .filter((s) => s.subjectId === subj.id && !s.isCancelled)
    .map((s) => ({
      ...s,
      records: store.attendanceRecords
        .filter((r) => r.sessionId === s.id)
        .map((r) => ({ ...r, user: store.users[r.userId] })),
    }))
  return {
    ...subj,
    institution: store.institutions[0],
    department: store.departments[0],
    semester: store.semesters[0],
    enrollments,
    lecturers,
    attendanceSessions,
    _count: {
      enrollments: enrollments.length,
      resources: 0,
      attendanceSessions: attendanceSessions.length,
      assessments: store.assessments.filter((a) => a.subjectId === subj.id).length,
      assignments: store.assignments.filter((a) => a.subjectId === subj.id).length,
    },
  }
}

function hydrateAttendanceSession(sess) {
  if (!sess) return null
  const subj = store.subjects.find((s) => s.id === sess.subjectId)
  const records = store.attendanceRecords
    .filter((r) => r.sessionId === sess.id)
    .map((r) => ({
      ...r,
      user: store.users[r.userId],
    }))
  return {
    ...sess,
    subject: hydrateSubject(subj),
    records,
    _count: { records: records.length },
  }
}

const mockPrisma = {
  $transaction: async (arg) => {
    if (typeof arg === 'function') {
      return arg(mockPrisma)
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg)
    }
    return arg
  },
  institution: {
    findFirst: async () => store.institutions[0] || null,
  },
  collegeMembership: {
    findFirst: async ({ where }) => {
      for (const u of Object.values(store.users)) {
        const m = (u.memberships || []).find(
          (mem) =>
            (!where.userId || mem.userId === where.userId) &&
            (!where.status || mem.status === where.status)
        )
        if (m) return { ...m, institution: store.institutions[0] }
      }
      return null
    },
  },
  user: {
    findUnique: async ({ where }) => {
      if (where.id) return store.users[where.id] || null
      if (where.email) {
        return (
          Object.values(store.users).find(
            (u) => u.email.toLowerCase() === where.email.toLowerCase()
          ) || null
        )
      }
      return null
    },
    findMany: async ({ where }) => {
      return Object.values(store.users).filter((u) => {
        if (where?.id?.in) return where.id.in.includes(u.id)
        if (Array.isArray(where?.OR)) {
          return where.OR.some((branch) => {
            if (branch.id?.in && branch.id.in.includes(u.id)) return true
            if (
              branch.email?.in &&
              branch.email.in.map((e) => e.toLowerCase()).includes(u.email.toLowerCase())
            ) {
              return true
            }
            return false
          })
        }
        return true
      })
    },
  },
  lecturerAssignment: {
    findFirst: async ({ where }) => {
      return (
        store.lecturerAssignments.find(
          (la) =>
            (!where.userId || la.userId === where.userId) &&
            (!where.subjectId || la.subjectId === where.subjectId)
        ) || null
      )
    },
    findMany: async ({ where }) => {
      return store.lecturerAssignments.filter(
        (la) => !where?.userId || la.userId === where.userId
      )
    },
  },
  subjectEnrollment: {
    findFirst: async ({ where }) => {
      return (
        store.subjectEnrollments.find(
          (e) =>
            (!where.userId || e.userId === where.userId) &&
            (!where.subjectId || e.subjectId === where.subjectId) &&
            (where.isActive === undefined || e.isActive === where.isActive)
        ) || null
      )
    },
    findUnique: async ({ where }) => {
      const key = where.userId_subjectId
      if (!key) return null
      const found = store.subjectEnrollments.find(
        (e) => e.userId === key.userId && e.subjectId === key.subjectId
      )
      if (!found) return null
      return {
        ...found,
        user: store.users[found.userId],
        subject: hydrateSubject(store.subjects.find((s) => s.id === found.subjectId)),
      }
    },
    findMany: async ({ where }) => {
      return store.subjectEnrollments
        .filter((e) => {
          if (where?.userId && typeof where.userId === 'string' && e.userId !== where.userId)
            return false
          if (where?.userId?.in && !where.userId.in.includes(e.userId)) return false
          if (where?.subjectId && e.subjectId !== where.subjectId) return false
          if (where?.isActive !== undefined && e.isActive !== where.isActive) return false
          return true
        })
        .map((e) => {
          const subj = hydrateSubject(store.subjects.find((s) => s.id === e.subjectId))
          return {
            ...e,
            user: store.users[e.userId],
            subject: {
              ...subj,
              attendanceSessions: subj.attendanceSessions.map((sess) => ({
                ...sess,
                records: sess.records.filter((r) =>
                  where?.userId && typeof where.userId === 'string'
                    ? r.userId === where.userId
                    : true
                ),
              })),
              assignments: store.assignments
                .filter((a) => a.subjectId === e.subjectId && a.isPublished)
                .map((a) => ({
                  ...a,
                  _count: {
                    submissions: store.assignmentSubmissions.filter(
                      (sub) => sub.assignmentId === a.id && sub.userId === e.userId
                    ).length,
                  },
                })),
            },
          }
        })
    },
    upsert: async ({ where, update, create }) => {
      const key = where.userId_subjectId
      let existing = store.subjectEnrollments.find(
        (e) => e.userId === key.userId && e.subjectId === key.subjectId
      )
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const created = {
        id: `enr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        enrolledAt: new Date(),
        ...create,
      }
      store.subjectEnrollments.push(created)
      return created
    },
  },
  subject: {
    findUnique: async ({ where }) => {
      const found = store.subjects.find((s) => s.id === where.id)
      return hydrateSubject(found)
    },
    findMany: async ({ where }) => {
      return store.subjects
        .filter((s) => {
          if (where?.id) {
            if (typeof where.id === 'string' && s.id !== where.id) return false
            if (where.id.in && !where.id.in.includes(s.id)) return false
          }
          if (where?.lecturers?.some?.userId) {
            return store.lecturerAssignments.some(
              (la) => la.subjectId === s.id && la.userId === where.lecturers.some.userId
            )
          }
          if (where?.enrollments?.some?.userId) {
            return store.subjectEnrollments.some(
              (enr) =>
                enr.subjectId === s.id &&
                enr.userId === where.enrollments.some.userId &&
                enr.isActive
            )
          }
          return true
        })
        .map(hydrateSubject)
    },
    update: async ({ where, data }) => {
      const found = store.subjects.find((s) => s.id === where.id)
      if (!found) throw new Error('Subject not found')
      Object.assign(found, data)
      return hydrateSubject(found)
    },
  },
  plannerEvent: {
    create: async ({ data }) => {
      const ev = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.plannerEvents.push(ev)
      return {
        ...ev,
        subject: ev.subjectId
          ? store.subjects.find((s) => s.id === ev.subjectId) || null
          : null,
        user: store.users[ev.userId] || null,
      }
    },
    findUnique: async ({ where }) => {
      const ev = store.plannerEvents.find((e) => e.id === where.id)
      if (!ev) return null
      return {
        ...ev,
        subject: ev.subjectId
          ? store.subjects.find((s) => s.id === ev.subjectId) || null
          : null,
        user: store.users[ev.userId] || null,
      }
    },
    findMany: async ({ where }) => {
      return store.plannerEvents
        .filter((ev) => {
          if (where?.subjectId && ev.subjectId !== where.subjectId) return false
          if (where?.eventType) {
            if (typeof where.eventType === 'string' && ev.eventType !== where.eventType)
              return false
            if (where.eventType.in && !where.eventType.in.includes(ev.eventType))
              return false
          }
          if (where?.startTime) {
            if (where.startTime.gte && new Date(ev.startTime) < where.startTime.gte)
              return false
            if (where.startTime.lte && new Date(ev.startTime) > where.startTime.lte)
              return false
          }
          return true
        })
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .map((ev) => ({
          ...ev,
          subject: ev.subjectId
            ? store.subjects.find((s) => s.id === ev.subjectId) || null
            : null,
          user: store.users[ev.userId] || null,
        }))
    },
    update: async ({ where, data }) => {
      const ev = store.plannerEvents.find((e) => e.id === where.id)
      if (!ev) throw new Error('Event not found')
      Object.assign(ev, data, { updatedAt: new Date() })
      return {
        ...ev,
        subject: ev.subjectId
          ? store.subjects.find((s) => s.id === ev.subjectId) || null
          : null,
        user: store.users[ev.userId] || null,
      }
    },
    delete: async ({ where }) => {
      store.plannerEvents = store.plannerEvents.filter((e) => e.id !== where.id)
      return {}
    },
  },
  plannerTask: {
    create: async ({ data }) => {
      const t = {
        id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.plannerTasks.push(t)
      return { ...t, subject: null }
    },
    findMany: async ({ where }) => {
      return store.plannerTasks.filter((t) => !where?.userId || t.userId === where.userId)
    },
    findUnique: async ({ where }) => {
      return store.plannerTasks.find((t) => t.id === where.id) || null
    },
    update: async ({ where, data }) => {
      const t = store.plannerTasks.find((x) => x.id === where.id)
      Object.assign(t, data, { updatedAt: new Date() })
      return t
    },
    delete: async ({ where }) => {
      store.plannerTasks = store.plannerTasks.filter((x) => x.id !== where.id)
      return {}
    },
  },
  attendanceSession: {
    findFirst: async ({ where }) => {
      const found = store.attendanceSessions.find((s) => {
        if (where.id?.not && s.id === where.id.not) return false
        if (where.subjectId && s.subjectId !== where.subjectId) return false
        if (where.period !== undefined && s.period !== where.period) return false
        if (where.date) {
          const t = new Date(s.date).getTime()
          if (where.date.gte && t < where.date.gte.getTime()) return false
          if (where.date.lte && t > where.date.lte.getTime()) return false
        }
        return true
      })
      return hydrateAttendanceSession(found)
    },
    findUnique: async ({ where }) => {
      const found = store.attendanceSessions.find((s) => s.id === where.id)
      return hydrateAttendanceSession(found)
    },
    findMany: async ({ where }) => {
      return store.attendanceSessions
        .filter((s) => {
          if (where?.subjectId) {
            if (typeof where.subjectId === 'string' && s.subjectId !== where.subjectId)
              return false
            if (where.subjectId.in && !where.subjectId.in.includes(s.subjectId))
              return false
          }
          if (where?.isCancelled !== undefined && s.isCancelled !== where.isCancelled)
            return false
          if (where?.period !== undefined && s.period !== where.period) return false
          if (where?.date) {
            const t = new Date(s.date).getTime()
            if (where.date.gte && t < where.date.gte.getTime()) return false
            if (where.date.lte && t > where.date.lte.getTime()) return false
          }
          if (Array.isArray(where?.OR)) {
            return where.OR.some((b) => {
              if (b.subjectId?.in && b.subjectId.in.includes(s.subjectId)) return true
              if (b.conductedBy && s.conductedBy === b.conductedBy) return true
              return false
            })
          }
          return true
        })
        .map(hydrateAttendanceSession)
    },
    create: async ({ data }) => {
      const sess = {
        id: `asess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        topic: null,
        conductedBy: null,
        isCancelled: false,
        cancelReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.attendanceSessions.push(sess)
      return hydrateAttendanceSession(sess)
    },
    update: async ({ where, data }) => {
      const sess = store.attendanceSessions.find((s) => s.id === where.id)
      if (!sess) throw new Error('Session not found')
      Object.assign(sess, data, { updatedAt: new Date() })
      return hydrateAttendanceSession(sess)
    },
    delete: async ({ where }) => {
      store.attendanceSessions = store.attendanceSessions.filter((s) => s.id !== where.id)
      store.attendanceRecords = store.attendanceRecords.filter(
        (r) => r.sessionId !== where.id
      )
      return {}
    },
  },
  attendanceRecord: {
    findUnique: async ({ where }) => {
      let rec = null
      if (where.id) {
        rec = store.attendanceRecords.find((r) => r.id === where.id)
      } else if (where.sessionId_userId) {
        rec = store.attendanceRecords.find(
          (r) =>
            r.sessionId === where.sessionId_userId.sessionId &&
            r.userId === where.sessionId_userId.userId
        )
      }
      if (!rec) return null
      const sess = store.attendanceSessions.find((s) => s.id === rec.sessionId)
      const subj = sess ? store.subjects.find((s) => s.id === sess.subjectId) : null
      return {
        ...rec,
        session: sess ? { ...sess, subject: subj } : null,
        user: store.users[rec.userId] || null,
      }
    },
    create: async ({ data }) => {
      const rec = {
        id: `arec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        remarks: null,
        markedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.attendanceRecords.push(rec)
      return rec
    },
    upsert: async ({ where, update, create }) => {
      const { sessionId, userId } = where.sessionId_userId
      let existing = store.attendanceRecords.find(
        (r) => r.sessionId === sessionId && r.userId === userId
      )
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() })
        return existing
      }
      const created = {
        id: `arec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        remarks: null,
        markedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create,
      }
      store.attendanceRecords.push(created)
      return created
    },
    update: async ({ where, data }) => {
      const existing = store.attendanceRecords.find((r) => r.id === where.id)
      if (!existing) throw new Error('Record not found')
      Object.assign(existing, data, { updatedAt: new Date() })
      return existing
    },
    delete: async ({ where }) => {
      store.attendanceRecords = store.attendanceRecords.filter((r) => r.id !== where.id)
      return {}
    },
  },
  assessment: {
    create: async ({ data }) => {
      const a = {
        id: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        isPublished: false,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.assessments.push(a)
      return {
        ...a,
        subject: store.subjects.find((s) => s.id === a.subjectId),
        _count: { results: 0 },
      }
    },
    findUnique: async ({ where }) => {
      const a = store.assessments.find((x) => x.id === where.id)
      if (!a) return null
      const subj = hydrateSubject(store.subjects.find((s) => s.id === a.subjectId))
      const results = store.assessmentResults
        .filter((r) => r.assessmentId === a.id)
        .map((r) => ({ ...r, user: store.users[r.userId] }))
      return {
        ...a,
        subject: subj,
        semester: store.semesters[0],
        results,
      }
    },
    update: async ({ where, data }) => {
      const a = store.assessments.find((x) => x.id === where.id)
      Object.assign(a, data, { updatedAt: new Date() })
      return a
    },
    delete: async ({ where }) => {
      store.assessments = store.assessments.filter((x) => x.id !== where.id)
      return {}
    },
  },
  assessmentResult: {
    upsert: async ({ where, update, create }) => {
      const { assessmentId, userId } = where.assessmentId_userId
      let existing = store.assessmentResults.find(
        (r) => r.assessmentId === assessmentId && r.userId === userId
      )
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const created = {
        id: `ares_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...create,
      }
      store.assessmentResults.push(created)
      return created
    },
  },
  assignment: {
    create: async ({ data }) => {
      const asgn = {
        id: `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      store.assignments.push(asgn)
      return {
        ...asgn,
        subject: store.subjects.find((s) => s.id === asgn.subjectId),
        _count: { submissions: 0 },
      }
    },
    findUnique: async ({ where }) => {
      return store.assignments.find((a) => a.id === where.id) || null
    },
    findMany: async () => {
      return store.assignments.map((a) => ({
        ...a,
        subject: store.subjects.find((s) => s.id === a.subjectId),
        _count: {
          submissions: store.assignmentSubmissions.filter(
            (sub) => sub.assignmentId === a.id
          ).length,
        },
      }))
    },
  },
  assignmentSubmission: {
    create: async ({ data }) => {
      const sub = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        submittedAt: new Date(),
        marksObtained: null,
        feedback: null,
        attachments: [],
        ...data,
      }
      store.assignmentSubmissions.push(sub)
      return sub
    },
    findUnique: async ({ where }) => {
      return store.assignmentSubmissions.find((s) => s.id === where.id) || null
    },
    findMany: async ({ where }) => {
      return store.assignmentSubmissions
        .filter((s) => !where?.assignmentId || s.assignmentId === where.assignmentId)
        .map((s) => ({
          ...s,
          user: store.users[s.userId],
          attachments: [],
        }))
    },
    update: async ({ where, data }) => {
      const sub = store.assignmentSubmissions.find((s) => s.id === where.id)
      Object.assign(sub, data)
      return {
        ...sub,
        user: store.users[sub.userId],
        attachments: [],
      }
    },
  },
  auditLog: {
    create: async ({ data }) => {
      const log = { id: `audit_${Date.now()}`, createdAt: new Date(), ...data }
      store.auditLogs.push(log)
      return log
    },
  },
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
  },
  'next/server': {
    NextResponse: CustomNextResponse,
  },
  'next/headers': {
    cookies: async () => ({
      get: (name) =>
        name === 'alex_local_session' && activeSessionToken
          ? { value: activeSessionToken }
          : undefined,
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
  if (request === '@alex/shared-utils') {
    return path.join(repoRoot, 'packages/shared-utils/src/index.ts')
  }
  if (request === '@alex/validation-schemas') {
    return path.join(repoRoot, 'packages/validation-schemas/src/index.ts')
  }
  if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
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

function compileTs(module, filename) {
  const raw = fs.readFileSync(filename, 'utf8')
  const transformed = babel.transformSync(raw, {
    filename,
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
      ['@babel/preset-react', { runtime: 'automatic' }],
    ],
  })
  module._compile(transformed.code, filename)
}

require.extensions['.ts'] = compileTs
require.extensions['.tsx'] = compileTs

const { createLocalSession } = require(path.join(srcRoot, 'lib/local-auth.ts'))

function switchUser(userKey) {
  const u = store.users[userKey]
  activeSessionToken = createLocalSession(u.id)
}

// Load route handlers
const meetingsRoute = require(path.join(srcRoot, 'app/api/meetings/route.ts'))
const meetingIdRoute = require(path.join(srcRoot, 'app/api/meetings/[id]/route.ts'))
const plannerEventsRoute = require(path.join(srcRoot, 'app/api/planner/events/route.ts'))
const attendanceSessionsRoute = require(path.join(
  srcRoot,
  'app/api/attendance/sessions/route.ts'
))
const attendanceMarkRoute = require(path.join(srcRoot, 'app/api/attendance/mark/route.ts'))
const attendanceEditRoute = require(path.join(srcRoot, 'app/api/attendance/edit/route.ts'))
const attendanceMyRoute = require(path.join(srcRoot, 'app/api/attendance/my/route.ts'))
const attendanceReportsRoute = require(path.join(
  srcRoot,
  'app/api/attendance/reports/route.ts'
))
const assessmentsRoute = require(path.join(srcRoot, 'app/api/assessments/route.ts'))
const assessmentIdRoute = require(path.join(srcRoot, 'app/api/assessments/[id]/route.ts'))
const assignmentsMyRoute = require(path.join(srcRoot, 'app/api/assignments/my/route.ts'))
const assignmentSubmissionsRoute = require(path.join(
  srcRoot,
  'app/api/assignments/[id]/submissions/route.ts'
))

// ============================================================================
// Test #33: Teacher Meetings (Create, View, Update, Participants, Links, Cancel)
// ============================================================================

test('Test #33: Teacher Meetings — create, validate schedules & links, manage participants, RSVP, update, and cancel', async () => {
  switchUser('user_lecturer_cs301')

  // 1. Reject invalid time window (endTime <= startTime)
  const badScheduleRes = await meetingsRoute.POST(
    new Request('http://localhost/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Invalid Schedule Meeting',
        subjectId: 'subj_cs301',
        startTime: '2026-10-25T11:00:00.000Z',
        endTime: '2026-10-25T10:00:00.000Z',
      }),
    })
  )
  assert.equal(badScheduleRes.status, 400)
  assert.match((await badScheduleRes.json()).error, /End time must be after start time/i)

  // 2. Reject invalid meeting link URL
  const badLinkRes = await meetingsRoute.POST(
    new Request('http://localhost/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bad Link Meeting',
        subjectId: 'subj_cs301',
        startTime: '2026-10-25T10:00:00.000Z',
        endTime: '2026-10-25T11:00:00.000Z',
        meetingLink: 'ftp://invalid-conference-link',
      }),
    })
  )
  assert.equal(badLinkRes.status, 400)
  assert.match((await badLinkRes.json()).error, /http:\/\/ or https:\/\//i)

  // 3. Create valid teacher meeting with enrolled class students + meeting link
  const createRes = await meetingsRoute.POST(
    new Request('http://localhost/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CS301 Midterm Review & Doubt Clearing',
        eventType: 'MEETING',
        subjectId: 'subj_cs301',
        startTime: '2026-10-25T10:00:00.000Z',
        endTime: '2026-10-25T11:30:00.000Z',
        meetingLink: 'https://meet.alex.edu/cs301-midterm-review',
        location: 'Room 302, CS Block',
        agenda: 'Review dynamic programming recurrences and graph traversal complexities.',
        includeClassStudents: true,
      }),
    })
  )
  assert.equal(createRes.status, 200)
  const createdData = await createRes.json()
  const meetingId = createdData.meeting.id
  assert.ok(meetingId)
  assert.equal(createdData.meeting.title, 'CS301 Midterm Review & Doubt Clearing')
  assert.equal(
    createdData.meeting.meetingLink,
    'https://meet.alex.edu/cs301-midterm-review'
  )
  assert.equal(createdData.meeting.location, 'Room 302, CS Block')
  assert.equal(createdData.meeting.status, 'SCHEDULED')
  assert.equal(createdData.meeting.isCancelled, false)
  // Both enrolled students (user_student_1, user_student_2) should be in participants
  assert.equal(createdData.meeting.participants.length, 2)
  assert.deepEqual(
    createdData.meeting.participants.map((p) => p.userId).sort(),
    ['user_student_1', 'user_student_2']
  )

  // 4. Enrolled student can view the meeting and RSVP "ACCEPTED"
  switchUser('user_student_1')
  const studentListRes = await plannerEventsRoute.GET(
    new Request('http://localhost/api/planner/events?meetingsOnly=true')
  )
  assert.equal(studentListRes.status, 200)
  const studentListData = await studentListRes.json()
  assert.equal(studentListData.meetings.length, 1)
  assert.equal(studentListData.meetings[0].id, meetingId)
  assert.equal(studentListData.meetings[0].canManage, false)

  const rsvpRes = await meetingIdRoute.PATCH(
    new Request(`http://localhost/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rsvp', rsvpStatus: 'ACCEPTED' }),
    }),
    { params: Promise.resolve({ id: meetingId }) }
  )
  assert.equal(rsvpRes.status, 200)
  const rsvpData = await rsvpRes.json()
  const stu1Participant = rsvpData.meeting.participants.find(
    (p) => p.userId === 'user_student_1'
  )
  assert.equal(stu1Participant.status, 'ACCEPTED')
  assert.ok(stu1Participant.respondedAt)

  // 5. Outsider student (not enrolled in CS301 and not invited) cannot view or modify the meeting
  switchUser('user_student_outsider')
  const outsiderGetRes = await meetingIdRoute.GET(
    new Request(`http://localhost/api/meetings/${meetingId}`),
    { params: Promise.resolve({ id: meetingId }) }
  )
  assert.equal(outsiderGetRes.status, 403)

  // 6. Teacher updates meeting details, then cancels the meeting with a reason
  switchUser('user_lecturer_cs301')
  const updateRes = await meetingIdRoute.PATCH(
    new Request(`http://localhost/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CS301 Midterm Review (Updated)',
        location: 'Auditorium B',
        meetingLink: 'https://meet.alex.edu/cs301-auditorium-b',
      }),
    }),
    { params: Promise.resolve({ id: meetingId }) }
  )
  assert.equal(updateRes.status, 200)
  const updatedMeeting = (await updateRes.json()).meeting
  assert.equal(updatedMeeting.title, 'CS301 Midterm Review (Updated)')
  assert.equal(updatedMeeting.location, 'Auditorium B')
  assert.equal(updatedMeeting.meetingLink, 'https://meet.alex.edu/cs301-auditorium-b')
  assert.equal(
    updatedMeeting.participants.find((p) => p.userId === 'user_student_1').status,
    'ACCEPTED'
  )

  const cancelRes = await meetingIdRoute.PATCH(
    new Request(`http://localhost/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancel',
        cancelReason: 'Rescheduled due to department faculty senate meeting',
      }),
    }),
    { params: Promise.resolve({ id: meetingId }) }
  )
  assert.equal(cancelRes.status, 200)
  const cancelledMeeting = (await cancelRes.json()).meeting
  assert.equal(cancelledMeeting.isCancelled, true)
  assert.equal(cancelledMeeting.status, 'CANCELLED')
  assert.equal(
    cancelledMeeting.cancelReason,
    'Rescheduled due to department faculty senate meeting'
  )
})

// ============================================================================
// Test #34: Attendance Recording, Updating, Duplicate Prevention & Live Summaries
// ============================================================================

test('Test #34: Attendance — session date normalization, duplicate prevention, marking, editing, and updated summaries', async () => {
  switchUser('user_lecturer_cs301')

  // 1. Create attendance session for CS301 on 2026-10-22 Period 1
  const createSessRes = await attendanceSessionsRoute.POST(
    new Request('http://localhost/api/attendance/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'subj_cs301',
        date: '2026-10-22T09:15:30.000Z',
        period: 1,
        topic: 'Shortest Path Algorithms (Dijkstra & Bellman-Ford)',
      }),
    })
  )
  assert.equal(createSessRes.status, 200)
  const sessionData = (await createSessRes.json()).session
  const sessionId = sessionData.id
  assert.ok(sessionId)
  assert.equal(new Date(sessionData.date).toISOString(), '2026-10-22T00:00:00.000Z')
  assert.equal(sessionData.roster.length, 2)
  assert.equal(sessionData.summary.totalEnrolled, 2)
  assert.equal(sessionData.summary.markedCount, 0)

  // 2. Prevent accidental duplicate session on the same class, calendar day, and period
  const dupSessRes = await attendanceSessionsRoute.POST(
    new Request('http://localhost/api/attendance/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'subj_cs301',
        date: '2026-10-22T16:40:00.000Z',
        period: 1,
        topic: 'Accidental Duplicate Session',
      }),
    })
  )
  assert.equal(dupSessRes.status, 409)
  const dupPayload = await dupSessRes.json()
  assert.equal(dupPayload.code, 'DUPLICATE_SESSION')
  assert.equal(dupPayload.session.id, sessionId)
  assert.equal(store.attendanceSessions.length, 1)

  // 3. Mark attendance for students (including duplicate payload entry deduplication)
  const markRes = await attendanceMarkRoute.POST(
    new Request('http://localhost/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        records: [
          { userId: 'user_student_1', status: 'PRESENT' },
          { userId: 'user_student_2', status: 'PRESENT' },
          { userId: 'user_student_2', status: 'ABSENT', remarks: 'Unexcused absence' },
        ],
      }),
    })
  )
  assert.equal(markRes.status, 200)
  const markPayload = await markRes.json()
  assert.equal(markPayload.count, 2)
  assert.equal(store.attendanceRecords.length, 2)
  assert.equal(markPayload.summary.present, 1)
  assert.equal(markPayload.summary.absent, 1)
  assert.equal(markPayload.summary.attendancePercentage, 50)

  // 4. Edit student 2's attendance from ABSENT to LATE via PUT /api/attendance/edit
  const student2Rec = store.attendanceRecords.find((r) => r.userId === 'user_student_2')
  const editRes = await attendanceEditRoute.PUT(
    new Request('http://localhost/api/attendance/edit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordId: student2Rec.id,
        status: 'LATE',
        remarks: 'Arrived 10 minutes late due to bus delay',
      }),
    })
  )
  assert.equal(editRes.status, 200)
  const editPayload = await editRes.json()
  assert.equal(editPayload.record.status, 'LATE')
  assert.equal(editPayload.summary.present, 1)
  assert.equal(editPayload.summary.late, 1)
  assert.equal(editPayload.summary.absent, 0)
  assert.equal(editPayload.summary.attendancePercentage, 100)
  assert.equal(store.attendanceRecords.length, 2)

  // 5. Verify updated attendance summaries via /api/attendance/my (student & teacher) and /api/attendance/reports
  switchUser('user_student_2')
  const stuMyRes = await attendanceMyRoute.GET(
    new Request('http://localhost/api/attendance/my')
  )
  assert.equal(stuMyRes.status, 200)
  const stuMyData = await stuMyRes.json()
  assert.equal(stuMyData.stats.late, 1)
  assert.equal(stuMyData.stats.absent, 0)
  assert.equal(stuMyData.stats.overallPercentage, 100)

  switchUser('user_lecturer_cs301')
  const reportRes = await attendanceReportsRoute.GET(
    new Request('http://localhost/api/attendance/reports?type=subject&subjectId=subj_cs301')
  )
  assert.equal(reportRes.status, 200)
  const reportData = await reportRes.json()
  assert.equal(reportData.totalSessions, 1)
  assert.equal(reportData.students.length, 2)
  assert.equal(reportData.sessions[0].percentage, 100)
})

// ============================================================================
// Test #35: Role-Based Access Control & Teacher Workflows (Meetings, Attendance, Assessments, Assignments)
// ============================================================================

test('Test #35: Teacher Workflows & RBAC — students & unassigned lecturers blocked with 403; assigned teacher & admin permitted', async () => {
  const sessionId = store.attendanceSessions[0].id
  const meetingId = store.plannerEvents[0].id

  // 1. Student blocked from teacher mutations across meetings, attendance, assessments, and assignments
  switchUser('user_student_1')

  const stuCreateMeeting = await meetingsRoute.POST(
    new Request('http://localhost/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthorized Student Meeting',
        startTime: '2026-10-26T10:00:00.000Z',
        endTime: '2026-10-26T11:00:00.000Z',
      }),
    })
  )
  assert.equal(stuCreateMeeting.status, 403)

  const stuCancelMeeting = await meetingIdRoute.PATCH(
    new Request(`http://localhost/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    }),
    { params: Promise.resolve({ id: meetingId }) }
  )
  assert.equal(stuCancelMeeting.status, 403)

  const stuMarkAttendance = await attendanceMarkRoute.POST(
    new Request('http://localhost/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        records: [{ userId: 'user_student_1', status: 'PRESENT' }],
      }),
    })
  )
  assert.equal(stuMarkAttendance.status, 403)

  const stuEditAttendance = await attendanceEditRoute.PUT(
    new Request('http://localhost/api/attendance/edit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userId: 'user_student_1',
        status: 'PRESENT',
      }),
    })
  )
  assert.equal(stuEditAttendance.status, 403)

  // 2. Unassigned Lecturer (prof.iyer, not teaching CS301) blocked from CS301 sessions, meetings, and grading
  switchUser('user_lecturer_other')

  const unassignedSessionRes = await attendanceSessionsRoute.POST(
    new Request('http://localhost/api/attendance/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'subj_cs301',
        date: '2026-10-23',
        period: 2,
      }),
    })
  )
  assert.equal(unassignedSessionRes.status, 403)

  const unassignedMarkRes = await attendanceMarkRoute.POST(
    new Request('http://localhost/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        records: [{ userId: 'user_student_1', status: 'ABSENT' }],
      }),
    })
  )
  assert.equal(unassignedMarkRes.status, 403)

  // 3. Assigned Lecturer creates Assessment, loads full class roster, and grades students
  switchUser('user_lecturer_cs301')
  const createAssessRes = await assessmentsRoute.POST(
    new Request('http://localhost/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'subj_cs301',
        name: 'Midterm Assessment 1',
        type: 'INTERNAL_ASSESSMENT',
        maxMarks: 50,
        weight: 1.0,
        assessmentDate: '2026-10-28T00:00:00.000Z',
      }),
    })
  )
  assert.equal(createAssessRes.status, 200)
  const assessId = (await createAssessRes.json()).assessment.id

  const getAssessDetailRes = await assessmentIdRoute.GET(
    new Request(`http://localhost/api/assessments/${assessId}`),
    { params: Promise.resolve({ id: assessId }) }
  )
  assert.equal(getAssessDetailRes.status, 200)
  const assessDetail = (await getAssessDetailRes.json()).assessment
  assert.equal(assessDetail.roster.length, 2)

  // Reject marks exceeding maxMarks (50)
  const invalidGradeRes = await assessmentIdRoute.PUT(
    new Request(`http://localhost/api/assessments/${assessId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [{ userId: 'user_student_1', marksObtained: 65 }],
      }),
    }),
    { params: Promise.resolve({ id: assessId }) }
  )
  assert.equal(invalidGradeRes.status, 400)

  // Valid marks entry & publish
  const validGradeRes = await assessmentIdRoute.PUT(
    new Request(`http://localhost/api/assessments/${assessId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPublished: true,
        results: [
          { userId: 'user_student_1', marksObtained: 46, feedback: 'Strong DP proofs' },
          { userId: 'user_student_2', marksObtained: 41, feedback: 'Good work' },
        ],
      }),
    }),
    { params: Promise.resolve({ id: assessId }) }
  )
  assert.equal(validGradeRes.status, 200)
  const gradedAssessment = (await validGradeRes.json()).assessment
  assert.equal(gradedAssessment.isPublished, true)
  assert.equal(gradedAssessment.results.length, 2)

  // 4. Assigned Lecturer creates Assignment & grades a student submission; Admin also has full access
  const createAsgnRes = await assignmentsMyRoute.POST(
    new Request('http://localhost/api/assignments/my', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: 'subj_cs301',
        title: 'Graph Algorithms Implementation',
        maxMarks: 100,
        dueDate: '2026-11-05T23:59:59.000Z',
      }),
    })
  )
  assert.equal(createAsgnRes.status, 200)
  const assignmentId = (await createAsgnRes.json()).assignment.id

  const sub = await mockPrisma.assignmentSubmission.create({
    data: {
      assignmentId,
      userId: 'user_student_1',
      status: 'SUBMITTED',
      submissionNumber: 1,
      content: 'Implemented Dijkstra using binary heap.',
    },
  })

  switchUser('user_admin')
  const adminGradeSubRes = await assignmentSubmissionsRoute.PATCH(
    new Request(`http://localhost/api/assignments/${assignmentId}/submissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: sub.id,
        marksObtained: 95,
        feedback: 'Clean O((V+E) log V) implementation.',
      }),
    }),
    { params: Promise.resolve({ id: assignmentId }) }
  )
  assert.equal(adminGradeSubRes.status, 200)
  const gradedSub = (await adminGradeSubRes.json()).submission
  assert.equal(gradedSub.status, 'EVALUATED')
  assert.equal(gradedSub.marksObtained, 95)
})

// ============================================================================
// Test #36: Frontend Teacher & Classroom Management TSX Compilation & Wiring
// ============================================================================

test('Test #36: Frontend Teacher & Classroom pages compile cleanly and wire up meetings, attendance, and grading endpoints', async () => {
  const pagesToVerify = [
    {
      relPath: 'app/(dashboard)/attendance/page.tsx',
      requiredPatterns: [
        '/api/attendance/sessions',
        '/api/attendance/mark',
        '/api/attendance/edit',
        '/api/attendance/my',
        'Confirm Cancel Session',
        'Mark All Present',
      ],
    },
    {
      relPath: 'app/(dashboard)/planner/page.tsx',
      requiredPatterns: [
        '/api/planner/events',
        '/api/planner/tasks',
        'meetingLink',
        'includeClassStudents',
        'Confirm Cancel Meeting',
      ],
    },
    {
      relPath: 'app/(dashboard)/dashboard/lecturer-dashboard.tsx',
      requiredPatterns: ['/api/meetings', 'Teacher Meetings', '/attendance', '/planner'],
    },
    {
      relPath: 'app/(dashboard)/assessments/page.tsx',
      requiredPatterns: ['/api/assessments', 'assessmentDetail?.roster', 'Confirm Delete'],
    },
    {
      relPath: 'app/(dashboard)/assignments/page.tsx',
      requiredPatterns: ['/api/assignments/my', '/submissions', 'Save Grade'],
    },
  ]

  for (const page of pagesToVerify) {
    const fullPath = path.join(srcRoot, page.relPath)
    const source = fs.readFileSync(fullPath, 'utf8')
    const compiled = babel.transformSync(source, {
      filename: fullPath,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    })
    assert.ok(compiled && compiled.code.length > 100, `Failed to compile ${page.relPath}`)
    for (const pattern of page.requiredPatterns) {
      assert.ok(
        source.includes(pattern),
        `Expected ${page.relPath} to include "${pattern}"`
      )
    }
  }
})
