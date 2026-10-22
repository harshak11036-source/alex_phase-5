import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const decks = await prisma.flashcardDeck.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { cards: true } },
        subject: { select: { id: true, name: true, code: true } },
        sourceDoc: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ decks })
  } catch (error) {
    console.error('Flashcard decks list error:', error)
    return NextResponse.json({ error: 'Failed to list decks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, description, subjectId, sourceDocId, algorithm } = body

    const deck = await prisma.flashcardDeck.create({
      data: {
        userId: user.id,
        title,
        description,
        subjectId,
        sourceDocId,
        algorithm: algorithm || 'SM2',
      },
    })

    return NextResponse.json({ deck })
  } catch (error) {
    console.error('Flashcard deck create error:', error)
    return NextResponse.json({ error: 'Failed to create deck' }, { status: 500 })
  }
}
