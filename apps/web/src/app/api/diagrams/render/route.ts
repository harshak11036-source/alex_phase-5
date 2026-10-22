import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { renderDiagramFromCode } from '@/lib/diagrams/renderer'
import { AuditLogService } from '@/lib/audit-log'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { type, code, title, save } = body

    if (!type || !code) {
      return NextResponse.json({ error: 'Type and code are required' }, { status: 400 })
    }

    const validTypes = ['mermaid', 'graphviz', 'plantuml']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid diagram type' }, { status: 400 })
    }

    const result = await renderDiagramFromCode(type, code)

    let savedDiagram = null
    if (save) {
      savedDiagram = await prisma.diagram.create({
        data: {
          userId: user.id,
          title: title || `${type} diagram`,
          type,
          definition: { code, title } as any,
          renderedUrl: result.svg,
        },
      })
    }

    return NextResponse.json({
      svg: result.svg,
      width: result.width,
      height: result.height,
      diagram: savedDiagram,
    })
  } catch (error) {
    console.error('Diagram render error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to render diagram' }, { status: 500 })
  }
}
