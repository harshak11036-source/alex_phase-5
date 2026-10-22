import { prisma } from '@/lib/prisma'
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client'
import {
  extractContent,
  validateUploadedFile,
  resolveDocumentType,
} from '@/lib/document-processing/extractors'
import { chunkBySemanticUnits } from '@/lib/document-processing/chunker'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { uploadFile, fileExists, downloadFile as storageDownloadFile } from '@/lib/storage/client'
import { canMutateDocument } from '@/lib/document-processing/access'

export interface ProcessingContext {
  documentId: string
  userId: string
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  documentType: DocumentType
  subjectId?: string
  projectId?: string
  notebookId?: string
}

export interface ProcessedDocumentSummary {
  id: string
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  documentType: DocumentType
  status: DocumentStatus
  pageCount: number
  chunksCount: number
  errorMessage: string | null
  processedAt: Date | null
  createdAt: Date
}

export function encodeEmbeddingToBytes(embedding: number[]): Buffer {
  const float32 = new Float32Array(embedding)
  return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength)
}

export function decodeEmbeddingFromBytes(bytes?: Buffer | Uint8Array | null): number[] | null {
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) return null
  const aligned = Buffer.from(bytes)
  const float32 = new Float32Array(
    aligned.buffer,
    aligned.byteOffset,
    aligned.byteLength / 4
  )
  return Array.from(float32)
}

export async function processDocument(
  context: ProcessingContext
): Promise<{ status: DocumentStatus; pageCount: number; chunksCount: number; tokenCount: number }> {
  const { documentId, userId, fileBuffer, mimeType, documentType } = context

  try {
    await updateStatus(documentId, DocumentStatus.EXTRACTING)

    const extracted = await extractContent(fileBuffer, documentType, mimeType)
    const normalizedText = (extracted.text || '').trim()
    if (!normalizedText) {
      throw new Error(`No readable text could be extracted from ${context.fileName}`)
    }
    const pageCount = Math.max(1, extracted.pages.length)

    await prisma.document.update({
      where: { id: documentId },
      data: {
        pageCount,
        metadata: extracted.metadata as Prisma.InputJsonValue,
        status: DocumentStatus.CHUNKING,
      },
    })

    await updateStatus(documentId, DocumentStatus.CHUNKING)

    const chunks = chunkBySemanticUnits(normalizedText, extracted.pages)
    if (chunks.length === 0) {
      throw new Error(`Document chunking produced 0 chunks for ${context.fileName}`)
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.EMBEDDING },
    })

    await updateStatus(documentId, DocumentStatus.EMBEDDING)

    const embeddingProvider = await getUserEmbeddingProvider(userId)
    if (!embeddingProvider) {
      throw new Error('No embedding provider configured for user')
    }

    const chunkTexts = chunks.map(c => c.content)
    const { embeddings, tokenCount } =
      chunkTexts.length > 0
        ? await embeddingProvider.provider.generateEmbeddings(chunkTexts)
        : { embeddings: [] as number[][], tokenCount: 0 }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.INDEXING },
    })

    await updateStatus(documentId, DocumentStatus.INDEXING)

    const processedAt = new Date()

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = embeddings[i] || []
        const embeddingBytes = embedding.length > 0 ? encodeEmbeddingToBytes(embedding) : null
        const chunkMetadata = {
          ...(chunk.metadata || {}),
          ...(embedding.length > 0 ? { embeddingModel: embeddingProvider.model } : {}),
        }

        await tx.documentChunk.create({
          data: {
            documentId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            sectionTitle: chunk.sectionTitle,
            tokenCount: chunk.tokenCount,
            embedding: embeddingBytes,
            metadata: chunkMetadata as Prisma.InputJsonValue,
          },
        })
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          errorMessage: null,
          processedAt,
          processorId: userId,
        },
      })
    })

    await prisma.documentProcessingJob.create({
      data: {
        documentId,
        step: 'completed',
        status: DocumentStatus.READY,
        completedAt: processedAt,
        metadata: { chunksCreated: chunks.length, tokensUsed: tokenCount, pageCount },
      },
    })

    return {
      status: DocumentStatus.READY,
      pageCount,
      chunksCount: chunks.length,
      tokenCount,
    }
  } catch (error) {
    console.error('[Document Pipeline] Processing error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown document processing error'
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
        errorMessage,
      },
    })

    await prisma.documentProcessingJob.create({
      data: {
        documentId,
        step: 'failed',
        status: DocumentStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    })
    throw error
  }
}

async function updateStatus(documentId: string, status: DocumentStatus) {
  await prisma.documentProcessingJob.create({
    data: {
      documentId,
      step: status.toLowerCase(),
      status,
      startedAt: new Date(),
    },
  })
}

export async function createDocumentRecord(
  userId: string,
  file: File,
  subjectId?: string,
  projectId?: string,
  notebookId?: string,
  customTitle?: string,
  description?: string
) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { documentType, normalizedMimeType } = validateUploadedFile(
    file.name,
    file.type,
    buffer
  )

  const crypto = await import('crypto')
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${userId}/${Date.now()}-${safeFileName}`
  const bucket = process.env.STORAGE_BUCKET_DOCUMENTS || 'documents'

  const uploadResult = await uploadFile(bucket, storagePath, buffer, {
    contentType: normalizedMimeType,
  })

  // Verify the file was actually persisted in storage
  const storedExists = await fileExists(bucket, uploadResult.path || storagePath)
  if (!storedExists) {
    throw new Error('Failed to verify stored file after upload')
  }

  const document = await prisma.document.create({
    data: {
      title: (customTitle || file.name).trim(),
      description: description ? description.trim() : null,
      fileName: file.name,
      fileSize: BigInt(buffer.byteLength),
      mimeType: normalizedMimeType,
      documentType,
      storagePath: uploadResult.path || storagePath,
      storageBucket: bucket,
      checksum,
      ownerId: userId,
      subjectId,
      projectId,
      notebookId,
      status: DocumentStatus.UPLOADED,
    },
  })

  return { document, buffer, storagePath: uploadResult.path || storagePath }
}

export function getDocumentType(fileName: string, mimeType = ''): DocumentType {
  return resolveDocumentType(fileName, mimeType)
}

export async function reprocessDocument(
  documentId: string,
  userId: string,
  userRole?: string
) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document) throw new Error('Document not found')
  if (!canMutateDocument({ id: userId, role: userRole }, document)) {
    throw new Error('Unauthorized')
  }

  await prisma.documentChunk.deleteMany({ where: { documentId } })
  await prisma.documentProcessingJob.deleteMany({ where: { documentId } })

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.QUEUED, errorMessage: null },
  })

  const buffer = await storageDownloadFile(document.storageBucket, document.storagePath)

  return processDocument({
    documentId,
    userId,
    fileBuffer: buffer,
    fileName: document.fileName,
    mimeType: document.mimeType,
    documentType: document.documentType,
    subjectId: document.subjectId || undefined,
    projectId: document.projectId || undefined,
    notebookId: document.notebookId || undefined,
  })
}
