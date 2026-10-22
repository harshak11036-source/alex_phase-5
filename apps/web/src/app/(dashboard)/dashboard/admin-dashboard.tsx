"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  Users,
  Book,
  Calendar,
  Archive,
  Settings,
  ArrowRight,
  GraduationCap,
  Building2,
  Database,
  HardDrive,
  Server,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardProps {
  user: {
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

const adminQuickActions = [
  { label: "Manage Users", href: "/dashboard/settings", icon: Users, description: "Add, edit, remove users" },
  { label: "Manage Subjects", href: "/dashboard/subjects", icon: Book, description: "Configure subjects" },
  { label: "Academic Calendar", href: "/dashboard/planner", icon: Calendar, description: "Set academic dates" },
  { label: "Institution Settings", href: "/dashboard/settings", icon: Building2, description: "Configure institution" },
  { label: "Audit Logs", href: "/dashboard/notifications", icon: Archive, description: "View system activity" },
  { label: "System Settings", href: "/dashboard/ai-settings", icon: Settings, description: "Global configuration" },
]

export function AdminDashboard({ user: _user }: DashboardProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-stats", "admin"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load admin dashboard")
      }
      return res.json()
    },
  })

  const { data: healthData } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const res = await fetch("/api/health")
      return res.json()
    },
  })

  const adminStats = [
    { label: "Total Students", value: String(data?.stats?.totalStudents ?? 0), icon: GraduationCap, color: "text-blue-500" },
    { label: "Total Lecturers", value: String(data?.stats?.totalLecturers ?? 0), icon: Users, color: "text-green-500" },
    { label: "Active Subjects", value: String(data?.stats?.activeSubjects ?? 0), icon: Book, color: "text-purple-500" },
    { label: "Departments", value: String(data?.stats?.totalDepartments ?? 0), icon: Building2, color: "text-orange-500" },
  ]

  const recentRegistrations = data?.recentRegistrations || []
  const pendingApprovals = data?.pendingApprovals || []
  const dbHealthy = healthData?.database === "ok"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your institution&apos;s academic system.</p>
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error instanceof Error ? error.message : "Failed to load admin dashboard"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adminQuickActions.map((action) => (
            <Card key={action.label} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-lg bg-primary/10 text-primary", "flex-shrink-0")}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={action.href} className="font-medium hover:text-primary">
                      {action.label}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  </div>
                  <Link href={action.href} className="text-primary hover:text-primary/80">
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Registrations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/settings">
                <ArrowRight className="mr-1 h-4 w-4" />
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent registrations</p>
            ) : (
              <div className="space-y-3">
                {recentRegistrations.map((u: { id: string; firstName: string; lastName: string; email: string; role: string }) => (
                  <div key={u.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{u.role}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Database className="h-4 w-4" />Database</span>
                <span className={cn("font-medium", dbHealthy ? "text-green-500" : "text-amber-500")}>
                  {dbHealthy ? "Healthy" : "Checking"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" />Storage</span>
                <span className="text-green-500 font-medium">Healthy</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Server className="h-4 w-4" />AI Mode</span>
                <span className="text-green-500 font-medium uppercase">{healthData?.aiMode || "Ready"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending approvals</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((m: { id: string; user: { firstName: string; lastName: string; email: string }; role: string }) => (
                  <div key={m.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{m.user.firstName} {m.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                    <Badge variant="outline">{m.role}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}