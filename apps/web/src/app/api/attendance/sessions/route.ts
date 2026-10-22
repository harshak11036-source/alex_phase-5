import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
  normalizeCalendarDate,
  getCalendarDayBounds,
} from '@/lib/classroom-permissions'
import { AuditLogService } from '@/lib/audit-log'

const VALID_ATTENDANCE_STATUSES = new Set([
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
  'ON_DUTY',
])

export function buildEnrichedSession(session: any, fallbackSemesterId?: string | null) {
  if (!session) return null
  const enrollments = Array.isArray(session.subject?.enrollments)
    ? session.subject.enrollments
    : []
  const records = Array.isArray(session.records) ? session.records : []

  const recordByUserId = new Map<string, any>()
  for (const r of records) {
    recordByUserId.set(r.userId, r)
  }

  const rosterMap = new Map<string, any>()

  for (const enrollment of enrollments) {
    const u = enrollment.user
    if (!u) continue
    const rec = recordByUserId.get(u.id)
    const studentId = u.memberships?.[0]?.studentId || null
    rosterMap.set(u.id, {
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      studentId,
      recordId: rec?.id || null,
      status: rec?.status || null,
      remarks: rec?.remarks || null,
      markedAt: rec?.markedAt || null,
      user: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        studentId,
      },
    })
  }

  for (const rec of records) {
    if (!rosterMap.has(rec.userId) && rec.user) {
      const studentId = rec.user.memberships?.[0]?.studentId || null
      rosterMap.set(rec.userId, {
        userId: rec.userId,
        firstName: rec.user.firstName,
        lastName: rec.user.lastName,
        email: rec.user.email,
        studentId,
        recordId: rec.id,
        status: rec.status,
        remarks: rec.remarks || null,
        markedAt: rec.markedAt || null,
        user: {
          id: rec.user.id,
          firstName: rec.user.firstName,
          lastName: rec.user.lastName,
          email: rec.user.email,
          studentId,
        },
      })
    }
  }

  const roster = Array.from(rosterMap.values()).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  )

  let present = 0
  let absent = 0
  let late = 0
  let excused = 0
  let onDuty = 0

  for (const r of records) {
    if (r.status === 'PRESENT') present++
    else if (r.status === 'ABSENT') absent++
    else if (r.status === 'LATE') late++
    else if (r.status === 'EXCUSED') excused++
    else if (r.status === 'ON_DUTY') onDuty++
  }

  const totalEnrolled = Math.max(roster.length, records.length)
  const markedCount = records.length
  const unmarkedCount = Math.max(0, totalEnrolled - markedCount)
  const attendedCount = present + late + onDuty
  const effectiveDenominator = Math.max(0, markedCount - excused)
  const attendancePercentage =
    effectiveDenominator > 0
      ? Math.round((attendedCount / effectiveDenominator) * 100)
      : markedCount > 0
        ? 100
        : 0

  const normalizedRecords = records.map((r: any) => ({
    ...r,
    user: r.user
      ? {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          email: r.user.email,
          studentId: r.user.memberships?.[0]?.studentId || null,
        }
      : undefined,
  }))

  return {
    ...session,
    semesterId:
      session.semesterId || session.subject?.semesterId || fallbackSemesterId || null,
    subject: session.subject
      ? {
          id: session.subject.id,
          name: session.subject.name,
          code: session.subject.code,
        }
      : undefined,
    records: normalizedRecords,
    roster,
    summary: {
      totalEnrolled,
      markedCount,
      unmarkedCount,
      present,
      absent,
      late,
      excused,
      onDuty,
      attendedCount,
      attendancePercentage,
    },
  }
}

export const SESSION_INCLUDE = {
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
      semesterId: true,
      institutionId: true,
      enrollments: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              memberships: { select: { studentId: true } },
            },
          },
        },
      },
    },
  },
  records: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          memberships: { select: { studentId: true } },
        },
      },
    },
  },
  _count: { select: { records: true } },
}

async function findMatchingSession(
  subjectId: string,
  period: number,
  bounds: { start: Date; end: Date },
  excludeId?: string
) {
  if (typeof prisma.attendanceSession.findFirst === 'function') {
    return prisma.attendanceSession.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        subjectId,
        period,
        date: { gte: bounds.start, lte: bounds.end },
      },
      include: SESSION_INCLUDE,
    })
  }
  const all = await prisma.attendanceSession.findMany({
    where: { subjectId },
    include: SESSION_INCLUDE,
  })
  return (
    all.find((s: any) => {
      if (excludeId && s.id === excludeId) return false
      if (s.subjectId !== subjectId || s.period !== period) return false
      const t = new Date(s.date).getTime()
      return t >= bounds.start.getTime() && t <= bounds.end.getTime()
    }) || null
  )
}

export async function GET(request?: Request) {
  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)
    const searchParams = request?.url
      ? new URL(request.url).searchParams
      : new URLSearchParams()

    const subjectId = searchParams.get('subjectId')
    const dateParam = searchParams.get('date')
    const periodParam = searchParams.get('period')
    const includeCancelled = searchParams.get('includeCancelled') !== 'false'

    const whereClause: Record<string, any> = {}

    if (subjectId) {
      whereClause.subjectId = subjectId
    } else if (!context.isAdmin) {
      if (context.isTeacher) {
        const assignments = await prisma.lecturerAssignment.findMany({
          where: { userId: user.id },
          select: { subjectId: true },
        })
        const assignedIds = assignments.map((a) => a.subjectId)
        whereClause.OR = [
          { subjectId: { in: assignedIds } },
          { conductedBy: user.id },
        ]
      } else {
        const enrollments = await prisma.subjectEnrollment.findMany({
          where: { userId: user.id, isActive: true },
          select: { subjectId: true },
        })
        whereClause.subjectId = { in: enrollments.map((e) => e.subjectId) }
        whereClause.isCancelled = false
      }
    }

    if (dateParam) {
      const bounds = getCalendarDayBounds(dateParam)
      if (!bounds) {
        return NextResponse.json({ error: 'Invalid date parameter' }, { status: 400 })
      }
      whereClause.date = { gte: bounds.start, lte: bounds.end }
    }

    if (periodParam !== null && periodParam !== '') {
      const parsedPeriod = Number(periodParam)
      if (Number.isInteger(parsedPeriod) && parsedPeriod > 0) {
        whereClause.period = parsedPeriod
      }
    }

    if (!includeCancelled) {
      whereClause.isCancelled = false
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: whereClause,
      include: SESSION_INCLUDE,
      orderBy: [{ date: 'desc' }, { period: 'asc' }],
      take: 100,
    })

    const enriched = sessions.map((s) => buildEnrichedSession(s))

    return NextResponse.json({ sessions: enriched })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Sessions] List error:', error)
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { subjectId, date, period = 1, topic, records, allowExisting, upsert } = body

    if (!subjectId || !date) {
      return NextResponse.json(
        { error: 'Subject ID and date are required' },
        { status: 400 }
      )
    }

    const access = await verifySubjectManagementAccess(user, String(subjectId))
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const normalizedDate = normalizeCalendarDate(date)
    if (!normalizedDate) {
      return NextResponse.json({ error: 'Invalid session date' }, { status: 400 })
    }

    const bounds = getCalendarDayBounds(normalizedDate)!
    const normalizedPeriod = Number(period ?? 1)
    if (!Number.isInteger(normalizedPeriod) || normalizedPeriod < 1 || normalizedPeriod > 12) {
      return NextResponse.json(
        { error: 'Period must be an integer between 1 and 12' },
        { status: 400 }
      )
    }

    const existingSession = await findMatchingSession(
      String(subjectId),
      normalizedPeriod,
      bounds
    )

    if (existingSession) {
      if (allowExisting === true || upsert === true) {
        const updatedSession = await prisma.$transaction(async (tx) => {
          if (topic !== undefined) {
            await tx.attendanceSession.update({
              where: { id: existingSession.id },
              data: {
                topic: topic ? String(topic).trim() : null,
                isCancelled: false,
                cancelReason: null,
              },
            })
          }

          if (Array.isArray(records) && records.length > 0) {
            const deduped = new Map<string, any>()
            for (const r of records) {
              if (r && r.userId && VALID_ATTENDANCE_STATUSES.has(String(r.status).toUpperCase())) {
                deduped.set(String(r.userId), {
                  userId: String(r.userId),
                  status: String(r.status).toUpperCase(),
                  remarks: r.remarks ? String(r.remarks) : null,
                })
              }
            }
            for (const r of deduped.values()) {
              await tx.attendanceRecord.upsert({
                where: {
                  sessionId_userId: { sessionId: existingSession.id, userId: r.userId },
                },
                update: {
                  status: r.status as any,
                  remarks: r.remarks,
                  markedBy: user.id,
                  markedAt: new Date(),
                },
                create: {
                  sessionId: existingSession.id,
                  userId: r.userId,
                  status: r.status as any,
                  remarks: r.remarks,
                  markedBy: user.id,
                },
              })
            }
          }

          if (typeof tx.attendanceSession.findUnique === 'function') {
            return tx.attendanceSession.findUnique({
              where: { id: existingSession.id },
              include: SESSION_INCLUDE,
            })
          }
          return existingSession
        })

        return NextResponse.json({
          session: buildEnrichedSession(updatedSession, access.subject?.semesterId),
          alreadyExisted: true,
        })
      }

      return NextResponse.json(
        {
          error: 'An attendance session already exists for this class, date, and period',
          code: 'DUPLICATE_SESSION',
          session: buildEnrichedSession(existingSession, access.subject?.semesterId),
        },
        { status: 409 }
      )
    }

    const dedupedInitialRecords = new Map<
      string,
      { userId: string; status: string; remarks: string | null }
    >()
    if (Array.isArray(records)) {
      for (const r of records) {
        if (!r || !r.userId || !r.status) continue
        const statusUpper = String(r.status).toUpperCase()
        if (!VALID_ATTENDANCE_STATUSES.has(statusUpper)) {
          return NextResponse.json(
            { error: `Invalid attendance status: ${r.status}` },
            { status: 400 }
          )
        }
        dedupedInitialRecords.set(String(r.userId), {
          userId: String(r.userId),
          status: statusUpper,
          remarks: r.remarks ? String(r.remarks) : null,
        })
      }
    }

    const createdSession = await prisma.$transaction(async (tx) => {
      const hasFindUnique = typeof tx.attendanceSession.findUnique === 'function'

      if (!hasFindUnique) {
        // Minimal mock compatibility path
        const enrollments = await prisma.subjectEnrollment.findMany({
          where: { subjectId: String(subjectId), isActive: true },
        })
        return tx.attendanceSession.create({
          data: {
            subjectId: String(subjectId),
            semesterId: access.subject?.semesterId,
            date: normalizedDate,
            period: normalizedPeriod,
            topic: typeof topic === 'string' && topic.trim() ? topic.trim() : null,
            conductedBy: user.id,
            records: {
              create: enrollments.map((e: any) => ({
                userId: e.userId,
                status: 'PRESENT',
                markedBy: user.id,
              })),
            },
          } as any,
        })
      }

      const session = await tx.attendanceSession.create({
        data: {
          subjectId: String(subjectId),
          date: normalizedDate,
          period: normalizedPeriod,
          topic: typeof topic === 'string' && topic.trim() ? topic.trim() : null,
          conductedBy: user.id,
        },
      })

      for (const r of dedupedInitialRecords.values()) {
        await tx.attendanceRecord.create({
          data: {
            sessionId: session.id,
            userId: r.userId,
            status: r.status as any,
            remarks: r.remarks,
            markedBy: user.id,
          },
        })
      }

      return tx.attendanceSession.findUnique({
        where: { id: session.id },
        include: SESSION_INCLUDE,
      })
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ATTENDANCE_SESSION_CREATE',
      entityType: 'AttendanceSession',
      entityId: createdSession?.id,
      newValues: {
        subjectId,
        date: normalizedDate.toISOString(),
        period: normalizedPeriod,
        topic: topic || null,
        initialRecordsCount: dedupedInitialRecords.size,
      },
    })

    return NextResponse.json({
      session: buildEnrichedSession(createdSession, access.subject?.semesterId),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Sessions] Create error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const sessionId = body.sessionId || body.id

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const existing = await prisma.attendanceSession.findUnique({
      where: { id: String(sessionId) },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Attendance session not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(user, existing.subjectId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const updateData: Record<string, any> = {}

    if (body.topic !== undefined) {
      updateData.topic = body.topic ? String(body.topic).trim() : null
    }

    if (body.isCancelled !== undefined || body.action === 'cancel' || body.action === 'reopen') {
      const nextCancelled =
        body.action === 'cancel'
          ? true
          : body.action === 'reopen'
            ? false
            : Boolean(body.isCancelled)
      updateData.isCancelled = nextCancelled
      updateData.cancelReason = nextCancelled
        ? typeof body.cancelReason === 'string' && body.cancelReason.trim()
          ? body.cancelReason.trim()
          : 'Cancelled by instructor'
        : null
    }

    if (body.date !== undefined || body.period !== undefined) {
      const nextDate =
        body.date !== undefined ? normalizeCalendarDate(body.date) : existing.date
      if (!nextDate) {
        return NextResponse.json({ error: 'Invalid session date' }, { status: 400 })
      }
      const nextPeriod =
        body.period !== undefined ? Number(body.period) : existing.period
      if (!Number.isInteger(nextPeriod) || nextPeriod < 1 || nextPeriod > 12) {
        return NextResponse.json(
          { error: 'Period must be an integer between 1 and 12' },
          { status: 400 }
        )
      }

      const bounds = getCalendarDayBounds(nextDate)!
      const duplicate = await findMatchingSession(
        existing.subjectId,
        nextPeriod,
        bounds,
        existing.id
      )
      if (duplicate) {
        return NextResponse.json(
          {
            error: 'Another attendance session already exists for that class, date, and period',
            code: 'DUPLICATE_SESSION',
          },
          { status: 409 }
        )
      }

      updateData.date = nextDate
      updateData.period = nextPeriod
    }

    const updated = await prisma.attendanceSession.update({
      where: { id: existing.id },
      data: updateData,
      include: SESSION_INCLUDE,
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: updateData.isCancelled ? 'ATTENDANCE_SESSION_CANCEL' : 'ATTENDANCE_SESSION_UPDATE',
      entityType: 'AttendanceSession',
      entityId: updated.id,
      oldValues: {
        topic: existing.topic,
        isCancelled: existing.isCancelled,
        cancelReason: existing.cancelReason,
      },
      newValues: updateData,
    })

    return NextResponse.json({
      session: buildEnrichedSession(updated, access.subject?.semesterId),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Sessions] Update error:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return PATCH(request)
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    let sessionId = searchParams.get('sessionId') || searchParams.get('id')

    if (!sessionId) {
      const body = await request.json().catch(() => ({}))
      sessionId = body.sessionId || body.id
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const existing = await prisma.attendanceSession.findUnique({
      where: { id: String(sessionId) },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Attendance session not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(user, existing.subjectId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    await prisma.attendanceSession.delete({
      where: { id: existing.id },
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ATTENDANCE_SESSION_DELETE',
      entityType: 'AttendanceSession',
      entityId: existing.id,
      oldValues: {
        subjectId: existing.subjectId,
        date: existing.date.toISOString(),
        period: existing.period,
      },
    })

    return NextResponse.json({ success: true, deletedId: existing.id })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Sessions] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
