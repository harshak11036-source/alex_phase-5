import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

async function verifyProjectAccess(projectId: string, userId: string, role: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { where: { userId } } },
  })
  if (!project) return { project: null, allowed: false }
  const allowed =
    role === 'ADMIN' ||
    project.ownerId === userId ||
    project.members.length > 0
  return { project, allowed }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const { project, allowed } = await verifyProjectAccess(id, user.id, user.role)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const tasks = await prisma.projectTask.findMany({
      where: { projectId: id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('[Projects] Project tasks list error:', error)
    return NextResponse.json({ error: 'Failed to list project tasks' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const { project, allowed } = await verifyProjectAccess(id, user.id, user.role)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { title, description, assigneeId, status = 'TODO', priority = 1, dueDate } = body

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
    }

    const task = await prisma.projectTask.create({
      data: {
        projectId: id,
        title: String(title).trim(),
        description: description || null,
        assigneeId: assigneeId || user.id,
        creatorId: user.id,
        status: String(status),
        priority: Number(priority) || 0,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('[Projects] Project task create error:', error)
    return NextResponse.json({ error: 'Failed to create project task' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const { project, allowed } = await verifyProjectAccess(id, user.id, user.role)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { taskId, status, title, description, priority } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(status ? { status, completedAt: status === 'DONE' ? new Date() : null } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority !== undefined ? { priority: Number(priority) } : {}),
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('[Projects] Project task update error:', error)
    return NextResponse.json({ error: 'Failed to update project task' }, { status: 500 })
  }
}
