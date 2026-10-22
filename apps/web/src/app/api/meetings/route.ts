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
      meetingsOnly: searchParams.get('meetingsOnly') !== 'false',
    })

    return NextResponse.json({
      meetings: result.meetings,
      events: result.events,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Meetings] List error:', error)
    return NextResponse.json({ error: 'Failed to list meetings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const result = await createMeetingOrEvent(
      user,
      {
        ...body,
        eventType: body.eventType || 'MEETING',
      },
      { requireTeacher: true }
    )
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      meeting: result.meeting,
      event: result.event,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Meetings] Create error:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const meetingId = body.id || body.meetingId || body.eventId

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    const result = await updateMeetingOrEvent(user, String(meetingId), body)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      meeting: result.meeting,
      event: result.event,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Meetings] Update error:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return PATCH(request)
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    let meetingId =
      searchParams.get('id') ||
      searchParams.get('meetingId') ||
      searchParams.get('eventId')

    if (!meetingId) {
      const body = await request.json().catch(() => ({}))
      meetingId = body.id || body.meetingId || body.eventId
    }

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    const result = await deleteMeetingOrEvent(user, String(meetingId))
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Meetings] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}
