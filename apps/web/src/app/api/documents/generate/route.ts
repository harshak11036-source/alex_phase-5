import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getUserChatProvider, type AIProviderType } from '@/lib/rag/generation'
import { hybridSearch } from '@/lib/rag/vector-search'
import { canAccessDocument } from '@/lib/document-processing/access'
import { formatAIServiceErrorResponse } from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const {
      sourceType,
      prompt,
      title,
      outputFormat = 'markdown',
      includeDiagrams,
      includeTables,
      includeCitations,
      documentIds,
      sourceDocumentIds,
      subjectId,
      projectId,
      notebookId,
      provider,
      model,
    } = body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const requestedDocIds: string[] | undefined = Array.isArray(documentIds)
      ? documentIds
      : Array.isArray(sourceDocumentIds)
        ? sourceDocumentIds
        : undefined

    if (requestedDocIds && requestedDocIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: { id: { in: requestedDocIds } },
        select: { id: true, ownerId: true, subjectId: true, projectId: true, notebookId: true },
      })
      if (docs.length === 0) {
        return NextResponse.json({ error: 'Selected source documents not found' }, { status: 404 })
      }
      for (const doc of docs) {
        const allowed = await canAccessDocument(user, doc)
        if (!allowed) {
          return NextResponse.json(
            { error: 'Forbidden: you do not have access to one or more selected documents' },
            { status: 403 }
          )
        }
      }
    }

    const chatProvider = await getUserChatProvider(
      user.id,
      provider as AIProviderType | undefined,
      model
    )

    let searchResults: any[] = []
    let context = ''

    if (sourceType === 'rag' || (requestedDocIds && requestedDocIds.length > 0)) {
      searchResults = await hybridSearch({
        query: prompt,
        userId: user.id,
        userRole: user.role,
        subjectId,
        projectId,
        notebookId,
        documentIds: requestedDocIds,
        limit: 10,
        threshold: 0.3,
      })
      context = searchResults
        .map(
          (c, i) =>
            `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
        )
        .join('\n\n---\n\n')
    }

    const formatPrompts = {
      markdown:
        'Generate a well-structured Markdown document with proper headings, lists, code blocks, and tables.',
      html: 'Generate a complete HTML document with semantic markup, proper styling, and responsive design.',
      pdf: 'Generate content suitable for PDF export with clear page structure.',
      docx: 'Generate content suitable for Word document with proper formatting hints.',
    }

    const featurePrompts = []
    if (includeDiagrams) featurePrompts.push('Include Mermaid diagram code blocks where appropriate')
    if (includeTables) featurePrompts.push('Include well-formatted tables with headers')
    if (includeCitations && searchResults.length > 0) {
      featurePrompts.push('Cite sources using [Source X] format')
    }

    const systemPrompt = `You are ALEX, a professional document generator. Create a high-quality ${outputFormat} document based on the user's request.

FORMAT: ${String(outputFormat).toUpperCase()}
${formatPrompts[outputFormat as keyof typeof formatPrompts] || formatPrompts.markdown}

FEATURES:
${featurePrompts.map(f => `- ${f}`).join('\n')}

RULES:
- Create professional, well-structured content
- Use appropriate formatting for the output format
- Be comprehensive but concise
- Include practical examples where relevant
- Maintain consistent style and tone
${context ? `\nUSE THE FOLLOWING SOURCES:\n${context}` : ''}`

    const response = await chatProvider.generate({
      query: prompt,
      context: searchResults,
      systemPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    })

    const sections = parseSections(response.answer)

    const document: Record<string, unknown> = {
      id: `doc-${Date.now()}`,
      title: title || 'Generated Document',
      content: response.answer,
      format: outputFormat,
      provider: response.provider,
      model: response.model,
      sections,
      metadata: {
        wordCount: response.answer.split(/\s+/).filter(Boolean).length,
        readingTime: Math.max(1, Math.ceil(response.answer.split(/\s+/).filter(Boolean).length / 200)),
        provider: response.provider,
        model: response.model,
        sourcesUsed: searchResults.length,
        createdAt: new Date().toISOString(),
      },
    }

    if (includeCitations && response.citations.length > 0) {
      document.citations = response.citations
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('[Document Generate] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Document generation failed')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}

function parseSections(content: string): Array<{
  id: string
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'diagram' | 'quote'
  content: any
  level?: number
}> {
  const sections: Array<{
    id: string
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'diagram' | 'quote'
    content: any
    level?: number
  }> = []

  const lines = content.split('\n')
  let currentSection: any = null
  let inCodeBlock = false
  let codeContent = ''
  let codeLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
        codeContent = ''
      } else {
        inCodeBlock = false
        sections.push({
          id: `section-${sections.length}`,
          type: codeLang === 'mermaid' ? 'diagram' : 'code',
          content: { code: codeContent, language: codeLang },
        })
        codeContent = ''
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += line + '\n'
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      sections.push({
        id: `section-${sections.length}`,
        type: 'heading',
        content: headingMatch[2],
        level: headingMatch[1].length,
      })
      continue
    }

    if (line.includes('|') && line.includes('---')) {
      const tableLines = [line]
      let j = i + 1
      while (j < lines.length && (lines[j].includes('|') || lines[j].trim() === '')) {
        if (lines[j].trim()) tableLines.push(lines[j])
        j++
      }
      i = j - 1
      sections.push({
        id: `section-${sections.length}`,
        type: 'table',
        content: tableLines.join('\n'),
      })
      continue
    }

    if (line.trim()) {
      if (!currentSection || currentSection.type !== 'paragraph') {
        currentSection = {
          id: `section-${sections.length}`,
          type: 'paragraph',
          content: '',
        }
        sections.push(currentSection)
      }
      currentSection.content += (currentSection.content ? '\n' : '') + line
    } else {
      currentSection = null
    }
  }

  return sections
}
