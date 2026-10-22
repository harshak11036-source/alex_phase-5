import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
} from '@/lib/classroom-permissions'
import { AuditLogService } from '@/lib/audit-log'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)
    const { id } = await params

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, number: true } },
        lecturers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
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
        _count: {
          select: {
            enrollments: true,
            resources: true,
            attendanceSessions: true,
            assessments: true,
            assignments: true,
          },
        },
      },
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    const students = subject.enrollments.map((e) => ({
      id: e.user.id,
      userId: e.user.id,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      name: `${e.user.firstName} ${e.user.lastName}`.trim(),
      email: e.user.email,
      studentId: e.user.memberships?.[0]?.studentId || null,
      enrolledAt: e.enrolledAt,
    }))

    return NextResponse.json({
      subject: {
        ...subject,
        students,
        canManage:
          context.isAdmin ||
          subject.lecturers.some((l) => l.userId === user.id),
      },
      students,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Subject ID] Get error:', error)
    return NextResponse.json({ error: 'Failed to get subject details' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()

    const access = await verifySubjectManagementAccess(user, id)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    if (body.action === 'enroll_student' && body.studentId) {
      const enrollment = await prisma.subjectEnrollment.upsert({
        where: {
          userId_subjectId: {
            userId: String(body.studentId),
            subjectId: id,
          },
        },
        update: { isActive: true },
        create: {
          userId: String(body.studentId),
          subjectId: id,
          isActive: true,
        },
      })
      return NextResponse.json({ enrollment })
    }

    const updateData: Record<string, any> = {}
    if (body.name !== undefined && String(body.name).trim()) {
      updateData.name = String(body.name).trim()
    }
    if (body.description !== undefined) {
      updateData.description = body.description ? String(body.description).trim() : null
    }
    if (body.syllabus !== undefined) {
      updateData.syllabus = body.syllabus ? String(body.syllabus).trim() : null
    }
    if (body.credits !== undefined && !Number.isNaN(Number(body.credits))) {
      updateData.credits = Number(body.credits)
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: updateData,
      include: {
        institution: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, number: true } },
        lecturers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { enrollments: true, resources: true } },
      },
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'SUBJECT_UPDATE',
      entityType: 'Subject',
      entityId: id,
      newValues: updateData,
    })

    return NextResponse.json({ subject: updated })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Subject ID] Update error:', error)
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}
