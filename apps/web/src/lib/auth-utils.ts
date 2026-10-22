import { getCurrentUserWithRole, requireAuth as requireAuthFn } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export interface AuthContext {
  userId: string
  user: any
  membership: any
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getCurrentUserWithRole()
  
  if (!user) {
    return null
  }

  return {
    userId: user.id,
    user,
    membership: user.activeMembership,
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const user = await requireAuthFn()
  return {
    userId: user.id,
    user,
    membership: user.activeMembership,
  }
}

export function requireRole(auth: AuthContext | null, allowedRoles: string[]): AuthContext {
  if (!auth) {
    throw new Error('Unauthorized')
  }
  
  const effectiveRole = auth.membership?.role ?? auth.user?.role
  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    throw new Error('Forbidden')
  }
  
  return auth
}

export function requireLecturerOrAdmin(auth: AuthContext | null): AuthContext {
  return requireRole(auth, ['LECTURER', 'ADMIN'])
}

export function requireAdmin(auth: AuthContext | null): AuthContext {
  return requireRole(auth, ['ADMIN'])
}

export async function checkDocumentAccess(
  userId: string,
  documentId: string
): Promise<boolean> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, subjectId: true, projectId: true, notebookId: true },
  })

  if (!document) return false

  if (document.ownerId === userId) return true

  // Check subject enrollment
  if (document.subjectId) {
    const enrollment = await prisma.subjectEnrollment.findFirst({
      where: { userId, subjectId: document.subjectId, isActive: true },
    })
    if (enrollment) return true
  }

  // Check project membership
  if (document.projectId) {
    const membership = await prisma.projectMember.findFirst({
      where: { userId, projectId: document.projectId },
    })
    if (membership) return true
  }

  // Check notebook ownership
  if (document.notebookId) {
    const notebook = await prisma.researchNotebook.findFirst({
      where: { id: document.notebookId, ownerId: userId },
    })
    if (notebook) return true
  }

  return false
}

export async function checkSubjectAccess(
  userId: string,
  subjectId: string,
  requireLecturer: boolean = false
): Promise<boolean> {
  if (requireLecturer) {
    const assignment = await prisma.lecturerAssignment.findFirst({
      where: { userId, subjectId },
    })
    return !!assignment
  }

  const enrollment = await prisma.subjectEnrollment.findFirst({
    where: { userId, subjectId, isActive: true },
  })
  return !!enrollment
}

export async function checkProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  const membership = await prisma.projectMember.findFirst({
    where: { userId, projectId },
  })
  return !!membership
}

export async function checkAssessmentAccess(
  userId: string,
  assessmentId: string,
  requireLecturer: boolean = false
): Promise<boolean> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { subjectId: true, createdBy: true },
  })

  if (!assessment) return false

  if (requireLecturer) {
    const assignment = await prisma.lecturerAssignment.findFirst({
      where: { userId, subjectId: assessment.subjectId },
    })
    return !!assignment || assessment.createdBy === userId
  }

  const enrollment = await prisma.subjectEnrollment.findFirst({
    where: { userId, subjectId: assessment.subjectId, isActive: true },
  })
  return !!enrollment
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}

export function validateFileType(fileName: string, allowedTypes: string[]): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext ? allowedTypes.includes(ext) : false
}

export function validateFileSize(fileSize: number, maxSizeMB: number): boolean {
  return fileSize <= maxSizeMB * 1024 * 1024
}

export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken
}

// Input validation helpers
export const validators = {
  email: (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },
  uuid: (uuid: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
  },
  cuid: (cuid: string): boolean => {
    return /^c[0-9a-z]{24}$/i.test(cuid)
  },
  positiveNumber: (num: number): boolean => {
    return Number.isFinite(num) && num > 0
  },
  nonEmptyString: (str: string): boolean => {
    return typeof str === 'string' && str.trim().length > 0
  },
  maxLength: (str: string, max: number): boolean => {
    return typeof str === 'string' && str.length <= max
  },
  inRange: (num: number, min: number, max: number): boolean => {
    return Number.isFinite(num) && num >= min && num <= max
  },
  isArray: <T>(arr: T[]): boolean => {
    return Array.isArray(arr)
  },
  arrayLength: <T>(arr: T[], min: number, max?: number): boolean => {
    if (!Array.isArray(arr)) return false
    if (arr.length < min) return false
    if (max !== undefined && arr.length > max) return false
    return true
  },
}

// API response helpers
export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, message }, { status: 200 })
}

export function errorResponse(message: string, status: number = 400, details?: any) {
  return NextResponse.json({ success: false, error: message, details }, { status })
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ success: false, error: message }, { status: 403 })
}

export function notFoundResponse(message = 'Not found') {
  return NextResponse.json({ success: false, error: message }, { status: 404 })
}

export function rateLimitedResponse(message = 'Too many requests', resetTime?: number) {
  const headers: Record<string, string> = {}
  if (resetTime) {
    headers['Retry-After'] = Math.ceil((resetTime - Date.now()) / 1000).toString()
  }
  return NextResponse.json({ success: false, error: message }, { status: 429, headers })
}