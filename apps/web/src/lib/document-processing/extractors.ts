import { DocumentType } from '@prisma/client'
import { inflateRawSync, inflateSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)

export interface ExtractedContent {
  text: string
  pages: PageContent[]
  metadata: Record<string, unknown>
}

export interface PageContent {
  pageNumber: number
  text: string
  tables?: TableData[]
  images?: ImageData[]
}

export interface TableData {
  headers: string[]
  rows: string[][]
  pageNumber: number
}

export interface ImageData {
  pageNumber: number
  imageIndex: number
  mimeType: string
  data: Buffer
}

const DocType = {
  PDF: (DocumentType?.PDF || "PDF") as DocumentType,
  DOC: (DocumentType?.DOC || "DOC") as DocumentType,
  DOCX: (DocumentType?.DOCX || "DOCX") as DocumentType,
  TXT: (DocumentType?.TXT || "TXT") as DocumentType,
  MARKDOWN: (DocumentType?.MARKDOWN || "MARKDOWN") as DocumentType,
  CSV: (DocumentType?.CSV || "CSV") as DocumentType,
  XLS: (DocumentType?.XLS || "XLS") as DocumentType,
  XLSX: (DocumentType?.XLSX || "XLSX") as DocumentType,
  PPT: (DocumentType?.PPT || "PPT") as DocumentType,
  PPTX: (DocumentType?.PPTX || "PPTX") as DocumentType,
  PNG: (DocumentType?.PNG || "PNG") as DocumentType,
  JPG: (DocumentType?.JPG || "JPG") as DocumentType,
  JPEG: (DocumentType?.JPEG || "JPEG") as DocumentType,
  OTHER: (DocumentType?.OTHER || "OTHER") as DocumentType,
}

export const SUPPORTED_FILE_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'md',
  'markdown',
  'csv',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
] as const

export const EXTENSION_TO_DOCUMENT_TYPE: Record<string, DocumentType> = {
  pdf: DocType.PDF,
  doc: DocType.DOC,
  docx: DocType.DOCX,
  txt: DocType.TXT,
  md: DocType.MARKDOWN,
  markdown: DocType.MARKDOWN,
  csv: DocType.CSV,
  xls: DocType.XLS,
  xlsx: DocType.XLSX,
  ppt: DocType.PPT,
  pptx: DocType.PPTX,
  png: DocType.PNG,
  jpg: DocType.JPG,
  jpeg: DocType.JPEG,
}

export const MIME_TO_DOCUMENT_TYPE: Record<string, DocumentType> = {
  'application/pdf': DocType.PDF,
  'application/msword': DocType.DOC,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocType.DOCX,
  'text/plain': DocType.TXT,
  'text/markdown': DocType.MARKDOWN,
  'text/x-markdown': DocType.MARKDOWN,
  'text/csv': DocType.CSV,
  'application/csv': DocType.CSV,
  'application/vnd.ms-excel': DocType.XLS,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocType.XLSX,
  'application/vnd.ms-powerpoint': DocType.PPT,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': DocType.PPTX,
  'image/png': DocType.PNG,
  'image/jpeg': DocType.JPEG,
  'image/jpg': DocType.JPG,
}

export class DocumentValidationError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode = 400, code = 'INVALID_DOCUMENT') {
    super(message)
    this.name = 'DocumentValidationError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function getMaxUploadSizeBytes(): number {
  const maxMb = Number(process.env.MAX_FILE_SIZE_MB || '50')
  const effectiveMb = Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 50
  return Math.floor(effectiveMb * 1024 * 1024)
}

export function resolveDocumentType(fileName: string, mimeType?: string): DocumentType {
  const ext = fileName.includes('.')
    ? fileName.split('.').pop()?.trim().toLowerCase() || ''
    : ''
  if (ext && EXTENSION_TO_DOCUMENT_TYPE[ext]) {
    return EXTENSION_TO_DOCUMENT_TYPE[ext]
  }
  const normalizedMime = (mimeType || '').split(';')[0].trim().toLowerCase()
  if (normalizedMime && MIME_TO_DOCUMENT_TYPE[normalizedMime]) {
    return MIME_TO_DOCUMENT_TYPE[normalizedMime]
  }
  return DocType.OTHER
}

export function validateUploadedFile(
  fileName: string,
  mimeType: string | undefined,
  buffer: Buffer,
  maxSizeBytes = getMaxUploadSizeBytes()
): { documentType: DocumentType; extension: string; normalizedMimeType: string } {
  const trimmedName = (fileName || '').trim()
  if (!trimmedName) {
    throw new DocumentValidationError('File name is required', 400, 'MISSING_FILE_NAME')
  }

  if (!buffer || buffer.byteLength === 0) {
    throw new DocumentValidationError('File is empty (0 bytes)', 400, 'EMPTY_FILE')
  }

  if (buffer.byteLength > maxSizeBytes) {
    const maxMb = Math.round((maxSizeBytes / (1024 * 1024)) * 10) / 10
    throw new DocumentValidationError(
      `File size (${(buffer.byteLength / (1024 * 1024)).toFixed(2)}MB) exceeds the ${maxMb}MB limit`,
      413,
      'FILE_TOO_LARGE'
    )
  }

  const allowedEnv = process.env.ALLOWED_FILE_TYPES
    ? process.env.ALLOWED_FILE_TYPES.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [...SUPPORTED_FILE_EXTENSIONS]

  const ext = trimmedName.includes('.')
    ? trimmedName.split('.').pop()?.trim().toLowerCase() || ''
    : ''
  const normalizedMime = (mimeType || '').split(';')[0].trim().toLowerCase()

  const documentType = resolveDocumentType(trimmedName, normalizedMime)
  if (
    documentType === DocType.OTHER ||
    (ext && !allowedEnv.includes(ext) && !(ext === 'markdown' && allowedEnv.includes('md')))
  ) {
    throw new DocumentValidationError(
      `Unsupported file type "${ext || normalizedMime || 'unknown'}". Allowed formats: ${allowedEnv.join(', ').toUpperCase()}`,
      400,
      'UNSUPPORTED_FILE_TYPE'
    )
  }

  // Content magic-byte & format integrity checks
  const isZip =
    buffer.byteLength >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  const isOle2 =
    buffer.byteLength >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  const isPdf = buffer.byteLength >= 5 && buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')
  const isPng =
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  const isJpeg =
    buffer.byteLength >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff

  if (documentType === DocType.PDF && !isPdf) {
    throw new DocumentValidationError(
      'Invalid or corrupted PDF file (missing %PDF header)',
      422,
      'CORRUPTED_FILE'
    )
  }

  if (documentType === DocType.PNG && !isPng) {
    throw new DocumentValidationError(
      'Invalid PNG image file (signature mismatch)',
      422,
      'CORRUPTED_FILE'
    )
  }

  if ((documentType === DocType.JPG || documentType === DocType.JPEG) && !isJpeg) {
    throw new DocumentValidationError(
      'Invalid JPEG image file (signature mismatch)',
      422,
      'CORRUPTED_FILE'
    )
  }

  if (
    (documentType === DocType.DOCX ||
      documentType === DocType.XLSX ||
      documentType === DocType.PPTX) &&
    !isZip
  ) {
    // Allow plain XML/text fallback only if it isn't random binary executable data
    const sample = buffer.subarray(0, Math.min(buffer.byteLength, 512))
    const hasNullBytes = sample.includes(0x00) && !isOle2
    if (hasNullBytes) {
      throw new DocumentValidationError(
        `Invalid or corrupted ${documentType} archive`,
        422,
        'CORRUPTED_FILE'
      )
    }
  }

  const defaultMimeByType: Record<DocumentType, string> = {
    [DocType.PDF]: 'application/pdf',
    [DocType.DOC]: 'application/msword',
    [DocType.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    [DocType.TXT]: 'text/plain',
    [DocType.MARKDOWN]: 'text/markdown',
    [DocType.CSV]: 'text/csv',
    [DocType.XLS]: 'application/vnd.ms-excel',
    [DocType.XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    [DocType.PPT]: 'application/vnd.ms-powerpoint',
    [DocType.PPTX]: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    [DocType.PNG]: 'image/png',
    [DocType.JPG]: 'image/jpeg',
    [DocType.JPEG]: 'image/jpeg',
    [DocType.OTHER]: 'application/octet-stream',
  }

  return {
    documentType,
    extension: ext || documentType.toLowerCase(),
    normalizedMimeType:
      normalizedMime && normalizedMime !== 'application/octet-stream'
        ? normalizedMime
        : defaultMimeByType[documentType],
  }
}

// ============================================================================
// Shared Native ZIP Reader (Central Directory + Local File Header fallback)
// ============================================================================

export function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()

  // 1. Try reading from the Central Directory (handles bit-3 data descriptors accurately)
  let eocdOffset = -1
  const minEocdOffset = Math.max(0, buffer.length - 65557)
  for (let i = buffer.length - 22; i >= minEocdOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset >= 0 && eocdOffset + 20 <= buffer.length) {
    const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
    const cdSize = buffer.readUInt32LE(eocdOffset + 12)
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16)

    if (cdOffset + cdSize <= buffer.length) {
      let ptr = cdOffset
      for (let i = 0; i < totalEntries && ptr + 46 <= buffer.length; i++) {
        if (buffer.readUInt32LE(ptr) !== 0x02014b50) break
        const compressionMethod = buffer.readUInt16LE(ptr + 10)
        const compressedSize = buffer.readUInt32LE(ptr + 20)
        const fileNameLen = buffer.readUInt16LE(ptr + 28)
        const extraLen = buffer.readUInt16LE(ptr + 30)
        const commentLen = buffer.readUInt16LE(ptr + 32)
        const localHeaderOffset = buffer.readUInt32LE(ptr + 42)
        const fileName = buffer.subarray(ptr + 46, ptr + 46 + fileNameLen).toString('utf8')

        if (localHeaderOffset + 30 <= buffer.length && buffer.readUInt32LE(localHeaderOffset) === 0x04034b50) {
          const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26)
          const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28)
          const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
          const dataEnd = dataStart + compressedSize
          if (dataEnd <= buffer.length && !fileName.endsWith('/')) {
            try {
              const rawSlice = buffer.subarray(dataStart, dataEnd)
              const decompressed =
                compressionMethod === 8
                  ? inflateRawSync(rawSlice)
                  : compressionMethod === 0
                    ? Buffer.from(rawSlice)
                    : null
              if (decompressed) {
                entries.set(fileName, decompressed)
              }
            } catch {
              // Ignore individual entry decompression failure and try fallback below
            }
          }
        }

        ptr += 46 + fileNameLen + extraLen + commentLen
      }
    }
  }

  if (entries.size > 0) {
    return entries
  }

  // 2. Fallback: scan Local File Headers (0x04034b50) directly
  let offset = 0
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset++
      continue
    }
    const compressionMethod = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const fileNameLength = buffer.readUInt16LE(offset + 26)
    const extraFieldLength = buffer.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const fileName = buffer.subarray(nameStart, nameStart + fileNameLength).toString('utf8')
    const dataStart = nameStart + fileNameLength + extraFieldLength
    const dataEnd = dataStart + compressedSize

    if (compressedSize > 0 && dataEnd <= buffer.length && !fileName.endsWith('/')) {
      try {
        const rawSlice = buffer.subarray(dataStart, dataEnd)
        const decompressed =
          compressionMethod === 8
            ? inflateRawSync(rawSlice)
            : compressionMethod === 0
              ? Buffer.from(rawSlice)
              : null
        if (decompressed) {
          entries.set(fileName, decompressed)
        }
      } catch {
        // Ignore corrupted entry
      }
      offset = dataEnd
    } else {
      offset = dataStart > offset ? dataStart : offset + 1
    }
  }

  return entries
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

// ============================================================================
// 1. PDF Extraction (pdf-parse -> pdftotext CLI -> Native PDF Stream Parser)
// ============================================================================

function decodePdfLiteralString(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch !== '\\') {
      out += ch
      continue
    }
    i++
    if (i >= raw.length) break
    const next = raw[i]
    if (next === 'n') out += '\n'
    else if (next === 'r') out += '\r'
    else if (next === 't') out += '\t'
    else if (next === 'b') out += '\b'
    else if (next === 'f') out += '\f'
    else if (next === '(' || next === ')' || next === '\\') out += next
    else if (next >= '0' && next <= '7') {
      let oct = next
      if (i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i]
      if (i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i]
      out += String.fromCharCode(parseInt(oct, 8))
    } else {
      out += next
    }
  }
  return out
}

function decodePdfHexString(hexRaw: string): string {
  const clean = hexRaw.replace(/\s+/g, '')
  if (!clean) return ''
  const padded = clean.length % 2 === 1 ? clean + '0' : clean
  const bytes = Buffer.from(padded, 'hex')
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let str = ''
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      str += String.fromCharCode(bytes.readUInt16BE(i))
    }
    return str
  }
  return bytes.toString('latin1').replace(/\x00/g, '')
}

function extractTextFromPdfContentStream(contentStr: string): string {
  const chunks: string[] = []
  const btBlocks = [...contentStr.matchAll(/BT([\s\S]*?)ET/g)]
  const targetRegions = btBlocks.length > 0 ? btBlocks.map(m => m[1]) : [contentStr]

  for (const block of targetRegions) {
    const lines: string[] = []
    let currentLine = ''

    const tokenRegex =
      /\[((?:[^\]\\]|\\.|\\\([\s\S]*?\\\))*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|\b(T\*|TD|Td)\b/g
    let match: RegExpExecArray | null
    while ((match = tokenRegex.exec(block)) !== null) {
      if (match[1] !== undefined) {
        const arrayBody = match[1]
        const itemRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g
        let itemMatch: RegExpExecArray | null
        while ((itemMatch = itemRegex.exec(arrayBody)) !== null) {
          if (itemMatch[1] !== undefined) {
            currentLine += decodePdfLiteralString(itemMatch[1])
          } else if (itemMatch[2] !== undefined) {
            currentLine += decodePdfHexString(itemMatch[2])
          } else if (itemMatch[3] !== undefined) {
            const kern = parseFloat(itemMatch[3])
            if (kern < -120 && !currentLine.endsWith(' ')) {
              currentLine += ' '
            }
          }
        }
      } else if (match[2] !== undefined) {
        currentLine += decodePdfLiteralString(match[2])
      } else if (match[3] !== undefined) {
        currentLine += decodePdfHexString(match[3])
      } else if (match[4] !== undefined) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim())
          currentLine = ''
        }
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }
    if (lines.length > 0) {
      chunks.push(lines.join('\n'))
    }
  }

  return chunks.join('\n').trim()
}

function parsePdfStreamsNatively(buffer: Buffer): ExtractedContent | null {
  const raw = buffer.toString('latin1')
  const pages: PageContent[] = []

  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  let pageIdx = 1

  while ((match = streamRegex.exec(raw)) !== null) {
    const dict = match[1]
    if (/\/Subtype\s*\/Image|\/Type\s*\/XRef|\/Type\s*\/ObjStm|\/Subtype\s*\/Type1C/.test(dict)) {
      continue
    }
    const streamStart = match.index + match[0].indexOf('stream') + 6
    const afterStream = raw.slice(streamStart, streamStart + 2)
    const byteStart =
      afterStream === '\r\n' ? streamStart + 2 : afterStream.startsWith('\n') || afterStream.startsWith('\r') ? streamStart + 1 : streamStart
    const endPos = raw.indexOf('endstream', byteStart)
    if (endPos <= byteStart) continue

    let streamEnd = endPos
    if (raw[streamEnd - 1] === '\n') streamEnd--
    if (raw[streamEnd - 1] === '\r') streamEnd--

    const streamBytes = buffer.subarray(byteStart, streamEnd)
    let decodedStr = ''

    if (/\/FlateDecode/.test(dict)) {
      try {
        decodedStr = inflateSync(streamBytes).toString('latin1')
      } catch {
        try {
          decodedStr = inflateRawSync(streamBytes).toString('latin1')
        } catch {
          continue
        }
      }
    } else {
      decodedStr = streamBytes.toString('latin1')
    }

    const extracted = extractTextFromPdfContentStream(decodedStr)
    if (extracted) {
      pages.push({
        pageNumber: pageIdx++,
        text: extracted,
      })
    }
  }

  if (pages.length === 0) {
    const directText = extractTextFromPdfContentStream(raw)
    if (directText) {
      pages.push({ pageNumber: 1, text: directText })
    }
  }

  if (pages.length === 0) return null

  return {
    text: pages.map(p => p.text).join('\n\n'),
    pages,
    metadata: {
      pageCount: pages.length,
      extractor: 'native-pdf-parser',
    },
  }
}

export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedContent> {
  // 1. Try pdf-parse package if installed
  try {
    const pdfParseModule: any = await import('pdf-parse')
    if (typeof pdfParseModule.PDFParse === 'function') {
      const parser = new pdfParseModule.PDFParse({ data: new Uint8Array(buffer) })
      const result = await parser.getText()
      const pages: PageContent[] = (result.pages || [])
        .map((page: { text?: string }, index: number) => ({
          pageNumber: index + 1,
          text: page.text?.trim() || '',
        }))
        .filter((p: PageContent) => p.text.length > 0)

      if (result.text?.trim() || pages.length > 0) {
        return {
          text: result.text || pages.map(p => p.text).join('\n\n'),
          pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: result.text.trim() }],
          metadata: { pageCount: result.total || pages.length, extractor: 'pdf-parse' },
        }
      }
    } else if (typeof pdfParseModule.default === 'function') {
      const result = await pdfParseModule.default(buffer)
      if (result?.text?.trim()) {
        const rawPages = String(result.text)
          .split(/\f/)
          .map(t => t.trim())
          .filter(Boolean)
        const pages = rawPages.map((text, idx) => ({ pageNumber: idx + 1, text }))
        return {
          text: result.text.trim(),
          pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: result.text.trim() }],
          metadata: { pageCount: result.numpages || pages.length, extractor: 'pdf-parse' },
        }
      }
    }
  } catch {
    // Fall through to pdftotext / native parser
  }

  // 2. Try system pdftotext utility if available
  const tmpPdfPath = path.join(
    os.tmpdir(),
    `alex-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  )
  try {
    await writeFile(tmpPdfPath, buffer)
    const { stdout } = await execFileAsync('pdftotext', ['-layout', tmpPdfPath, '-'], {
      timeout: 15000,
      maxBuffer: 20 * 1024 * 1024,
    })
    const rawPages = stdout
      .split('\f')
      .map(p => p.trim())
      .filter(Boolean)
    if (rawPages.length > 0) {
      const pages: PageContent[] = rawPages.map((text, idx) => ({
        pageNumber: idx + 1,
        text,
      }))
      return {
        text: pages.map(p => p.text).join('\n\n'),
        pages,
        metadata: { pageCount: pages.length, extractor: 'pdftotext' },
      }
    }
  } catch {
    // Fall through to native parser
  } finally {
    await unlink(tmpPdfPath).catch(() => undefined)
  }

  // 3. Pure Node.js PDF content stream & FlateDecode parser
  const nativeResult = parsePdfStreamsNatively(buffer)
  if (nativeResult && nativeResult.text.trim()) {
    return nativeResult
  }

  throw new Error('Failed to extract readable text from PDF')
}

// ============================================================================
// 2. DOCX & DOC Extraction (mammoth -> Native OOXML ZIP Parser)
// ============================================================================

function parseDocxXmlToPages(xml: string): { text: string; pages: PageContent[]; tables: TableData[] } {
  const tables: TableData[] = []

  // Extract tables (<w:tbl>)
  const tblMatches = [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)]
  for (const tblMatch of tblMatches) {
    const tblXml = tblMatch[0]
    const rowMatches = [...tblXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
    const parsedRows: string[][] = []
    for (const rowMatch of rowMatches) {
      const cellMatches = [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)]
      const cells = cellMatches.map(cellMatch => {
        const cellTexts = [...cellMatch[0].matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m =>
          decodeXmlEntities(m[1])
        )
        return cellTexts.join('').trim()
      })
      if (cells.some(Boolean)) {
        parsedRows.push(cells)
      }
    }
    if (parsedRows.length > 0) {
      tables.push({
        headers: parsedRows[0],
        rows: parsedRows.slice(1),
        pageNumber: 1,
      })
    }
  }

  // Split by explicit page breaks if present
  const rawPageSegments = xml.split(/<w:br\s+w:type="page"\s*\/>|<w:lastRenderedPageBreak\s*\/>/)
  const pages: PageContent[] = []

  rawPageSegments.forEach((segment, idx) => {
    const paragraphs: string[] = []
    const pMatches = [...segment.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    if (pMatches.length > 0) {
      for (const pMatch of pMatches) {
        const pXml = pMatch[0]
          .replace(/<w:tab\s*\/>/g, '\t')
          .replace(/<w:br(?:\s+[^>]*)?\/>/g, '\n')
        const runs = [...pXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m =>
          decodeXmlEntities(m[1])
        )
        const line = runs.join('').trim()
        if (line) paragraphs.push(line)
      }
    } else {
      const runs = [...segment.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m =>
        decodeXmlEntities(m[1])
      )
      const line = runs.join(' ').trim()
      if (line) paragraphs.push(line)
    }

    const pageText = paragraphs.join('\n').trim()
    if (pageText) {
      pages.push({
        pageNumber: idx + 1,
        text: pageText,
        ...(idx === 0 && tables.length > 0 ? { tables } : {}),
      })
    }
  })

  const fullText = pages.map(p => p.text).join('\n\n')
  return {
    text: fullText,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText, tables }],
    tables,
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractedContent> {
  // 1. Try mammoth if installed
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    if (result?.value?.trim()) {
      const text = result.value.trim()
      return {
        text,
        pages: [{ pageNumber: 1, text }],
        metadata: { messages: result.messages, pageCount: 1, extractor: 'mammoth' },
      }
    }
  } catch {
    // Fall through to native OOXML ZIP parser
  }

  // 2. Native OOXML ZIP parser for word/document.xml, headers, footers, footnotes
  const zipEntries = readZipEntries(buffer)
  const docXmlBuf = zipEntries.get('word/document.xml')
  if (docXmlBuf) {
    const xmlParts: string[] = [docXmlBuf.toString('utf8')]
    for (const [entryName, entryBuf] of zipEntries.entries()) {
      if (/^word\/(header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(entryName)) {
        xmlParts.push(entryBuf.toString('utf8'))
      }
    }
    const parsed = parseDocxXmlToPages(xmlParts.join('\n'))
    if (parsed.text.trim()) {
      return {
        text: parsed.text,
        pages: parsed.pages,
        metadata: {
          pageCount: parsed.pages.length,
          tableCount: parsed.tables.length,
          extractor: 'native-ooxml-docx',
        },
      }
    }
  }

  // 3. Fallback if buffer is XML or plain text with .docx extension
  const rawUtf8 = buffer.toString('utf8')
  if (rawUtf8.includes('<w:t')) {
    const parsed = parseDocxXmlToPages(rawUtf8)
    if (parsed.text.trim()) {
      return {
        text: parsed.text,
        pages: parsed.pages,
        metadata: { pageCount: parsed.pages.length, extractor: 'xml-docx' },
      }
    }
  }

  throw new Error('Failed to extract text from DOCX')
}

export async function extractTextFromDoc(buffer: Buffer): Promise<ExtractedContent> {
  // If the .doc file is actually a ZIP-based DOCX
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return extractTextFromDocx(buffer)
  }

  const rawLatin1 = buffer.toString('latin1')

  // If RTF format ({\rtf1...)
  if (rawLatin1.startsWith('{\\rtf')) {
    const stripped = rawLatin1
      .replace(/\\par\b/g, '\n')
      .replace(/\\tab\b/g, '\t')
      .replace(/\\'[0-9a-fA-F]{2}/g, m => String.fromCharCode(parseInt(m.slice(2), 16)))
      .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
      .replace(/[{}]/g, '')
      .trim()
    if (stripped) {
      return {
        text: stripped,
        pages: [{ pageNumber: 1, text: stripped }],
        metadata: { pageCount: 1, format: 'rtf' },
      }
    }
  }

  // Extract printable ASCII and UTF-16LE runs from legacy OLE2 .doc binary or plain text
  const utf8Candidate = buffer.toString('utf8').replace(/\0/g, '').trim()
  const printableMatches = utf8Candidate.match(/[A-Za-z0-9\s.,;:'"?!()\-_/\\@#$%^&*+=[\]{}<>|~`]{8,}/g)
  const text = printableMatches ? printableMatches.join('\n').trim() : utf8Candidate

  if (!text) {
    throw new Error('Failed to extract text from DOC')
  }

  return {
    text,
    pages: [{ pageNumber: 1, text }],
    metadata: { pageCount: 1, extractor: 'native-doc' },
  }
}

// ============================================================================
// 3. Text & Markdown Extraction
// ============================================================================

export async function extractTextFromText(buffer: Buffer): Promise<ExtractedContent> {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '').trim()
  if (!text) {
    throw new Error('Text file contains no readable content')
  }
  return {
    text,
    pages: [{ pageNumber: 1, text }],
    metadata: { pageCount: 1, charCount: text.length },
  }
}

export async function extractTextFromMarkdown(buffer: Buffer): Promise<ExtractedContent> {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '').trim()
  if (!text) {
    throw new Error('Markdown file contains no readable content')
  }
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].trim())
  return {
    text,
    pages: [{ pageNumber: 1, text }],
    metadata: { pageCount: 1, headings, charCount: text.length },
  }
}

// ============================================================================
// 4. CSV Extraction (RFC-4180 Native Parser + Markdown Table & JSON Summary)
// ============================================================================

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  const cleaned = csvText.replace(/^\uFEFF/, '')
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]
    const next = cleaned[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        currentCell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell.trim())
      if (currentRow.some(c => c.length > 0)) rows.push(currentRow)
      currentRow = []
      currentCell = ''
      i++
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell.trim())
      if (currentRow.some(c => c.length > 0)) rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else {
      currentCell += ch
    }
  }

  currentRow.push(currentCell.trim())
  if (currentRow.some(c => c.length > 0)) {
    rows.push(currentRow)
  }

  return rows
}

function formatTableAsReadableText(sheetTitle: string, headers: string[], dataRows: string[][]): {
  text: string
  records: Record<string, string>[]
} {
  const records = dataRows.map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h || `Column_${idx + 1}`] = row[idx] ?? ''
    })
    return obj
  })

  const mdHeader = `| ${headers.join(' | ')} |`
  const mdSep = `| ${headers.map(() => '---').join(' | ')} |`
  const mdRows = dataRows.map(r => `| ${headers.map((_, i) => r[i] ?? '').join(' | ')} |`)

  const text = [
    `### ${sheetTitle}`,
    mdHeader,
    mdSep,
    ...mdRows,
    '',
    JSON.stringify(records, null, 2),
  ].join('\n')

  return { text, records }
}

export async function extractTextFromCSV(buffer: Buffer): Promise<ExtractedContent> {
  const rawText = buffer.toString('utf-8').trim()
  if (!rawText) {
    throw new Error('CSV file is empty')
  }

  const parsedRows = parseCsvRows(rawText)
  if (parsedRows.length === 0) {
    throw new Error('Failed to parse rows from CSV')
  }

  const headers = parsedRows[0].map((h, i) => h || `Column_${i + 1}`)
  const dataRows = parsedRows.slice(1)
  const { text, records } = formatTableAsReadableText('CSV Data Table', headers, dataRows)

  const tableData: TableData = {
    headers,
    rows: dataRows,
    pageNumber: 1,
  }

  return {
    text,
    pages: [
      {
        pageNumber: 1,
        text,
        tables: [tableData],
      },
    ],
    metadata: {
      pageCount: 1,
      rows: records.length,
      columns: headers,
      extractor: 'native-csv',
    },
  }
}

// ============================================================================
// 5. Excel (.xlsx / .xls) Extraction (xlsx package -> Native OOXML Workbook Parser)
// ============================================================================

function colLettersToIndex(colLetters: string): number {
  let idx = 0
  for (let i = 0; i < colLetters.length; i++) {
    idx = idx * 26 + (colLetters.charCodeAt(i) - 64)
  }
  return Math.max(0, idx - 1)
}

function parseOoxmlWorkbook(zipEntries: Map<string, Buffer>): ExtractedContent | null {
  // 1. Parse sharedStrings.xml if present
  const sharedStrings: string[] = []
  const sharedBuf = zipEntries.get('xl/sharedStrings.xml')
  if (sharedBuf) {
    const sharedXml = sharedBuf.toString('utf8')
    const siMatches = [...sharedXml.matchAll(/<si\b[\s\S]*?<\/si>/g)]
    for (const siMatch of siMatches) {
      const tMatches = [...siMatch[0].matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)].map(m =>
        decodeXmlEntities(m[1])
      )
      sharedStrings.push(tMatches.join(''))
    }
  }

  // 2. Parse sheet names from xl/workbook.xml
  const sheetNames: string[] = []
  const wbBuf = zipEntries.get('xl/workbook.xml')
  if (wbBuf) {
    const wbXml = wbBuf.toString('utf8')
    const sheetMatches = [...wbXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*\/?>/g)]
    for (const sm of sheetMatches) {
      sheetNames.push(decodeXmlEntities(sm[1]))
    }
  }

  // 3. Find all xl/worksheets/sheet*.xml entries
  const sheetFiles = [...zipEntries.keys()]
    .filter(k => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0', 10)
      const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10)
      return na - nb
    })

  if (sheetFiles.length === 0) return null

  const pages: PageContent[] = []
  const sheetsJson: Record<string, unknown[]> = {}

  sheetFiles.forEach((sheetPath, sheetIdx) => {
    const sheetTitle = sheetNames[sheetIdx] || `Sheet${sheetIdx + 1}`
    const sheetXml = zipEntries.get(sheetPath)!.toString('utf8')
    const rowMatches = [...sheetXml.matchAll(/<row\b[\s\S]*?<\/row>/g)]
    const matrix: string[][] = []

    for (const rowMatch of rowMatches) {
      const rowCells: string[] = []
      const cellMatches = [...rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)]
      let nextColIdx = 0

      for (const cellMatch of cellMatches) {
        const attrs = cellMatch[1]
        const cellInner = cellMatch[2]
        const refMatch = attrs.match(/\br="([A-Z]+)\d+"/i)
        const colIdx = refMatch ? colLettersToIndex(refMatch[1].toUpperCase()) : nextColIdx
        const typeMatch = attrs.match(/\bt="([^"]+)"/)
        const cellType = typeMatch ? typeMatch[1] : 'n'

        let value = ''
        if (cellType === 'inlineStr') {
          const tMatches = [...cellInner.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)].map(m =>
            decodeXmlEntities(m[1])
          )
          value = tMatches.join('')
        } else {
          const vMatch = cellInner.match(/<v[^>]*>([\s\S]*?)<\/v>/)
          const rawVal = vMatch ? decodeXmlEntities(vMatch[1].trim()) : ''
          if (cellType === 's') {
            const sIdx = parseInt(rawVal, 10)
            value = Number.isFinite(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawVal
          } else if (cellType === 'b') {
            value = rawVal === '1' ? 'TRUE' : 'FALSE'
          } else {
            value = rawVal
          }
        }

        while (rowCells.length < colIdx) rowCells.push('')
        rowCells[colIdx] = value.trim()
        nextColIdx = colIdx + 1
      }

      if (rowCells.some(c => c.length > 0)) {
        matrix.push(rowCells)
      }
    }

    if (matrix.length > 0) {
      const headers = matrix[0].map((h, i) => h || `Column_${i + 1}`)
      const dataRows = matrix.slice(1)
      const { text, records } = formatTableAsReadableText(sheetTitle, headers, dataRows)
      sheetsJson[sheetTitle] = records
      pages.push({
        pageNumber: sheetIdx + 1,
        text,
        tables: [{ headers, rows: dataRows, pageNumber: sheetIdx + 1 }],
      })
    }
  })

  if (pages.length === 0) return null

  return {
    text: pages.map(p => p.text).join('\n\n'),
    pages,
    metadata: {
      pageCount: pages.length,
      sheets: Object.keys(sheetsJson),
      extractor: 'native-ooxml-xlsx',
    },
  }
}

export async function extractTextFromExcel(buffer: Buffer): Promise<ExtractedContent> {
  // 1. Try xlsx package if installed
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets: Record<string, unknown[]> = {}
    const pages: PageContent[] = []

    workbook.SheetNames.forEach((sheetName, idx) => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonRows = XLSX.utils.sheet_to_json(worksheet)
      sheets[sheetName] = jsonRows
      const sheetText = `### ${sheetName}\n${JSON.stringify(jsonRows, null, 2)}`
      pages.push({ pageNumber: idx + 1, text: sheetText })
    })

    if (pages.length > 0) {
      return {
        text: pages.map(p => p.text).join('\n\n'),
        pages,
        metadata: { pageCount: pages.length, sheets: workbook.SheetNames, extractor: 'xlsx' },
      }
    }
  } catch {
    // Fall through to native OOXML parser
  }

  // 2. Native OOXML ZIP parser for .xlsx
  const zipEntries = readZipEntries(buffer)
  if (zipEntries.size > 0) {
    const parsed = parseOoxmlWorkbook(zipEntries)
    if (parsed) return parsed
  }

  // 3. Fallback for CSV/TSV/XML-Spreadsheet .xls files
  const rawUtf8 = buffer.toString('utf8').trim()
  if (rawUtf8.includes(',') || rawUtf8.includes('\t')) {
    const normalizedCsv = rawUtf8.includes('\t') && !rawUtf8.includes(',')
      ? rawUtf8.replace(/\t/g, ',')
      : rawUtf8
    return extractTextFromCSV(Buffer.from(normalizedCsv, 'utf8'))
  }

  throw new Error('Failed to extract text from Excel workbook')
}

// ============================================================================
// 6. PowerPoint (.pptx / .ppt) Extraction
// ============================================================================

export async function extractTextFromPPTX(buffer: Buffer): Promise<ExtractedContent> {
  try {
    const slides: { slideIndex: number; text: string }[] = []
    const zipEntries = readZipEntries(buffer)

    for (const [entryName, entryBuf] of zipEntries.entries()) {
      const slideMatch = entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/i)
      if (!slideMatch) continue
      const slideIndex = parseInt(slideMatch[1], 10)
      const xml = entryBuf.toString('utf8')

      // Extract paragraph by paragraph (<a:p>) for cleaner formatting
      const paragraphs: string[] = []
      const pMatches = [...xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
      if (pMatches.length > 0) {
        for (const pMatch of pMatches) {
          const runs = [...pMatch[0].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
            .map(m => decodeXmlEntities(m[1].trim()))
            .filter(Boolean)
          if (runs.length > 0) {
            paragraphs.push(runs.join(' '))
          }
        }
      } else {
        const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
          .map(m => decodeXmlEntities(m[1].trim()))
          .filter(Boolean)
        if (texts.length > 0) {
          paragraphs.push(texts.join(' '))
        }
      }

      // Check for matching speaker notes (ppt/notesSlides/notesSlideN.xml)
      const notesBuf = zipEntries.get(`ppt/notesSlides/notesSlide${slideIndex}.xml`)
      if (notesBuf) {
        const notesXml = notesBuf.toString('utf8')
        const noteRuns = [...notesXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
          .map(m => decodeXmlEntities(m[1].trim()))
          .filter(Boolean)
        if (noteRuns.length > 0) {
          paragraphs.push(`Speaker Notes: ${noteRuns.join(' ')}`)
        }
      }

      if (paragraphs.length > 0) {
        slides.push({
          slideIndex,
          text: `Slide ${slideIndex}:\n${paragraphs.join('\n')}`,
        })
      }
    }

    if (slides.length > 0) {
      slides.sort((a, b) => a.slideIndex - b.slideIndex)
      const pages: PageContent[] = slides.map(s => ({
        pageNumber: s.slideIndex,
        text: s.text,
      }))
      return {
        text: pages.map(p => p.text).join('\n\n'),
        pages,
        metadata: { pageCount: pages.length, extractor: 'native-ooxml-pptx' },
      }
    }

    // Fallback for plain text or uncompressed XML buffers
    const fallbackText = buffer.toString('utf8').replace(/\0/g, '').trim()
    if (!fallbackText) {
      throw new Error('Presentation contains no extractable text')
    }
    return {
      text: fallbackText,
      pages: [{ pageNumber: 1, text: fallbackText }],
      metadata: { pageCount: 1 },
    }
  } catch (error) {
    console.error('PPTX extraction error:', error)
    throw new Error('Failed to extract text from PPTX')
  }
}

// ============================================================================
// 7. Image (PNG / JPG / JPEG) Extraction (Tesseract CLI -> tesseract.js -> Metadata)
// ============================================================================

function extractImageMetadataAndEmbeddedText(buffer: Buffer, mimeType: string): {
  width?: number
  height?: number
  embeddedTexts: string[]
  format: string
} {
  const embeddedTexts: string[] = []
  let width: number | undefined
  let height: number | undefined
  let format = mimeType.includes('png') ? 'PNG' : 'JPEG'

  // PNG parsing (\x89PNG\r\n\x1a\n)
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    format = 'PNG'
    width = buffer.readUInt32BE(16)
    height = buffer.readUInt32BE(20)
    let offset = 8
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset)
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
      const dataStart = offset + 8
      const dataEnd = dataStart + length
      if (dataEnd > buffer.length) break

      if (type === 'tEXt' || type === 'iTXt') {
        const textChunk = buffer
          .subarray(dataStart, dataEnd)
          .toString('utf8')
          .replace(/\0+/g, ': ')
          .trim()
        if (textChunk) embeddedTexts.push(textChunk)
      } else if (type === 'zTXt') {
        const rawChunk = buffer.subarray(dataStart, dataEnd)
        const nullIdx = rawChunk.indexOf(0)
        if (nullIdx >= 0 && nullIdx + 2 < rawChunk.length) {
          try {
            const keyword = rawChunk.subarray(0, nullIdx).toString('utf8')
            const inflated = inflateSync(rawChunk.subarray(nullIdx + 2)).toString('utf8')
            embeddedTexts.push(`${keyword}: ${inflated}`)
          } catch {
            // Ignore malformed zTXt
          }
        }
      }
      offset = dataEnd + 4
      if (type === 'IEND') break
    }
  } else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    format = 'JPEG'
    let offset = 2
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = buffer[offset + 1]
      if (marker === 0xd9 || marker === 0xda) break
      const segLength = buffer.readUInt16BE(offset + 2)
      if (segLength < 2 || offset + 2 + segLength > buffer.length) break

      // SOF0 / SOF2 frame header for dimensions
      if (marker === 0xc0 || marker === 0xc2) {
        if (offset + 9 <= buffer.length) {
          height = buffer.readUInt16BE(offset + 5)
          width = buffer.readUInt16BE(offset + 7)
        }
      } else if (marker === 0xfe) {
        // JPEG Comment marker
        const comment = buffer.subarray(offset + 4, offset + 2 + segLength).toString('utf8').trim()
        if (comment) embeddedTexts.push(comment)
      }
      offset += 2 + segLength
    }
  }

  return { width, height, embeddedTexts, format }
}

export async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<ExtractedContent> {
  const imgMeta = extractImageMetadataAndEmbeddedText(buffer, mimeType)
  const parts: string[] = [...imgMeta.embeddedTexts]

  // 1. Try system /usr/bin/tesseract CLI
  const ext = imgMeta.format === 'PNG' ? 'png' : 'jpg'
  const tmpImgPath = path.join(
    os.tmpdir(),
    `alex-img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  )
  try {
    await writeFile(tmpImgPath, buffer)
    const { stdout } = await execFileAsync('tesseract', [tmpImgPath, 'stdout', '-l', 'eng', '--psm', '3'], {
      timeout: 15000,
    })
    if (stdout && stdout.trim()) {
      parts.push(stdout.trim())
    }
  } catch {
    // 2. Fallback: try tesseract.js npm module if installed
    try {
      const Tesseract = (await import('tesseract.js')).default
      const {
        data: { text },
      } = await Tesseract.recognize(buffer, 'eng')
      if (text && text.trim()) {
        parts.push(text.trim())
      }
    } catch {
      // Neither tesseract CLI nor tesseract.js succeeded
    }
  } finally {
    await unlink(tmpImgPath).catch(() => undefined)
  }

  const combinedText =
    parts.filter(Boolean).join('\n\n').trim() ||
    `[${imgMeta.format} Image Document${imgMeta.width && imgMeta.height ? ` (${imgMeta.width}x${imgMeta.height}px)` : ''}, size: ${buffer.byteLength} bytes]`

  return {
    text: combinedText,
    pages: [{ pageNumber: 1, text: combinedText }],
    metadata: {
      pageCount: 1,
      mimeType,
      format: imgMeta.format,
      width: imgMeta.width,
      height: imgMeta.height,
    },
  }
}

export async function extractContent(
  buffer: Buffer,
  documentType: DocumentType,
  mimeType: string
): Promise<ExtractedContent> {
  switch (documentType) {
    case DocType.PDF:
      return extractTextFromPDF(buffer)
    case DocType.DOC:
      return extractTextFromDoc(buffer)
    case DocType.DOCX:
      return extractTextFromDocx(buffer)
    case DocType.TXT:
      return extractTextFromText(buffer)
    case DocType.MARKDOWN:
      return extractTextFromMarkdown(buffer)
    case DocType.CSV:
      return extractTextFromCSV(buffer)
    case DocType.XLS:
    case DocType.XLSX:
      return extractTextFromExcel(buffer)
    case DocType.PPT:
    case DocType.PPTX:
      return extractTextFromPPTX(buffer)
    case DocType.PNG:
    case DocType.JPG:
    case DocType.JPEG:
      return extractTextFromImage(buffer, mimeType)
    default:
      return extractTextFromText(buffer)
  }
}