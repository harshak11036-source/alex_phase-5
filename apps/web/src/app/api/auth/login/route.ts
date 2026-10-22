import { prisma } from '@/lib/prisma'
import { createLocalSession, LOCAL_AUTH_COOKIE, isLocalAuth } from '@/lib/local-auth'
import { compare } from 'bcryptjs'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    if (!isLocalAuth()) {
      return NextResponse.json({ error: 'Local auth is disabled' }, { status: 404 })
    }

    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive || !user.passwordHash || !(await compare(password, user.passwordHash))) {
      console.warn(`[Auth] Failed login attempt for ${email}`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => undefined)

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
    console.error('[Auth] Local login error:', error)
    return NextResponse.json(
      { error: 'Database unavailable. Start PostgreSQL and run the ALEX database setup first.' },
      { status: 503 }
    )
  }
}
