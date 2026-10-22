import { DocumentType } from '@prisma/client'

export interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
}

export interface DocumentChunk {
  content: string
  chunkIndex: number
  pageNumber?: number
  sectionTitle?: string
  tokenCount: number
  metadata: Record<string, unknown>
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
}

function countTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function splitText(text: string, separators: string[], maxTokens = 1000): string[] {
  if (separators.length === 0) return [text]

  const separator = separators[0]
  const parts = text.split(separator)

  if (parts.length === 1) {
    return splitText(text, separators.slice(1), maxTokens)
  }

  const result: string[] = []
  let current = ''

  for (const part of parts) {
    const testChunk = current + (current ? separator : '') + part
    if (countTokens(testChunk) > maxTokens && current) {
      result.push(current)
      current = part
    } else {
      current = testChunk
    }
  }

  if (current) result.push(current)
  return result
}

export function chunkContent(
  content: string,
  pages: { pageNumber: number; text: string }[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const normalizedPages = (pages.length > 0 ? pages : [{ pageNumber: 1, text: content }]).filter(
    p => p.text && p.text.trim().length > 0
  )
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  for (const page of normalizedPages) {
    const pageText = page.text.trim()
    if (!pageText) continue

    const segments = splitText(pageText, opts.separators, opts.chunkSize)
    let currentChunk = ''

    for (const segment of segments) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + segment
      const tokenCount = countTokens(testChunk)

      if (tokenCount > opts.chunkSize && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          pageNumber: page.pageNumber,
          tokenCount: countTokens(currentChunk),
          metadata: {},
          sectionTitle: extractSectionTitle(currentChunk),
        })

        const overlapText = getOverlapText(currentChunk, opts.chunkOverlap)
        currentChunk = overlapText ? overlapText + '\n\n' + segment : segment
      } else {
        currentChunk = testChunk
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        tokenCount: countTokens(currentChunk),
        metadata: {},
        sectionTitle: extractSectionTitle(currentChunk),
      })
    }
  }

  return chunks
}

function getOverlapText(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return ''
  const words = text.split(/\s+/)
  const overlapWords = Math.min(words.length, Math.ceil(overlapTokens / 4))
  return words.slice(-overlapWords).join(' ')
}

function extractSectionTitle(text: string): string | undefined {
  const lines = text.split('\n').filter(l => l.trim())
  for (const line of lines) {
    const trimmed = line.trim().replace(/^#{1,6}\s+/, '')
    if (trimmed.length > 2 && trimmed.length < 100 && /^[A-Z][^.!?;]*$/.test(trimmed)) {
      return trimmed
    }
  }
  return undefined
}

export function chunkBySemanticUnits(
  content: string,
  pages: { pageNumber: number; text: string }[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  return chunkContent(content, pages, options)
}