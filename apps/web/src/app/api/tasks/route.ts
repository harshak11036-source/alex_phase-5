import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const tasks = await prisma.task.findMany({
      where: { assigneeId: user.id },
      orderBy: [
        { isCompleted: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Tasks list error:', error)
    return NextResponse.json({ error: 'Failed to list tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, description, dueDate, priority } = body

    const task = await prisma.task.create({
      data: {
        title,
        description,
        assigneeId: user.id,
        creatorId: user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 0,
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Task create error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const { id, isCompleted } = await request.json()
    if (!id || typeof isCompleted !== 'boolean') return NextResponse.json({ error: 'id and isCompleted are required' }, { status: 400 })
    const result = await prisma.task.updateMany({ where: { id, assigneeId: user.id }, data: { isCompleted, completedAt: isCompleted ? new Date() : null } })
    if (!result.count) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) { console.error('Task update error:', error); return NextResponse.json({ error: 'Failed to update task' }, { status: 500 }) }
}
