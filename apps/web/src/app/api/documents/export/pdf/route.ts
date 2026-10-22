import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

interface DocumentData {
  title: string
  content: string
  format: string
  sections: any[]
  metadata: any
  citations?: any[]
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { document } = body as { document: DocumentData }

    if (!document) {
      return NextResponse.json({ error: 'Document data required' }, { status: 400 })
    }

const pdfBuffer = await generateDocumentPDF(document)
    
    const uint8Array = new Uint8Array(pdfBuffer)
     
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 })
  }
}

async function generateDocumentPDF(doc: DocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: doc.title,
        Author: 'ALEX Academic System',
        Creator: 'ALEX Document Studio',
      },
    })

    const chunks: Buffer[] = []
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)

    // Title
    pdfDoc.fontSize(24).font('Helvetica-Bold').text(doc.title, { align: 'center' })
    pdfDoc.moveDown(1.5)

    // Process sections
    doc.sections.forEach(section => {
      renderPDFSection(pdfDoc, section)
    })

    // Citations
    if (doc.citations?.length) {
      pdfDoc.addPage()
      pdfDoc.fontSize(18).font('Helvetica-Bold').text('References', { align: 'center' })
      pdfDoc.moveDown(1)
      
      doc.citations.forEach((citation, i) => {
        pdfDoc.fontSize(10).font('Helvetica')
        pdfDoc.text(`[${i + 1}] ${citation.documentTitle || citation.title || 'Source'}`, { continued: false })
        if (citation.pageNumber) {
          pdfDoc.text(`    Page ${citation.pageNumber}`, { indent: 20 })
        }
        if (citation.excerpt) {
          pdfDoc.font('Helvetica-Oblique').fontSize(9)
          pdfDoc.text(`    "${citation.excerpt.slice(0, 300)}${citation.excerpt.length > 300 ? '...' : ''}"`, { indent: 20 })
        }
        pdfDoc.moveDown(0.5)
      })
    }

    // Metadata footer on last page
    pdfDoc.fontSize(8).font('Helvetica').fillColor('gray')
    pdfDoc.text(
      `Words: ${doc.metadata?.wordCount || 'N/A'} | Reading time: ~${doc.metadata?.readingTime || 'N/A'} min | Generated: ${new Date(doc.metadata?.createdAt || Date.now()).toLocaleString()}`,
      50,
      pdfDoc.page.height - 40,
      { align: 'center', width: pdfDoc.page.width - 100 }
    )

    pdfDoc.end()
  })
}

function renderPDFSection(pdfDoc: PDFKit.PDFDocument, section: any) {
  switch (section.type) {
    case 'heading': {
      const level = section.level || 1
      const sizes = [20, 18, 16, 14, 12, 11]
      const size = sizes[Math.min(level - 1, sizes.length - 1)]
      pdfDoc.fontSize(size).font('Helvetica-Bold').text(section.content)
      pdfDoc.moveDown(0.8)
      break
    }
    case 'paragraph':
      pdfDoc.fontSize(11).font('Helvetica').text(section.content, { align: 'justify' })
      pdfDoc.moveDown(0.6)
      break
    case 'list':
      if (Array.isArray(section.content)) {
        section.content.forEach((item: string) => {
          pdfDoc.fontSize(11).font('Helvetica').text(`• ${item}`, { indent: 20 })
        })
        pdfDoc.moveDown(0.4)
      }
      break
    case 'table':
      renderPDFTable(pdfDoc, section.content)
      break
    case 'code':
      pdfDoc.fontSize(9).font('Courier').fillColor('#333')
      const codeText = section.content.code || section.content
      pdfDoc.text(codeText, { indent: 20, lineGap: 2 })
      pdfDoc.fillColor('black').moveDown(0.8)
      break
    case 'diagram':
      pdfDoc.fontSize(11).font('Helvetica-Bold').text(section.content.title || 'Diagram')
      pdfDoc.moveDown(0.3)
      pdfDoc.fontSize(9).font('Courier').fillColor('#666')
      pdfDoc.text('[Diagram: ' + (section.content.type || 'mermaid') + ']', { indent: 20 })
      pdfDoc.text(section.content.code?.slice(0, 500) || section.content.code || '', { indent: 20 })
      pdfDoc.fillColor('black').moveDown(0.8)
      break
    case 'quote':
      pdfDoc.fontSize(11).font('Helvetica-Oblique').fillColor('#555')
      pdfDoc.text(`"${section.content}"`, { indent: 30, width: pdfDoc.page.width - 110 })
      pdfDoc.fillColor('black').moveDown(0.6)
      break
    default:
      pdfDoc.fontSize(11).font('Helvetica').text(String(section.content))
      pdfDoc.moveDown(0.6)
  }
}

function renderPDFTable(pdfDoc: PDFKit.PDFDocument, tableContent: string) {
  // Parse markdown table
  const lines = tableContent.trim().split('\n')
  if (lines.length < 2) return

  const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean)
  const separator = lines[1]
  const rows = lines.slice(2).map(line => 
    line.split('|').map(c => c.trim()).filter(Boolean)
  )

  if (headers.length === 0 || rows.length === 0) return

  const colWidth = (pdfDoc.page.width - 100) / headers.length
  const startX = 50
  let y = pdfDoc.y

  // Header row
  pdfDoc.font('Helvetica-Bold').fontSize(9)
  headers.forEach((header, i) => {
    pdfDoc.rect(startX + i * colWidth, y, colWidth, 20).fill('#f3f4f6').stroke()
    pdfDoc.fillColor('black').text(header, startX + i * colWidth + 5, y + 5, { width: colWidth - 10 })
  })
  y += 20

  // Data rows
  pdfDoc.font('Helvetica').fontSize(9)
  rows.forEach((row, rowIndex) => {
    if (y > pdfDoc.page.height - 80) {
      pdfDoc.addPage()
      y = 50
    }
    row.forEach((cell, i) => {
      const fillColor = rowIndex % 2 === 0 ? '#f9fafb' : '#ffffff'
      pdfDoc.rect(startX + i * colWidth, y, colWidth, 20).fill(fillColor).stroke()
      pdfDoc.fillColor('black').text(cell, startX + i * colWidth + 5, y + 5, { width: colWidth - 10 })
    })
    y += 20
  })

  pdfDoc.y = y + 10
  pdfDoc.fillColor('black')
}
