import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import PDFDocument from 'pdfkit'

interface SolutionData {
  questionNumber: string
  originalQuestion: string
  topic: string
  explanation: string
  definitions: string[]
  formulas: string[]
  calculations: string
  tables: Array<{ headers: string[]; rows: string[][] }>
  diagrams: Array<{ type: string; definition: string; title: string }>
  finalAnswer: string
  citations: Array<{ id: string; documentTitle: string; pageNumber: number | null; excerpt: string }>
  answerMode: string
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { solution } = body as { solution: SolutionData }

    if (!solution) {
      return NextResponse.json({ error: 'Solution data required' }, { status: 400 })
    }

const pdfBuffer = await generateSolutionPDF(solution)
    
    const uint8Array = new Uint8Array(pdfBuffer)
     
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="solution-${solution.questionNumber}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Solution PDF export error:', error)
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 })
  }
}

async function generateSolutionPDF(solution: SolutionData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `Solution ${solution.questionNumber} - ${solution.topic}`,
        Author: 'ALEX Academic System',
        Creator: 'ALEX Document-to-Solution Engine',
      },
    })

    const chunks: Buffer[] = []
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)

    // Title
    pdfDoc.fontSize(22).font('Helvetica-Bold').text(`Solution ${solution.questionNumber}`, { align: 'center' })
    pdfDoc.moveDown(0.3)
    pdfDoc.fontSize(12).font('Helvetica').fillColor('#2563eb').text(solution.answerMode.charAt(0).toUpperCase() + solution.answerMode.slice(1) + ' Mode', { align: 'center' })
    pdfDoc.fillColor('black').moveDown(0.8)

    // Question
    pdfDoc.fontSize(14).font('Helvetica-Bold').text('Question')
    pdfDoc.moveDown(0.3)
    pdfDoc.fontSize(11).font('Helvetica-Bold').text(`Topic: `, { continued: true })
    pdfDoc.font('Helvetica').text(solution.topic)
    pdfDoc.moveDown(0.3)
    
    // Question box
    const questionY = pdfDoc.y
    pdfDoc.rect(50, questionY, pdfDoc.page.width - 100, 60).fill('#f0f9ff').stroke('#bae6fd')
    pdfDoc.fillColor('black').fontSize(11).font('Helvetica').text(solution.originalQuestion, 55, questionY + 10, { width: pdfDoc.page.width - 110 })
    pdfDoc.y = questionY + 70
    pdfDoc.moveDown(0.8)

    // Explanation
    pdfDoc.fontSize(14).font('Helvetica-Bold').text('Explanation')
    pdfDoc.moveDown(0.3)
    pdfDoc.fontSize(11).font('Helvetica').text(solution.explanation, { align: 'justify' })
    pdfDoc.moveDown(0.8)

    // Definitions
    if (solution.definitions.length > 0) {
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Definitions')
      pdfDoc.moveDown(0.3)
      solution.definitions.forEach((def, i) => {
        pdfDoc.fontSize(11).font('Helvetica').text(`${i + 1}. ${def}`, { indent: 20 })
      })
      pdfDoc.moveDown(0.8)
    }

    // Formulas
    if (solution.formulas.length > 0) {
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Formulas')
      pdfDoc.moveDown(0.3)
      solution.formulas.forEach((formula, i) => {
        pdfDoc.fontSize(11).font('Times-Roman').fillColor('#1a1a1a')
        pdfDoc.text(formula, { indent: 20 })
      })
      pdfDoc.font('Helvetica').fillColor('black').moveDown(0.8)
    }

    // Calculations
    if (solution.calculations) {
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Calculations')
      pdfDoc.moveDown(0.3)
      pdfDoc.fontSize(10).font('Courier').fillColor('#333')
      pdfDoc.text(solution.calculations, { indent: 20, lineGap: 2 })
      pdfDoc.font('Helvetica').fillColor('black').moveDown(0.8)
    }

    // Tables
    if (solution.tables.length > 0) {
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Tables')
      pdfDoc.moveDown(0.3)
      solution.tables.forEach((table, tableIndex) => {
        pdfDoc.fontSize(12).font('Helvetica-Bold').text(`Table ${tableIndex + 1}`)
        pdfDoc.moveDown(0.2)
        renderPDFTable(pdfDoc, table.headers, table.rows)
        pdfDoc.moveDown(0.6)
      })
    }

    // Diagrams
    if (solution.diagrams.length > 0) {
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Diagrams')
      pdfDoc.moveDown(0.3)
      solution.diagrams.forEach((diagram, i) => {
        pdfDoc.fontSize(12).font('Helvetica-Bold').text(`${diagram.title} (${diagram.type})`)
        pdfDoc.moveDown(0.2)
        pdfDoc.fontSize(9).font('Courier').fillColor('#666')
        pdfDoc.text(diagram.definition, { indent: 20 })
        pdfDoc.font('Helvetica').fillColor('black').moveDown(0.5)
      })
    }

    // Final Answer
    pdfDoc.moveDown(0.5)
    pdfDoc.rect(50, pdfDoc.y, pdfDoc.page.width - 100, 80).fill('#f0fdf4').stroke('#86efac')
    pdfDoc.fillColor('black').fontSize(14).font('Helvetica-Bold').text('Final Answer', 55, pdfDoc.y - 70)
    pdfDoc.fontSize(12).font('Helvetica').text(solution.finalAnswer, 55, pdfDoc.y - 45, { width: pdfDoc.page.width - 110 })
    pdfDoc.y = pdfDoc.y + 20
    pdfDoc.moveDown(1)

    // Citations
    if (solution.citations.length > 0) {
      pdfDoc.addPage()
      pdfDoc.fontSize(18).font('Helvetica-Bold').text('Sources & Citations', { align: 'center' })
      pdfDoc.moveDown(1)
      
      solution.citations.forEach((citation, i) => {
        pdfDoc.fontSize(10).font('Helvetica-Bold').text(`[${i + 1}] ${citation.documentTitle}`)
        if (citation.pageNumber) {
          pdfDoc.fontSize(9).font('Helvetica').fillColor('#666').text(`Page ${citation.pageNumber}`, { indent: 20 })
        }
        if (citation.excerpt) {
          pdfDoc.fontSize(9).font('Helvetica-Oblique').fillColor('#333')
          pdfDoc.text(citation.excerpt, { indent: 20 })
        }
        pdfDoc.font('Helvetica').fillColor('black').moveDown(0.5)
      })
    }

    // Footer
    pdfDoc.fontSize(8).font('Helvetica').fillColor('gray')
    pdfDoc.text(
      'Generated by ALEX - AI Academic Assistant | Document-to-Solution Engine',
      50,
      pdfDoc.page.height - 40,
      { align: 'center', width: pdfDoc.page.width - 100 }
    )

    pdfDoc.end()
  })
}

function renderPDFTable(pdfDoc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
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
