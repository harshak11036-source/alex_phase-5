import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
} from '@/lib/classroom-permissions'
import { AuditLogService } from '@/lib/audit-log'

export async function GET() {
  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)

    if (context.isTeacher) {
      const whereClause = context.isAdmin
        ? {}
        : {
            OR: [
              { createdBy: user.id },
              { subject: { lecturers: { some: { userId: user.id } } } },
            ],
          }

      const assignments = await prisma.assignment.findMany({
        where: whereClause,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { dueDate: 'asc' },
      })

      return NextResponse.json({ assignments })
    }

    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        subject: {
          include: {
            assignments: {
              where: { isPublished: true },
              include: {
                _count: {
                  select: {
                    submissions: { where: { userId: user.id } },
                  },
                },
              },
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    })

    const assignments = enrollments.flatMap((e) =>
      e.subject.assignments.map((a) => ({
        ...a,
        subject: { id: e.subject.id, name: e.subject.name, code: e.subject.code },
      }))
    )

    return NextResponse.json({ assignments })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assignments] My assignments list error:', error)
    return NextResponse.json({ error: 'Failed to list assignments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const {
      subjectId,
      title,
      description,
      instructions,
      maxMarks = 100,
      weight = 1.0,
      dueDate,
      allowResubmission = true,
      maxSubmissions = 3,
      isPublished = true,
    } = body

    if (!subjectId || !title || !dueDate) {
      return NextResponse.json(
        { error: 'subjectId, title, and dueDate are required' },
        { status: 400 }
      )
    }

    const access = await verifySubjectManagementAccess(user, String(subjectId))
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const parsedDue = new Date(dueDate)
    if (Number.isNaN(parsedDue.getTime())) {
      return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
    }

    const parsedMaxMarks = Number(maxMarks)
    if (Number.isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
      return NextResponse.json(
        { error: 'maxMarks must be greater than 0' },
        { status: 400 }
      )
    }

    const assignment = await prisma.assignment.create({
      data: {
        subjectId: String(subjectId),
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        instructions: instructions ? String(instructions).trim() : null,
        maxMarks: parsedMaxMarks,
        weight: Number(weight) || 1.0,
        assignedDate: new Date(),
        dueDate: parsedDue,
        allowedFormats: ['PDF', 'DOCX', 'TXT'],
        allowResubmission: Boolean(allowResubmission),
        maxSubmissions: Number(maxSubmissions) || 1,
        isPublished: Boolean(isPublished),
        createdBy: user.id,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { submissions: true } },
      },
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ASSIGNMENT_CREATE',
      entityType: 'Assignment',
      entityId: assignment.id,
      newValues: {
        subjectId,
        title: assignment.title,
        maxMarks: assignment.maxMarks,
        dueDate: parsedDue.toISOString(),
      },
    })

    return NextResponse.json({ assignment })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assignments] Assignment create error:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
