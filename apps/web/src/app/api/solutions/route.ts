import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    // For now, return empty array since we don't have a Solution model
    // In production, you'd store solutions in a database table
    return NextResponse.json([])
  } catch (error) {
    console.error('Solutions history error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
