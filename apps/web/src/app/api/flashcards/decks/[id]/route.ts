import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id },
      include: {
        cards: { orderBy: { nextReview: 'asc' } },
        _count: { select: { cards: true } },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ deck, cards: deck.cards })
  } catch (error) {
    console.error('Flashcard deck get error:', error)
    return NextResponse.json({ error: 'Failed to get deck' }, { status: 500 })
  }
}