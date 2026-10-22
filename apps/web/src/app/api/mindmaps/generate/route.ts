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
    const { sourceDocId, title, provider, model } = body

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    const doc = await prisma.document.findFirst({
      where: { id: sourceDocId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 20 } },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, doc)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!doc.chunks || doc.chunks.length === 0) {
      return NextResponse.json(
        { error: 'The document has no processed text yet' },
        { status: 422 }
      )
    }

    const sourceText = doc.chunks
      .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
      .join('\n\n')
      .slice(0, 12000)

    const structured = await generateStructuredOutput<{
      nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
      edges: Array<{ id: string; source: string; target: string }>
    }>({
      userId: user.id,
      provider,
      model,
      systemPrompt:
        'You are ALEX, an academic knowledge-graph and mind-map generator. Extract the hierarchy of core concepts and their relationships from the provided document.',
      schemaDescription: `{
  "nodes": [
    { "id": "node-0", "label": "Central Topic", "position": { "x": 0, "y": 0 } }
  ],
  "edges": [
    { "id": "edge-0", "source": "node-0", "target": "node-1" }
  ]
}`,
      prompt: `Generate a structured concept mind map from "${doc.title}":\n\n${sourceText}`,
      validate: (parsed) => {
        if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
          throw new Error('Model did not return valid mind map nodes')
        }
        const nodes = parsed.nodes.map((n: any, idx: number) => ({
          id: String(n.id || `node-${idx}`),
          label: String(n.label || `Concept ${idx + 1}`).slice(0, 160),
          position: {
            x: typeof n.position?.x === 'number' ? n.position.x : (idx % 3) * 260,
            y: typeof n.position?.y === 'number' ? n.position.y : Math.floor(idx / 3) * 140,
          },
        }))
        const edges = Array.isArray(parsed.edges)
          ? parsed.edges.map((e: any, idx: number) => ({
              id: String(e.id || `edge-${idx}`),
              source: String(e.source || nodes[0].id),
              target: String(e.target || nodes[Math.min(idx + 1, nodes.length - 1)].id),
            }))
          : []
        return { nodes, edges }
      },
    })

    const map = await prisma.mindMap.create({
      data: {
        userId: user.id,
        title: title || `${doc.title} — mind map`,
        sourceDocId: doc.id,
        subjectId: doc.subjectId,
        nodes: structured.data.nodes,
        edges: structured.data.edges,
      },
    })

    return NextResponse.json({
      mindMap: map,
      provider: structured.provider,
      model: structured.model,
    })
  } catch (error) {
    console.error('[MindMaps] Generation error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate mind map')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
