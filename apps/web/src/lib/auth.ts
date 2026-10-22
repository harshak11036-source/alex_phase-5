import { prisma } from './prisma'
import { getLocalUserId, LOCAL_AUTH_COOKIE } from './local-auth'
import { UserRole, MembershipStatus, CollegeMembership } from '@prisma/client'
import { cookies } from 'next/headers'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(LOCAL_AUTH_COOKIE)?.value
  const userId = getLocalUserId(sessionCookie)

  if (!userId) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: MembershipStatus.ACTIVE },
        include: {
          institution: true,
          department: true,
          course: true,
          semester: true,
          academicYear: true,
        },
      },
    },
  })

  if (!dbUser || !dbUser.isActive) return null

  return dbUser
}

export async function getCurrentUserWithRole() {
  const user = await getCurrentUser()
  if (!user) return null

  const activeMembership = user.memberships[0]
  return {
    ...user,
    activeMembership,
    role: activeMembership?.role ?? user.role,
    institutionId: activeMembership?.institutionId,
    departmentId: activeMembership?.departmentId,
    courseId: activeMembership?.courseId,
    semesterId: activeMembership?.semesterId,
  }
}

export async function requireAuth() {
  const user = await getCurrentUserWithRole()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth()
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}

export async function requireInstitutionAccess(institutionId: string) {
  const user = await requireAuth()
  const membership = user.memberships.find(m => m.institutionId === institutionId && m.status === MembershipStatus.ACTIVE)
  if (!membership) {
    throw new Error('Forbidden: No access to this institution')
  }
  return { user, membership }
}

export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function canAccessSubject(user: { role: UserRole; memberships: CollegeMembership[] }, subjectInstitutionId: string): boolean {
  if (user.role === UserRole.ADMIN) return true
  const membership = user.memberships.find(m => m.institutionId === subjectInstitutionId && m.status === MembershipStatus.ACTIVE)
  if (!membership) return false
  const allowedRoles: UserRole[] = [UserRole.STUDENT, UserRole.LECTURER, UserRole.PROJECT_MENTOR]
  return allowedRoles.includes(membership.role)
}

export function canManageSubject(user: { role: UserRole; memberships: CollegeMembership[] }, subjectInstitutionId: string): boolean {
  if (user.role === UserRole.ADMIN) return true
  const membership = user.memberships.find(m => m.institutionId === subjectInstitutionId && m.status === MembershipStatus.ACTIVE)
  if (!membership) return false
  const allowedRoles: UserRole[] = [UserRole.LECTURER, UserRole.ADMIN]
  return allowedRoles.includes(membership.role)
}