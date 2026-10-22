import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'
import {
  generateStructuredOutput,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { sourceDocId, count = 10, title, provider, model } = body

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    const document = await prisma.document.findFirst({
      where: { id: sourceDocId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, document)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!document.chunks || document.chunks.length === 0) {
      return NextResponse.json(
        { error: 'The document has no processed text yet' },
        { status: 422 }
      )
    }

    const targetCount = Math.min(Math.max(Number(count) || 10, 1), 50)
    const sourceText = document.chunks
      .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
      .join('\n\n')
      .slice(0, 16000)

    const structured = await generateStructuredOutput<{ cards: Array<{ front: string; back: string }> }>({
      userId: user.id,
      provider,
      model,
      systemPrompt:
        'You are ALEX, an academic flashcard generator. Create high-signal spaced-repetition flashcards strictly grounded in the provided document text.',
      schemaDescription: `{
  "cards": [
    {
      "front": "Clear, specific question testing a concept, formula, or definition from the text",
      "back": "Concise, accurate answer grounded in the source text with [Source X] citation"
    }
  ]
}`,
      prompt: `Generate up to ${targetCount} flashcards from "${document.title}":\n\n${sourceText}`,
      validate: (parsed) => {
        const rawCards = Array.isArray(parsed) ? parsed : parsed?.cards
        if (!Array.isArray(rawCards) || rawCards.length === 0) {
          throw new Error('Model did not return a non-empty cards array')
        }
        return {
          cards: rawCards
            .filter((c: any) => c && typeof c.front === 'string' && typeof c.back === 'string')
            .slice(0, targetCount)
            .map((c: any) => ({
              front: c.front.trim(),
              back: c.back.trim(),
            })),
        }
      },
    })

    const deck = await prisma.flashcardDeck.create({
      data: {
        userId: user.id,
        title: title || `${document.title} — flashcards`,
        sourceDocId: document.id,
        subjectId: document.subjectId,
        cards: {
          create: structured.data.cards.map(c => ({
            front: c.front,
            back: c.back,
          })),
        },
      },
      include: {
        cards: true,
        _count: { select: { cards: true } },
      },
    })

    return NextResponse.json({
      deckId: deck.id,
      deck,
      provider: structured.provider,
      model: structured.model,
    })
  } catch (error) {
    console.error('[Flashcards] Generation error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate flashcards')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
