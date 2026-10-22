import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
} from '@/lib/classroom-permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)
    const { id } = await params

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
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
        semester: { select: { id: true, name: true, number: true } },
        results: {
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
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (!context.isTeacher) {
      if (!assessment.isPublished) {
        return NextResponse.json({ error: 'Assessment not published' }, { status: 403 })
      }
      const enrollment = await prisma.subjectEnrollment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId, isActive: true },
      })
      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in this subject' }, { status: 403 })
      }
      assessment.results = assessment.results.filter(
        (r: { userId: string }) => r.userId === user.id
      )
    } else if (!context.isAdmin) {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment && assessment.createdBy !== user.id) {
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

    const normalizedResults = assessment.results.map((r) => ({
      ...r,
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        studentId: r.user.memberships?.[0]?.studentId || null,
      },
    }))

    const enrolledStudents = context.isTeacher
      ? (assessment.subject.enrollments || []).map((e) => ({
          id: e.user.id,
          firstName: e.user.firstName,
          lastName: e.user.lastName,
          email: e.user.email,
          studentId: e.user.memberships?.[0]?.studentId || null,
        }))
      : []

    const resultByUser = new Map(normalizedResults.map((r) => [r.userId, r]))
    const roster = context.isTeacher
      ? enrolledStudents.map((student) => {
          const existing = resultByUser.get(student.id)
          return (
            existing || {
              id: `ungraded-${student.id}`,
              assessmentId: assessment.id,
              userId: student.id,
              marksObtained: 0,
              hasMarks: false,
              feedback: null,
              gradedBy: null,
              gradedAt: null,
              isPublished: false,
              user: student,
            }
          )
        })
      : normalizedResults

    return NextResponse.json({
      assessment: {
        ...assessment,
        subject: {
          id: assessment.subject.id,
          name: assessment.subject.name,
          code: assessment.subject.code,
          semesterId: assessment.subject.semesterId,
          institutionId: assessment.subject.institutionId,
        },
        results: normalizedResults,
        enrolledStudents,
        roster,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assessments] Get assessment error:', error)
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)

    if (!context.isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      isPublished,
      results,
      name,
      type,
      maxMarks,
      weight,
      assessmentDate,
      description,
    } = body

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: true,
        results: {
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
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (!context.isAdmin) {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment && assessment.createdBy !== user.id) {
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

    const effectiveMaxMarks =
      maxMarks !== undefined ? Number(maxMarks) : assessment.maxMarks
    if (Number.isNaN(effectiveMaxMarks) || effectiveMaxMarks <= 0) {
      return NextResponse.json(
        { error: 'maxMarks must be greater than 0' },
        { status: 400 }
      )
    }

    if (results && Array.isArray(results)) {
      for (const result of results) {
        if (result.userId === undefined || result.marksObtained === undefined) continue
        const numMarks = Number(result.marksObtained)
        if (Number.isNaN(numMarks) || numMarks < 0 || numMarks > effectiveMaxMarks) {
          return NextResponse.json(
            {
              error: `Invalid marks for student ${result.userId}: must be between 0 and ${effectiveMaxMarks}`,
            },
            { status: 400 }
          )
        }
      }
    }

    const oldValues = {
      name: assessment.name,
      maxMarks: assessment.maxMarks,
      isPublished: assessment.isPublished,
      publishedAt: assessment.publishedAt,
      results: assessment.results.map((r) => ({
        userId: r.userId,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        isPublished: r.isPublished,
      })),
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined && String(name).trim()) {
      updateData.name = String(name).trim()
    }
    if (type !== undefined && String(type).trim()) {
      updateData.type = String(type).trim()
    }
    if (maxMarks !== undefined) {
      updateData.maxMarks = effectiveMaxMarks
    }
    if (weight !== undefined && !Number.isNaN(Number(weight))) {
      updateData.weight = Number(weight)
    }
    if (assessmentDate !== undefined) {
      const parsedDate = new Date(assessmentDate)
      if (!Number.isNaN(parsedDate.getTime())) {
        updateData.assessmentDate = parsedDate
      }
    }
    if (description !== undefined) {
      updateData.description = description ? String(description).trim() : null
    }

    if (typeof isPublished === 'boolean') {
      updateData.isPublished = isPublished
      if (isPublished && !assessment.isPublished) {
        updateData.publishedAt = new Date()
      } else if (!isPublished && assessment.isPublished) {
        updateData.publishedAt = null
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.assessment.update({
          where: { id },
          data: updateData,
        })
      }

      if (results && Array.isArray(results)) {
        for (const result of results) {
          const {
            userId,
            marksObtained,
            feedback,
            isPublished: resultPublished,
          } = result
          if (userId === undefined || marksObtained === undefined) continue
          const numMarks = Number(marksObtained)
          if (Number.isNaN(numMarks)) continue

          const publishFlag =
            resultPublished !== undefined
              ? Boolean(resultPublished)
              : typeof isPublished === 'boolean'
                ? isPublished
                : true

          await tx.assessmentResult.upsert({
            where: { assessmentId_userId: { assessmentId: id, userId } },
            update: {
              marksObtained: numMarks,
              feedback: feedback ? String(feedback) : null,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: publishFlag,
              publishedAt: publishFlag ? new Date() : null,
            },
            create: {
              assessmentId: id,
              userId,
              marksObtained: numMarks,
              feedback: feedback ? String(feedback) : null,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: publishFlag,
              publishedAt: publishFlag ? new Date() : null,
            },
          })
        }
      }
    })

    const updatedAssessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        results: {
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
    })

    const newValues = {
      isPublished: updatedAssessment?.isPublished,
      publishedAt: updatedAssessment?.publishedAt,
      results: updatedAssessment?.results.map((r) => ({
        userId: r.userId,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        isPublished: r.isPublished,
      })),
    }

    await AuditLogService.log({
      institutionId: context.institutionId || assessment.subject.institutionId,
      userId: user.id,
      action:
        isPublished !== undefined && isPublished !== assessment.isPublished
          ? isPublished
            ? 'ASSESSMENT_PUBLISH'
            : 'ASSESSMENT_UNPUBLISH'
          : 'ASSESSMENT_UPDATE_RESULTS',
      entityType: 'Assessment',
      entityId: id,
      oldValues,
      newValues,
    })

    return NextResponse.json({
      assessment: updatedAssessment
        ? {
            ...updatedAssessment,
            results: updatedAssessment.results.map((r) => ({
              ...r,
              user: {
                id: r.user.id,
                firstName: r.user.firstName,
                lastName: r.user.lastName,
                email: r.user.email,
                studentId: r.user.memberships?.[0]?.studentId || null,
              },
            })),
          }
        : null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assessments] Update assessment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update assessment' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await prisma.assessment.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(user, existing.subjectId)
    if (!access.allowed && existing.createdBy !== user.id) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    await prisma.assessment.delete({ where: { id } })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ASSESSMENT_DELETE',
      entityType: 'Assessment',
      entityId: id,
      oldValues: {
        name: existing.name,
        subjectId: existing.subjectId,
      },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assessments] Delete assessment error:', error)
    return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 })
  }
}