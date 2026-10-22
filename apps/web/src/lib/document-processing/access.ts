import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface AccessUser {
  id: string
  role?: string | null
}

export interface DocumentAccessTarget {
  id?: string
  ownerId: string
  subjectId?: string | null
  projectId?: string | null
  notebookId?: string | null
}

export function canMutateDocument(user: AccessUser, document: { ownerId: string }): boolean {
  return document.ownerId === user.id || user.role === 'ADMIN'
}

export async function canAccessDocument(
  user: AccessUser,
  document: DocumentAccessTarget
): Promise<boolean> {
  if (!user?.id) return false
  if (document.ownerId === user.id || user.role === 'ADMIN') {
    return true
  }

  if (document.subjectId) {
    const [enrollment, lecturerAssignment] = await Promise.all([
      prisma.subjectEnrollment?.findFirst
        ? prisma.subjectEnrollment.findFirst({
            where: { userId: user.id, subjectId: document.subjectId, isActive: true },
          })
        : Promise.resolve(null),
      prisma.lecturerAssignment?.findFirst
        ? prisma.lecturerAssignment.findFirst({
            where: { userId: user.id, subjectId: document.subjectId },
          })
        : Promise.resolve(null),
    ])
    if (enrollment || lecturerAssignment) return true
  }

  if (document.projectId && prisma.projectMember?.findFirst) {
    const member = await prisma.projectMember.findFirst({
      where: { userId: user.id, projectId: document.projectId },
    })
    if (member) return true
  }

  if (document.notebookId && prisma.researchNotebook?.findFirst) {
    const notebook = await prisma.researchNotebook.findFirst({
      where: {
        id: document.notebookId,
        OR: [{ ownerId: user.id }, { isPublic: true }],
      },
    })
    if (notebook) return true
  }

  return false
}

export async function canUploadToTarget(
  user: AccessUser,
  targets: { subjectId?: string | null; projectId?: string | null; notebookId?: string | null }
): Promise<{ allowed: boolean; reason?: string; statusCode?: number }> {
  if (user.role === 'ADMIN') return { allowed: true }

  if (targets.subjectId) {
    const [enrollment, lecturerAssignment] = await Promise.all([
      prisma.subjectEnrollment?.findFirst
        ? prisma.subjectEnrollment.findFirst({
            where: { userId: user.id, subjectId: targets.subjectId, isActive: true },
          })
        : Promise.resolve(null),
      prisma.lecturerAssignment?.findFirst
        ? prisma.lecturerAssignment.findFirst({
            where: { userId: user.id, subjectId: targets.subjectId },
          })
        : Promise.resolve(null),
    ])
    if (!enrollment && !lecturerAssignment) {
      return {
        allowed: false,
        reason: 'You do not have access to upload documents to this subject',
        statusCode: 403,
      }
    }
  }

  if (targets.projectId && prisma.projectMember?.findFirst) {
    const member = await prisma.projectMember.findFirst({
      where: { userId: user.id, projectId: targets.projectId },
    })
    if (!member) {
      return {
        allowed: false,
        reason: 'You are not a member of the target project',
        statusCode: 403,
      }
    }
  }

  if (targets.notebookId && prisma.researchNotebook?.findFirst) {
    const notebook = await prisma.researchNotebook.findFirst({
      where: { id: targets.notebookId },
    })
    if (!notebook) {
      return {
        allowed: false,
        reason: 'Target research notebook not found',
        statusCode: 404,
      }
    }
    if (notebook.ownerId !== user.id) {
      return {
        allowed: false,
        reason: 'You do not have permission to upload sources to this research notebook',
        statusCode: 403,
      }
    }
  }

  return { allowed: true }
}

export function buildAccessibleDocumentsWhere(
  user: AccessUser,
  filters: {
    subjectId?: string | null
    projectId?: string | null
    notebookId?: string | null
    status?: string | null
    search?: string | null
    documentIds?: string[]
  } = {}
): Prisma.DocumentWhereInput {
  const { subjectId, projectId, notebookId, status, search, documentIds } = filters

  const accessCondition: Prisma.DocumentWhereInput =
    user.role === 'ADMIN'
      ? {}
      : {
          OR: [
            { ownerId: user.id },
            { subject: { enrollments: { some: { userId: user.id, isActive: true } } } },
            { subject: { lecturers: { some: { userId: user.id } } } },
            { project: { members: { some: { userId: user.id } } } },
            { notebook: { ownerId: user.id } },
            { notebook: { isPublic: true } },
          ],
        }

  const andConditions: Prisma.DocumentWhereInput[] = [accessCondition]

  if (subjectId && subjectId !== 'current' && subjectId !== 'all') {
    andConditions.push({ subjectId })
  } else if (subjectId === 'current') {
    andConditions.push({ NOT: { subjectId: null } })
  }

  if (projectId && projectId !== 'all') {
    andConditions.push({ projectId })
  }

  if (notebookId && notebookId !== 'all') {
    andConditions.push({ notebookId })
  }

  if (status && status !== 'all') {
    andConditions.push({ status: status as any })
  }

  if (documentIds && documentIds.length > 0) {
    andConditions.push({ id: { in: documentIds } })
  }

  if (search && search.trim()) {
    const q = search.trim()
    andConditions.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { fileName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  return andConditions.length === 1 ? andConditions[0] : { AND: andConditions }
}
