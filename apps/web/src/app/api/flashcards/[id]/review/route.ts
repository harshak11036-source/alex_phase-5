import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const body = await request.json()
    const { rating } = body

    const card = await prisma.flashcard.findUnique({
      where: { id },
      include: { deck: true },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    if (card.deck.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    let { easeFactor, interval, repetitions } = card
    let nextReview: Date

    if (rating < 3) {
      repetitions = 0
      interval = 1
    } else {
      if (repetitions === 0) {
        interval = 1
      } else if (repetitions === 1) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor)
      }
      repetitions += 1
    }

    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)))
    nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000)

    const updatedCard = await prisma.flashcard.update({
      where: { id },
      data: {
        easeFactor,
        interval,
        repetitions,
        nextReview,
        lastReviewed: now,
        difficulty: Math.max(0, Math.min(1, 1 - (rating - 1) / 3)),
      },
    })

    await prisma.flashcardReview.create({
      data: {
        cardId: id,
        userId: user.id,
        rating,
        previousEase: card.easeFactor,
        newEase: easeFactor,
        previousInterval: card.interval,
        newInterval: interval,
      },
    })

    return NextResponse.json({ card: updatedCard })
  } catch (error) {
    console.error('Flashcard review error:', error)
    return NextResponse.json({ error: 'Failed to review card' }, { status: 500 })
  }
}