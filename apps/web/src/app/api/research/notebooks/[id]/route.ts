import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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
              include: { _count: { select: { chunks: true } } },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { chunks: true } } },
        },
        notes: { orderBy: { updatedAt: 'desc' } },
        conversations: { orderBy: { updatedAt: 'desc' }, take: 10 },
      },
    })

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.ownerId !== user.id && !notebook.isPublic && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      notebook: serializeBigInt(notebook),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook detail error:', error)
    return NextResponse.json({ error: 'Failed to load notebook' }, { status: 500 })
  }
}

export async function PATCH(
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
    const { title, description, isPublic, projectId } = body

    if (title !== undefined && !String(title).trim()) {
      return NextResponse.json({ error: 'Notebook title cannot be empty' }, { status: 400 })
    }

    const updated = await prisma.researchNotebook.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(isPublic !== undefined ? { isPublic: Boolean(isPublic) } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      },
    })

    return NextResponse.json({ notebook: serializeBigInt(updated) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook update error:', error)
    return NextResponse.json({ error: 'Failed to update notebook' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
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

    await prisma.researchNote.deleteMany({ where: { notebookId: id } })
    await prisma.researchSource.deleteMany({ where: { notebookId: id } })
    await prisma.researchNotebook.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook delete error:', error)
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 })
  }
}
