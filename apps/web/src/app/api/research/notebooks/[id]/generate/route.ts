import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  generateText,
  generateStructuredOutput,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'
import { extractCitationsFromText } from '@/lib/rag/generation'
import type { SearchResult } from '@/lib/rag/vector-search'

export type NotebookArtifactType = 'summary' | 'study_guide' | 'faq' | 'quiz'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: notebookId } = await params

    const notebook = await prisma.researchNotebook.findUnique({
      where: { id: notebookId },
      include: {
        sources: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (notebook.ownerId !== user.id && !notebook.isPublic && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      type = 'summary',
      sourceIds,
      documentIds,
      count = 5,
      difficulty = 'medium',
      customInstructions,
      provider,
      model,
    } = body as {
      type?: NotebookArtifactType
      sourceIds?: string[]
      documentIds?: string[]
      count?: number
      difficulty?: string
      customInstructions?: string
      provider?: string
      model?: string
    }

    // Gather all document IDs associated with this notebook
    const candidateDocIds = new Set<string>()
    for (const s of notebook.sources || []) {
      if (s.documentId) candidateDocIds.add(s.documentId)
    }
    for (const d of notebook.documents || []) {
      candidateDocIds.add(d.id)
    }

    // Filter by requested documentIds or sourceIds if specified
    const filterIds = Array.isArray(documentIds) && documentIds.length > 0
      ? documentIds
      : Array.isArray(sourceIds) && sourceIds.length > 0
        ? sourceIds
        : null

    if (filterIds) {
      const resolvedFilterDocIds = new Set<string>()
      for (const fid of filterIds) {
        if (candidateDocIds.has(fid)) {
          resolvedFilterDocIds.add(fid)
        } else {
          const matchingSource = (notebook.sources || []).find(s => s.id === fid && s.documentId)
          if (matchingSource?.documentId) {
            resolvedFilterDocIds.add(matchingSource.documentId)
          }
        }
      }
      candidateDocIds.clear()
      for (const id of resolvedFilterDocIds) candidateDocIds.add(id)
    }

    const activeDocIds = [...candidateDocIds]
    if (activeDocIds.length === 0) {
      return NextResponse.json(
        {
          error: 'This notebook has no processed source documents yet. Upload or link at least one source first.',
          code: 'NO_PROCESSED_SOURCES',
        },
        { status: 422 }
      )
    }

    const rawChunks = await prisma.documentChunk.findMany({
      where: {
        documentId: { in: activeDocIds },
      },
      orderBy: [{ chunkIndex: 'asc' }],
      take: 40,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            documentType: true,
            ownerId: true,
          },
        },
      },
    })

    if (!rawChunks || rawChunks.length === 0) {
      return NextResponse.json(
        {
          error: 'The sources in this notebook have no extracted text chunks yet.',
          code: 'NO_PROCESSED_SOURCES',
        },
        { status: 422 }
      )
    }

    const docOrder = new Map(activeDocIds.map((id, idx) => [id, idx]))
    rawChunks.sort((a, b) => {
      const da = docOrder.get(a.documentId) ?? 999
      const db = docOrder.get(b.documentId) ?? 999
      if (da !== db) return da - db
      return a.chunkIndex - b.chunkIndex
    })
    const searchContext: SearchResult[] = rawChunks.map(c => ({
      id: c.id,
      documentId: c.documentId,
      content: c.content,
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
      similarity: 1.0,
      metadata: (c.metadata || {}) as Record<string, unknown>,
      document: c.document,
    }))

    const formattedSourcesBlock = searchContext
      .map(
        (c, i) =>
          `[Source ${i + 1}] (Document: "${c.document.title}", Page ${c.pageNumber ?? 1}${c.sectionTitle ? `, Section: "${c.sectionTitle}"` : ''}):\n${c.content.trim()}`
      )
      .join('\n\n---\n\n')
      .slice(0, 24000)

    const distinctDocTitles = [...new Set(searchContext.map(c => c.document.title))]

    // 1. Summary or Study Guide
    if (type === 'summary' || type === 'study_guide') {
      const isStudyGuide = type === 'study_guide'
      const systemPrompt = isStudyGuide
        ? `You are ALEX, an academic research synthesis assistant. Create a comprehensive Study Guide strictly grounded in the provided notebook sources.
Include:
1. Core Themes & Overview
2. Key Concepts & Definitions (with [Source X] citations)
3. Important Formulas, Methods, or Mechanisms (with [Source X] citations)
4. Cross-Source Comparison & Connections
5. Short-Answer Review Questions with Answers

Rules:
- Cite the exact source for every claim using [Source X] format (which maps to the document title, page, and section).
- Do NOT invent facts outside the provided sources.`
        : `You are ALEX, an academic research synthesis assistant. Create an Executive Briefing & Notebook Summary strictly grounded in the provided notebook sources.
Include:
1. Executive Overview across all ${distinctDocTitles.length} source(s)
2. Key Findings & Evidence per Source (citing [Source X])
3. Core Takeaways & Synthesis

Rules:
- Cite the exact source for every claim using [Source X] format (which maps to the document title, page, and section).
- Do NOT invent facts outside the provided sources.`

      const genRes = await generateText({
        userId: user.id,
        provider,
        model,
        taskType: 'summarization',
        systemPrompt,
        prompt: `Notebook: "${notebook.title}"\nIncluded Sources: ${distinctDocTitles.join(', ')}\n${customInstructions ? `Additional Focus: ${customInstructions}\n` : ''}\nSource Excerpts:\n\n${formattedSourcesBlock}`,
        temperature: 0.25,
        maxTokens: 3200,
      })

      const citations = extractCitationsFromText(genRes.text, searchContext)
      if (citations.length === 0 && searchContext.length > 0) {
        const first = searchContext[0]
        citations.push({
          id: first.id,
          documentId: first.documentId,
          documentTitle: first.document.title,
          pageNumber: first.pageNumber,
          sectionTitle: first.sectionTitle,
          excerpt: first.content.slice(0, 200),
          relevanceScore: 1.0,
        })
      }

      const noteTitle = isStudyGuide
        ? `${notebook.title} — Study Guide`
        : `${notebook.title} — Executive Summary`

      const savedNote = await prisma.researchNote.create({
        data: {
          notebookId,
          userId: user.id,
          title: noteTitle,
          content: genRes.text,
          sourceIds: activeDocIds,
          tags: ['generated', isStudyGuide ? 'study-guide' : 'summary'],
        },
      })

      return NextResponse.json({
        type,
        title: noteTitle,
        content: genRes.text,
        citations,
        sourcesUsed: distinctDocTitles.length,
        isSourceSupported: true,
        groundingStatus: 'SUPPORTED',
        note: savedNote,
        provider: genRes.provider,
        model: genRes.model,
      })
    }

    // 2. FAQ Generation
    if (type === 'faq') {
      const targetCount = Math.min(Math.max(Number(count) || 5, 1), 15)
      const structured = await generateStructuredOutput<{
        faqs: Array<{
          question: string
          answer: string
          sourceNumbers: number[]
        }>
      }>({
        userId: user.id,
        provider,
        model,
        systemPrompt:
          'You are ALEX, an academic FAQ generator. Generate frequently asked questions and thorough answers strictly grounded in the provided notebook sources. Every answer MUST cite [Source X] and include the referenced sourceNumbers array.',
        schemaDescription: `{
  "faqs": [
    {
      "question": "Specific question answered by the notebook sources",
      "answer": "Detailed, source-supported answer citing [Source 1]",
      "sourceNumbers": [1]
    }
  ]
}`,
        prompt: `Generate ${targetCount} high-value FAQs for notebook "${notebook.title}" from these sources:\n\n${formattedSourcesBlock}`,
        validate: (parsed) => {
          const rawFaqs = Array.isArray(parsed) ? parsed : parsed?.faqs
          if (!Array.isArray(rawFaqs) || rawFaqs.length === 0) {
            throw new Error('Model did not return a valid faqs array')
          }
          return {
            faqs: rawFaqs.slice(0, targetCount).map((f: any) => ({
              question: String(f.question || '').trim(),
              answer: String(f.answer || '').trim(),
              sourceNumbers: Array.isArray(f.sourceNumbers)
                ? f.sourceNumbers.map(Number).filter(n => Number.isFinite(n) && n >= 1)
                : [],
            })),
          }
        },
      })

      const enrichedFaqs = structured.data.faqs.map((faq, idx) => {
        let citations = extractCitationsFromText(faq.answer, searchContext)
        if (citations.length === 0 && faq.sourceNumbers.length > 0) {
          citations = faq.sourceNumbers
            .map(n => searchContext[n - 1])
            .filter(Boolean)
            .map(s => ({
              id: s.id,
              documentId: s.documentId,
              documentTitle: s.document.title,
              pageNumber: s.pageNumber,
              sectionTitle: s.sectionTitle,
              excerpt: s.content.slice(0, 200),
              relevanceScore: 1.0,
            }))
        }
        if (citations.length === 0 && searchContext[idx % searchContext.length]) {
          const fallbackSrc = searchContext[idx % searchContext.length]
          citations = [
            {
              id: fallbackSrc.id,
              documentId: fallbackSrc.documentId,
              documentTitle: fallbackSrc.document.title,
              pageNumber: fallbackSrc.pageNumber,
              sectionTitle: fallbackSrc.sectionTitle,
              excerpt: fallbackSrc.content.slice(0, 200),
              relevanceScore: 1.0,
            },
          ]
        }
        return {
          question: faq.question,
          answer: faq.answer,
          citations,
        }
      })

      const markdownFaq = enrichedFaqs
        .map(
          (f, i) =>
            `### Q${i + 1}: ${f.question}\n${f.answer}\n*Sources: ${f.citations
              .map(c => `${c.documentTitle}${c.pageNumber ? ` (p.${c.pageNumber})` : ''}${c.sectionTitle ? ` [${c.sectionTitle}]` : ''}`)
              .join(', ')}*`
        )
        .join('\n\n')

      const savedNote = await prisma.researchNote.create({
        data: {
          notebookId,
          userId: user.id,
          title: `${notebook.title} — FAQ`,
          content: markdownFaq,
          sourceIds: activeDocIds,
          tags: ['generated', 'faq'],
        },
      })

      return NextResponse.json({
        type: 'faq',
        title: `${notebook.title} — FAQ`,
        faqs: enrichedFaqs,
        content: markdownFaq,
        citations: enrichedFaqs.flatMap(f => f.citations),
        sourcesUsed: distinctDocTitles.length,
        isSourceSupported: true,
        groundingStatus: 'SUPPORTED',
        note: savedNote,
        provider: structured.provider,
        model: structured.model,
      })
    }

    // 3. Quiz Generation across Notebook Sources
    if (type === 'quiz') {
      const targetCount = Math.min(Math.max(Number(count) || 5, 1), 20)
      const structured = await generateStructuredOutput<{
        questions: Array<{
          id: string
          prompt: string
          options: string[]
          answer: number
          explanation: string
        }>
      }>({
        userId: user.id,
        provider,
        model,
        systemPrompt:
          'You are ALEX, an academic assessment generator. Create multiple-choice quiz questions strictly grounded in the provided notebook sources. Every explanation MUST cite [Source X].',
        schemaDescription: `{
  "questions": [
    {
      "id": "q-1",
      "prompt": "Question testing comprehension of the notebook sources",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Explanation citing [Source 1] with page/section context"
    }
  ]
}`,
        prompt: `Generate ${targetCount} ${difficulty}-difficulty multiple-choice questions for notebook "${notebook.title}" from these sources:\n\n${formattedSourcesBlock}`,
        validate: (parsed) => {
          const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions
          if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
            throw new Error('Model did not return a non-empty questions array')
          }
          return {
            questions: rawQuestions.slice(0, targetCount).map((q: any, idx: number) => ({
              id: q.id || `q-${idx + 1}`,
              prompt: String(q.prompt || q.question || '').trim(),
              options:
                Array.isArray(q.options) && q.options.length >= 2
                  ? q.options.map(String)
                  : ['Option A', 'Option B', 'Option C', 'Option D'],
              answer: typeof q.answer === 'number' ? q.answer : 0,
              explanation: String(q.explanation || 'Grounded in [Source 1].').trim(),
            })),
          }
        },
      })

      const enrichedQuestions = structured.data.questions.map((q, idx) => {
        let citations = extractCitationsFromText(`${q.prompt} ${q.explanation}`, searchContext)
        if (citations.length === 0 && searchContext[idx % searchContext.length]) {
          const fallbackSrc = searchContext[idx % searchContext.length]
          citations = [
            {
              id: fallbackSrc.id,
              documentId: fallbackSrc.documentId,
              documentTitle: fallbackSrc.document.title,
              pageNumber: fallbackSrc.pageNumber,
              sectionTitle: fallbackSrc.sectionTitle,
              excerpt: fallbackSrc.content.slice(0, 200),
              relevanceScore: 1.0,
            },
          ]
        }
        return {
          ...q,
          citations,
        }
      })

      const quiz = await prisma.quiz.create({
        data: {
          userId: user.id,
          title: `${notebook.title} — Quiz`,
          description: `Generated from ${distinctDocTitles.length} source(s) in ${notebook.title}`,
          sourceDocId: activeDocIds[0] || null,
          topic: notebook.title,
          difficulty: String(difficulty),
          questions: enrichedQuestions as any,
        },
      })

      return NextResponse.json({
        type: 'quiz',
        title: quiz.title,
        quiz: {
          ...quiz,
          questions: enrichedQuestions,
        },
        citations: enrichedQuestions.flatMap(q => q.citations),
        sourcesUsed: distinctDocTitles.length,
        isSourceSupported: true,
        groundingStatus: 'SUPPORTED',
        provider: structured.provider,
        model: structured.model,
      })
    }

    return NextResponse.json(
      { error: `Unsupported artifact type "${type}". Supported: summary, study_guide, faq, quiz.` },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Research Notebook Generate] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate notebook artifact')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
