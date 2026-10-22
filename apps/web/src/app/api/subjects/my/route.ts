import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET() {
  await headers()

  try {
    const user = await requireAuth()

    let whereClause: Record<string, unknown> = {}
    if (user.role === 'STUDENT') {
      whereClause = {
        enrollments: { some: { userId: user.id, isActive: true } },
      }
    } else if (user.role === 'LECTURER') {
      whereClause = {
        lecturers: { some: { userId: user.id } },
      }
    } else if (user.institutionId) {
      whereClause = {
        institutionId: user.institutionId,
      }
    }

    const subjects = await prisma.subject.findMany({
      where: whereClause,
      include: {
        institution: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, number: true } },
        lecturers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { enrollments: true, resources: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ subjects })
  } catch (error) {
    console.error('[Subjects] My subjects list error:', error)
    return NextResponse.json({ error: 'Failed to list subjects' }, { status: 500 })
  }
}
