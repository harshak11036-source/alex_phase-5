"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  Edit,
  AlertTriangle,
  Users,
  ShieldCheck,
  Ban,
  RotateCcw,
  Save,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

type AttendanceStatusType = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "ON_DUTY"

interface RosterEntry {
  userId: string
  firstName: string
  lastName: string
  email: string
  studentId: string | null
  recordId: string | null
  status: AttendanceStatusType | null
  remarks: string | null
  markedAt: string | null
}

interface SessionSummary {
  totalEnrolled: number
  markedCount: number
  unmarkedCount: number
  present: number
  absent: number
  late: number
  excused: number
  onDuty: number
  attendedCount: number
  attendancePercentage: number
}

interface AttendanceSession {
  id: string
  subjectId: string
  date: string
  period: number
  topic: string | null
  conductedBy: string | null
  isCancelled: boolean
  cancelReason: string | null
  subject: { id: string; name: string; code: string }
  records: {
    id: string
    userId: string
    status: AttendanceStatusType
    remarks: string | null
    user: { id: string; firstName: string; lastName: string; email: string; studentId?: string | null }
  }[]
  roster?: RosterEntry[]
  summary?: SessionSummary
  _count: { records: number }
}

interface SubjectAttendanceSummary {
  subject: { id: string; name: string; code: string }
  totalSessions: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount?: number
  onDutyCount?: number
  attendancePercentage: number
  enrolledCount?: number
  students?: {
    userId: string
    firstName: string
    lastName: string
    email: string
    studentId: string | null
    present: number
    absent: number
    late: number
    excused: number
    onDuty: number
    totalSessions: number
    percentage: number
  }[]
}

function toYmdString(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export default function AttendancePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("my-attendance")
  const [selectedSubject, setSelectedSubject] = React.useState<string>("")
  const [selectedDateStr, setSelectedDateStr] = React.useState<string>(() =>
    toYmdString(new Date())
  )
  const [selectedPeriod, setSelectedPeriod] = React.useState<number>(1)
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>("")
  const [sessionTopic, setSessionTopic] = React.useState<string>("")

  // Draft attendance state keyed by student userId
  const [draftStatuses, setDraftStatuses] = React.useState<
    Record<string, { status: AttendanceStatusType; remarks: string }>
  >({})

  const [editingEntry, setEditingEntry] = React.useState<{
    recordId: string | null
    sessionId: string
    userId: string
    studentName: string
    status: AttendanceStatusType
    remarks: string
  } | null>(null)

  const [cancelConfirmSession, setCancelConfirmSession] =
    React.useState<AttendanceSession | null>(null)
  const [cancelReasonInput, setCancelReasonInput] = React.useState("")

  const { data: userData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile")
      if (!res.ok) throw new Error("Failed to fetch profile")
      return res.json()
    },
  })

  const userRole = userData?.user?.role || "STUDENT"
  const isTeacher = ["LECTURER", "PROJECT_MENTOR", "ADMIN"].includes(userRole)

  const { data: myAttendance } = useQuery({
    queryKey: ["attendance", "my"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/my")
      if (!res.ok) throw new Error("Failed to fetch attendance summary")
      return res.json()
    },
  })

  const { data: sessionsData } = useQuery({
    queryKey: ["attendance", "sessions", selectedSubject],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedSubject) params.set("subjectId", selectedSubject)
      const res = await fetch(`/api/attendance/sessions?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch sessions")
      return res.json()
    },
  })

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", "my"],
    queryFn: async () => {
      const res = await fetch("/api/subjects/my")
      if (!res.ok) throw new Error("Failed to fetch subjects")
      return res.json()
    },
  })

  const subjectsList = subjectsData?.subjects || []
  const allSessions: AttendanceSession[] = sessionsData?.sessions || []

  // Auto-select first subject for teachers if none selected
  React.useEffect(() => {
    if (!selectedSubject && subjectsList.length > 0) {
      setSelectedSubject(subjectsList[0].id)
    }
  }, [selectedSubject, subjectsList])

  // Resolve the active session matching selectedSessionId OR (selectedSubject + selectedDateStr + selectedPeriod)
  const activeSession = React.useMemo(() => {
    if (selectedSessionId) {
      const byId = allSessions.find((s) => s.id === selectedSessionId)
      if (byId) return byId
    }
    if (!selectedSubject) return null
    const matchingDateAndPeriod = allSessions.find(
      (s) =>
        s.subjectId === selectedSubject &&
        toYmdString(s.date) === selectedDateStr &&
        Number(s.period) === Number(selectedPeriod)
    )
    return matchingDateAndPeriod || null
  }, [allSessions, selectedSessionId, selectedSubject, selectedDateStr, selectedPeriod])

  // Sync draftStatuses whenever activeSession changes
  React.useEffect(() => {
    if (!activeSession) {
      setDraftStatuses({})
      return
    }
    const nextDrafts: Record<string, { status: AttendanceStatusType; remarks: string }> = {}
    const roster = activeSession.roster || []
    for (const r of roster) {
      if (r.status) {
        nextDrafts[r.userId] = {
          status: r.status,
          remarks: r.remarks || "",
        }
      }
    }
    for (const rec of activeSession.records || []) {
      nextDrafts[rec.userId] = {
        status: rec.status,
        remarks: rec.remarks || "",
      }
    }
    setDraftStatuses(nextDrafts)
    setSessionTopic(activeSession.topic || "")
  }, [activeSession])

  const invalidateAttendanceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance", "sessions"] })
    queryClient.invalidateQueries({ queryKey: ["attendance", "my"] })
  }

  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      subjectId: string
      date: string
      period: number
      topic?: string
    }) => {
      const res = await fetch("/api/attendance/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.status === 409 && payload.session) {
        return { ...payload, duplicate: true }
      }
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create attendance session")
      }
      return payload
    },
    onSuccess: (payload) => {
      invalidateAttendanceQueries()
      if (payload.session?.id) {
        setSelectedSessionId(payload.session.id)
      }
      if (payload.duplicate) {
        toast({
          title: "Existing session loaded",
          description:
            "An attendance session already exists for this class, date, and period. Loaded existing session to prevent duplicates.",
        })
      } else {
        toast({ title: "Attendance session created" })
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const markAttendanceMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string
      records: { userId: string; status: AttendanceStatusType; remarks?: string }[]
    }) => {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to record attendance")
      }
      return payload
    },
    onSuccess: (payload) => {
      invalidateAttendanceQueries()
      toast({
        title: "Attendance saved",
        description: `Persisted ${payload.count || 0} student record(s). Session attendance: ${payload.summary?.attendancePercentage ?? 0}%`,
      })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const editAttendanceMutation = useMutation({
    mutationFn: async (data: {
      recordId?: string | null
      sessionId: string
      userId: string
      status: AttendanceStatusType
      remarks?: string
    }) => {
      const res = await fetch("/api/attendance/edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update attendance record")
      }
      return payload
    },
    onSuccess: () => {
      invalidateAttendanceQueries()
      setEditingEntry(null)
      toast({ title: "Attendance record updated" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const updateSessionMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string
      topic?: string
      action?: "cancel" | "reopen"
      cancelReason?: string
    }) => {
      const res = await fetch("/api/attendance/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update session")
      }
      return payload
    },
    onSuccess: () => {
      invalidateAttendanceQueries()
      setCancelConfirmSession(null)
      setCancelReasonInput("")
      toast({ title: "Session updated" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const handleSingleStudentStatus = (
    userId: string,
    status: AttendanceStatusType
  ) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [userId]: {
        status,
        remarks: prev[userId]?.remarks || "",
      },
    }))
    if (activeSession && !activeSession.isCancelled) {
      markAttendanceMutation.mutate({
        sessionId: activeSession.id,
        records: [
          {
            userId,
            status,
            remarks: draftStatuses[userId]?.remarks || undefined,
          },
        ],
      })
    }
  }

  const handleBulkStatus = (status: AttendanceStatusType) => {
    if (!activeSession || activeSession.isCancelled) return
    const roster = activeSession.roster || []
    const nextDrafts: Record<string, { status: AttendanceStatusType; remarks: string }> = {
      ...draftStatuses,
    }
    const batchRecords: { userId: string; status: AttendanceStatusType; remarks?: string }[] = []

    for (const student of roster) {
      nextDrafts[student.userId] = {
        status,
        remarks: nextDrafts[student.userId]?.remarks || "",
      }
      batchRecords.push({
        userId: student.userId,
        status,
        remarks: nextDrafts[student.userId]?.remarks || undefined,
      })
    }

    setDraftStatuses(nextDrafts)
    if (batchRecords.length > 0) {
      markAttendanceMutation.mutate({
        sessionId: activeSession.id,
        records: batchRecords,
      })
    }
  }

  const handleSaveAllAttendance = () => {
    if (!activeSession || activeSession.isCancelled) return
    const recordsToSave = Object.entries(draftStatuses).map(
      ([userId, { status, remarks }]) => ({
        userId,
        status,
        remarks: remarks || undefined,
      })
    )
    if (recordsToSave.length === 0) {
      toast({
        title: "No attendance statuses selected",
        description: "Mark at least one student or click 'Mark All Present' first.",
        variant: "destructive",
      })
      return
    }
    markAttendanceMutation.mutate({
      sessionId: activeSession.id,
      records: recordsToSave,
    })
  }

  const stats = myAttendance?.stats || {
    overallPercentage: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    onDuty: 0,
    total: 0,
  }

  const subjectSummaries: SubjectAttendanceSummary[] = myAttendance?.subjects || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? "Record classroom attendance, manage sessions, and track student attendance summaries"
              : "Track and view your class attendance records"}
          </p>
        </div>
        {isTeacher && (
          <Button onClick={() => setActiveTab("mark")}>
            <Plus className="mr-2 h-4 w-4" />
            Record Class Attendance
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.overallPercentage || 0}%</div>
            <Progress value={stats.overallPercentage || 0} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.present || 0}</div>
            <p className="text-sm text-muted-foreground">
              Out of {stats.total || 0} sessions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.absent || 0}</div>
            <p className="text-sm text-muted-foreground">Unexcused absences</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.late || 0}</div>
            <p className="text-sm text-muted-foreground">Late arrivals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Excused / On Duty</CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.excused || 0) + (stats.onDuty || 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              {stats.excused || 0} excused · {stats.onDuty || 0} on duty
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my-attendance">
            {isTeacher ? "Class Summaries" : "My Attendance"}
          </TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          {isTeacher && <TabsTrigger value="mark">Mark Attendance</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-attendance" className="mt-4">
          <div className="space-y-4">
            {subjectSummaries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No attendance summaries available yet.
                </CardContent>
              </Card>
            ) : (
              subjectSummaries.map((item: SubjectAttendanceSummary) => (
                <Card key={item.subject.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {item.subject.code} - {item.subject.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {item.totalSessions} sessions conducted
                          {item.enrolledCount !== undefined
                            ? ` · ${item.enrolledCount} enrolled students`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.attendancePercentage >= 75
                            ? "success"
                            : item.attendancePercentage >= 60
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {item.attendancePercentage}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Progress value={item.attendancePercentage} />
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="text-green-600">
                          Present: {item.presentCount}
                        </span>
                        <span className="text-red-600">
                          Absent: {item.absentCount}
                        </span>
                        <span className="text-orange-600">
                          Late: {item.lateCount}
                        </span>
                        {(item.excusedCount || 0) > 0 && (
                          <span className="text-blue-600">
                            Excused: {item.excusedCount}
                          </span>
                        )}
                        {(item.onDutyCount || 0) > 0 && (
                          <span className="text-indigo-600">
                            On Duty: {item.onDutyCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {isTeacher && item.students && item.students.length > 0 && (
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Student ID</TableHead>
                              <TableHead>Present</TableHead>
                              <TableHead>Absent</TableHead>
                              <TableHead>Late</TableHead>
                              <TableHead>Excused / OD</TableHead>
                              <TableHead>Attendance %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.students.map((st) => (
                              <TableRow key={st.userId}>
                                <TableCell className="font-medium">
                                  {st.firstName} {st.lastName}
                                </TableCell>
                                <TableCell>{st.studentId || "N/A"}</TableCell>
                                <TableCell className="text-green-600">
                                  {st.present}
                                </TableCell>
                                <TableCell className="text-red-600">
                                  {st.absent}
                                </TableCell>
                                <TableCell className="text-orange-600">
                                  {st.late}
                                </TableCell>
                                <TableCell>
                                  {st.excused + st.onDuty}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      st.percentage >= 75
                                        ? "success"
                                        : st.percentage >= 60
                                          ? "warning"
                                          : "destructive"
                                    }
                                  >
                                    {st.percentage}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <div className="space-y-4">
            {allSessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No attendance sessions recorded yet.
                </CardContent>
              </Card>
            ) : (
              allSessions.map((session: AttendanceSession) => (
                <Card key={session.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {session.subject?.code} - {session.subject?.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(session.date)} · Period {session.period}
                          {session.topic && ` · ${session.topic}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.isCancelled ? (
                          <Badge variant="destructive">Cancelled</Badge>
                        ) : (
                          <Badge variant="outline">
                            {session.summary?.markedCount ?? session._count.records} /{" "}
                            {session.summary?.totalEnrolled ?? session._count.records}{" "}
                            marked ({session.summary?.attendancePercentage ?? 0}%)
                          </Badge>
                        )}
                        {isTeacher && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubject(session.subjectId)
                              setSelectedDateStr(toYmdString(session.date))
                              setSelectedPeriod(session.period)
                              setSelectedSessionId(session.id)
                              setActiveTab("mark")
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Manage
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {session.records && session.records.length > 0 && (
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Remarks</TableHead>
                              {isTeacher && (
                                <TableHead className="text-right">Actions</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {session.records.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell>
                                  {record.user?.firstName} {record.user?.lastName}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      record.status === "PRESENT"
                                        ? "success"
                                        : record.status === "ABSENT"
                                          ? "destructive"
                                          : record.status === "LATE"
                                            ? "warning"
                                            : "outline"
                                    }
                                  >
                                    {record.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{record.remarks || "-"}</TableCell>
                                {isTeacher && (
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={session.isCancelled}
                                      onClick={() =>
                                        setEditingEntry({
                                          recordId: record.id,
                                          sessionId: session.id,
                                          userId: record.userId,
                                          studentName: `${record.user?.firstName || ""} ${record.user?.lastName || ""}`.trim(),
                                          status: record.status,
                                          remarks: record.remarks || "",
                                        })
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {isTeacher && (
          <TabsContent value="mark" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Record & Manage Class Attendance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Class, Date, Period, and Session Selector */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Class / Subject</Label>
                    <Select
                      value={selectedSubject}
                      onValueChange={(val) => {
                        setSelectedSubject(val)
                        setSelectedSessionId("")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectsList.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Session Date</Label>
                    <Input
                      type="date"
                      value={selectedDateStr}
                      onChange={(e) => {
                        setSelectedDateStr(e.target.value)
                        setSelectedSessionId("")
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Period</Label>
                    <Select
                      value={String(selectedPeriod)}
                      onValueChange={(val) => {
                        setSelectedPeriod(Number(val))
                        setSelectedSessionId("")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            Period {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Or Jump to Existing Session</Label>
                    <Select
                      value={activeSession?.id || "NEW"}
                      onValueChange={(val) => {
                        if (val === "NEW") {
                          setSelectedSessionId("")
                          return
                        }
                        const found = allSessions.find((s) => s.id === val)
                        if (found) {
                          setSelectedSubject(found.subjectId)
                          setSelectedDateStr(toYmdString(found.date))
                          setSelectedPeriod(found.period)
                          setSelectedSessionId(found.id)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW">
                          Match Selected Date & Period
                        </SelectItem>
                        {allSessions
                          .filter(
                            (s) => !selectedSubject || s.subjectId === selectedSubject
                          )
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {toYmdString(s.date)} · P{s.period}
                              {s.topic ? ` (${s.topic})` : ""}
                              {s.isCancelled ? " [Cancelled]" : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* If no session exists yet for the selected subject + date + period */}
                {!activeSession ? (
                  <Card className="bg-muted/30 border-dashed">
                    <CardContent className="py-8 space-y-4">
                      <div className="text-center space-y-1">
                        <Users className="h-8 w-8 mx-auto text-muted-foreground" />
                        <h3 className="font-semibold text-lg">
                          No Session Started for {selectedDateStr} (Period{" "}
                          {selectedPeriod})
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Start an attendance session for this class, date, and period to load the enrolled student roster.
                        </p>
                      </div>
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="space-y-1">
                          <Label>Session Topic (Optional)</Label>
                          <Input
                            placeholder="e.g., Graph Traversal & Shortest Paths"
                            value={sessionTopic}
                            onChange={(e) => setSessionTopic(e.target.value)}
                          />
                        </div>
                        <Button
                          className="w-full"
                          disabled={
                            !selectedSubject || createSessionMutation.isPending
                          }
                          onClick={() =>
                            createSessionMutation.mutate({
                              subjectId: selectedSubject,
                              date: selectedDateStr,
                              period: selectedPeriod,
                              topic: sessionTopic || undefined,
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {createSessionMutation.isPending
                            ? "Creating Session..."
                            : "Start Attendance Session & Load Roster"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Active Session Info & Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/20">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            {activeSession.subject?.code} -{" "}
                            {activeSession.subject?.name}
                          </h3>
                          {activeSession.isCancelled ? (
                            <Badge variant="destructive">Cancelled</Badge>
                          ) : (
                            <Badge variant="success">Active Session</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Date: {toYmdString(activeSession.date)} · Period{" "}
                          {activeSession.period}
                          {activeSession.cancelReason
                            ? ` · Reason: ${activeSession.cancelReason}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="w-56"
                          placeholder="Session topic..."
                          value={sessionTopic}
                          onChange={(e) => setSessionTopic(e.target.value)}
                          disabled={activeSession.isCancelled}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            activeSession.isCancelled ||
                            updateSessionMutation.isPending
                          }
                          onClick={() =>
                            updateSessionMutation.mutate({
                              sessionId: activeSession.id,
                              topic: sessionTopic,
                            })
                          }
                        >
                          Save Topic
                        </Button>
                        {activeSession.isCancelled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateSessionMutation.mutate({
                                sessionId: activeSession.id,
                                action: "reopen",
                              })
                            }
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reopen Session
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setCancelConfirmSession(activeSession)
                              setCancelReasonInput("")
                            }}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Cancel Session
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Session Live Summary */}
                    {activeSession.summary && (
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">
                            Enrolled
                          </div>
                          <div className="text-xl font-bold">
                            {activeSession.summary.totalEnrolled}
                          </div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">
                            Present
                          </div>
                          <div className="text-xl font-bold text-green-600">
                            {activeSession.summary.present}
                          </div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">
                            Absent
                          </div>
                          <div className="text-xl font-bold text-red-600">
                            {activeSession.summary.absent}
                          </div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">
                            Late
                          </div>
                          <div className="text-xl font-bold text-orange-600">
                            {activeSession.summary.late}
                          </div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">
                            Excused / OD
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {activeSession.summary.excused +
                              activeSession.summary.onDuty}
                          </div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">
                            Session %
                          </div>
                          <div className="text-xl font-bold">
                            {activeSession.summary.attendancePercentage}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bulk Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            activeSession.isCancelled ||
                            markAttendanceMutation.isPending
                          }
                          onClick={() => handleBulkStatus("PRESENT")}
                        >
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                          Mark All Present
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            activeSession.isCancelled ||
                            markAttendanceMutation.isPending
                          }
                          onClick={() => handleBulkStatus("ABSENT")}
                        >
                          <XCircle className="mr-2 h-4 w-4 text-red-600" />
                          Mark All Absent
                        </Button>
                      </div>

                      <Button
                        disabled={
                          activeSession.isCancelled ||
                          markAttendanceMutation.isPending
                        }
                        onClick={handleSaveAllAttendance}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {markAttendanceMutation.isPending
                          ? "Saving Attendance..."
                          : "Save Attendance"}
                      </Button>
                    </div>

                    {/* Student Roster Table */}
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Current Status</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead className="text-right">
                              Mark / Update Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(activeSession.roster || []).length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-8 text-muted-foreground"
                              >
                                No students enrolled in this class yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            (activeSession.roster || []).map((student) => {
                              const currentStatus =
                                draftStatuses[student.userId]?.status ||
                                student.status
                              const currentRemarks =
                                draftStatuses[student.userId]?.remarks ??
                                (student.remarks || "")

                              return (
                                <TableRow key={student.userId}>
                                  <TableCell className="font-medium">
                                    <div>
                                      {student.firstName} {student.lastName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {student.email}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {student.studentId || "N/A"}
                                  </TableCell>
                                  <TableCell>
                                    {currentStatus ? (
                                      <Badge
                                        variant={
                                          currentStatus === "PRESENT"
                                            ? "success"
                                            : currentStatus === "ABSENT"
                                              ? "destructive"
                                              : currentStatus === "LATE"
                                                ? "warning"
                                                : "outline"
                                        }
                                      >
                                        {currentStatus}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        UNMARKED
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="w-44 h-8 text-xs"
                                      placeholder="Optional remarks..."
                                      disabled={activeSession.isCancelled}
                                      value={currentRemarks}
                                      onChange={(e) =>
                                        setDraftStatuses((prev) => ({
                                          ...prev,
                                          [student.userId]: {
                                            status:
                                              prev[student.userId]?.status ||
                                              student.status ||
                                              "PRESENT",
                                            remarks: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 flex-wrap">
                                      {(
                                        [
                                          ["PRESENT", "Present"],
                                          ["ABSENT", "Absent"],
                                          ["LATE", "Late"],
                                          ["EXCUSED", "Excused"],
                                          ["ON_DUTY", "On Duty"],
                                        ] as [AttendanceStatusType, string][]
                                      ).map(([stKey, label]) => (
                                        <Button
                                          key={stKey}
                                          size="sm"
                                          variant={
                                            currentStatus === stKey
                                              ? stKey === "ABSENT"
                                                ? "destructive"
                                                : "default"
                                              : "outline"
                                          }
                                          disabled={activeSession.isCancelled}
                                          onClick={() =>
                                            handleSingleStudentStatus(
                                              student.userId,
                                              stKey
                                            )
                                          }
                                        >
                                          {label}
                                        </Button>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Individual Attendance Record Dialog */}
      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  Changes to attendance records are persisted and logged for audit purposes.
                </span>
              </div>
              <div className="space-y-1">
                <Label>Student</Label>
                <p className="text-sm font-medium">{editingEntry.studentName}</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingEntry.status}
                  onValueChange={(v) =>
                    setEditingEntry({
                      ...editingEntry,
                      status: v as AttendanceStatusType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="EXCUSED">Excused</SelectItem>
                    <SelectItem value="ON_DUTY">On Duty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  value={editingEntry.remarks}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      remarks: e.target.value,
                    })
                  }
                  placeholder="Reason for change (optional)"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingEntry(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={editAttendanceMutation.isPending}
                  onClick={() =>
                    editAttendanceMutation.mutate({
                      recordId: editingEntry.recordId,
                      sessionId: editingEntry.sessionId,
                      userId: editingEntry.userId,
                      status: editingEntry.status,
                      remarks: editingEntry.remarks || undefined,
                    })
                  }
                >
                  {editAttendanceMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Session Confirmation Dialog */}
      <Dialog
        open={!!cancelConfirmSession}
        onOpenChange={(open) => !open && setCancelConfirmSession(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Attendance Session</DialogTitle>
          </DialogHeader>
          {cancelConfirmSession && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to cancel the attendance session for{" "}
                <strong>
                  {cancelConfirmSession.subject?.code} -{" "}
                  {cancelConfirmSession.subject?.name}
                </strong>{" "}
                on {toYmdString(cancelConfirmSession.date)} (Period{" "}
                {cancelConfirmSession.period})? Cancelled sessions are excluded from student attendance percentage penalties.
              </p>
              <div className="space-y-2">
                <Label>Cancellation Reason</Label>
                <Input
                  placeholder="e.g., Faculty seminar / Holiday reschedule"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCancelConfirmSession(null)}
                >
                  Keep Session Active
                </Button>
                <Button
                  variant="destructive"
                  disabled={updateSessionMutation.isPending}
                  onClick={() =>
                    updateSessionMutation.mutate({
                      sessionId: cancelConfirmSession.id,
                      action: "cancel",
                      cancelReason:
                        cancelReasonInput || "Cancelled by instructor",
                    })
                  }
                >
                  {updateSessionMutation.isPending
                    ? "Cancelling..."
                    : "Confirm Cancel Session"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
