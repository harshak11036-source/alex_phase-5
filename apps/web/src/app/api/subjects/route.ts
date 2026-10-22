import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await requireAuth()

    const subjects = await prisma.subject.findMany({
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
    console.error('[Subjects] All subjects list error:', error)
    return NextResponse.json({ error: 'Failed to list subjects' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user.role !== 'LECTURER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, credits = 3, description, syllabus } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Subject name and code are required' }, { status: 400 })
    }

    const institution = await prisma.institution.findFirst({
      where: user.institutionId ? { id: user.institutionId } : {},
      include: {
        departments: { take: 1 },
        semesters: { orderBy: { isActive: 'desc' }, take: 1 },
      },
    })

    const institutionId = body.institutionId || user.institutionId || institution?.id
    const departmentId = body.departmentId || user.departmentId || institution?.departments?.[0]?.id
    const semesterId = body.semesterId || user.semesterId || institution?.semesters?.[0]?.id

    if (!institutionId || !departmentId || !semesterId) {
      return NextResponse.json(
        { error: 'Institution, department, and semester context required to create subject' },
        { status: 400 }
      )
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        credits: Number(credits) || 3,
        description: description || null,
        syllabus: syllabus || null,
        institutionId,
        departmentId,
        semesterId,
        ...(user.role === 'LECTURER'
          ? {
              lecturers: {
                create: { userId: user.id, isPrimary: true },
              },
            }
          : {}),
      },
      include: {
        institution: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, number: true } },
        lecturers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { enrollments: true, resources: true } },
      },
    })

    return NextResponse.json({ subject })
  } catch (error) {
    console.error('[Subjects] Subject create error:', error)
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 })
  }
}
