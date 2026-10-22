import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'
import { generateDiagramFromTemplate, saveDiagram, type DiagramDefinition } from '@/lib/diagrams/generator'
import { generateStructuredOutput, formatAIServiceErrorResponse } from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const {
      templateId,
      variables,
      customCode,
      customType,
      prompt,
      title,
      sourceDocId,
      subjectId,
      provider,
      model,
    } = body

    let definition: DiagramDefinition
    let usedProvider: string | undefined
    let usedModel: string | undefined

    const isPlaceholderMermaid =
      customCode === 'flowchart TD\n  A[Source document] --> B[Key concepts]' && Boolean(sourceDocId)

    if (templateId) {
      definition = await generateDiagramFromTemplate(templateId, variables || {})
      if (title) definition.title = title
    } else if (customCode && customType && !isPlaceholderMermaid) {
      definition = {
        type: customType,
        code: customCode,
        title: title || 'Custom Diagram',
      }
    } else if (sourceDocId || prompt) {
      let contextText = prompt || ''
      let docTitle = title || 'Generated Diagram'

      if (sourceDocId) {
        const doc = await prisma.document.findFirst({
          where: { id: sourceDocId },
          include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 15 } },
        })
        if (!doc) {
          return NextResponse.json({ error: 'Source document not found' }, { status: 404 })
        }
        const hasAccess = await canAccessDocument(user, doc)
        if (!hasAccess) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        docTitle = title || `${doc.title} — diagram`
        contextText = doc.chunks.map(c => c.content.trim()).join('\n\n').slice(0, 10000)
      }

      const structured = await generateStructuredOutput<{
        type: 'mermaid' | 'graphviz' | 'plantuml'
        title: string
        code: string
      }>({
        userId: user.id,
        provider,
        model,
        systemPrompt:
          'You are ALEX, an academic diagram generator. Create a clear Mermaid flowchart or sequence diagram illustrating the core process or architecture in the provided content.',
        schemaDescription: `{
  "type": "mermaid",
  "title": "Diagram title",
  "code": "flowchart TD\\n  A[Step 1] --> B[Step 2]"
}`,
        prompt: `Generate a ${customType || 'mermaid'} diagram for "${docTitle}":\n\n${contextText}`,
        validate: (parsed) => {
          if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
            throw new Error('Model did not return valid diagram code')
          }
          return {
            type: (parsed.type || customType || 'mermaid') as 'mermaid' | 'graphviz' | 'plantuml',
            title: String(parsed.title || docTitle),
            code: parsed.code.trim(),
          }
        },
      })

      definition = structured.data
      usedProvider = structured.provider
      usedModel = structured.model
    } else {
      return NextResponse.json(
        { error: 'Either templateId, customCode+customType, sourceDocId, or prompt is required' },
        { status: 400 }
      )
    }

    const saved = await saveDiagram(user.id, definition, sourceDocId, subjectId)

    return NextResponse.json({
      id: saved.id,
      title: saved.title,
      type: saved.type,
      definition: saved.definition,
      provider: usedProvider,
      model: usedModel,
      createdAt: saved.createdAt,
    })
  } catch (error) {
    console.error('[Diagrams] Generation error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Diagram generation failed')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const diagramId = searchParams.get('id')

    if (diagramId) {
      const diagram = await prisma.diagram.findUnique({ where: { id: diagramId } })
      if (!diagram || diagram.userId !== user.id) {
        return NextResponse.json({ error: 'Diagram not found' }, { status: 404 })
      }
      return NextResponse.json(diagram)
    }

    const diagrams = await prisma.diagram.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json(diagrams)
  } catch (error) {
    console.error('Get diagrams error:', error)
    return NextResponse.json({ error: 'Failed to get diagrams' }, { status: 500 })
  }
}
