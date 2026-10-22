import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth'

export interface ResolvedClassroomContext {
  effectiveRole: 'STUDENT' | 'LECTURER' | 'PROJECT_MENTOR' | 'ADMIN'
  isTeacher: boolean
  isAdmin: boolean
  institutionId: string | null
  studentId: string | null
}

export async function resolveClassroomContext(
  user: AuthenticatedUser
): Promise<ResolvedClassroomContext> {
  const membership = await prisma.collegeMembership.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
  })

  const rawRole =
    user.role && user.role !== 'STUDENT'
      ? user.role
      : membership?.role || user.role || 'STUDENT'

  const effectiveRole = (
    ['STUDENT', 'LECTURER', 'PROJECT_MENTOR', 'ADMIN'].includes(rawRole)
      ? rawRole
      : 'STUDENT'
  ) as ResolvedClassroomContext['effectiveRole']

  const isAdmin = effectiveRole === 'ADMIN'
  const isTeacher = ['LECTURER', 'PROJECT_MENTOR', 'ADMIN'].includes(effectiveRole)

  let institutionId = membership?.institutionId || user.institutionId || null
  if (!institutionId) {
    const firstInstitution = await prisma.institution.findFirst({
      select: { id: true },
    })
    institutionId = firstInstitution?.id || null
  }

  return {
    effectiveRole,
    isTeacher,
    isAdmin,
    institutionId,
    studentId: membership?.studentId || null,
  }
}

export async function verifySubjectManagementAccess(
  user: AuthenticatedUser,
  subjectId: string
): Promise<{
  allowed: boolean
  status: number
  error?: string
  subject?: {
    id: string
    name: string
    code: string
    semesterId: string
    departmentId: string
    institutionId: string
  }
  context: ResolvedClassroomContext
}> {
  const context = await resolveClassroomContext(user)

  if (!context.isTeacher) {
    return {
      allowed: false,
      status: 403,
      error: 'Forbidden: Only teachers and administrators can perform this action',
      context,
    }
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      code: true,
      semesterId: true,
      departmentId: true,
      institutionId: true,
    },
  })

  if (!subject) {
    return {
      allowed: false,
      status: 404,
      error: 'Subject not found',
      context,
    }
  }

  if (context.isAdmin) {
    return {
      allowed: true,
      status: 200,
      subject,
      context: {
        ...context,
        institutionId: context.institutionId || subject.institutionId,
      },
    }
  }

  const assignment = await prisma.lecturerAssignment.findFirst({
    where: {
      userId: user.id,
      subjectId,
    },
  })

  if (!assignment) {
    return {
      allowed: false,
      status: 403,
      error: 'Forbidden: You are not assigned to teach this subject',
      subject,
      context,
    }
  }

  return {
    allowed: true,
    status: 200,
    subject,
    context: {
      ...context,
      institutionId: context.institutionId || subject.institutionId,
    },
  }
}

/**
 * Normalizes any date string or Date object to UTC start-of-day (00:00:00.000Z)
 * so that attendance sessions for the same calendar date always match deterministically.
 */
export function normalizeCalendarDate(dateInput: unknown): Date | null {
  if (!dateInput) return null

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim()
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
    if (ymdMatch) {
      const year = Number(ymdMatch[1])
      const month = Number(ymdMatch[2])
      const day = Number(ymdMatch[3])
      const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      if (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
      ) {
        return d
      }
      return null
    }
  }

  const parsed = dateInput instanceof Date ? dateInput : new Date(String(dateInput))
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )
}

export function getCalendarDayBounds(dateInput: unknown): { start: Date; end: Date } | null {
  const start = normalizeCalendarDate(dateInput)
  if (!start) return null
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { start, end }
}

export function validateMeetingLink(linkInput: unknown): {
  valid: boolean
  normalized: string | null
  error?: string
} {
  if (linkInput === undefined || linkInput === null) {
    return { valid: true, normalized: null }
  }
  const trimmed = String(linkInput).trim()
  if (!trimmed) {
    return { valid: true, normalized: null }
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalized: null,
        error: 'Meeting link must use http:// or https://',
      }
    }
    return { valid: true, normalized: parsed.toString() }
  } catch {
    return {
      valid: false,
      normalized: null,
      error: 'Meeting link must be a valid URL (e.g., https://meet.example.edu/room)',
    }
  }
}
