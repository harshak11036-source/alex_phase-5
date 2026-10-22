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

    if (deck.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ deck, cards: deck.cards })
  } catch (error) {
    console.error('[Flashcards] Deck cards get error:', error)
    return NextResponse.json({ error: 'Failed to get deck cards' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const deck = await prisma.flashcardDeck.findUnique({ where: { id } })
    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { front, back } = body

    if (!front || !back) {
      return NextResponse.json({ error: 'front and back are required' }, { status: 400 })
    }

    const card = await prisma.flashcard.create({
      data: {
        deckId: id,
        front: String(front),
        back: String(back),
      },
    })

    return NextResponse.json({ card })
  } catch (error) {
    console.error('[Flashcards] Deck card create error:', error)
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 })
  }
}
