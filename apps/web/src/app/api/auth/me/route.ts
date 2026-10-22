import { getCurrentUserWithRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getCurrentUserWithRole()
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const { passwordHash, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}