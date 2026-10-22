import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  verifySubjectManagementAccess,
  normalizeCalendarDate,
  getCalendarDayBounds,
} from '@/lib/classroom-permissions'
import { buildEnrichedSession, SESSION_INCLUDE } from '@/app/api/attendance/sessions/route'
import { AuditLogService } from '@/lib/audit-log'

const VALID_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'ON_DUTY'])

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    let sessionId: string | null = body.sessionId ? String(body.sessionId) : null
    let targetSession: any = null

    if (sessionId) {
      targetSession = await prisma.attendanceSession.findUnique({
        where: { id: sessionId },
      })
      if (!targetSession) {
        return NextResponse.json({ error: 'Attendance session not found' }, { status: 404 })
      }
    } else if (body.subjectId && body.date) {
      const normalizedDate = normalizeCalendarDate(body.date)
      if (!normalizedDate) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
      }
      const period = Number(body.period ?? 1)
      if (!Number.isInteger(period) || period < 1 || period > 12) {
        return NextResponse.json(
          { error: 'Period must be an integer between 1 and 12' },
          { status: 400 }
        )
      }
      const access = await verifySubjectManagementAccess(user, String(body.subjectId))
      if (!access.allowed) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }

      const bounds = getCalendarDayBounds(normalizedDate)!
      targetSession = await prisma.attendanceSession.findFirst({
        where: {
          subjectId: String(body.subjectId),
          period,
          date: { gte: bounds.start, lte: bounds.end },
        },
      })

      if (!targetSession) {
        targetSession = await prisma.attendanceSession.create({
          data: {
            subjectId: String(body.subjectId),
            date: normalizedDate,
            period,
            topic: typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : null,
            conductedBy: user.id,
          },
        })
      }
      sessionId = targetSession.id
    } else {
      return NextResponse.json(
        { error: 'sessionId (or subjectId and date) is required' },
        { status: 400 }
      )
    }

    const access = await verifySubjectManagementAccess(user, targetSession.subjectId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    if (targetSession.isCancelled) {
      return NextResponse.json(
        { error: 'Cannot record or update attendance for a cancelled session' },
        { status: 400 }
      )
    }

    const rawRecords = Array.isArray(body.records)
      ? body.records
      : body.userId && body.status
        ? [{ userId: body.userId, status: body.status, remarks: body.remarks }]
        : []

    if (rawRecords.length === 0) {
      return NextResponse.json(
        { error: 'At least one attendance record is required' },
        { status: 400 }
      )
    }

    // Deduplicate records within the same batch by userId (last entry wins)
    const deduplicatedMap = new Map<
      string,
      { userId: string; status: string; remarks: string | null }
    >()

    for (const r of rawRecords) {
      if (!r || typeof r.userId !== 'string' || !r.userId.trim()) {
        return NextResponse.json(
          { error: 'Each attendance record must include a valid userId' },
          { status: 400 }
        )
      }
      const statusUpper = String(r.status || '').trim().toUpperCase()
      if (!VALID_STATUSES.has(statusUpper)) {
        return NextResponse.json(
          {
            error: `Invalid attendance status "${r.status}". Must be one of: PRESENT, ABSENT, LATE, EXCUSED, ON_DUTY`,
          },
          { status: 400 }
        )
      }
      deduplicatedMap.set(r.userId.trim(), {
        userId: r.userId.trim(),
        status: statusUpper,
        remarks:
          r.remarks !== undefined && r.remarks !== null && String(r.remarks).trim()
            ? String(r.remarks).trim()
            : null,
      })
    }

    const uniqueRecords = Array.from(deduplicatedMap.values())

    // Verify all referenced users exist
    const studentUsers = await prisma.user.findMany({
      where: { id: { in: uniqueRecords.map((r) => r.userId) } },
      select: { id: true },
    })
    const existingUserIds = new Set(studentUsers.map((u) => u.id))
    for (const r of uniqueRecords) {
      if (!existingUserIds.has(r.userId)) {
        return NextResponse.json(
          { error: `Student user not found: ${r.userId}` },
          { status: 404 }
        )
      }
    }

    const results = await prisma.$transaction(
      uniqueRecords.map((r) =>
        prisma.attendanceRecord.upsert({
          where: {
            sessionId_userId: { sessionId: targetSession.id, userId: r.userId },
          },
          update: {
            status: r.status as any,
            remarks: r.remarks,
            markedBy: user.id,
            markedAt: new Date(),
          },
          create: {
            sessionId: targetSession.id,
            userId: r.userId,
            status: r.status as any,
            remarks: r.remarks,
            markedBy: user.id,
          },
        })
      )
    )

    const updatedSession = await prisma.attendanceSession.findUnique({
      where: { id: targetSession.id },
      include: SESSION_INCLUDE,
    })

    const enriched = buildEnrichedSession(updatedSession)

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ATTENDANCE_MARK',
      entityType: 'AttendanceSession',
      entityId: targetSession.id,
      newValues: {
        sessionId: targetSession.id,
        subjectId: targetSession.subjectId,
        markedCount: results.length,
        summary: enriched.summary,
      },
    })

    return NextResponse.json({
      results,
      count: results.length,
      session: enriched,
      summary: enriched.summary,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Mark] Error:', error)
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 })
  }
}
