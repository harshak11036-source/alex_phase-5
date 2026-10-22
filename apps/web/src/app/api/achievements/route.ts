import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const achievements = await prisma.studentAchievement.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ achievements })
  } catch (error) {
    console.error('Achievements list error:', error)
    return NextResponse.json({ error: 'Failed to list achievements' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, category, organization, startDate, endDate, description } = body

    const achievement = await prisma.studentAchievement.create({
      data: {
        userId: user.id,
        title,
        category,
        organization,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        description,
      },
    })

    return NextResponse.json({ achievement })
  } catch (error) {
    console.error('Achievement create error:', error)
    return NextResponse.json({ error: 'Failed to create achievement' }, { status: 500 })
  }
}
