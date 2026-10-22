import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const CATEGORIES = [
  "ASSIGNMENT",
  "ATTENDANCE",
  "INTERNAL_ASSESSMENT",
  "ACADEMIC_ANNOUNCEMENT",
  "PROJECT_MILESTONE",
  "MENTOR_FEEDBACK",
  "RESEARCH_UPDATE",
  "STUDY_REMINDER",
  "UPCOMING_DEADLINE",
  "DOCUMENT_PROCESSING_FAILURE",
  "AI_TASK_COMPLETION",
]

export async function GET() {
  try {
    const user = await requireAuth()

    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: user.id },
    })

    const allPrefs = CATEGORIES.map(category => {
      const pref = prefs.find(p => p.category === category)
      return pref || {
        category,
        inAppEnabled: true,
        emailEnabled: false,
        pushEnabled: false,
      }
    })

    return NextResponse.json({ preferences: allPrefs })
  } catch (error) {
    console.error('Notification preferences list error:', error)
    return NextResponse.json({ error: 'Failed to list preferences' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { preferences } = body

    for (const pref of preferences) {
      await prisma.notificationPreference.upsert({
        where: { userId_category: { userId: user.id, category: pref.category } },
        update: {
          inAppEnabled: pref.inAppEnabled,
          emailEnabled: pref.emailEnabled,
          pushEnabled: pref.pushEnabled,
        },
        create: {
          userId: user.id,
          category: pref.category,
          inAppEnabled: pref.inAppEnabled,
          emailEnabled: pref.emailEnabled,
          pushEnabled: pref.pushEnabled,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notification preferences update error:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
