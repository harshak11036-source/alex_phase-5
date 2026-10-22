import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Conversations list error:', error)
    return NextResponse.json({ error: 'Failed to list conversations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, projectId, notebookId } = body

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || 'New Conversation',
        projectId,
        notebookId,
      },
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Conversation create error:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}
