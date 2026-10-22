import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
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

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: { id: true, subjectId: true, createdBy: true, maxMarks: true, title: true },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    if (context.isTeacher && !context.isAdmin) {
      const assigned = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assignment.subjectId },
      })
      if (!assigned && assignment.createdBy !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const whereClause = context.isTeacher
      ? { assignmentId: id }
      : { assignmentId: id, userId: user.id }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: whereClause,
      orderBy: [{ submittedAt: 'desc' }, { submissionNumber: 'desc' }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        attachments: true,
      },
    })

    const serialized = submissions.map((s) => ({
      ...s,
      attachments: s.attachments.map((a) => ({
        ...a,
        fileSize: Number(a.fileSize),
      })),
    }))

    return NextResponse.json({ submissions: serializeBigInt(serialized) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assignments] Assignment submissions list error:', error)
    return NextResponse.json({ error: 'Failed to list submissions' }, { status: 500 })
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
    const { submissionId, marksObtained, feedback } = body

    if (!submissionId || marksObtained === undefined) {
      return NextResponse.json(
        { error: 'submissionId and marksObtained are required' },
        { status: 400 }
      )
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(user, assignment.subjectId)
    if (!access.allowed && assignment.createdBy !== user.id) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const numMarks = Number(marksObtained)
    if (Number.isNaN(numMarks) || numMarks < 0 || numMarks > assignment.maxMarks) {
      return NextResponse.json(
        {
          error: `Marks must be between 0 and ${assignment.maxMarks}`,
        },
        { status: 400 }
      )
    }

    const existingSub = await prisma.assignmentSubmission.findUnique({
      where: { id: String(submissionId) },
    })

    if (!existingSub || existingSub.assignmentId !== id) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: existingSub.id },
      data: {
        marksObtained: numMarks,
        feedback: feedback !== undefined ? (feedback ? String(feedback).trim() : null) : existingSub.feedback,
        status: 'EVALUATED',
        gradedBy: user.id,
        gradedAt: new Date(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        attachments: true,
      },
    })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ASSIGNMENT_SUBMISSION_GRADE',
      entityType: 'AssignmentSubmission',
      entityId: updated.id,
      newValues: {
        assignmentId: id,
        submissionId: updated.id,
        studentId: updated.userId,
        marksObtained: numMarks,
      },
    })

    return NextResponse.json({
      submission: serializeBigInt({
        ...updated,
        attachments: updated.attachments.map((a) => ({
          ...a,
          fileSize: Number(a.fileSize),
        })),
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assignments] Grade submission error:', error)
    return NextResponse.json({ error: 'Failed to grade submission' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}