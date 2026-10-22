import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const results = await prisma.assessmentResult.findMany({
      where: { assessmentId: id, isPublished: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { marksObtained: 'desc' },
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Assessment results list error:', error)
    return NextResponse.json({ error: 'Failed to list results' }, { status: 500 })
  }
}