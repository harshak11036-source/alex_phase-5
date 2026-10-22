import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { reprocessDocument } from '@/lib/document-processing/pipeline'
import { canMutateDocument } from '@/lib/document-processing/access'

export async function POST(
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

    const stats = await reprocessDocument(id, user.id, user.role)
    const updated = await prisma.document.findUnique({
      where: { id },
      include: { _count: { select: { chunks: true } } },
    })

    return NextResponse.json({
      success: true,
      message: 'Document reprocessed successfully',
      document: updated
        ? serializeBigInt({
            id: updated.id,
            title: updated.title,
            status: updated.status,
            pageCount: updated.pageCount ?? stats.pageCount,
            chunksCount: updated._count?.chunks ?? stats.chunksCount,
            processedAt: updated.processedAt,
          })
        : stats,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Retry error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry processing' },
      { status: 422 }
    )
  }
}