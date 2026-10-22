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

    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId: id },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json({ milestones })
  } catch (error) {
    console.error('[Projects] Project milestones list error:', error)
    return NextResponse.json({ error: 'Failed to list project milestones' }, { status: 500 })
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
    const { title, description, dueDate } = body

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Milestone title is required' }, { status: 400 })
    }

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId: id,
        title: String(title).trim(),
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({ milestone })
  } catch (error) {
    console.error('[Projects] Project milestone create error:', error)
    return NextResponse.json({ error: 'Failed to create project milestone' }, { status: 500 })
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
    const { milestoneId, isCompleted } = body

    if (!milestoneId || typeof isCompleted !== 'boolean') {
      return NextResponse.json({ error: 'milestoneId and isCompleted are required' }, { status: 400 })
    }

    const milestone = await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    })

    return NextResponse.json({ milestone })
  } catch (error) {
    console.error('[Projects] Project milestone update error:', error)
    return NextResponse.json({ error: 'Failed to update project milestone' }, { status: 500 })
  }
}
