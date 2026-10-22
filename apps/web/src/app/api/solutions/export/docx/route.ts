import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx'

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

const docxBuffer = await generateSolutionDOCX(solution)
    
    const uint8Array = new Uint8Array(docxBuffer)
     
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="solution-${solution.questionNumber}-${Date.now()}.docx"`,
        'Content-Length': docxBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Solution DOCX export error:', error)
    return NextResponse.json({ error: 'DOCX export failed' }, { status: 500 })
  }
}

async function generateSolutionDOCX(solution: SolutionData): Promise<Buffer> {
  const children: any[] = []

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Solution ${solution.questionNumber}`, bold: true, size: 44 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  )

  children.push(
    new Paragraph({
      children: [new TextRun({ text: `${solution.answerMode.charAt(0).toUpperCase() + solution.answerMode.slice(1)} Mode`, size: 24, color: '2563EB' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  // Question
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Question', bold: true, size: 32 })],
      spacing: { before: 200, after: 100 },
    })
  )

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Topic: ', bold: true, size: 22 }),
        new TextRun({ text: solution.topic, size: 22 }),
      ],
      spacing: { after: 100 },
    })
  )

  children.push(
    new Paragraph({
      children: [new TextRun({ text: solution.originalQuestion, size: 22 })],
      spacing: { after: 200 },
    })
  )

  // Explanation
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Explanation', bold: true, size: 32 })],
      spacing: { before: 200, after: 100 },
    })
  )

  children.push(
    new Paragraph({
      children: [new TextRun({ text: solution.explanation, size: 22 })],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200 },
    })
  )

  // Definitions
  if (solution.definitions.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Definitions', bold: true, size: 32 })],
        spacing: { before: 200, after: 100 },
      })
    )

    solution.definitions.forEach((def, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${def}`, size: 22 })],
          indent: { left: 720 },
          spacing: { after: 80 },
        })
      )
    })
  }

  // Formulas
  if (solution.formulas.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Formulas', bold: true, size: 32 })],
        spacing: { before: 200, after: 100 },
      })
    )

    solution.formulas.forEach((formula) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: formula, size: 22, font: 'Times New Roman', italics: true })],
          indent: { left: 720 },
          spacing: { after: 80 },
        })
      )
    })
  }

  // Calculations
  if (solution.calculations) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Calculations', bold: true, size: 32 })],
        spacing: { before: 200, after: 100 },
      })
    )

    children.push(
      new Paragraph({
        children: [new TextRun({ text: solution.calculations, size: 20, font: 'Courier New', color: '333333' })],
        indent: { left: 720 },
        spacing: { after: 200 },
      })
    )
  }

  // Tables
  if (solution.tables.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Tables', bold: true, size: 32 })],
        spacing: { before: 200, after: 100 },
      })
    )

    solution.tables.forEach((table, tableIndex) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Table ${tableIndex + 1}`, bold: true, size: 24 })],
          spacing: { after: 100 },
        })
      )

      children.push(...renderDOCXTable(table.headers, table.rows))
    })
  }

  // Diagrams
  if (solution.diagrams.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Diagrams', bold: true, size: 32 })],
        spacing: { before: 200, after: 100 },
      })
    )

    solution.diagrams.forEach((diagram) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${diagram.title} (${diagram.type})`, bold: true, size: 24 })],
          spacing: { after: 80 },
        })
      )

      children.push(
        new Paragraph({
          children: [new TextRun({ text: diagram.definition, size: 18, font: 'Courier New', color: '666666' })],
          indent: { left: 720 },
          spacing: { after: 160 },
        })
      )
    })
  }

  // Final Answer
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Final Answer', bold: true, size: 32, color: '16A34A' })],
      spacing: { before: 300, after: 100 },
    })
  )

  children.push(
    new Paragraph({
      children: [new TextRun({ text: solution.finalAnswer, size: 24, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  )

  // Citations
  if (solution.citations.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Sources & Citations', bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
      })
    )

    solution.citations.forEach((citation, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${i + 1}] `, bold: true, size: 20 }),
            new TextRun({ text: citation.documentTitle, size: 20 }),
          ],
          spacing: { after: 80 },
        })
      )

      if (citation.pageNumber) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `    Page ${citation.pageNumber}`, size: 18, italics: true, color: '666666' })],
            indent: { left: 720 },
            spacing: { after: 50 },
          })
        )
      }

      if (citation.excerpt) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `    "${citation.excerpt.slice(0, 300)}${citation.excerpt.length > 300 ? '...' : ''}"`, size: 18, italics: true, color: '333333' })],
            indent: { left: 720 },
            spacing: { after: 100 },
          })
        )
      }
    })
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Generated by ALEX - AI Academic Assistant | Document-to-Solution Engine',
          size: 16,
          color: '999999',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    })
  )

  const wordDoc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  })

  return Buffer.from(await Packer.toBuffer(wordDoc))
}

function renderDOCXTable(headers: string[], rows: string[][]): any[] {
  if (headers.length === 0 || rows.length === 0) return []

  const tableRows: TableRow[] = []

  // Header row
  tableRows.push(
    new TableRow({
      children: headers.map(header => 
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 20 })] })],
          shading: { fill: 'F3F4F6' },
          borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
        })
      ),
    })
  )

  // Data rows
  rows.forEach((row, rowIndex) => {
    tableRows.push(
      new TableRow({
        children: row.map(cell => 
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18 })] })],
            shading: { fill: rowIndex % 2 === 0 ? 'F9FAFB' : 'FFFFFF' },
            borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
          })
        ),
      })
    )
  })

  return [
    new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ]
}
