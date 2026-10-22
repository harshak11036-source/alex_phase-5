import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument, canMutateDocument } from '@/lib/document-processing/access'
import { deleteFile } from '@/lib/storage/client'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, title: true } },
        notebook: { select: { id: true, title: true } },
        chunks: { orderBy: { chunkIndex: 'asc' }, take: 50 },
        processingJobs: { orderBy: { createdAt: 'desc' } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, document)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const chunks = (document.chunks || []).map(c => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
      tokenCount: c.tokenCount,
      content: c.content,
    }))

    return NextResponse.json({
      document: serializeBigInt({
        id: document.id,
        title: document.title,
        description: document.description,
        fileName: document.fileName,
        fileSize: document.fileSize.toString(),
        mimeType: document.mimeType,
        documentType: document.documentType,
        status: document.status,
        errorMessage: document.errorMessage,
        pageCount: document.pageCount,
        metadata: document.metadata,
        subject: document.subject,
        project: document.project,
        notebook: document.notebook,
        chunksCount: chunks.length,
        extractedText: chunks.map(c => c.content).join('\n\n'),
        chunks,
        processingJobs: document.processingJobs || [],
        versions: (document.versions || []).map(v => ({
          ...v,
          fileSize: v.fileSize.toString(),
        })),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        processedAt: document.processedAt,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Document get error:', error)
    return NextResponse.json({ error: 'Failed to get document' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!canMutateDocument(user, document)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.documentChunk.deleteMany({ where: { documentId: id } })
    await prisma.documentProcessingJob.deleteMany({ where: { documentId: id } })
    await prisma.document.delete({ where: { id } })

    if (document.storageBucket && document.storagePath) {
      await deleteFile(document.storageBucket, [document.storagePath]).catch(() => undefined)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Document delete error:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
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
    const { title, description, subjectId, projectId, notebookId } = body

    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!canMutateDocument(user, document)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
        ...(notebookId !== undefined ? { notebookId: notebookId || null } : {}),
      },
    })

    return NextResponse.json({
      document: serializeBigInt({
        ...updated,
        fileSize: updated.fileSize.toString(),
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Document update error:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}