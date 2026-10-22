"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, CheckCircle, AlertCircle, Calendar, BarChart, Edit, Eye, Trash2 } from "lucide-react"
import { formatDate, calculatePercentage } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Assessment {
  id: string
  subjectId: string
  semesterId: string
  name: string
  type: string
  maxMarks: number
  weight: number
  assessmentDate: string
  description: string | null
  isPublished: boolean
  publishedAt: string | null
  subject: { id: string; name: string; code: string }
  _count: { results: number }
}

interface AssessmentResult {
  id: string
  assessmentId: string
  userId: string
  marksObtained: number
  feedback: string | null
  gradedBy: string | null
  gradedAt: string | null
  isPublished: boolean
  user: { id: string; firstName: string; lastName: string; studentId: string | null; email: string }
}

interface AssessmentDetail extends Assessment {
  results: AssessmentResult[]
  roster?: AssessmentResult[]
}

export default function AssessmentsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("my-assessments")
  const [selectedAssessment, setSelectedAssessment] = React.useState<string | null>(null)
  const [showMarksDialog, setShowMarksDialog] = React.useState(false)
  const [marksInput, setMarksInput] = React.useState<Record<string, { marks: string; feedback: string }>>({})
  const [deletingAssessment, setDeletingAssessment] = React.useState<Assessment | null>(null)

  const { data: assessments } = useQuery({
    queryKey: ['assessments', 'my'],
    queryFn: async () => {
      const res = await fetch('/api/assessments/my')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: assessmentDetailData } = useQuery({
    queryKey: ['assessment-detail', selectedAssessment],
    queryFn: async () => {
      if (!selectedAssessment) return null
      const res = await fetch(`/api/assessments/${selectedAssessment}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedAssessment,
  })
  const assessmentDetail: AssessmentDetail | null = assessmentDetailData?.assessment || assessmentDetailData || null

  // Pre-fill marksInput when opening marks dialog
  React.useEffect(() => {
    if (showMarksDialog && assessmentDetail) {
      const entries = assessmentDetail.roster || assessmentDetail.results || []
      setMarksInput(
        Object.fromEntries(
          entries.map((r: any) => [
            r.userId,
            {
              marks: r.marksObtained !== undefined ? String(r.marksObtained) : '0',
              feedback: r.feedback || '',
            },
          ])
        )
      )
    }
  }, [showMarksDialog, assessmentDetail])

  const updateAssessmentMutation = useMutation({
    mutationFn: async (data: { id: string; isPublished?: boolean; results?: any[] }) => {
      const res = await fetch(`/api/assessments/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-detail', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['assessments', 'my'] })
      toast({ title: "Assessment updated successfully" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const deleteAssessmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assessments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to delete assessment')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments', 'my'] })
      setDeletingAssessment(null)
      toast({ title: "Assessment deleted" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const handlePublish = (assessmentId: string, isPublished: boolean) => {
    updateAssessmentMutation.mutate({ id: assessmentId, isPublished })
  }

  const handleSaveMarks = () => {
    if (!selectedAssessment || !assessmentDetail) return

    const results = Object.entries(marksInput).map(([userId, { marks, feedback }]) => ({
      userId,
      marksObtained: parseFloat(marks) || 0,
      feedback: feedback || null,
      isPublished: true,
    }))

    updateAssessmentMutation.mutate({
      id: selectedAssessment,
      results,
      isPublished: true,
    })
    setShowMarksDialog(false)
  }

  const handleMarksChange = (userId: string, field: 'marks' | 'feedback', value: string) => {
    setMarksInput(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }))
  }

  const { data: userData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const isLecturer =
    userData?.user?.role === 'LECTURER' ||
    userData?.user?.role === 'PROJECT_MENTOR' ||
    userData?.user?.role === 'ADMIN'

  const gradingRoster = assessmentDetail?.roster || assessmentDetail?.results || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground mt-1">Track and manage academic performance</p>
        </div>
        {isLecturer && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Assessment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Assessment</DialogTitle>
              </DialogHeader>
              <CreateAssessmentForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['assessments', 'my'] })} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my-assessments">My Assessments</TabsTrigger>
          {isLecturer && <TabsTrigger value="manage">Manage Assessments</TabsTrigger>}
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="my-assessments" className="mt-4">
          <div className="space-y-4">
            {assessments?.assessments?.map((assessment: Assessment) => (
              <Card key={assessment.id} onClick={() => setSelectedAssessment(assessment.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{assessment.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{assessment.subject.code} - {assessment.subject.name}</p>
                  </div>
                  <Badge variant={assessment.isPublished ? 'success' : 'outline'}>
                    {assessment.isPublished ? 'Published' : 'Pending'}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{assessment.type}</span>
                      <span>•</span>
                      <span>Max: {assessment.maxMarks} marks</span>
                      <span>•</span>
                      <span>Weight: {assessment.weight}x</span>
                      <span>•</span>
                      <span>{formatDate(assessment.assessmentDate)}</span>
                    </div>
                    {assessment.isPublished && (
                      <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); setSelectedAssessment(assessment.id); setActiveTab("results") }}>
                        View Result
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {isLecturer && (
          <TabsContent value="manage" className="mt-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Manage Assessments</h2>
              </div>

              <div className="space-y-4">
                {assessments?.assessments?.map((assessment: Assessment) => (
                  <Card key={assessment.id}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{assessment.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{assessment.subject.code} - {assessment.subject.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={assessment.isPublished ? 'success' : 'outline'}>
                          {assessment.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedAssessment(assessment.id); setActiveTab("results") }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingAssessment(assessment)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{assessment.type}</span>
                          <span>•</span>
                          <span>Max: {assessment.maxMarks} marks</span>
                          <span>•</span>
                          <span>Weight: {assessment.weight}x</span>
                          <span>•</span>
                          <span>{formatDate(assessment.assessmentDate)}</span>
                          <span>•</span>
                          <span>{assessment._count.results} graded</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={assessment.isPublished ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handlePublish(assessment.id, !assessment.isPublished)}
                          >
                            {assessment.isPublished ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedAssessment(assessment.id); setShowMarksDialog(true) }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Enter Marks
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="results" className="mt-4">
          {selectedAssessment && assessmentDetail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{assessmentDetail.name}</h2>
                  <p className="text-sm text-muted-foreground">{assessmentDetail.subject.code} - {assessmentDetail.subject.name}</p>
                </div>
                <div className="flex gap-2">
                  {isLecturer && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setShowMarksDialog(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Marks
                      </Button>
                      <Button
                        variant={assessmentDetail.isPublished ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handlePublish(assessmentDetail.id, !assessmentDetail.isPublished)}
                      >
                        {assessmentDetail.isPublished ? 'Unpublish' : 'Publish Results'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <Card>
                <CardContent className="pt-0">
                  {assessmentDetail.results.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No results recorded yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Marks</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Feedback</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assessmentDetail.results.map((result: AssessmentResult) => (
                            <TableRow key={result.id}>
                              <TableCell className="font-medium">{result.user.firstName} {result.user.lastName}</TableCell>
                              <TableCell>{result.user.studentId || 'N/A'}</TableCell>
                              <TableCell>{result.marksObtained} / {assessmentDetail.maxMarks}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={calculatePercentage(result.marksObtained, assessmentDetail.maxMarks)} className="w-32" />
                                  <span className="text-sm">{calculatePercentage(result.marksObtained, assessmentDetail.maxMarks)}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getGradeVariant(getGrade(calculatePercentage(result.marksObtained, assessmentDetail.maxMarks)))}>{getGrade(calculatePercentage(result.marksObtained, assessmentDetail.maxMarks))}</Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{result.feedback || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={result.isPublished ? 'success' : 'secondary'}>
                                  {result.isPublished ? 'Published' : 'Draft'}
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
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <BarChart className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select an assessment to view its results</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
                <BarChart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{calculateOverallAverage(assessments?.assessments)}%</div>
                <p className="text-sm text-muted-foreground">Across all published assessments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published Results</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{assessments?.assessments?.filter((a: Assessment) => a.isPublished).length || 0}</div>
                <p className="text-sm text-muted-foreground">Out of {assessments?.assessments?.length || 0} assessments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Grading</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{assessments?.assessments?.filter((a: Assessment) => a.isPublished && a._count.results === 0).length || 0}</div>
                <p className="text-sm text-muted-foreground">Assessments awaiting results</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Assessments</CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{getUpcomingCount(assessments?.assessments)}</div>
                <p className="text-sm text-muted-foreground">In the next 30 days</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Marks Entry Dialog */}
      <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Enter Marks - {assessmentDetail?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead className="w-32">Marks</TableHead>
                  <TableHead className="w-40">Percentage</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradingRoster.map((result: AssessmentResult) => {
                  const existing = marksInput[result.userId] || {
                    marks: String(result.marksObtained ?? 0),
                    feedback: result.feedback || '',
                  }
                  const percentage = calculatePercentage(
                    parseFloat(existing.marks) || 0,
                    assessmentDetail?.maxMarks || 100
                  )
                  return (
                    <TableRow key={result.userId}>
                      <TableCell className="font-medium">{result.user.firstName} {result.user.lastName}</TableCell>
                      <TableCell>{result.user.studentId || 'N/A'}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={assessmentDetail?.maxMarks || 100}
                          step={0.5}
                          value={existing.marks}
                          onChange={e => handleMarksChange(result.userId, 'marks', e.target.value)}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground"> / {assessmentDetail?.maxMarks || 100}</span>
                      </TableCell>
                      <TableCell>
                        <Progress value={percentage} className="w-full" />
                        <span className="text-xs ml-2">{percentage}%</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={existing.feedback}
                          onChange={e => handleMarksChange(result.userId, 'feedback', e.target.value)}
                          placeholder="Optional feedback"
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarksDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveMarks} disabled={updateAssessmentMutation.isPending}>
              {updateAssessmentMutation.isPending ? 'Saving...' : 'Save & Publish Marks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Assessment Confirmation Dialog */}
      <Dialog open={!!deletingAssessment} onOpenChange={(open) => !open && setDeletingAssessment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assessment</DialogTitle>
          </DialogHeader>
          {deletingAssessment && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <strong>{deletingAssessment.name}</strong>? All recorded student marks for this assessment will also be removed.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletingAssessment(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={deleteAssessmentMutation.isPending}
                  onClick={() => deleteAssessmentMutation.mutate(deletingAssessment.id)}
                >
                  {deleteAssessmentMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateAssessmentForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = React.useState<{
    subjectId: string
    name: string
    type: string
    maxMarks: number
    weight: number
    assessmentDate: Date | undefined
    description: string
  }>({
    subjectId: '',
    name: '',
    type: 'INTERNAL_ASSESSMENT',
    maxMarks: 100,
    weight: 1,
    assessmentDate: new Date(),
    description: '',
  })
  const [isLoading, setIsLoading] = React.useState(false)

  const resetForm = () => setFormData({
    subjectId: '', name: '', type: 'INTERNAL_ASSESSMENT', maxMarks: 100,
    weight: 1, assessmentDate: new Date(), description: '',
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects', 'my'],
    queryFn: async () => {
      const res = await fetch('/api/subjects/my')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const createAssessmentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        assessmentDate: data.assessmentDate instanceof Date ? data.assessmentDate.toISOString() : new Date().toISOString(),
      }
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Assessment created successfully" })
      onSuccess()
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    createAssessmentMutation.mutate(formData, {
      onSettled: () => setIsLoading(false),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Subject</Label>
        <Select value={formData.subjectId} onValueChange={v => setFormData(prev => ({ ...prev, subjectId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
          <SelectContent>
            {subjects?.subjects?.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Assessment Name</Label>
        <Input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Midterm Exam 1" required />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={formData.type} onValueChange={v => setFormData(prev => ({ ...prev, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INTERNAL_ASSESSMENT">Internal Assessment</SelectItem>
            <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
            <SelectItem value="QUIZ">Quiz</SelectItem>
            <SelectItem value="LAB_ASSESSMENT">Lab Assessment</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="PRESENTATION">Presentation</SelectItem>
            <SelectItem value="PRACTICAL_EXAM">Practical Exam</SelectItem>
            <SelectItem value="SEMESTER_EXAM">Semester Exam</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Max Marks</Label>
          <Input type="number" min={1} value={formData.maxMarks} onChange={e => setFormData(prev => ({ ...prev, maxMarks: parseInt(e.target.value) }))} required />
        </div>
        <div className="space-y-2">
          <Label>Weight</Label>
          <Input type="number" min={0.1} step={0.1} value={formData.weight} onChange={e => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) }))} required />
        </div>
        <div className="space-y-2">
          <Label>Assessment Date</Label>
          <DatePicker value={formData.assessmentDate} onChange={v => setFormData(prev => ({ ...prev, assessmentDate: v }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description (Optional)</Label>
        <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full p-2 border rounded-md min-h-[80px]" rows={3} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        <Button type="submit" disabled={isLoading || createAssessmentMutation.isPending}>
          {isLoading || createAssessmentMutation.isPending ? 'Creating...' : 'Create Assessment'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function getGrade(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 50) return 'C'
  if (percentage >= 40) return 'D'
  return 'F'
}

function getGradeVariant(grade: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  if (['A+', 'A'].includes(grade)) return 'success'
  if (['B+', 'B'].includes(grade)) return 'default'
  if (['C', 'D'].includes(grade)) return 'warning'
  return 'destructive'
}

function calculateOverallAverage(assessments?: Assessment[]): number {
  if (!assessments || assessments.length === 0) return 0
  const published = assessments.filter(a => a.isPublished)
  if (published.length === 0) return 0
  const withResults = published.filter((a: any) => Array.isArray(a.results) && a.results.length > 0 && a.maxMarks > 0)
  if (withResults.length === 0) return 0
  const sumPct = withResults.reduce((acc: number, a: any) => {
    const avgMarks = a.results.reduce((s: number, r: any) => s + Number(r.marksObtained || 0), 0) / a.results.length
    return acc + (avgMarks / a.maxMarks) * 100
  }, 0)
  return Math.round(sumPct / withResults.length)
}

function getUpcomingCount(assessments?: Assessment[]): number {
  if (!assessments) return 0
  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  return assessments.filter(a => new Date(a.assessmentDate) >= now && new Date(a.assessmentDate) <= thirtyDaysLater).length
}
