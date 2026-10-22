import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const subjectId = searchParams.get('subjectId')

    const whereClause: Record<string, any> = { userId: user.id }
    if (status) whereClause.status = status.toUpperCase()
    if (subjectId) whereClause.subjectId = subjectId

    const tasks = await prisma.plannerTask.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Tasks] List error:', error)
    return NextResponse.json({ error: 'Failed to list tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
    }

    const task = await prisma.plannerTask.create({
      data: {
        userId: user.id,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        priority: (body.priority || 'MEDIUM') as any,
        status: (body.status || 'TODO') as any,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        estimatedMinutes: body.estimatedMinutes ? Number(body.estimatedMinutes) : null,
        subjectId:
          typeof body.subjectId === 'string' && body.subjectId.trim() && body.subjectId !== 'NONE'
            ? body.subjectId.trim()
            : null,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Tasks] Create error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const id = body.id || body.taskId

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const existing = await prisma.plannerTask.findUnique({ where: { id: String(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const nextStatus = body.status ? String(body.status).toUpperCase() : existing.status
    const task = await prisma.plannerTask.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description ? String(body.description).trim() : null }
          : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.status !== undefined
          ? {
              status: nextStatus as any,
              completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
            }
          : {}),
        ...(body.dueDate !== undefined
          ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
          : {}),
        ...(body.actualMinutes !== undefined
          ? { actualMinutes: body.actualMinutes ? Number(body.actualMinutes) : null }
          : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Tasks] Update error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return PATCH(request)
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id') || searchParams.get('taskId')

    if (!id) {
      const body = await request.json().catch(() => ({}))
      id = body.id || body.taskId
    }

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const existing = await prisma.plannerTask.findUnique({ where: { id: String(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.plannerTask.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true, deletedId: existing.id })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Tasks] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
