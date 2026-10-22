import { prisma } from '@/lib/prisma'
import { createLocalSession, LOCAL_AUTH_COOKIE, isLocalAuth } from '@/lib/local-auth'
import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    if (!isLocalAuth()) {
      return NextResponse.json({ error: 'Local auth is disabled' }, { status: 404 })
    }

    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const firstName = String(body.firstName || body.first_name || '').trim()
    const lastName = String(body.lastName || body.last_name || '').trim()

    if (!email || password.length < 8 || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Name, valid email and password of at least 8 characters are required' },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const role = body.role === 'LECTURER' ? 'LECTURER' : body.role === 'ADMIN' ? 'ADMIN' : 'STUDENT'

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(password, 12),
        firstName,
        lastName,
        role,
        isActive: true,
        emailVerified: new Date(),
      },
    })

    // Automatically attach an active CollegeMembership if an institution exists in the database
    try {
      const defaultInstitution = await prisma.institution.findFirst({
        include: {
          departments: { take: 1 },
          courses: { take: 1 },
          semesters: { where: { isActive: true }, take: 1 },
          academicYears: { where: { isActive: true }, take: 1 },
        },
      })
      if (defaultInstitution) {
        await prisma.collegeMembership.create({
          data: {
            userId: user.id,
            institutionId: defaultInstitution.id,
            departmentId: defaultInstitution.departments?.[0]?.id || null,
            courseId: defaultInstitution.courses?.[0]?.id || null,
            semesterId: defaultInstitution.semesters?.[0]?.id || null,
            academicYearId: defaultInstitution.academicYears?.[0]?.id || null,
            role,
            status: 'ACTIVE',
          },
        })
      }
    } catch (membershipErr) {
      console.warn('[Auth] Optional default membership creation skipped:', membershipErr)
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    })

    response.cookies.set(LOCAL_AUTH_COOKIE, createLocalSession(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    console.error('[Auth] Local registration error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
