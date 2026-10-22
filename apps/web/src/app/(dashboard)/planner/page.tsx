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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import {
  Plus,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  BookOpen,
  Video,
  Users,
  MapPin,
  Edit,
  Ban,
  Trash2,
  ExternalLink,
  RotateCcw,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface MeetingParticipant {
  userId?: string | null
  email: string
  name: string
  role: string
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE"
}

interface PlannerEvent {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  allDay: boolean
  eventType: string
  subjectId?: string | null
  subject?: { id: string; name: string; code: string } | null
  status?: "SCHEDULED" | "CANCELLED" | "COMPLETED"
  isCancelled?: boolean
  cancelReason?: string | null
  meetingLink?: string | null
  location?: string | null
  agenda?: string | null
  notes?: string | null
  includeClassStudents?: boolean
  organizer?: { id: string; name: string; email: string; role: string }
  participants?: MeetingParticipant[]
  participantCount?: number
  canManage?: boolean
  isMeeting?: boolean
}

interface PlannerTask {
  id: string
  title: string
  description: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  dueDate: string | null
  estimatedMinutes: number | null
  actualMinutes: number | null
  subject: { id: string; name: string; code: string } | null
  tags: string[]
}

function toLocalDateTimeInput(isoOrDate?: string | Date): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date()
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PlannerPage() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date())
  const [activeTab, setActiveTab] = React.useState("meetings")
  const [meetingFilter, setMeetingFilter] = React.useState<
    "ALL" | "SCHEDULED" | "CANCELLED"
  >("ALL")

  // Create / Edit Meeting Dialog state
  const [showMeetingDialog, setShowMeetingDialog] = React.useState(false)
  const [editingMeeting, setEditingMeeting] = React.useState<PlannerEvent | null>(
    null
  )
  const [meetingForm, setMeetingForm] = React.useState({
    title: "",
    eventType: "MEETING",
    subjectId: "NONE",
    startTime: toLocalDateTimeInput(new Date(Date.now() + 3600 * 1000)),
    endTime: toLocalDateTimeInput(new Date(Date.now() + 7200 * 1000)),
    meetingLink: "",
    location: "",
    agenda: "",
    includeClassStudents: true,
    participantEmailsText: "",
  })

  // Cancel Meeting Confirmation Dialog state
  const [cancellingMeeting, setCancellingMeeting] =
    React.useState<PlannerEvent | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")

  // View Meeting Details Dialog state
  const [viewingMeeting, setViewingMeeting] =
    React.useState<PlannerEvent | null>(null)

  // Task creation state
  const [showTaskDialog, setShowTaskDialog] = React.useState(false)
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    estimatedMinutes: "45",
  })

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

  const { data: eventsData } = useQuery({
    queryKey: ["planner", "events"],
    queryFn: async () => {
      const res = await fetch("/api/planner/events")
      if (!res.ok) throw new Error("Failed to fetch events")
      return res.json()
    },
  })

  const { data: tasksData } = useQuery({
    queryKey: ["planner", "tasks"],
    queryFn: async () => {
      const res = await fetch("/api/planner/tasks")
      if (!res.ok) throw new Error("Failed to fetch tasks")
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

  const allEvents: PlannerEvent[] = eventsData?.events || []
  const allMeetings: PlannerEvent[] =
    eventsData?.meetings ||
    allEvents.filter((e) =>
      ["MEETING", "OFFICE_HOURS", "CLASS"].includes(e.eventType)
    )
  const allTasks: PlannerTask[] = tasksData?.tasks || []
  const subjectsList = subjectsData?.subjects || []

  const filteredMeetings = allMeetings.filter((m) => {
    if (meetingFilter === "SCHEDULED") return !m.isCancelled
    if (meetingFilter === "CANCELLED") return Boolean(m.isCancelled)
    return true
  })

  const openCreateMeetingDialog = () => {
    setEditingMeeting(null)
    const start = new Date(Date.now() + 3600 * 1000)
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 3600 * 1000)
    setMeetingForm({
      title: "",
      eventType: isTeacher ? "MEETING" : "STUDY_SESSION",
      subjectId: subjectsList[0]?.id || "NONE",
      startTime: toLocalDateTimeInput(start),
      endTime: toLocalDateTimeInput(end),
      meetingLink: "",
      location: "",
      agenda: "",
      includeClassStudents: isTeacher,
      participantEmailsText: "",
    })
    setShowMeetingDialog(true)
  }

  const openEditMeetingDialog = (meeting: PlannerEvent) => {
    setEditingMeeting(meeting)
    setMeetingForm({
      title: meeting.title,
      eventType: meeting.eventType || "MEETING",
      subjectId: meeting.subjectId || meeting.subject?.id || "NONE",
      startTime: toLocalDateTimeInput(meeting.startTime),
      endTime: toLocalDateTimeInput(meeting.endTime),
      meetingLink: meeting.meetingLink || "",
      location: meeting.location || "",
      agenda: meeting.agenda || meeting.description || "",
      includeClassStudents: Boolean(meeting.includeClassStudents),
      participantEmailsText: (meeting.participants || [])
        .map((p) => p.email)
        .filter(Boolean)
        .join(", "),
    })
    setShowMeetingDialog(true)
  }

  const saveMeetingMutation = useMutation({
    mutationFn: async () => {
      if (!meetingForm.title.trim()) {
        throw new Error("Meeting title is required")
      }
      const start = new Date(meetingForm.startTime)
      const end = new Date(meetingForm.endTime)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Valid start and end times are required")
      }
      if (end <= start) {
        throw new Error("End time must be after start time")
      }

      const participantEmails = meetingForm.participantEmailsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)

      const payload = {
        title: meetingForm.title.trim(),
        eventType: meetingForm.eventType,
        subjectId:
          meetingForm.subjectId !== "NONE" ? meetingForm.subjectId : null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        meetingLink: meetingForm.meetingLink.trim() || null,
        location: meetingForm.location.trim() || null,
        agenda: meetingForm.agenda.trim() || null,
        description: meetingForm.agenda.trim() || null,
        includeClassStudents: meetingForm.includeClassStudents,
        participantEmails,
      }

      const url = editingMeeting
        ? `/api/planner/events/${editingMeeting.id}`
        : "/api/planner/events"
      const method = editingMeeting ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to save meeting")
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner", "events"] })
      setShowMeetingDialog(false)
      setEditingMeeting(null)
      toast({
        title: editingMeeting
          ? "Meeting updated successfully"
          : "Meeting scheduled successfully",
      })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const updateMeetingActionMutation = useMutation({
    mutationFn: async (data: {
      id: string
      action?: "cancel" | "reopen" | "rsvp"
      cancelReason?: string
      rsvpStatus?: string
    }) => {
      const res = await fetch(`/api/planner/events/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update meeting")
      }
      return payload
    },
    onSuccess: (payload, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planner", "events"] })
      setCancellingMeeting(null)
      setCancelReason("")
      if (viewingMeeting && payload.event) {
        setViewingMeeting(payload.event)
      }
      toast({
        title:
          variables.action === "cancel"
            ? "Meeting cancelled"
            : variables.action === "reopen"
              ? "Meeting reopened"
              : "RSVP updated",
      })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/planner/events/${id}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete meeting")
      }
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner", "events"] })
      setViewingMeeting(null)
      toast({ title: "Meeting deleted" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/planner/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description || null,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null,
          estimatedMinutes: Number(taskForm.estimatedMinutes) || 45,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create task")
      }
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner", "tasks"] })
      setShowTaskDialog(false)
      setTaskForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: "",
        estimatedMinutes: "45",
      })
      toast({ title: "Task created" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: PlannerTask) => {
      const nextStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED"
      const res = await fetch("/api/planner/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      })
      if (!res.ok) throw new Error("Failed to update task")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner", "tasks"] })
    },
  })

  const eventsOnSelectedDate = allEvents.filter(
    (e) =>
      new Date(e.startTime).toDateString() === selectedDate.toDateString()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isTeacher ? "Teacher Meetings & Planner" : "Smart Planner"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? "Schedule and manage classroom meetings, office hours, participants, and academic schedules"
              : "View class meetings, office hours, and manage your academic schedule"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowTaskDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
          <Button onClick={openCreateMeetingDialog}>
            <Video className="mr-2 h-4 w-4" />
            {isTeacher ? "Schedule Meeting" : "Add Study Event"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="meetings">
            Meetings ({allMeetings.length})
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({allTasks.length})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={meetingFilter === "ALL" ? "default" : "outline"}
                onClick={() => setMeetingFilter("ALL")}
              >
                All ({allMeetings.length})
              </Button>
              <Button
                size="sm"
                variant={meetingFilter === "SCHEDULED" ? "default" : "outline"}
                onClick={() => setMeetingFilter("SCHEDULED")}
              >
                Scheduled ({allMeetings.filter((m) => !m.isCancelled).length})
              </Button>
              <Button
                size="sm"
                variant={meetingFilter === "CANCELLED" ? "default" : "outline"}
                onClick={() => setMeetingFilter("CANCELLED")}
              >
                Cancelled ({allMeetings.filter((m) => m.isCancelled).length})
              </Button>
            </div>
            {isTeacher && (
              <Button size="sm" onClick={openCreateMeetingDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Teacher Meeting
              </Button>
            )}
          </div>

          {filteredMeetings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Video className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No meetings found for the selected filter.
                </p>
                {isTeacher && (
                  <Button variant="outline" onClick={openCreateMeetingDialog}>
                    Schedule Your First Meeting
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMeetings.map((meeting) => (
                <Card
                  key={meeting.id}
                  className={meeting.isCancelled ? "opacity-75 border-dashed" : ""}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">
                            {meeting.title}
                          </CardTitle>
                          <Badge variant="outline">{meeting.eventType}</Badge>
                          {meeting.isCancelled ? (
                            <Badge variant="destructive">Cancelled</Badge>
                          ) : (
                            <Badge variant="success">Scheduled</Badge>
                          )}
                        </div>
                        {meeting.subject && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {meeting.subject.code} - {meeting.subject.name}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingMeeting(meeting)}
                      >
                        Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        {formatDate(meeting.startTime)}{" "}
                        {new Date(meeting.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        –{" "}
                        {new Date(meeting.endTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {meeting.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{meeting.location}</span>
                      </div>
                    )}

                    {meeting.meetingLink && !meeting.isCancelled && (
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-primary shrink-0" />
                        <a
                          href={meeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline flex items-center gap-1 font-medium"
                        >
                          Join Meeting Link
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {meeting.agenda && (
                      <p className="text-muted-foreground line-clamp-2">
                        {meeting.agenda}
                      </p>
                    )}

                    {meeting.isCancelled && meeting.cancelReason && (
                      <p className="text-xs text-destructive">
                        Cancellation reason: {meeting.cancelReason}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {meeting.participantCount ??
                            (meeting.participants?.length || 0)}{" "}
                          participant(s)
                        </span>
                        {meeting.organizer && (
                          <span>· Org: {meeting.organizer.name}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {meeting.canManage ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditMeetingDialog(meeting)}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            {meeting.isCancelled ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateMeetingActionMutation.mutate({
                                    id: meeting.id,
                                    action: "reopen",
                                  })
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Reopen
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setCancellingMeeting(meeting)
                                  setCancelReason("")
                                }}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </>
                        ) : (
                          !meeting.isCancelled && (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateMeetingActionMutation.mutate({
                                    id: meeting.id,
                                    action: "rsvp",
                                    rsvpStatus: "ACCEPTED",
                                  })
                                }
                              >
                                Accept
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateMeetingActionMutation.mutate({
                                    id: meeting.id,
                                    action: "rsvp",
                                    rsvpStatus: "DECLINED",
                                  })
                                }
                              >
                                Decline
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  Events for {formatDate(selectedDate)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eventsOnSelectedDate.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No events scheduled for this day.
                    </p>
                  ) : (
                    eventsOnSelectedDate.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 border rounded-lg"
                      >
                        <div className="p-2 bg-primary/10 rounded">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{event.title}</p>
                            <div className="flex items-center gap-2">
                              {event.isCancelled && (
                                <Badge variant="destructive">Cancelled</Badge>
                              )}
                              <Badge variant="outline">{event.eventType}</Badge>
                            </div>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span>
                              {new Date(event.startTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              -{" "}
                              {new Date(event.endTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {event.subject && (
                              <span>{event.subject.code}</span>
                            )}
                            {event.meetingLink && !event.isCancelled && (
                              <a
                                href={event.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                              >
                                Join Link
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">My Tasks</h2>
              <Button size="sm" onClick={() => setShowTaskDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allTasks.length === 0 ? (
                <Card className="md:col-span-3">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No tasks created yet.
                  </CardContent>
                </Card>
              ) : (
                allTasks.map((task) => (
                  <Card key={task.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleTaskMutation.mutate(task)}
                            className="text-left"
                          >
                            {task.status === "COMPLETED" ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <Clock className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <CardTitle
                            className={`text-lg ${
                              task.status === "COMPLETED"
                                ? "line-through text-muted-foreground"
                                : ""
                            }`}
                          >
                            {task.title}
                          </CardTitle>
                        </div>
                        <Badge
                          variant={
                            task.priority === "URGENT"
                              ? "destructive"
                              : task.priority === "HIGH"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {task.dueDate && (
                          <span>Due: {formatDate(task.dueDate)}</span>
                        )}
                        {task.estimatedMinutes && (
                          <span>~{task.estimatedMinutes} min</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {allEvents.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">
                    No upcoming scheduled events.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <span>{ev.title}</span>
                          <Badge variant="outline">{ev.eventType}</Badge>
                          {ev.isCancelled && (
                            <Badge variant="destructive">Cancelled</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(ev.startTime)} ·{" "}
                          {new Date(ev.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          –{" "}
                          {new Date(ev.endTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {ev.subject ? ` · ${ev.subject.code}` : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingMeeting(ev)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMeeting
                ? "Update Meeting Details"
                : isTeacher
                  ? "Schedule Teacher / Classroom Meeting"
                  : "Schedule Study Event"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g., CS301 Doubt Clearing & Project Review"
                value={meetingForm.title}
                onChange={(e) =>
                  setMeetingForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={meetingForm.eventType}
                  onValueChange={(v) =>
                    setMeetingForm((prev) => ({ ...prev, eventType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isTeacher && (
                      <>
                        <SelectItem value="MEETING">Teacher Meeting</SelectItem>
                        <SelectItem value="OFFICE_HOURS">
                          Office Hours
                        </SelectItem>
                        <SelectItem value="CLASS">Class Session</SelectItem>
                      </>
                    )}
                    <SelectItem value="STUDY_SESSION">Study Session</SelectItem>
                    <SelectItem value="DEADLINE">Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Class / Subject (Optional)</Label>
                <Select
                  value={meetingForm.subjectId}
                  onValueChange={(v) =>
                    setMeetingForm((prev) => ({ ...prev, subjectId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">General / No Subject</SelectItem>
                    {subjectsList.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={meetingForm.startTime}
                  onChange={(e) =>
                    setMeetingForm((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={meetingForm.endTime}
                  onChange={(e) =>
                    setMeetingForm((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Meeting Link URL (Optional)</Label>
                <Input
                  placeholder="https://meet.example.edu/cs301"
                  value={meetingForm.meetingLink}
                  onChange={(e) =>
                    setMeetingForm((prev) => ({
                      ...prev,
                      meetingLink: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Location / Room (Optional)</Label>
                <Input
                  placeholder="e.g., Room 302, CS Block"
                  value={meetingForm.location}
                  onChange={(e) =>
                    setMeetingForm((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {isTeacher && (
              <>
                {meetingForm.subjectId !== "NONE" && (
                  <div className="flex items-center gap-2">
                    <input
                      id="includeClassStudents"
                      type="checkbox"
                      checked={meetingForm.includeClassStudents}
                      onChange={(e) =>
                        setMeetingForm((prev) => ({
                          ...prev,
                          includeClassStudents: e.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="includeClassStudents">
                      Automatically invite all active enrolled students in this class
                    </Label>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    Additional Participant Emails (comma-separated, optional)
                  </Label>
                  <Input
                    placeholder="student1@university.edu, colleague@university.edu"
                    value={meetingForm.participantEmailsText}
                    onChange={(e) =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        participantEmailsText: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Agenda / Description</Label>
              <textarea
                className="w-full p-2 border rounded-md min-h-[80px] text-sm"
                placeholder="Topics to cover, preparation notes, or meeting agenda..."
                value={meetingForm.agenda}
                onChange={(e) =>
                  setMeetingForm((prev) => ({
                    ...prev,
                    agenda: e.target.value,
                  }))
                }
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowMeetingDialog(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={saveMeetingMutation.isPending}
                onClick={() => saveMeetingMutation.mutate()}
              >
                {saveMeetingMutation.isPending
                  ? "Saving..."
                  : editingMeeting
                    ? "Save Changes"
                    : "Schedule Meeting"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Meeting Details Dialog */}
      <Dialog
        open={!!viewingMeeting}
        onOpenChange={(open) => !open && setViewingMeeting(null)}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingMeeting?.title}</DialogTitle>
          </DialogHeader>
          {viewingMeeting && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{viewingMeeting.eventType}</Badge>
                {viewingMeeting.isCancelled ? (
                  <Badge variant="destructive">Cancelled</Badge>
                ) : (
                  <Badge variant="success">Scheduled</Badge>
                )}
                {viewingMeeting.subject && (
                  <Badge variant="secondary">
                    {viewingMeeting.subject.code}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <p className="font-medium">Schedule</p>
                <p className="text-muted-foreground">
                  {formatDate(viewingMeeting.startTime)} ·{" "}
                  {new Date(viewingMeeting.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(viewingMeeting.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {viewingMeeting.location && (
                <div className="space-y-1">
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">
                    {viewingMeeting.location}
                  </p>
                </div>
              )}

              {viewingMeeting.meetingLink && (
                <div className="space-y-1">
                  <p className="font-medium">Meeting Link</p>
                  <a
                    href={viewingMeeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline break-all"
                  >
                    {viewingMeeting.meetingLink}
                  </a>
                </div>
              )}

              {viewingMeeting.agenda && (
                <div className="space-y-1">
                  <p className="font-medium">Agenda / Notes</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {viewingMeeting.agenda}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="font-medium">
                  Participants ({viewingMeeting.participants?.length || 0})
                </p>
                {!viewingMeeting.participants ||
                viewingMeeting.participants.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No specific participants listed.
                  </p>
                ) : (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {viewingMeeting.participants.map((p, idx) => (
                      <div
                        key={p.userId || p.email || idx}
                        className="flex items-center justify-between p-2 text-xs"
                      >
                        <div>
                          <span className="font-medium">{p.name}</span>
                          {p.email && (
                            <span className="text-muted-foreground ml-1">
                              ({p.email})
                            </span>
                          )}
                        </div>
                        <Badge variant="outline">{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex justify-between sm:justify-between">
                {viewingMeeting.canManage ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteMeetingMutation.isPending}
                    onClick={() => deleteMeetingMutation.mutate(viewingMeeting.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Meeting
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  variant="outline"
                  onClick={() => setViewingMeeting(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Meeting Confirmation Dialog */}
      <Dialog
        open={!!cancellingMeeting}
        onOpenChange={(open) => !open && setCancellingMeeting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Meeting</DialogTitle>
          </DialogHeader>
          {cancellingMeeting && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to cancel{" "}
                <strong>{cancellingMeeting.title}</strong>? Participants will see this meeting marked as cancelled.
              </p>
              <div className="space-y-2">
                <Label>Reason for Cancellation</Label>
                <Input
                  placeholder="e.g., Rescheduled to Friday afternoon"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCancellingMeeting(null)}
                >
                  Keep Scheduled
                </Button>
                <Button
                  variant="destructive"
                  disabled={updateMeetingActionMutation.isPending}
                  onClick={() =>
                    updateMeetingActionMutation.mutate({
                      id: cancellingMeeting.id,
                      action: "cancel",
                      cancelReason: cancelReason || "Cancelled by organizer",
                    })
                  }
                >
                  {updateMeetingActionMutation.isPending
                    ? "Cancelling..."
                    : "Confirm Cancel Meeting"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input
                placeholder="e.g., Prepare midterm grading rubric"
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={taskForm.priority}
                onValueChange={(v) =>
                  setTaskForm((prev) => ({ ...prev, priority: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowTaskDialog(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!taskForm.title.trim() || createTaskMutation.isPending}
                onClick={() => createTaskMutation.mutate()}
              >
                Create Task
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
