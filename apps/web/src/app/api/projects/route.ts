import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { members: true, tasks: true, milestones: true, documents: true } },
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
        },
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Projects list error:', error)
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, description, category, tags } = body

    const project = await prisma.project.create({
      data: {
        ownerId: user.id,
        title,
        description,
        category,
        tags: tags || [],
        members: {
          create: { userId: user.id, role: 'OWNER' },
        },
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Project create error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
