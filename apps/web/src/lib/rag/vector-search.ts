import { prisma } from '@/lib/prisma'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { decodeEmbeddingFromBytes } from '@/lib/document-processing/pipeline'
import { Prisma } from '@prisma/client'

export interface SearchOptions {
  query: string
  userId: string
  userRole?: string
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  limit?: number
  threshold?: number
  filter?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  metadata: Record<string, unknown>
  document: {
    id: string
    title: string
    fileName: string
    documentType: string
    ownerId: string
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function buildAccessibleDocumentWhere(options: SearchOptions): Prisma.DocumentWhereInput {
  const { userId, userRole, subjectId, projectId, notebookId, documentIds } = options
  const accessClause: Prisma.DocumentWhereInput =
    userRole === 'ADMIN'
      ? {}
      : {
          OR: [
            { ownerId: userId },
            { subject: { enrollments: { some: { userId, isActive: true } } } },
            { subject: { lecturers: { some: { userId } } } },
            { project: { members: { some: { userId } } } },
            { notebook: { ownerId: userId } },
            { notebook: { isPublic: true } },
          ],
        }

  return {
    AND: [
      accessClause,
      ...(subjectId ? [{ subjectId }] : []),
      ...(projectId ? [{ projectId }] : []),
      ...(notebookId ? [{ notebookId }] : []),
      ...(documentIds && documentIds.length > 0 ? [{ id: { in: documentIds } }] : []),
    ],
  }
}

export async function vectorSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, userId, limit = 10, threshold = 0.5 } = options

  const embeddingProvider = await getUserEmbeddingProvider(userId)
  if (!embeddingProvider) {
    return []
  }

  try {
    const { embeddings } = await embeddingProvider.provider.generateEmbeddings([query])
    const queryEmbedding = embeddings[0]
    if (!queryEmbedding || queryEmbedding.length === 0) return []

    const rows = await prisma.documentChunk.findMany({
      where: {
        document: buildAccessibleDocumentWhere(options),
      },
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
      take: 500,
    })

    const effectiveThreshold = embeddingProvider.model === 'mock' ? -1 : threshold

    return rows
      .map(row => {
        const meta = (row.metadata || {}) as Record<string, unknown>
        const vector =
          decodeEmbeddingFromBytes(row.embedding) ||
          (Array.isArray(meta.embedding) ? (meta.embedding as number[]) : null)
        if (!vector) return null
        const sim = cosineSimilarity(queryEmbedding, vector)
        return { row, similarity: sim }
      })
      .filter((item): item is { row: (typeof rows)[number]; similarity: number } =>
        Boolean(item && item.similarity >= effectiveThreshold)
      )
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ row, similarity }) => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: Math.max(0, Number(similarity)),
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))
  } catch (error) {
    console.warn('Vector search failed, falling back to keyword search:', error)
    return []
  }
}

export async function keywordSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, limit = 10 } = options

  try {
    const rows = await prisma.documentChunk.findMany({
      where: {
        document: buildAccessibleDocumentWhere(options),
      },
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
      take: 500,
    })

    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'how', 'why',
      'are', 'was', 'were', 'can', 'you', 'about', 'into', 'tell', 'explain',
      'summarize', 'summary', 'document', 'file', 'uploaded', 'please',
    ])

    const rawTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)
    const terms = rawTerms.filter(t => !stopWords.has(t))
    const activeTerms = terms.length > 0 ? terms : rawTerms

    if (activeTerms.length === 0) {
      return rows.slice(0, limit).map(row => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: 0.5,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))
    }

    const scored = rows
      .map(row => {
        const lowerContent = row.content.toLowerCase()
        const lowerTitle = row.document.title.toLowerCase()
        const matchedCount = activeTerms.filter(
          term => lowerContent.includes(term) || lowerTitle.includes(term)
        ).length
        const score = matchedCount / activeTerms.length
        return { row, score }
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: score,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))

    if (scored.length > 0) {
      return scored
    }

    // If user asked a general summarization/analysis query over accessible documents, return leading chunks
    if (rows.length > 0) {
      return rows.slice(0, limit).map(row => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: 0.35,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))
    }

    return []
  } catch (error) {
    console.warn('Keyword search failed:', error)
    return []
  }
}

export async function hybridSearch(options: SearchOptions): Promise<SearchResult[]> {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(options),
    keywordSearch(options),
  ])

  const combined = new Map<string, SearchResult>()

  for (const result of vectorResults) {
    combined.set(result.id, { ...result, similarity: result.similarity * 0.7 })
  }

  for (const result of keywordResults) {
    const existing = combined.get(result.id)
    if (existing) {
      existing.similarity = Math.min(1, existing.similarity + result.similarity * 0.3)
    } else {
      combined.set(result.id, { ...result, similarity: result.similarity * 0.3 })
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit || 10)
}
