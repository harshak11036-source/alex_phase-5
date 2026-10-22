import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth'
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
  validateMeetingLink,
  type ResolvedClassroomContext,
} from '@/lib/classroom-permissions'
import { AuditLogService } from '@/lib/audit-log'

export interface MeetingParticipant {
  userId?: string | null
  email: string
  name: string
  role: string
  status: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE'
  respondedAt?: string | null
}

export interface MeetingMetadata {
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED'
  isCancelled: boolean
  cancelledAt?: string | null
  cancelledBy?: string | null
  cancelReason?: string | null
  meetingLink?: string | null
  location?: string | null
  agenda?: string | null
  notes?: string | null
  organizerId: string
  organizerName: string
  organizerEmail: string
  organizerRole: string
  includeClassStudents?: boolean
  participants: MeetingParticipant[]
}

const VALID_EVENT_TYPES = [
  'MEETING',
  'OFFICE_HOURS',
  'CLASS',
  'EXAM',
  'DEADLINE',
  'STUDY_SESSION',
] as const

const TEACHER_ONLY_EVENT_TYPES = new Set(['MEETING', 'OFFICE_HOURS', 'CLASS'])
const VALID_PARTICIPANT_STATUSES = new Set([
  'INVITED',
  'ACCEPTED',
  'DECLINED',
  'TENTATIVE',
])

export async function resolveParticipantsList(params: {
  rawParticipants?: unknown[]
  participantIds?: string[]
  participantEmails?: string[]
  subjectId?: string | null
  includeClassStudents?: boolean
  existingParticipants?: MeetingParticipant[]
}): Promise<MeetingParticipant[]> {
  const existingByKey = new Map<string, MeetingParticipant>()
  for (const existing of params.existingParticipants || []) {
    if (existing.userId) existingByKey.set(`id:${existing.userId}`, existing)
    if (existing.email) existingByKey.set(`email:${existing.email.toLowerCase()}`, existing)
  }

  const candidateIds = new Set<string>(params.participantIds || [])
  const candidateEmails = new Set<string>(
    (params.participantEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  )
  const explicitEntries: Array<{
    userId?: string
    email?: string
    name?: string
    role?: string
    status?: string
  }> = []

  if (Array.isArray(params.rawParticipants)) {
    for (const item of params.rawParticipants) {
      if (typeof item === 'string') {
        const trimmed = item.trim()
        if (!trimmed) continue
        if (trimmed.includes('@')) {
          candidateEmails.add(trimmed.toLowerCase())
          explicitEntries.push({ email: trimmed.toLowerCase() })
        } else {
          candidateIds.add(trimmed)
          explicitEntries.push({ userId: trimmed })
        }
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const userId = typeof obj.userId === 'string' ? obj.userId.trim() : typeof obj.id === 'string' ? obj.id.trim() : undefined
        const email = typeof obj.email === 'string' ? obj.email.trim().toLowerCase() : undefined
        const name = typeof obj.name === 'string' ? obj.name.trim() : undefined
        const role = typeof obj.role === 'string' ? obj.role.trim() : undefined
        const status = typeof obj.status === 'string' ? obj.status.trim().toUpperCase() : undefined
        if (userId) candidateIds.add(userId)
        if (email) candidateEmails.add(email)
        if (userId || email || name) {
          explicitEntries.push({ userId, email, name, role, status })
        }
      }
    }
  }

  if (params.includeClassStudents && params.subjectId) {
    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { subjectId: params.subjectId, isActive: true },
      select: { userId: true },
    })
    for (const e of enrollments) {
      candidateIds.add(e.userId)
    }
  }

  const dbUsers =
    candidateIds.size > 0 || candidateEmails.size > 0
      ? await prisma.user.findMany({
          where: {
            OR: [
              ...(candidateIds.size > 0 ? [{ id: { in: Array.from(candidateIds) } }] : []),
              ...(candidateEmails.size > 0
                ? [{ email: { in: Array.from(candidateEmails) } }]
                : []),
            ],
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        })
      : []

  const userById = new Map(dbUsers.map((u) => [u.id, u]))
  const userByEmail = new Map(dbUsers.map((u) => [u.email.toLowerCase(), u]))

  const finalMap = new Map<string, MeetingParticipant>()

  const upsertParticipant = (entry: {
    userId?: string
    email?: string
    name?: string
    role?: string
    status?: string
  }) => {
    const matchedUser =
      (entry.userId ? userById.get(entry.userId) : undefined) ||
      (entry.email ? userByEmail.get(entry.email.toLowerCase()) : undefined)

    const resolvedUserId = matchedUser?.id || entry.userId || null
    const resolvedEmail = (
      matchedUser?.email ||
      entry.email ||
      (resolvedUserId ? `${resolvedUserId}@local` : '')
    ).toLowerCase()

    if (!resolvedUserId && !resolvedEmail) return

    const prior =
      (resolvedUserId ? existingByKey.get(`id:${resolvedUserId}`) : undefined) ||
      (resolvedEmail ? existingByKey.get(`email:${resolvedEmail}`) : undefined)

    const fullName = matchedUser
      ? `${matchedUser.firstName} ${matchedUser.lastName}`.trim()
      : entry.name || prior?.name || resolvedEmail

    const resolvedRole = matchedUser?.role || entry.role || prior?.role || 'STUDENT'
    const requestedStatus = entry.status?.toUpperCase()
    const resolvedStatus = (
      requestedStatus && VALID_PARTICIPANT_STATUSES.has(requestedStatus)
        ? requestedStatus
        : prior?.status || 'INVITED'
    ) as MeetingParticipant['status']

    const key = resolvedUserId ? `id:${resolvedUserId}` : `email:${resolvedEmail}`
    finalMap.set(key, {
      userId: resolvedUserId,
      email: resolvedEmail,
      name: fullName,
      role: resolvedRole,
      status: resolvedStatus,
      respondedAt: prior?.respondedAt || null,
    })
  }

  for (const entry of explicitEntries) {
    upsertParticipant(entry)
  }
  for (const id of candidateIds) {
    if (!finalMap.has(`id:${id}`)) {
      upsertParticipant({ userId: id })
    }
  }
  for (const email of candidateEmails) {
    const matched = userByEmail.get(email)
    const key = matched ? `id:${matched.id}` : `email:${email}`
    if (!finalMap.has(key)) {
      upsertParticipant({ email })
    }
  }

  return Array.from(finalMap.values())
}

export function extractMeetingMetadata(
  event: {
    userId: string
    description: string | null
    metadata: unknown
    user?: { id: string; firstName: string; lastName: string; email: string; role?: string } | null
  }
): MeetingMetadata {
  const raw =
    event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? (event.metadata as Record<string, any>)
      : {}

  const isCancelled = Boolean(raw.isCancelled || raw.status === 'CANCELLED')
  const status: MeetingMetadata['status'] = isCancelled
    ? 'CANCELLED'
    : raw.status === 'COMPLETED'
      ? 'COMPLETED'
      : 'SCHEDULED'

  const organizerName =
    raw.organizerName ||
    (event.user ? `${event.user.firstName} ${event.user.lastName}`.trim() : 'Organizer')

  const participants: MeetingParticipant[] = Array.isArray(raw.participants)
    ? raw.participants.map((p: any) => ({
        userId: p.userId || null,
        email: String(p.email || ''),
        name: String(p.name || p.email || 'Participant'),
        role: String(p.role || 'STUDENT'),
        status: VALID_PARTICIPANT_STATUSES.has(String(p.status || '').toUpperCase())
          ? (String(p.status).toUpperCase() as MeetingParticipant['status'])
          : 'INVITED',
        respondedAt: p.respondedAt || null,
      }))
    : []

  return {
    status,
    isCancelled,
    cancelledAt: raw.cancelledAt || null,
    cancelledBy: raw.cancelledBy || null,
    cancelReason: raw.cancelReason || null,
    meetingLink: raw.meetingLink || null,
    location: raw.location || null,
    agenda: raw.agenda ?? event.description ?? null,
    notes: raw.notes || null,
    organizerId: raw.organizerId || event.userId,
    organizerName,
    organizerEmail: raw.organizerEmail || event.user?.email || '',
    organizerRole: raw.organizerRole || event.user?.role || 'LECTURER',
    includeClassStudents: Boolean(raw.includeClassStudents),
    participants,
  }
}

export function formatPlannerEventResponse(
  event: any,
  user: AuthenticatedUser,
  context: ResolvedClassroomContext,
  assignedSubjectIds: Set<string>
) {
  const meta = extractMeetingMetadata(event)
  const canManage =
    event.userId === user.id ||
    context.isAdmin ||
    (context.isTeacher && Boolean(event.subjectId && assignedSubjectIds.has(event.subjectId)))

  return {
    ...event,
    status: meta.status,
    isCancelled: meta.isCancelled,
    cancelledAt: meta.cancelledAt,
    cancelReason: meta.cancelReason,
    meetingLink: meta.meetingLink,
    location: meta.location,
    agenda: meta.agenda,
    notes: meta.notes,
    includeClassStudents: meta.includeClassStudents,
    organizer: {
      id: meta.organizerId,
      name: meta.organizerName,
      email: meta.organizerEmail,
      role: meta.organizerRole,
    },
    participants: meta.participants,
    participantCount: meta.participants.length,
    canManage,
    isMeeting: TEACHER_ONLY_EVENT_TYPES.has(event.eventType),
    metadata: meta,
  }
}

export async function listMeetingsAndEvents(
  user: AuthenticatedUser,
  options: {
    startDate?: string | null
    endDate?: string | null
    subjectId?: string | null
    eventType?: string | null
    status?: string | null
    includeCancelled?: boolean
    meetingsOnly?: boolean
  } = {}
) {
  const context = await resolveClassroomContext(user)

  const [enrollments, lecturerAssignments] = await Promise.all([
    prisma.subjectEnrollment.findMany({
      where: { userId: user.id, isActive: true },
      select: { subjectId: true },
    }),
    prisma.lecturerAssignment.findMany({
      where: { userId: user.id },
      select: { subjectId: true },
    }),
  ])

  const enrolledSubjectIds = new Set(enrollments.map((e) => e.subjectId))
  const assignedSubjectIds = new Set(lecturerAssignments.map((a) => a.subjectId))
  const visibleSubjectIds = Array.from(new Set([...enrolledSubjectIds, ...assignedSubjectIds]))

  const whereClause: Record<string, any> = {}

  if (options.startDate || options.endDate) {
    whereClause.startTime = {}
    if (options.startDate) {
      const start = new Date(options.startDate)
      if (!Number.isNaN(start.getTime())) whereClause.startTime.gte = start
    }
    if (options.endDate) {
      const end = new Date(options.endDate)
      if (!Number.isNaN(end.getTime())) whereClause.startTime.lte = end
    }
  }

  if (options.subjectId) {
    whereClause.subjectId = options.subjectId
  }

  if (options.eventType) {
    whereClause.eventType = options.eventType.toUpperCase()
  } else if (options.meetingsOnly) {
    whereClause.eventType = { in: ['MEETING', 'OFFICE_HOURS', 'CLASS'] }
  }

  const candidateEvents = await prisma.plannerEvent.findMany({
    where: whereClause,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  const userEmailLower = (user.email || '').toLowerCase()

  const accessible = candidateEvents.filter((event) => {
    if (context.isAdmin) return true
    if (event.userId === user.id) return true
    if (event.subjectId && visibleSubjectIds.includes(event.subjectId)) return true

    const meta = extractMeetingMetadata(event)
    const isParticipant = meta.participants.some(
      (p) =>
        (p.userId && p.userId === user.id) ||
        (p.email && userEmailLower && p.email.toLowerCase() === userEmailLower)
    )
    return isParticipant
  })

  const formatted = accessible
    .map((event) => formatPlannerEventResponse(event, user, context, assignedSubjectIds))
    .filter((item) => {
      if (options.includeCancelled === false && item.isCancelled) return false
      if (options.status && item.status !== options.status.toUpperCase()) return false
      return true
    })

  return {
    events: formatted,
    meetings: formatted.filter((e) => e.isMeeting),
    context,
  }
}

export async function createMeetingOrEvent(
  user: AuthenticatedUser,
  body: Record<string, any>,
  options: { requireTeacher?: boolean } = {}
) {
  const context = await resolveClassroomContext(user)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return { status: 400, error: 'Title is required' }
  }

  const rawType = typeof body.eventType === 'string' ? body.eventType.trim().toUpperCase() : 'MEETING'
  const eventType = VALID_EVENT_TYPES.includes(rawType as any) ? rawType : 'MEETING'

  const hasTeacherFeatures =
    options.requireTeacher ||
    TEACHER_ONLY_EVENT_TYPES.has(eventType) ||
    Boolean(body.includeClassStudents) ||
    (Array.isArray(body.participants) && body.participants.length > 0) ||
    (Array.isArray(body.participantIds) && body.participantIds.length > 0) ||
    (Array.isArray(body.participantEmails) && body.participantEmails.length > 0)

  if (hasTeacherFeatures && !context.isTeacher) {
    return {
      status: 403,
      error: 'Forbidden: Only teachers and administrators can create or schedule classroom meetings',
    }
  }

  if (!body.startTime || !body.endTime) {
    return { status: 400, error: 'Start time and end time are required' }
  }

  const startTime = new Date(body.startTime)
  const endTime = new Date(body.endTime)
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { status: 400, error: 'Invalid startTime or endTime date format' }
  }

  const allDay = Boolean(body.allDay)
  if (allDay ? endTime < startTime : endTime <= startTime) {
    return { status: 400, error: 'End time must be after start time' }
  }

  const linkValidation = validateMeetingLink(body.meetingLink ?? body.metadata?.meetingLink)
  if (!linkValidation.valid) {
    return { status: 400, error: linkValidation.error || 'Invalid meeting link' }
  }

  const subjectId =
    typeof body.subjectId === 'string' && body.subjectId.trim() && body.subjectId !== 'NONE'
      ? body.subjectId.trim()
      : null

  if (subjectId) {
    if (context.isTeacher) {
      const access = await verifySubjectManagementAccess(user, subjectId)
      if (!access.allowed) {
        return { status: access.status, error: access.error }
      }
    } else {
      const enrolled = await prisma.subjectEnrollment.findFirst({
        where: { userId: user.id, subjectId, isActive: true },
      })
      if (!enrolled) {
        return { status: 403, error: 'Forbidden: You are not enrolled in this subject' }
      }
    }
  }

  const includeClassStudents = Boolean(
    body.includeClassStudents ?? body.metadata?.includeClassStudents
  )

  const participants = await resolveParticipantsList({
    rawParticipants: body.participants ?? body.metadata?.participants,
    participantIds: body.participantIds,
    participantEmails: body.participantEmails,
    subjectId,
    includeClassStudents,
  })

  const organizerUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  })

  const description =
    typeof body.description === 'string'
      ? body.description.trim()
      : typeof body.agenda === 'string'
        ? body.agenda.trim()
        : null

  const agenda =
    typeof body.agenda === 'string'
      ? body.agenda.trim()
      : typeof body.metadata?.agenda === 'string'
        ? body.metadata.agenda.trim()
        : description

  const location =
    typeof body.location === 'string'
      ? body.location.trim() || null
      : typeof body.metadata?.location === 'string'
        ? body.metadata.location.trim() || null
        : null

  const notes =
    typeof body.notes === 'string'
      ? body.notes.trim() || null
      : typeof body.metadata?.notes === 'string'
        ? body.metadata.notes.trim() || null
        : null

  const metadata: MeetingMetadata = {
    status: 'SCHEDULED',
    isCancelled: false,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    meetingLink: linkValidation.normalized,
    location,
    agenda: agenda || null,
    notes,
    organizerId: user.id,
    organizerName: organizerUser
      ? `${organizerUser.firstName} ${organizerUser.lastName}`.trim()
      : user.name || 'Teacher',
    organizerEmail: organizerUser?.email || user.email || '',
    organizerRole: context.effectiveRole,
    includeClassStudents,
    participants,
  }

  const created = await prisma.plannerEvent.create({
    data: {
      userId: user.id,
      title,
      description,
      startTime,
      endTime,
      allDay,
      eventType,
      subjectId,
      taskId: typeof body.taskId === 'string' && body.taskId.trim() ? body.taskId.trim() : null,
      metadata: metadata as any,
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  })

  await AuditLogService.log({
    institutionId: context.institutionId,
    userId: user.id,
    action: 'MEETING_CREATE',
    entityType: 'PlannerEvent',
    entityId: created.id,
    newValues: {
      title,
      eventType,
      subjectId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      meetingLink: metadata.meetingLink,
      participantCount: participants.length,
    },
  })

  const formatted = formatPlannerEventResponse(
    created,
    user,
    context,
    new Set(subjectId ? [subjectId] : [])
  )

  return {
    status: 200,
    event: formatted,
    meeting: formatted,
  }
}

export async function getMeetingOrEventById(user: AuthenticatedUser, eventId: string) {
  const context = await resolveClassroomContext(user)

  const event = await prisma.plannerEvent.findUnique({
    where: { id: eventId },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  })

  if (!event) {
    return { status: 404, error: 'Meeting or event not found' }
  }

  const [enrollment, assignment] = event.subjectId
    ? await Promise.all([
        prisma.subjectEnrollment.findFirst({
          where: { userId: user.id, subjectId: event.subjectId, isActive: true },
        }),
        prisma.lecturerAssignment.findFirst({
          where: { userId: user.id, subjectId: event.subjectId },
        }),
      ])
    : [null, null]

  const meta = extractMeetingMetadata(event)
  const userEmailLower = (user.email || '').toLowerCase()
  const isParticipant = meta.participants.some(
    (p) =>
      (p.userId && p.userId === user.id) ||
      (p.email && userEmailLower && p.email.toLowerCase() === userEmailLower)
  )

  const canView =
    context.isAdmin ||
    event.userId === user.id ||
    Boolean(enrollment) ||
    Boolean(assignment) ||
    isParticipant

  if (!canView) {
    return { status: 403, error: 'Forbidden: You do not have access to this meeting' }
  }

  const formatted = formatPlannerEventResponse(
    event,
    user,
    context,
    new Set(assignment && event.subjectId ? [event.subjectId] : [])
  )

  return {
    status: 200,
    event: formatted,
    meeting: formatted,
  }
}

export async function updateMeetingOrEvent(
  user: AuthenticatedUser,
  eventId: string,
  body: Record<string, any>
) {
  const context = await resolveClassroomContext(user)

  const existing = await prisma.plannerEvent.findUnique({
    where: { id: eventId },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  })

  if (!existing) {
    return { status: 404, error: 'Meeting or event not found' }
  }

  const currentMeta = extractMeetingMetadata(existing)

  // Handle participant self-RSVP
  if (body.action === 'rsvp' || (body.rsvpStatus && Object.keys(body).length <= 2)) {
    const requestedRsvp = String(body.rsvpStatus || body.status || 'ACCEPTED').toUpperCase()
    if (!VALID_PARTICIPANT_STATUSES.has(requestedRsvp)) {
      return { status: 400, error: 'Invalid RSVP status' }
    }
    const userEmailLower = (user.email || '').toLowerCase()
    const participantIndex = currentMeta.participants.findIndex(
      (p) =>
        (p.userId && p.userId === user.id) ||
        (p.email && userEmailLower && p.email.toLowerCase() === userEmailLower)
    )
    if (participantIndex === -1) {
      return { status: 403, error: 'Forbidden: You are not a participant of this meeting' }
    }

    const updatedParticipants = [...currentMeta.participants]
    updatedParticipants[participantIndex] = {
      ...updatedParticipants[participantIndex],
      status: requestedRsvp as MeetingParticipant['status'],
      respondedAt: new Date().toISOString(),
    }

    const updatedMeta: MeetingMetadata = {
      ...currentMeta,
      participants: updatedParticipants,
    }

    const updated = await prisma.plannerEvent.update({
      where: { id: eventId },
      data: { metadata: updatedMeta as any },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    })

    const formatted = formatPlannerEventResponse(updated, user, context, new Set())
    return { status: 200, event: formatted, meeting: formatted }
  }

  // Verify management permissions
  let isAssignedLecturer = false
  if (existing.subjectId && context.isTeacher) {
    const assignment = await prisma.lecturerAssignment.findFirst({
      where: { userId: user.id, subjectId: existing.subjectId },
    })
    isAssignedLecturer = Boolean(assignment)
  }

  const canManage =
    existing.userId === user.id || context.isAdmin || (context.isTeacher && isAssignedLecturer)

  if (!canManage) {
    return {
      status: 403,
      error: 'Forbidden: Only the meeting organizer, assigned subject teacher, or administrator can modify this meeting',
    }
  }

  const nextTitle =
    body.title !== undefined ? String(body.title).trim() : existing.title
  if (!nextTitle) {
    return { status: 400, error: 'Title cannot be empty' }
  }

  const nextStartTime =
    body.startTime !== undefined ? new Date(body.startTime) : existing.startTime
  const nextEndTime =
    body.endTime !== undefined ? new Date(body.endTime) : existing.endTime

  if (Number.isNaN(nextStartTime.getTime()) || Number.isNaN(nextEndTime.getTime())) {
    return { status: 400, error: 'Invalid startTime or endTime' }
  }

  const nextAllDay = body.allDay !== undefined ? Boolean(body.allDay) : existing.allDay
  if (nextAllDay ? nextEndTime < nextStartTime : nextEndTime <= nextStartTime) {
    return { status: 400, error: 'End time must be after start time' }
  }

  let nextSubjectId = existing.subjectId
  if (body.subjectId !== undefined) {
    nextSubjectId =
      typeof body.subjectId === 'string' && body.subjectId.trim() && body.subjectId !== 'NONE'
        ? body.subjectId.trim()
        : null
    if (nextSubjectId && nextSubjectId !== existing.subjectId) {
      const access = await verifySubjectManagementAccess(user, nextSubjectId)
      if (!access.allowed) {
        return { status: access.status, error: access.error }
      }
    }
  }

  const rawLinkInput =
    body.meetingLink !== undefined
      ? body.meetingLink
      : body.metadata?.meetingLink !== undefined
        ? body.metadata.meetingLink
        : currentMeta.meetingLink

  const linkValidation = validateMeetingLink(rawLinkInput)
  if (!linkValidation.valid) {
    return { status: 400, error: linkValidation.error || 'Invalid meeting link' }
  }

  const isCancelling =
    body.action === 'cancel' ||
    body.isCancelled === true ||
    String(body.status || '').toUpperCase() === 'CANCELLED' ||
    body.metadata?.isCancelled === true ||
    String(body.metadata?.status || '').toUpperCase() === 'CANCELLED'

  const isReopening =
    body.action === 'reopen' ||
    body.action === 'reschedule' ||
    body.isCancelled === false ||
    String(body.status || '').toUpperCase() === 'SCHEDULED'

  let nextStatus: MeetingMetadata['status'] = currentMeta.status
  let nextIsCancelled = currentMeta.isCancelled
  let nextCancelledAt = currentMeta.cancelledAt
  let nextCancelledBy = currentMeta.cancelledBy
  let nextCancelReason = currentMeta.cancelReason

  if (isCancelling) {
    nextStatus = 'CANCELLED'
    nextIsCancelled = true
    nextCancelledAt = new Date().toISOString()
    nextCancelledBy = user.id
    nextCancelReason =
      typeof body.cancelReason === 'string'
        ? body.cancelReason.trim() || 'Cancelled by organizer'
        : typeof body.metadata?.cancelReason === 'string'
          ? body.metadata.cancelReason.trim() || 'Cancelled by organizer'
          : currentMeta.cancelReason || 'Cancelled by organizer'
  } else if (isReopening) {
    nextStatus = 'SCHEDULED'
    nextIsCancelled = false
    nextCancelledAt = null
    nextCancelledBy = null
    nextCancelReason = null
  } else if (String(body.status || '').toUpperCase() === 'COMPLETED') {
    nextStatus = 'COMPLETED'
    nextIsCancelled = false
  }

  const nextIncludeClassStudents =
    body.includeClassStudents !== undefined
      ? Boolean(body.includeClassStudents)
      : currentMeta.includeClassStudents

  let nextParticipants = currentMeta.participants
  if (
    body.participants !== undefined ||
    body.participantIds !== undefined ||
    body.participantEmails !== undefined ||
    body.includeClassStudents !== undefined
  ) {
    nextParticipants = await resolveParticipantsList({
      rawParticipants: body.participants ?? body.metadata?.participants,
      participantIds: body.participantIds,
      participantEmails: body.participantEmails,
      subjectId: nextSubjectId,
      includeClassStudents: nextIncludeClassStudents,
      existingParticipants: currentMeta.participants,
    })
  }

  const nextDescription =
    body.description !== undefined
      ? body.description
        ? String(body.description).trim()
        : null
      : existing.description

  const nextAgenda =
    body.agenda !== undefined
      ? body.agenda
        ? String(body.agenda).trim()
        : null
      : body.description !== undefined
        ? nextDescription
        : currentMeta.agenda

  const nextLocation =
    body.location !== undefined
      ? body.location
        ? String(body.location).trim()
        : null
      : body.metadata?.location !== undefined
        ? body.metadata.location
        : currentMeta.location

  const nextNotes =
    body.notes !== undefined
      ? body.notes
        ? String(body.notes).trim()
        : null
      : body.metadata?.notes !== undefined
        ? body.metadata.notes
        : currentMeta.notes

  const nextEventType =
    body.eventType && VALID_EVENT_TYPES.includes(String(body.eventType).toUpperCase() as any)
      ? String(body.eventType).toUpperCase()
      : existing.eventType

  const updatedMetadata: MeetingMetadata = {
    ...currentMeta,
    status: nextStatus,
    isCancelled: nextIsCancelled,
    cancelledAt: nextCancelledAt,
    cancelledBy: nextCancelledBy,
    cancelReason: nextCancelReason,
    meetingLink: linkValidation.normalized,
    location: nextLocation,
    agenda: nextAgenda,
    notes: nextNotes,
    includeClassStudents: nextIncludeClassStudents,
    participants: nextParticipants,
  }

  const updated = await prisma.plannerEvent.update({
    where: { id: eventId },
    data: {
      title: nextTitle,
      description: nextDescription,
      startTime: nextStartTime,
      endTime: nextEndTime,
      allDay: nextAllDay,
      eventType: nextEventType,
      subjectId: nextSubjectId,
      metadata: updatedMetadata as any,
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  })

  await AuditLogService.log({
    institutionId: context.institutionId,
    userId: user.id,
    action: isCancelling ? 'MEETING_CANCEL' : 'MEETING_UPDATE',
    entityType: 'PlannerEvent',
    entityId: updated.id,
    oldValues: {
      title: existing.title,
      startTime: existing.startTime.toISOString(),
      endTime: existing.endTime.toISOString(),
      status: currentMeta.status,
      meetingLink: currentMeta.meetingLink,
    },
    newValues: {
      title: updated.title,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime.toISOString(),
      status: updatedMetadata.status,
      cancelReason: updatedMetadata.cancelReason,
      meetingLink: updatedMetadata.meetingLink,
      participantCount: updatedMetadata.participants.length,
    },
  })

  const formatted = formatPlannerEventResponse(
    updated,
    user,
    context,
    new Set(nextSubjectId ? [nextSubjectId] : [])
  )

  return {
    status: 200,
    event: formatted,
    meeting: formatted,
  }
}

export async function deleteMeetingOrEvent(user: AuthenticatedUser, eventId: string) {
  const context = await resolveClassroomContext(user)

  const existing = await prisma.plannerEvent.findUnique({
    where: { id: eventId },
  })

  if (!existing) {
    return { status: 404, error: 'Meeting or event not found' }
  }

  let isAssignedLecturer = false
  if (existing.subjectId && context.isTeacher) {
    const assignment = await prisma.lecturerAssignment.findFirst({
      where: { userId: user.id, subjectId: existing.subjectId },
    })
    isAssignedLecturer = Boolean(assignment)
  }

  const canManage =
    existing.userId === user.id || context.isAdmin || (context.isTeacher && isAssignedLecturer)

  if (!canManage) {
    return {
      status: 403,
      error: 'Forbidden: Only the meeting organizer, assigned subject teacher, or administrator can delete this meeting',
    }
  }

  await prisma.plannerEvent.delete({
    where: { id: eventId },
  })

  await AuditLogService.log({
    institutionId: context.institutionId,
    userId: user.id,
    action: 'MEETING_DELETE',
    entityType: 'PlannerEvent',
    entityId: eventId,
    oldValues: {
      title: existing.title,
      eventType: existing.eventType,
      subjectId: existing.subjectId,
    },
  })

  return {
    status: 200,
    success: true,
    deletedId: eventId,
  }
}
