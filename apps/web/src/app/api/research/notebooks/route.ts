import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url || 'http://localhost:3000/api/research/notebooks')
    const includePublic = searchParams.get('includePublic') === 'true'

    const where = includePublic
      ? { OR: [{ ownerId: user.id }, { isPublic: true }] }
      : { ownerId: user.id }

    const notebooks = await prisma.researchNotebook.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { sources: true, notes: true } },
        project: { select: { id: true, title: true } },
        sources: { select: { id: true, documentId: true } },
        documents: { select: { id: true, status: true } },
      },
    })

    const enriched = notebooks.map(nb => {
      const docIds = new Set<string>()
      for (const s of nb.sources || []) {
        if (s.documentId) docIds.add(s.documentId)
        else docIds.add(s.id)
      }
      for (const d of nb.documents || []) {
        docIds.add(d.id)
      }
      const totalSources = Math.max(nb._count?.sources ?? 0, docIds.size)
      const totalNotes = nb._count?.notes ?? 0

      return serializeBigInt({
        id: nb.id,
        title: nb.title,
        description: nb.description,
        ownerId: nb.ownerId,
        projectId: nb.projectId,
        isPublic: nb.isPublic,
        project: nb.project || null,
        createdAt: nb.createdAt,
        updatedAt: nb.updatedAt,
        _count: {
          sources: totalSources,
          notes: totalNotes,
        },
      })
    })

    return NextResponse.json({ notebooks: enriched })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebooks list error:', error)
    return NextResponse.json({ error: 'Failed to list notebooks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, description, projectId, isPublic = false } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Notebook title is required', code: 'MISSING_TITLE' },
        { status: 400 }
      )
    }

    const notebook = await prisma.researchNotebook.create({
      data: {
        ownerId: user.id,
        title: title.trim(),
        description: description ? String(description).trim() : null,
        projectId: projectId || null,
        isPublic: Boolean(isPublic),
      },
    })

    return NextResponse.json({
      notebook: {
        ...notebook,
        _count: {
          sources: 0,
          notes: 0,
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook create error:', error)
    return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 })
  }
}
