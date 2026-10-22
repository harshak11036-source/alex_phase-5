import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx'

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

const docxBuffer = await generateDocumentDOCX(document)
    
    const uint8Array = new Uint8Array(docxBuffer)
     
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${document.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.docx"`,
        'Content-Length': docxBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('DOCX export error:', error)
    return NextResponse.json({ error: 'DOCX export failed' }, { status: 500 })
  }
}

async function generateDocumentDOCX(doc: DocumentData): Promise<Buffer> {
  const children: any[] = []

  children.push(
    new Paragraph({
      children: [new TextRun({ text: doc.title, bold: true, size: 48 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  doc.sections.forEach(section => {
    children.push(...renderDOCXSection(section))
  })

  if (doc.citations?.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'References', bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
      })
    )
    
    for (let i = 0; i < doc.citations.length; i++) {
      const citation = doc.citations[i]
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${i + 1}] `, bold: true, size: 20 }),
            new TextRun({ text: citation.documentTitle || citation.title || 'Source', size: 20 }),
          ],
          spacing: { after: 100 },
        })
      )
      if (citation.pageNumber) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `    Page ${citation.pageNumber}`, size: 18, italics: true })],
            indent: { left: 720 },
            spacing: { after: 50 },
          })
        )
      }
      if (citation.excerpt) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `    "${citation.excerpt.slice(0, 300)}${citation.excerpt.length > 300 ? '...' : ''}"`, size: 18, italics: true })],
            indent: { left: 720 },
            spacing: { after: 100 },
          })
        )
      }
    }
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Words: ${doc.metadata?.wordCount || 'N/A'} | Reading time: ~${doc.metadata?.readingTime || 'N/A'} min | Generated: ${new Date(doc.metadata?.createdAt || Date.now()).toLocaleString()}`,
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

function renderDOCXSection(section: any): any[] {
  const children: any[] = []

  switch (section.type) {
    case 'heading': {
      const level = section.level || 1
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ]
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.content, bold: true, size: 32 - level * 4 })],
          heading: headingLevels[Math.min(level - 1, headingLevels.length - 1)],
          spacing: { before: 240, after: 120 },
        })
      )
      break
    }
    case 'paragraph':
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.content, size: 22 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120 },
        })
      )
      break
    case 'list':
      if (Array.isArray(section.content)) {
        section.content.forEach((item: string) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${item}`, size: 22 })],
              indent: { left: 720 },
              spacing: { after: 80 },
            })
          )
        })
      }
      break
    case 'table':
      children.push(...renderDOCXTable(section.content))
      break
    case 'code':
      const codeText = section.content.code || section.content
      children.push(
        new Paragraph({
          children: [new TextRun({ text: codeText, size: 18, font: 'Courier New', color: '333333' })],
          indent: { left: 720 },
          spacing: { after: 160 },
        })
      )
      break
    case 'diagram':
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.content.title || 'Diagram', bold: true, size: 22 })],
          spacing: { after: 100 },
        })
      )
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `[Diagram: ${section.content.type || 'mermaid'}]`, size: 18, font: 'Courier New', color: '666666' })],
          indent: { left: 720 },
          spacing: { after: 50 },
        })
      )
      if (section.content.code) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: section.content.code.slice(0, 500), size: 18, font: 'Courier New', color: '666666' })],
            indent: { left: 720 },
            spacing: { after: 160 },
          })
        )
      }
      break
    case 'quote':
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `"${section.content}"`, size: 22, italics: true, color: '555555' })],
          indent: { left: 1080, right: 1080 },
          spacing: { after: 120 },
        })
      )
      break
    default:
      children.push(
        new Paragraph({
          children: [new TextRun({ text: String(section.content), size: 22 })],
          spacing: { after: 120 },
        })
      )
  }

  return children
}

function renderDOCXTable(tableContent: string): any[] {
  const lines = tableContent.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean)
  const rows = lines.slice(2).map(line => 
    line.split('|').map(c => c.trim()).filter(Boolean)
  )

  if (headers.length === 0 || rows.length === 0) return []

  const tableRows: TableRow[] = []

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
