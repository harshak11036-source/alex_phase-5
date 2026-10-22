import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { processDocument, createDocumentRecord } from '@/lib/document-processing/pipeline'
import { DocumentValidationError } from '@/lib/document-processing/extractors'
import {
  canUploadToTarget,
  buildAccessibleDocumentsWhere,
} from '@/lib/document-processing/access'
import { DocumentStatus } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string | null) || undefined
    const description = (formData.get('description') as string | null) || undefined
    const subjectId = ((formData.get('subjectId') as string | null) || '').trim() || undefined
    const projectId = ((formData.get('projectId') as string | null) || '').trim() || undefined
    const notebookId = ((formData.get('notebookId') as string | null) || '').trim() || undefined

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { error: 'No file provided', code: 'MISSING_FILE' },
        { status: 400 }
      )
    }

    // Verify user has permission to upload to the specified subject, project, or notebook
    if (subjectId || projectId || notebookId) {
      const targetCheck = await canUploadToTarget(user, { subjectId, projectId, notebookId })
      if (!targetCheck.allowed) {
        return NextResponse.json(
          { error: targetCheck.reason || 'Forbidden', code: 'FORBIDDEN_TARGET' },
          { status: targetCheck.statusCode || 403 }
        )
      }
    }

    const { document, buffer } = await createDocumentRecord(
      user.id,
      file,
      subjectId,
      projectId,
      notebookId,
      title,
      description
    )

    await prisma.documentProcessingJob.create({
      data: {
        documentId: document.id,
        step: 'queued',
        status: DocumentStatus.QUEUED,
      },
    })

    // Run extraction, chunking, embedding, and indexing synchronously so we never report
    // success before the file is stored AND processing has reached DocumentStatus.READY.
    let processingStats: {
      status: DocumentStatus
      pageCount: number
      chunksCount: number
      tokenCount: number
    }
    try {
      processingStats = await processDocument({
        documentId: document.id,
        userId: user.id,
        fileBuffer: buffer,
        fileName: file.name,
        mimeType: document.mimeType,
        documentType: document.documentType,
        subjectId,
        projectId,
        notebookId,
      })
    } catch (processingError) {
      const reason =
        processingError instanceof Error
          ? processingError.message
          : 'Document text extraction and indexing failed'
      return NextResponse.json(
        {
          error: reason,
          code: 'PROCESSING_FAILED',
          document: serializeBigInt({
            id: document.id,
            title: document.title,
            fileName: document.fileName,
            fileSize: document.fileSize.toString(),
            mimeType: document.mimeType,
            documentType: document.documentType,
            status: DocumentStatus.FAILED,
            errorMessage: reason,
            createdAt: document.createdAt,
          }),
        },
        { status: 422 }
      )
    }

    // If uploaded into a research notebook, ensure a ResearchSource entry is linked
    if (notebookId && prisma.researchSource?.create) {
      try {
        await prisma.researchSource.create({
          data: {
            notebookId,
            documentId: document.id,
            title: document.title,
          },
        })
      } catch {
        // Non-fatal if source already exists
      }
    }

    const updatedDoc = await prisma.document.findUnique({
      where: { id: document.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, title: true } },
        notebook: { select: { id: true, title: true } },
        _count: { select: { chunks: true } },
      },
    })

    return NextResponse.json({
      document: serializeBigInt({
        id: updatedDoc?.id || document.id,
        title: updatedDoc?.title || document.title,
        description: updatedDoc?.description ?? document.description ?? null,
        fileName: updatedDoc?.fileName || document.fileName,
        fileSize: (updatedDoc?.fileSize ?? document.fileSize).toString(),
        mimeType: updatedDoc?.mimeType || document.mimeType,
        documentType: updatedDoc?.documentType || document.documentType,
        status: updatedDoc?.status || processingStats.status,
        pageCount: updatedDoc?.pageCount ?? processingStats.pageCount,
        chunksCount: updatedDoc?._count?.chunks ?? processingStats.chunksCount,
        errorMessage: updatedDoc?.errorMessage ?? null,
        subject: updatedDoc?.subject ?? null,
        project: updatedDoc?.project ?? null,
        notebook: updatedDoc?.notebook ?? null,
        processedAt: updatedDoc?.processedAt ?? new Date(),
        createdAt: updatedDoc?.createdAt || document.createdAt,
      }),
    })
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId')
    const projectId = searchParams.get('projectId')
    const notebookId = searchParams.get('notebookId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const scope = searchParams.get('scope')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    // If explicitly querying a specific subject/project/notebook, verify access
    if (
      (subjectId && subjectId !== 'current' && subjectId !== 'all') ||
      (projectId && projectId !== 'all') ||
      (notebookId && notebookId !== 'all')
    ) {
      const check = await canUploadToTarget(user, {
        subjectId: subjectId && subjectId !== 'current' && subjectId !== 'all' ? subjectId : undefined,
        projectId: projectId && projectId !== 'all' ? projectId : undefined,
        notebookId: notebookId && notebookId !== 'all' ? notebookId : undefined,
      })
      // Note: For notebooks, public notebooks are also readable
      if (!check.allowed && notebookId && prisma.researchNotebook?.findFirst) {
        const pubNb = await prisma.researchNotebook.findFirst({
          where: { id: notebookId, isPublic: true },
        })
        if (!pubNb) {
          return NextResponse.json(
            { error: check.reason || 'Forbidden' },
            { status: check.statusCode || 403 }
          )
        }
      } else if (!check.allowed) {
        return NextResponse.json(
          { error: check.reason || 'Forbidden' },
          { status: check.statusCode || 403 }
        )
      }
    }

    const where =
      scope === 'personal'
        ? { ownerId: user.id, ...(status && status !== 'all' ? { status: status as any } : {}) }
        : buildAccessibleDocumentsWhere(user, {
            subjectId,
            projectId,
            notebookId,
            status,
            search,
          })

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, title: true } },
          notebook: { select: { id: true, title: true } },
          _count: { select: { chunks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count ? prisma.document.count({ where }) : Promise.resolve(0),
    ])

    const effectiveTotal = total || documents.length

    return NextResponse.json({
      documents: documents.map(d =>
        serializeBigInt({
          id: d.id,
          title: d.title,
          description: d.description,
          fileName: d.fileName,
          fileSize: d.fileSize.toString(),
          mimeType: d.mimeType,
          documentType: d.documentType,
          status: d.status,
          errorMessage: d.errorMessage,
          pageCount: d.pageCount,
          subject: d.subject,
          project: d.project,
          notebook: d.notebook,
          chunksCount: d._count?.chunks ?? 0,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          processedAt: d.processedAt,
        })
      ),
      pagination: {
        page,
        limit,
        total: effectiveTotal,
        totalPages: Math.max(1, Math.ceil(effectiveTotal / limit)),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] List error:', error)
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
  }
}
