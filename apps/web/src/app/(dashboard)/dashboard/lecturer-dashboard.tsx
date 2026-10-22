"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  BookOpen,
  Users,
  UserCheck,
  ClipboardCheck,
  FileText,
  Plus,
  ArrowRight,
  Book,
  ClipboardList,
  Loader2,
  AlertCircle,
  Video,
  ExternalLink,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

interface DashboardProps {
  user: {
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

const lecturerQuickActions = [
  { label: "Mark Attendance", href: "/attendance", icon: UserCheck, description: "Record & update class attendance" },
  { label: "Teacher Meetings", href: "/planner", icon: Video, description: "Schedule & manage meetings" },
  { label: "Create Assessment", href: "/assessments", icon: ClipboardCheck, description: "Add & grade assessments" },
  { label: "Create Assignment", href: "/assignments", icon: FileText, description: "Assign & evaluate coursework" },
  { label: "Upload Resources", href: "/subjects", icon: BookOpen, description: "Share study materials" },
  { label: "View Subjects", href: "/subjects", icon: Book, description: "Manage your classrooms" },
]

export function LecturerDashboard({ user }: DashboardProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-stats", "lecturer"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load lecturer dashboard")
      }
      return res.json()
    },
  })

  const { data: meetingsData } = useQuery({
    queryKey: ["meetings", "lecturer-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/meetings?includeCancelled=false")
      if (!res.ok) return { meetings: [] }
      return res.json()
    },
  })

  const lecturerStats = [
    { label: "Assigned Subjects", value: String(data?.stats?.assignedSubjects ?? 0), icon: Book, color: "text-blue-500" },
    { label: "Pending Attendance", value: String(data?.stats?.pendingAttendance ?? 0), icon: UserCheck, color: "text-yellow-500" },
    { label: "Ungraded Submissions", value: String(data?.stats?.ungradedSubmissions ?? 0), icon: ClipboardList, color: "text-red-500" },
    { label: "Active Students", value: String(data?.stats?.activeStudents ?? 0), icon: Users, color: "text-green-500" },
  ]

  const todaysClasses = data?.todaysClasses || []
  const pendingSubmissions = data?.pendingSubmissions || []
  const recentAnnouncements = data?.recentAnnouncements || []
  const upcomingMeetings = (meetingsData?.meetings || []).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, Dr. {user.lastName}!</h1>
        <p className="text-muted-foreground mt-1">Manage your classes, meetings, attendance, and assessments.</p>
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error instanceof Error ? error.message : "Failed to load dashboard"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {lecturerStats.map((stat) => (
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
          {lecturerQuickActions.map((action) => (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Today&apos;s Classes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/attendance">
                <Plus className="mr-1 h-4 w-4" />
                Attendance
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : todaysClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No classes scheduled today</p>
            ) : (
              <div className="space-y-3">
                {todaysClasses.map((cls: { id: string; period: number; topic: string | null; subject: { code: string; name: string } }) => (
                  <div key={cls.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{cls.subject.code} - {cls.subject.name}</p>
                      <p className="text-xs text-muted-foreground">{cls.topic || `Period ${cls.period}`}</p>
                    </div>
                    <Badge variant="outline">Period {cls.period}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Teacher Meetings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/planner">
                <Plus className="mr-1 h-4 w-4" />
                Schedule
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming meetings</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((m: any) => (
                  <div key={m.id} className="p-2 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <Badge variant="outline" className="text-xs">{m.eventType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(m.startTime)} · {m.participantCount || 0} participants
                    </p>
                    {m.meetingLink && (
                      <a
                        href={m.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline inline-flex items-center gap-1"
                      >
                        Join Link <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Grading</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/assignments">
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
            ) : pendingSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending submissions</p>
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.map((sub: { id: string; assignment: { title: string; subject: { code: string } }; user: { firstName: string; lastName: string } }) => (
                  <Link key={sub.id} href="/assignments" className="block p-2 border rounded-lg hover:bg-accent transition-colors">
                    <p className="text-sm font-medium truncate">{sub.assignment.subject.code}: {sub.assignment.title}</p>
                    <p className="text-xs text-muted-foreground">{sub.user.firstName} {sub.user.lastName}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent announcements</p>
            ) : (
              <div className="space-y-3">
                {recentAnnouncements.map((item: { id: string; title: string; message: string }) => (
                  <div key={item.id} className="p-2 border rounded-lg">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.message}</p>
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