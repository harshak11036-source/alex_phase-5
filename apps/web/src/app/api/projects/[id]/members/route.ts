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

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('[Projects] Project members list error:', error)
    return NextResponse.json({ error: 'Failed to list project members' }, { status: 500 })
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
    const { email, userId: targetUserId, role = 'MEMBER' } = body

    let resolvedUser = null
    if (targetUserId) {
      resolvedUser = await prisma.user.findUnique({ where: { id: String(targetUserId) } })
    } else if (email) {
      resolvedUser = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } })
    }

    if (!resolvedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const member = await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: id,
          userId: resolvedUser.id,
        },
      },
      update: { role: role === 'MENTOR' ? 'MENTOR' : 'MEMBER' },
      create: {
        projectId: id,
        userId: resolvedUser.id,
        role: role === 'MENTOR' ? 'MENTOR' : 'MEMBER',
        invitedBy: user.id,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({ member })
  } catch (error) {
    console.error('[Projects] Project member invite error:', error)
    return NextResponse.json({ error: 'Failed to add project member' }, { status: 500 })
  }
}
