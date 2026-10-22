import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
        notes: { orderBy: { updatedAt: 'desc' } },
      },
    })

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.ownerId !== user.id && !notebook.isPublic && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ notes: notebook.notes })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook notes list error:', error)
    return NextResponse.json({ error: 'Failed to list notebook notes' }, { status: 500 })
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
    const { title, content, sourceIds = [], tags = [] } = body

    if (!title || !String(title).trim() || !content || !String(content).trim()) {
      return NextResponse.json({ error: 'Note title and content are required' }, { status: 400 })
    }

    const note = await prisma.researchNote.create({
      data: {
        notebookId: id,
        userId: user.id,
        title: String(title).trim(),
        content: String(content),
        sourceIds: Array.isArray(sourceIds) ? sourceIds : [],
        tags: Array.isArray(tags) ? tags : [],
      },
    })

    return NextResponse.json({ note })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook note create error:', error)
    return NextResponse.json({ error: 'Failed to create notebook note' }, { status: 500 })
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url || `http://localhost:3000/api/research/notebooks/${id}/notes`)
    let noteId = searchParams.get('noteId')
    if (!noteId) {
      const body = await request.json().catch(() => ({}))
      noteId = body.noteId || null
    }

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 })
    }

    await prisma.researchNote.deleteMany({
      where: { id: noteId, notebookId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Research] Notebook note delete error:', error)
    return NextResponse.json({ error: 'Failed to delete notebook note' }, { status: 500 })
  }
}
