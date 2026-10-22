"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { RAGChat } from "@/components/rag/rag-chat"
import { Plus, Book, Users, FileText, Download, GraduationCap } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Subject {
  id: string
  name: string
  code: string
  institutionId: string
  departmentId: string
  semesterId: string
  credits: number
  description: string | null
  syllabus: string | null
  textbooks: Record<string, unknown> | null
  institution: { id: string; name: string }
  department: { id: string; name: string; code: string }
  semester: { id: string; name: string; number: number }
  lecturers: { id: string; user: { firstName: string; lastName: string } }[]
  _count: { enrollments: number; resources: number }
}

interface SubjectResource {
  id: string
  subjectId: string
  title: string
  description: string | null
  category: string
  fileName: string
  storagePath: string
  fileSize: bigint
  mimeType: string
  version: number
  isPublished: boolean
  uploadedBy: string
  createdAt: string
}

export default function SubjectsPage() {
  const [activeTab, setActiveTab] = React.useState("my-subjects")
  const [selectedSubject, setSelectedSubject] = React.useState<string | null>(null)

  const { data: subjects } = useQuery({
    queryKey: ['subjects', 'my'],
    queryFn: async () => {
      const res = await fetch('/api/subjects/my')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: allSubjects } = useQuery({
    queryKey: ['subjects', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/subjects')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: activeTab === 'all',
  })

  const { data: subjectResources } = useQuery({
    queryKey: ['subject-resources', selectedSubject],
    queryFn: async () => {
      if (!selectedSubject) return { resources: [] }
      const res = await fetch(`/api/subjects/${selectedSubject}/resources`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedSubject,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage your academic subjects and resources</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my-subjects">My Subjects</TabsTrigger>
          <TabsTrigger value="all">All Subjects</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="my-subjects" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects?.subjects?.map((subject: Subject) => (
              <Card key={subject.id} onClick={() => setSelectedSubject(subject.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{subject.code} - {subject.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{subject.credits} credits · {subject.department.code}</p>
                    </div>
                    <Badge variant="outline">{subject.semester.name}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {subject.lecturers.map((l: any) => (
                      <div key={l.id} className="flex items-center gap-2 text-muted-foreground">
                        <GraduationCap className="h-4 w-4" />
                        <span>Dr. {l.user.lastName}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{subject._count.enrollments} students</span>
                      <span>•</span>
                      <span>{subject._count.resources} resources</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Subjects</h2>
              <Input placeholder="Search subjects..." className="w-64" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allSubjects?.subjects?.map((subject: Subject) => (
                <Card key={subject.id} onClick={() => setSelectedSubject(subject.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{subject.code} - {subject.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{subject.credits} credits · {subject.department.name}</p>
                      </div>
                      <Badge variant="outline">{subject.semester.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{subject.description || 'No description'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          {selectedSubject ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Subject Resources</h2>
                <DocumentUpload subjectId={selectedSubject} />
              </div>
              <DocumentList
                documents={subjectResources?.resources?.map((r: SubjectResource) => ({
                  id: r.id,
                  title: r.title,
                  description: r.description,
                  fileName: r.fileName,
                  fileSize: r.fileSize.toString(),
                  mimeType: r.mimeType,
                  documentType: "PDF",
                  status: "READY" as any,
                  errorMessage: null,
                  pageCount: null,
                  subject: null,
                  project: null,
                  notebook: null,
                  chunksCount: 0,
                  createdAt: r.createdAt,
                  updatedAt: r.createdAt,
                  processedAt: null,
                })) || []}
                showUpload={false}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Book className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a subject to view its resources</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}