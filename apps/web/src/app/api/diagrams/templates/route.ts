import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getDiagramTemplates } from '@/lib/diagrams/generator'

export async function GET() {
  try {
    const user = await requireAuth()

    const templates = getDiagramTemplates()
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Diagram templates error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}
