import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { uploadFile } from '@/lib/storage/client'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    let assignmentId = ''
    let content = ''
    let files: File[] = []

    const contentType = request.headers?.get?.('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await request.json()
      assignmentId = String(body.assignmentId || '')
      content = String(body.content || '')
    } else {
      const formData = await request.formData()
      assignmentId = String(formData.get('assignmentId') || '')
      content = String(formData.get('content') || '')
      files = (formData.getAll('files') as File[]).filter(Boolean)
    }

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })
    }

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const existingSubmissions = await prisma.assignmentSubmission.count({
      where: { assignmentId, userId: user.id },
    })

    if (existingSubmissions >= assignment.maxSubmissions && !assignment.allowResubmission) {
      return NextResponse.json({ error: 'Maximum submissions reached' }, { status: 400 })
    }

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        userId: user.id,
        status: new Date(assignment.dueDate) < new Date() ? 'LATE' : 'SUBMITTED',
        submissionNumber: existingSubmissions + 1,
        content: content || null,
        submittedAt: new Date(),
      },
    })

    const createdAttachments = []
    for (const file of files) {
      if (file && file.size > 0) {
        const storagePath = `${user.id}/assignments/${assignmentId}/${submission.id}/${file.name}`
        const buffer =
          typeof file.arrayBuffer === 'function'
            ? Buffer.from(await file.arrayBuffer())
            : Buffer.isBuffer(file)
              ? file
              : Buffer.from(String(file))

        await uploadFile('documents', storagePath, buffer, {
          contentType: file.type || 'application/octet-stream',
        })

        const att = await prisma.submissionAttachment.create({
          data: {
            submissionId: submission.id,
            fileName: file.name,
            storagePath,
            fileSize: BigInt(file.size),
            mimeType: file.type || 'application/octet-stream',
          },
        })
        createdAttachments.push({
          ...att,
          fileSize: Number(att.fileSize),
        })
      }
    }

    return NextResponse.json({
      submission: serializeBigInt({
        ...submission,
        attachments: createdAttachments,
      }),
    })
  } catch (error) {
    console.error('[Assignments] Assignment submit error:', error)
    return NextResponse.json({ error: 'Failed to submit assignment' }, { status: 500 })
  }
}
