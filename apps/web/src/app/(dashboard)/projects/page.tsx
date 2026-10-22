"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { RAGChat } from "@/components/rag/rag-chat"
import { Plus, FileText, Users, Target, Clock, Sparkles, FolderKanban, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Project {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  ownerId: string
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
  _count: { members: number; tasks: number; milestones: number; documents: number }
}

interface ProjectTask {
  id: string
  projectId: string
  title: string
  description: string | null
  assigneeId: string | null
  status: string
  priority: number
  dueDate: string | null
  completedAt: string | null
  assignee: { id: string; firstName: string; lastName: string } | null
}

interface ProjectMilestone {
  id: string
  projectId: string
  title: string
  description: string | null
  dueDate: string
  completedAt: string | null
  isCompleted: boolean
}

interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null }
}

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("projects")
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null)
  const [showCreateProject, setShowCreateProject] = React.useState(false)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: projectTasks } = useQuery({
    queryKey: ['project-tasks', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return { tasks: [] }
      const res = await fetch(`/api/projects/${selectedProject}/tasks`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedProject,
  })

  const { data: projectMilestones } = useQuery({
    queryKey: ['project-milestones', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return { milestones: [] }
      const res = await fetch(`/api/projects/${selectedProject}/milestones`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedProject,
  })

  const { data: projectMembers } = useQuery({
    queryKey: ['project-members', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return { members: [] }
      const res = await fetch(`/api/projects/${selectedProject}/members`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedProject,
  })

  const createProject = useMutation({
    mutationFn: async (data: { title: string; description?: string; category?: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setSelectedProject(data.project.id)
      setShowCreateProject(false)
      toast({ title: "Project created" })
    },
    onError: () => toast({ title: "Error", description: "Failed to create project", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Collaborative project management with AI assistance</p>
        </div>
        <Button onClick={() => setShowCreateProject(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {showCreateProject && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createProject.mutate({ title: fd.get('title') as string, description: fd.get('description') as string, category: fd.get('category') as string }) }} className="space-y-4">
              <div>
                <Label>Project Title</Label>
                <Input name="title" placeholder="My Awesome Project" required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" placeholder="What is this project about?" />
              </div>
              <div>
                <Label>Category</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="software">Software Development</SelectItem>
                    <SelectItem value="ai-ml">AI/ML</SelectItem>
                    <SelectItem value="data-science">Data Science</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateProject(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="projects">My Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects?.projects?.map((project: Project) => (
              <Card key={project.id} onClick={() => setSelectedProject(project.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{project.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{project.description || 'No description'}</p>
                    </div>
                    <Badge variant={project.status === 'ACTIVE' ? 'default' : project.status === 'COMPLETED' ? 'success' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {project.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{project._count.members} members</span>
                    <span>•</span>
                    <span>{project._count.tasks} tasks</span>
                    <span>•</span>
                    <span>{project._count.milestones} milestones</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card onClick={() => setShowCreateProject(true)} className="cursor-pointer hover:shadow-md transition-shadow border-dashed">
              <CardContent className="pt-12 pb-12 text-center">
                <Plus className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Create new project</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {selectedProject ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Tasks</h2>
                <Button>New Task</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map(status => (
                  <Card key={status}>
                    <CardHeader>
                      <CardTitle>{status.replace('_', ' ')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {projectTasks?.tasks?.filter((t: ProjectTask) => t.status === status).map((task: ProjectTask) => (
                          <div key={task.id} className="p-3 border rounded-lg cursor-pointer hover:bg-accent">
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground">{task.assignee?.firstName} {task.assignee?.lastName}</p>
                            {task.dueDate && <p className="text-xs text-orange-500">Due {formatRelativeTime(task.dueDate)}</p>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a project to view its tasks</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="milestones" className="mt-4">
          {selectedProject ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Milestones</h2>
                <Button>Add Milestone</Button>
              </div>
              <div className="space-y-3">
                {projectMilestones?.milestones?.map((milestone: ProjectMilestone) => (
                  <Card key={milestone.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{milestone.title}</p>
                          <p className="text-sm text-muted-foreground">Due {formatRelativeTime(milestone.dueDate)}</p>
                        </div>
                        <Badge variant={milestone.isCompleted ? 'success' : 'outline'}>
                          {milestone.isCompleted ? 'Completed' : 'Pending'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a project to view its milestones</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {selectedProject ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Team Members</h2>
                <Button>Invite Member</Button>
              </div>
              <Card>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {projectMembers?.members?.map((member: ProjectMember) => (
                      <div key={member.id} className="flex items-center gap-4 p-3 border-b last:border-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {member.user.firstName[0]}{member.user.lastName[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                          <p className="text-sm text-muted-foreground">{member.user.email}</p>
                        </div>
                        <Badge variant={member.role === 'OWNER' ? 'default' : member.role === 'MENTOR' ? 'success' : 'outline'}>
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a project to view its team</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {selectedProject ? (
            <DocumentUpload projectId={selectedProject} />
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a project to upload documents</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {selectedProject ? (
            <RAGChat projectId={selectedProject} />
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a project to chat with its documents</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatRelativeTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}