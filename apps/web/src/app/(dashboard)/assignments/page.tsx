"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertCircle, FileText, Upload, Loader2, Plus, CheckCircle } from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Assignment {
  id: string
  subjectId: string
  title: string
  description: string | null
  instructions: string | null
  maxMarks: number
  weight: number
  assignedDate: string
  dueDate: string
  allowedFormats: string[]
  allowResubmission: boolean
  maxSubmissions: number
  isPublished: boolean
  subject: { id: string; name: string; code: string }
  _count: { submissions: number }
}

interface Submission {
  id: string
  assignmentId: string
  userId: string
  status: string
  submissionNumber: number
  content: string | null
  submittedAt: string | null
  gradedAt: string | null
  marksObtained: number | null
  feedback: string | null
  user?: { id: string; firstName: string; lastName: string; email?: string }
  attachments: { id: string; fileName: string; storagePath: string }[]
}

export default function AssignmentsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("my-assignments")
  const [selectedAssignment, setSelectedAssignment] = React.useState<string | null>(null)
  const [submissionContent, setSubmissionContent] = React.useState("")
  const [submissionFiles, setSubmissionFiles] = React.useState<File[]>([])
  const [showResubmitForm, setShowResubmitForm] = React.useState(false)

  // Teacher Create Assignment dialog state
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  const [newAssignment, setNewAssignment] = React.useState({
    subjectId: "",
    title: "",
    description: "",
    instructions: "",
    maxMarks: "100",
    weight: "1",
    dueDate: new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10),
  })

  // Teacher Grade Submission state
  const [gradingDrafts, setGradingDrafts] = React.useState<
    Record<string, { marks: string; feedback: string }>
  >({})

  const { data: userData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile")
      if (!res.ok) throw new Error("Failed to fetch profile")
      return res.json()
    },
  })

  const isTeacher = ["LECTURER", "PROJECT_MENTOR", "ADMIN"].includes(
    userData?.user?.role || ""
  )

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", "my"],
    queryFn: async () => {
      const res = await fetch("/api/subjects/my")
      if (!res.ok) return { subjects: [] }
      return res.json()
    },
    enabled: isTeacher,
  })

  const {
    data: assignmentsData,
    isLoading: isLoadingAssignments,
    isError: isAssignmentsError,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["assignments", "my"],
    queryFn: async () => {
      const res = await fetch("/api/assignments/my")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch assignments")
      }
      return res.json()
    },
  })

  const assignmentsList: Assignment[] = Array.isArray(assignmentsData)
    ? assignmentsData
    : assignmentsData?.assignments || []

  const {
    data: submissionsData,
    isLoading: isLoadingSubmissions,
    isError: isSubmissionsError,
    error: submissionsError,
  } = useQuery({
    queryKey: ["assignment-submissions", selectedAssignment],
    queryFn: async () => {
      if (!selectedAssignment) return { submissions: [] }
      const res = await fetch(`/api/assignments/${selectedAssignment}/submissions`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch submissions")
      }
      return res.json()
    },
    enabled: !!selectedAssignment,
  })

  const submissionsList: Submission[] = Array.isArray(submissionsData)
    ? submissionsData
    : submissionsData?.submissions || []

  const createAssignmentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/assignments/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: newAssignment.subjectId,
          title: newAssignment.title,
          description: newAssignment.description || null,
          instructions: newAssignment.instructions || null,
          maxMarks: Number(newAssignment.maxMarks) || 100,
          weight: Number(newAssignment.weight) || 1,
          dueDate: new Date(newAssignment.dueDate).toISOString(),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create assignment")
      }
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", "my"] })
      setShowCreateDialog(false)
      toast({ title: "Assignment created successfully" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const gradeSubmissionMutation = useMutation({
    mutationFn: async (data: {
      assignmentId: string
      submissionId: string
      marksObtained: number
      feedback: string
    }) => {
      const res = await fetch(
        `/api/assignments/${data.assignmentId}/submissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: data.submissionId,
            marksObtained: data.marksObtained,
            feedback: data.feedback,
          }),
        }
      )
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || "Failed to grade submission")
      }
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assignment-submissions", selectedAssignment],
      })
      queryClient.invalidateQueries({ queryKey: ["assignments", "my"] })
      toast({ title: "Submission graded and saved" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const submitAssignment = useMutation({
    mutationFn: async (data: { assignmentId: string; content: string; files: File[] }) => {
      const formData = new FormData()
      formData.append("assignmentId", data.assignmentId)
      formData.append("content", data.content)
      data.files.forEach((f) => formData.append("files", f))

      const res = await fetch("/api/assignments/submit", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to submit assignment")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", selectedAssignment] })
      queryClient.invalidateQueries({ queryKey: ["assignments", "my"] })
      setSubmissionContent("")
      setSubmissionFiles([])
      setShowResubmitForm(false)
      toast({ title: "Assignment submitted successfully" })
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit assignment",
        variant: "destructive",
      }),
  })

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment) return
    if (!submissionContent.trim() && submissionFiles.length === 0) {
      toast({
        title: "Submission required",
        description: "Please enter your response or attach at least one file before submitting.",
        variant: "destructive",
      })
      return
    }
    submitAssignment.mutate({
      assignmentId: selectedAssignment,
      content: submissionContent.trim(),
      files: submissionFiles,
    })
  }

  const activeAssignmentObj = assignmentsList.find((a) => a.id === selectedAssignment)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? "Create coursework assignments and evaluate student submissions"
              : "Manage your coursework and submissions"}
          </p>
        </div>
        {isTeacher && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Assignment
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my-assignments">
            {isTeacher ? "Class Assignments" : "My Assignments"}
          </TabsTrigger>
          <TabsTrigger value="submissions">
            {isTeacher ? "Student Submissions & Grading" : "My Submissions"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-assignments" className="mt-4">
          {isLoadingAssignments ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading assignments...</span>
              </CardContent>
            </Card>
          ) : isAssignmentsError ? (
            <Card className="border-destructive">
              <CardContent className="py-8 flex items-center justify-between">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>
                    {assignmentsError instanceof Error
                      ? assignmentsError.message
                      : "Failed to load assignments"}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchAssignments()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : assignmentsList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No assignments found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assignmentsList.map((assignment: Assignment) => {
                const isOverdue = new Date(assignment.dueDate) < new Date()
                const isSubmitted = (assignment._count?.submissions || 0) > 0

                return (
                  <Card key={assignment.id} className={isOverdue && !isSubmitted && !isTeacher ? "border-red-200" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{assignment.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {assignment.subject?.code} - {assignment.subject?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            isTeacher
                              ? "outline"
                              : isOverdue && !isSubmitted
                                ? "destructive"
                                : isSubmitted
                                  ? "success"
                                  : "warning"
                          }
                        >
                          {isTeacher
                            ? `${assignment._count?.submissions || 0} submission(s)`
                            : isOverdue && !isSubmitted
                              ? "Overdue"
                              : isSubmitted
                                ? "Submitted"
                                : "Pending"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {assignment.description && (
                          <p className="text-sm text-muted-foreground">{assignment.description}</p>
                        )}
                        {assignment.instructions && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="font-medium text-sm">Instructions:</p>
                            <p className="text-sm text-muted-foreground mt-1">{assignment.instructions}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Max: {assignment.maxMarks} marks</span>
                          <span>•</span>
                          <span>Weight: {assignment.weight}x</span>
                          <span>•</span>
                          <span>Due: {formatDate(assignment.dueDate)}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setSelectedAssignment(assignment.id)
                              setActiveTab("submissions")
                            }}
                          >
                            {isTeacher
                              ? "Review & Grade Submissions"
                              : isSubmitted
                                ? "View Submission"
                                : "Submit Assignment"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          {selectedAssignment ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Submissions for {activeAssignmentObj?.title || "Assignment"}
                </h2>
              </div>
              <Card>
                <CardContent className="pt-6">
                  {isLoadingSubmissions ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading submissions...</span>
                    </div>
                  ) : isSubmissionsError ? (
                    <div className="py-8 text-center text-destructive">
                      {submissionsError instanceof Error
                        ? submissionsError.message
                        : "Failed to load submissions"}
                    </div>
                  ) : isTeacher ? (
                    submissionsList.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        No student submissions received for this assignment yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {submissionsList.map((submission: Submission) => {
                          const draft = gradingDrafts[submission.id] || {
                            marks:
                              submission.marksObtained !== null
                                ? String(submission.marksObtained)
                                : "",
                            feedback: submission.feedback || "",
                          }

                          return (
                            <div
                              key={submission.id}
                              className="border rounded-lg p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {submission.user?.firstName}{" "}
                                    {submission.user?.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Attempt {submission.submissionNumber} ·{" "}
                                    {submission.submittedAt
                                      ? formatRelativeTime(submission.submittedAt)
                                      : "Draft"}
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    submission.status === "EVALUATED"
                                      ? "success"
                                      : "default"
                                  }
                                >
                                  {submission.status}
                                </Badge>
                              </div>

                              {submission.content && (
                                <div className="p-3 bg-muted/40 rounded text-sm whitespace-pre-wrap">
                                  {submission.content}
                                </div>
                              )}

                              {submission.attachments &&
                                submission.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {submission.attachments.map((att) => (
                                      <Badge key={att.id} variant="outline">
                                        {att.fileName}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                              <div className="grid gap-3 md:grid-cols-4 pt-2 border-t items-end">
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Marks (Max{" "}
                                    {activeAssignmentObj?.maxMarks || 100})
                                  </Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={activeAssignmentObj?.maxMarks || 100}
                                    value={draft.marks}
                                    onChange={(e) =>
                                      setGradingDrafts((prev) => ({
                                        ...prev,
                                        [submission.id]: {
                                          ...draft,
                                          marks: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label className="text-xs">Feedback</Label>
                                  <Input
                                    placeholder="Instructor feedback..."
                                    value={draft.feedback}
                                    onChange={(e) =>
                                      setGradingDrafts((prev) => ({
                                        ...prev,
                                        [submission.id]: {
                                          ...draft,
                                          feedback: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <Button
                                  disabled={gradeSubmissionMutation.isPending}
                                  onClick={() =>
                                    gradeSubmissionMutation.mutate({
                                      assignmentId: selectedAssignment,
                                      submissionId: submission.id,
                                      marksObtained: Number(draft.marks) || 0,
                                      feedback: draft.feedback,
                                    })
                                  }
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Save Grade
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  ) : submissionsList.length === 0 || showResubmitForm ? (
                    <form onSubmit={handleSubmitForm} className="p-4 max-w-xl mx-auto space-y-4">
                      <div className="text-center">
                        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                        <p className="mt-2 font-medium">
                          {showResubmitForm ? "Resubmit Assignment" : "Submit Your Work"}
                        </p>
                      </div>
                      <Textarea
                        placeholder="Enter your written response or notes..."
                        value={submissionContent}
                        onChange={(e) => setSubmissionContent(e.target.value)}
                        rows={6}
                      />
                      <div className="space-y-2">
                        <Input
                          type="file"
                          multiple
                          onChange={(e) =>
                            setSubmissionFiles(e.target.files ? Array.from(e.target.files) : [])
                          }
                        />
                        {submissionFiles.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Attached: {submissionFiles.map((f) => f.name).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        {showResubmitForm && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowResubmitForm(false)}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button type="submit" disabled={submitAssignment.isPending}>
                          {submitAssignment.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Submit Assignment
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      {submissionsList.map((submission: Submission) => (
                        <div key={submission.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <Badge
                              variant={
                                submission.status === "SUBMITTED"
                                  ? "default"
                                  : submission.status === "LATE"
                                    ? "warning"
                                    : submission.status === "EVALUATED"
                                      ? "success"
                                      : "outline"
                              }
                            >
                              {submission.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Attempt {submission.submissionNumber} ·{" "}
                              {submission.submittedAt
                                ? formatRelativeTime(submission.submittedAt)
                                : "Draft"}
                            </span>
                          </div>
                          {submission.content && (
                            <div className="prose mb-4 whitespace-pre-wrap">{submission.content}</div>
                          )}
                          {submission.attachments && submission.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {submission.attachments.map((att) => (
                                <Badge key={att.id} variant="outline">
                                  {att.fileName}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {submission.marksObtained !== null && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="font-medium">
                                Grade: {submission.marksObtained} /{" "}
                                {activeAssignmentObj?.maxMarks || 100}
                              </p>
                              {submission.feedback && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {submission.feedback}
                                </p>
                              )}
                            </div>
                          )}
                          {submission.status !== "EVALUATED" &&
                            activeAssignmentObj?.allowResubmission && (
                              <Button
                                variant="outline"
                                className="mt-2"
                                onClick={() => setShowResubmitForm(true)}
                              >
                                Resubmit
                              </Button>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  Select an assignment to view or evaluate submissions
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Teacher Create Assignment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select
                value={newAssignment.subjectId}
                onValueChange={(v) =>
                  setNewAssignment((prev) => ({ ...prev, subjectId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {(subjectsData?.subjects || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g., Problem Set 3: Dynamic Programming"
                value={newAssignment.title}
                onChange={(e) =>
                  setNewAssignment((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Marks</Label>
                <Input
                  type="number"
                  min={1}
                  value={newAssignment.maxMarks}
                  onChange={(e) =>
                    setNewAssignment((prev) => ({
                      ...prev,
                      maxMarks: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newAssignment.dueDate}
                  onChange={(e) =>
                    setNewAssignment((prev) => ({
                      ...prev,
                      dueDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                rows={4}
                placeholder="Assignment instructions and grading criteria..."
                value={newAssignment.instructions}
                onChange={(e) =>
                  setNewAssignment((prev) => ({
                    ...prev,
                    instructions: e.target.value,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !newAssignment.subjectId ||
                  !newAssignment.title.trim() ||
                  createAssignmentMutation.isPending
                }
                onClick={() => createAssignmentMutation.mutate()}
              >
                {createAssignmentMutation.isPending
                  ? "Creating..."
                  : "Create Assignment"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
