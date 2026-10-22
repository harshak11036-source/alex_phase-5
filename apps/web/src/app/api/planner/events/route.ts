import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  listMeetingsAndEvents,
  createMeetingOrEvent,
  updateMeetingOrEvent,
  deleteMeetingOrEvent,
} from '@/lib/meetings/service'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const result = await listMeetingsAndEvents(user, {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      subjectId: searchParams.get('subjectId'),
      eventType: searchParams.get('eventType') || searchParams.get('type'),
      status: searchParams.get('status'),
      includeCancelled: searchParams.get('includeCancelled') !== 'false',
      meetingsOnly: searchParams.get('meetingsOnly') === 'true',
    })

    return NextResponse.json({
      events: result.events,
      meetings: result.meetings,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Events] List error:', error)
    return NextResponse.json({ error: 'Failed to list events' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const result = await createMeetingOrEvent(user, body)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      event: result.event,
      meeting: result.meeting,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Events] Create error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const eventId = body.id || body.eventId || body.meetingId

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    const result = await updateMeetingOrEvent(user, String(eventId), body)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      event: result.event,
      meeting: result.meeting,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Events] Update error:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return PATCH(request)
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    let eventId =
      searchParams.get('id') ||
      searchParams.get('eventId') ||
      searchParams.get('meetingId')

    if (!eventId) {
      const body = await request.json().catch(() => ({}))
      eventId = body.id || body.eventId || body.meetingId
    }

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    const result = await deleteMeetingOrEvent(user, String(eventId))
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Planner Events] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
