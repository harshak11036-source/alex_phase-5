"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { StudentDashboard } from "./student-dashboard"
import { LecturerDashboard } from "./lecturer-dashboard"
import { AdminDashboard } from "./admin-dashboard"
import { useAuth } from "@/components/auth/AuthProvider"

interface UserWithRole {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
  activeMembership?: {
    role: string
    institutionId: string
    departmentId: string | null
    courseId: string | null
    semesterId: string | null
  }
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userWithRole: UserWithRole = {
    id: user.id,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: user.avatarUrl || null,
    role: user.role || 'STUDENT',
    activeMembership: user.activeMembership,
  }

  const role = userWithRole.activeMembership?.role ?? userWithRole.role

  return (
    <>
      {role === "ADMIN" && <AdminDashboard user={userWithRole} />}
      {role === "LECTURER" && <LecturerDashboard user={userWithRole} />}
      {role === "STUDENT" && <StudentDashboard user={userWithRole} />}
      {role === "PROJECT_MENTOR" && <LecturerDashboard user={userWithRole} />}
    </>
  )
}