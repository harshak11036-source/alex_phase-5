import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const materials = await prisma.studyMaterial.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceDoc: { select: { id: true, title: true, fileName: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ materials })
  } catch (error) {
    console.error('Study materials list error:', error)
    return NextResponse.json({ error: 'Failed to list study materials' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, content, type, sourceDocId, subjectId, topic, tags } = body

    const material = await prisma.studyMaterial.create({
      data: {
        userId: user.id,
        title,
        content,
        type,
        sourceDocId,
        subjectId,
        topic,
        tags: tags || [],
      },
    })

    return NextResponse.json({ material })
  } catch (error) {
    console.error('Study material create error:', error)
    return NextResponse.json({ error: 'Failed to create study material' }, { status: 500 })
  }
}
