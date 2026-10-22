import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'
import { processDocument } from '@/lib/document-processing/pipeline'
import { uploadFile } from '@/lib/storage/client'
import { DocumentStatus, DocumentType } from '@prisma/client'
import crypto from 'node:crypto'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const notebook = await prisma.researchNotebook.findUnique({
      where: { id },
      include: {
        sources: {
          orderBy: { createdAt: 'desc' },
          include: {
            document: {
              include: {
                _count: { select: { chunks: true } },
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { chunks: true } },
          },
        },
      },
    })

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.ownerId !== user.id && !notebook.isPublic && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const seenDocIds = new Set<string>()
    const enrichedSources: Array<Record<string, unknown>> = []

    for (const s of notebook.sources || []) {
      let linkedDoc = (s as any).document || null
      if (!linkedDoc && s.documentId) {
        linkedDoc =
          (notebook.documents || []).find(d => d.id === s.documentId) ||
          (await prisma.document.findUnique({
            where: { id: s.documentId },
            include: { _count: { select: { chunks: true } } },
          }))
      }
      if (s.documentId) {
        seenDocIds.add(s.documentId)
      }

      enrichedSources.push({
        id: s.id,
        notebookId: id,
        documentId: s.documentId || linkedDoc?.id || null,
        title: s.title || linkedDoc?.title || 'Untitled Source',
        fileName: linkedDoc?.fileName || s.title || 'source.txt',
        fileSize: linkedDoc?.fileSize ? linkedDoc.fileSize.toString() : '0',
        mimeType: linkedDoc?.mimeType || 'text/plain',
        documentType: linkedDoc?.documentType || 'TXT',
        status: linkedDoc?.status || 'READY',
        pageCount: linkedDoc?.pageCount ?? 1,
        chunksCount: linkedDoc?._count?.chunks ?? 0,
        errorMessage: linkedDoc?.errorMessage || null,
        authors: s.authors,
        publicationYear: s.publicationYear,
        doi: s.doi,
        url: s.url,
        metadata: s.metadata || null,
        createdAt: s.createdAt,
        processedAt: linkedDoc?.processedAt || s.createdAt,
      })
    }

    for (const d of notebook.documents || []) {
      if (seenDocIds.has(d.id)) continue
      seenDocIds.add(d.id)
      enrichedSources.push({
        id: d.id,
        notebookId: id,
        documentId: d.id,
        title: d.title,
        fileName: d.fileName,
        fileSize: d.fileSize ? d.fileSize.toString() : '0',
        mimeType: d.mimeType,
        documentType: d.documentType,
        status: d.status,
        pageCount: d.pageCount ?? 1,
        chunksCount: (d as any)._count?.chunks ?? 0,
        errorMessage: d.errorMessage || null,
        authors: null,
        publicationYear: null,
        doi: null,
        url: null,
        metadata: d.metadata || null,
        createdAt: d.createdAt,
        processedAt: d.processedAt,
      })
    }

    return NextResponse.json({
      sources: serializeBigInt(enrichedSources),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook sources list error:', error)
    return NextResponse.json({ error: 'Failed to list notebook sources' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const notebook = await prisma.researchNotebook.findUnique({ where: { id } })
    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.ownerId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      documentId,
      content,
      authors,
      publicationYear,
      doi,
      url,
    } = body

    let resolvedDocId: string | null = documentId || null
    let resolvedTitle = typeof title === 'string' && title.trim() ? title.trim() : ''
    let docSummary: Record<string, unknown> | null = null

    if (resolvedDocId) {
      const existingDoc = await prisma.document.findUnique({
        where: { id: resolvedDocId },
        include: { _count: { select: { chunks: true } } },
      })
      if (!existingDoc) {
        return NextResponse.json({ error: 'Referenced document not found' }, { status: 404 })
      }
      const allowed = await canAccessDocument(user, existingDoc)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Forbidden: you do not have access to this document' },
          { status: 403 }
        )
      }
      resolvedTitle = resolvedTitle || existingDoc.title
      if (existingDoc.ownerId === user.id && !existingDoc.notebookId) {
        await prisma.document.update({
          where: { id: existingDoc.id },
          data: { notebookId: id },
        })
      }
      docSummary = {
        fileName: existingDoc.fileName,
        fileSize: existingDoc.fileSize.toString(),
        mimeType: existingDoc.mimeType,
        documentType: existingDoc.documentType,
        status: existingDoc.status,
        pageCount: existingDoc.pageCount ?? 1,
        chunksCount: (existingDoc as any)._count?.chunks ?? 0,
      }
    } else if (typeof content === 'string' && content.trim().length > 0) {
      if (!resolvedTitle) {
        return NextResponse.json({ error: 'Source title is required' }, { status: 400 })
      }
      const textBuffer = Buffer.from(content.trim(), 'utf8')
      const safeFileName = `${resolvedTitle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}.md`
      const bucket = process.env.STORAGE_BUCKET_DOCUMENTS || 'documents'
      const storagePath = `${user.id}/${Date.now()}-${safeFileName}`
      const checksum = crypto.createHash('sha256').update(textBuffer).digest('hex')

      await uploadFile(bucket, storagePath, textBuffer, { contentType: 'text/markdown' })

      const createdDoc = await prisma.document.create({
        data: {
          title: resolvedTitle,
          fileName: safeFileName,
          fileSize: BigInt(textBuffer.byteLength),
          mimeType: 'text/markdown',
          documentType: (DocumentType?.MARKDOWN || 'MARKDOWN') as DocumentType,
          storagePath,
          storageBucket: bucket,
          checksum,
          ownerId: user.id,
          notebookId: id,
          status: (DocumentStatus?.UPLOADED || 'UPLOADED') as DocumentStatus,
        },
      })

      const stats = await processDocument({
        documentId: createdDoc.id,
        userId: user.id,
        fileBuffer: textBuffer,
        fileName: safeFileName,
        mimeType: 'text/markdown',
        documentType: (DocumentType?.MARKDOWN || 'MARKDOWN') as DocumentType,
        notebookId: id,
      })

      resolvedDocId = createdDoc.id
      docSummary = {
        fileName: safeFileName,
        fileSize: textBuffer.byteLength.toString(),
        mimeType: 'text/markdown',
        documentType: 'MARKDOWN',
        status: stats.status,
        pageCount: stats.pageCount,
        chunksCount: stats.chunksCount,
      }
    } else if (!resolvedTitle) {
      return NextResponse.json({ error: 'Source title is required' }, { status: 400 })
    }

    const source = await prisma.researchSource.create({
      data: {
        notebookId: id,
        title: resolvedTitle,
        documentId: resolvedDocId,
        authors: authors || null,
        publicationYear: publicationYear ? Number(publicationYear) : null,
        doi: doi || null,
        url: url || null,
      },
    })

    return NextResponse.json({
      source: serializeBigInt({
        ...source,
        ...(docSummary || {
          fileName: resolvedTitle,
          fileSize: '0',
          mimeType: 'text/plain',
          documentType: 'TXT',
          status: 'READY',
          pageCount: 1,
          chunksCount: 0,
        }),
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook source create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create notebook source' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const notebook = await prisma.researchNotebook.findUnique({
      where: { id },
      include: { sources: true },
    })
    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.ownerId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url || `http://localhost:3000/api/research/notebooks/${id}/sources`)
    let sourceId = searchParams.get('sourceId')
    let documentId = searchParams.get('documentId')

    if (!sourceId && !documentId) {
      const body = await request.json().catch(() => ({}))
      sourceId = body.sourceId || null
      documentId = body.documentId || null
    }

    if (!sourceId && !documentId) {
      return NextResponse.json({ error: 'sourceId or documentId is required' }, { status: 400 })
    }

    const matchedSource = (notebook.sources || []).find(
      s => s.id === sourceId || (documentId && s.documentId === documentId)
    )
    const targetDocId = documentId || matchedSource?.documentId || sourceId

    if (sourceId && prisma.researchSource?.deleteMany) {
      await prisma.researchSource.deleteMany({
        where: {
          notebookId: id,
          OR: [{ id: sourceId }, { documentId: sourceId }],
        },
      })
    }

    if (targetDocId) {
      const doc = await prisma.document.findUnique({ where: { id: targetDocId } })
      if (doc && doc.notebookId === id && (doc.ownerId === user.id || user.role === 'ADMIN')) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { notebookId: null },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook source delete error:', error)
    return NextResponse.json({ error: 'Failed to remove source from notebook' }, { status: 500 })
  }
}
