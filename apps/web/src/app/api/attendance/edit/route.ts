import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'
import { verifySubjectManagementAccess } from '@/lib/classroom-permissions'
import { buildEnrichedSession, SESSION_INCLUDE } from '@/app/api/attendance/sessions/route'

const VALID_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'ON_DUTY'])

export async function PUT(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { recordId, sessionId, userId, status, remarks } = body

    if (!status) {
      return NextResponse.json({ error: 'Attendance status is required' }, { status: 400 })
    }

    const statusUpper = String(status).trim().toUpperCase()
    if (!VALID_STATUSES.has(statusUpper)) {
      return NextResponse.json(
        {
          error: `Invalid attendance status "${status}". Must be one of: PRESENT, ABSENT, LATE, EXCUSED, ON_DUTY`,
        },
        { status: 400 }
      )
    }

    let existingRecord: any = null

    if (recordId) {
      existingRecord = await prisma.attendanceRecord.findUnique({
        where: { id: String(recordId) },
        include: {
          session: { include: { subject: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
    } else if (sessionId && userId) {
      existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          sessionId_userId: { sessionId: String(sessionId), userId: String(userId) },
        },
        include: {
          session: { include: { subject: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
    } else {
      return NextResponse.json(
        { error: 'recordId (or sessionId and userId) is required' },
        { status: 400 }
      )
    }

    if (!existingRecord && sessionId && userId) {
      const targetSession = await prisma.attendanceSession.findUnique({
        where: { id: String(sessionId) },
      })
      if (!targetSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      const access = await verifySubjectManagementAccess(user, targetSession.subjectId)
      if (!access.allowed) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
      if (targetSession.isCancelled) {
        return NextResponse.json(
          { error: 'Cannot edit attendance for a cancelled session' },
          { status: 400 }
        )
      }

      const created = await prisma.attendanceRecord.create({
        data: {
          sessionId: String(sessionId),
          userId: String(userId),
          status: statusUpper as any,
          remarks: remarks !== undefined ? (remarks ? String(remarks) : null) : null,
          markedBy: user.id,
        },
      })

      const refreshedSession = await prisma.attendanceSession.findUnique({
        where: { id: String(sessionId) },
        include: SESSION_INCLUDE,
      })
      const enriched = buildEnrichedSession(refreshedSession)

      return NextResponse.json({
        record: created,
        session: enriched,
        summary: enriched.summary,
      })
    }

    if (!existingRecord) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(
      user,
      existingRecord.session.subjectId
    )
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    if (existingRecord.session.isCancelled) {
      return NextResponse.json(
        { error: 'Cannot edit attendance for a cancelled session' },
        { status: 400 }
      )
    }

    const oldValues = {
      status: existingRecord.status,
      remarks: existingRecord.remarks,
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        status: statusUpper as any,
        remarks:
          remarks !== undefined
            ? remarks !== null && String(remarks).trim()
              ? String(remarks).trim()
              : null
            : existingRecord.remarks,
        markedBy: user.id,
        markedAt: new Date(),
      },
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId || existingRecord.session.subject.institutionId,
      userId: user.id,
      action: 'ATTENDANCE_EDIT',
      entityType: 'AttendanceRecord',
      entityId: existingRecord.id,
      oldValues,
      newValues: { status: updated.status, remarks: updated.remarks },
    })

    const refreshedSession = await prisma.attendanceSession.findUnique({
      where: { id: existingRecord.sessionId },
      include: SESSION_INCLUDE,
    })
    const enriched = buildEnrichedSession(refreshedSession)

    return NextResponse.json({
      record: updated,
      session: enriched,
      summary: enriched.summary,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Edit] Error:', error)
    return NextResponse.json({ error: 'Failed to edit attendance' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  return PUT(request)
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    let recordId = searchParams.get('recordId') || searchParams.get('id')

    if (!recordId) {
      const body = await request.json().catch(() => ({}))
      recordId = body.recordId || body.id
    }

    if (!recordId) {
      return NextResponse.json({ error: 'Record ID required' }, { status: 400 })
    }

    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id: String(recordId) },
      include: { session: { include: { subject: true } } },
    })

    if (!existingRecord) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(
      user,
      existingRecord.session.subjectId
    )
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    await prisma.attendanceRecord.delete({ where: { id: existingRecord.id } })

    await AuditLogService.log({
      institutionId: access.context.institutionId || existingRecord.session.subject.institutionId,
      userId: user.id,
      action: 'ATTENDANCE_DELETE',
      entityType: 'AttendanceRecord',
      entityId: existingRecord.id,
      oldValues: {
        status: existingRecord.status,
        userId: existingRecord.userId,
        sessionId: existingRecord.sessionId,
      },
    })

    const refreshedSession = await prisma.attendanceSession.findUnique({
      where: { id: existingRecord.sessionId },
      include: SESSION_INCLUDE,
    })
    const enriched = buildEnrichedSession(refreshedSession)

    return NextResponse.json({
      deleted: true,
      session: enriched,
      summary: enriched.summary,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete attendance' }, { status: 500 })
  }
}
