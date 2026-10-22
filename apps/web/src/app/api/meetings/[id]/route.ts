import {
  GET as getEvent,
  PATCH as patchEvent,
  PUT as putEvent,
  DELETE as deleteEvent,
} from '@/app/api/planner/events/[id]/route'

export const GET = getEvent
export const PATCH = patchEvent
export const PUT = putEvent
export const DELETE = deleteEvent
