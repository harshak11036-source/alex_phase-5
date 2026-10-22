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
import { DocumentUpload } from "@/components/documents/document-upload"
import { RAGChat } from "@/components/rag/rag-chat"
import {
  Plus,
  FileText,
  Brain,
  Sparkles,
  FlaskConical,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  Link as LinkIcon,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ResearchNotebook {
  id: string
  title: string
  description: string | null
  ownerId: string
  projectId: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  _count: { sources: number; notes: number }
}

interface NotebookSourceItem {
  id: string
  notebookId: string
  documentId: string | null
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  documentType: string
  status: string
  pageCount: number | null
  chunksCount: number
  errorMessage: string | null
  authors: Record<string, unknown> | null
  publicationYear: number | null
  doi: string | null
  url: string | null
  createdAt: string
}

interface ResearchNote {
  id: string
  notebookId: string
  userId: string
  title: string
  content: string
  sourceIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface GeneratedQuizQuestion {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  citations?: Array<{
    id: string
    documentId: string
    documentTitle: string
    pageNumber: number | null
    sectionTitle: string | null
    excerpt: string
  }>
}

export default function ResearchLabPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("notebooks")
  const [selectedNotebook, setSelectedNotebook] = React.useState<string | null>(null)
  const [showCreateNotebook, setShowCreateNotebook] = React.useState(false)
  const [showAddTextSource, setShowAddTextSource] = React.useState(false)
  const [showCreateNote, setShowCreateNote] = React.useState(false)
  const [selectedExistingDocId, setSelectedExistingDocId] = React.useState("")
  const [textSourceTitle, setTextSourceTitle] = React.useState("")
  const [textSourceContent, setTextSourceContent] = React.useState("")
  const [noteTitle, setNoteTitle] = React.useState("")
  const [noteContent, setNoteContent] = React.useState("")
  const [selectedSourceDocIds, setSelectedSourceDocIds] = React.useState<string[]>([])
  const [generatedSynthesis, setGeneratedSynthesis] = React.useState<{
    type: string
    title: string
    content?: string
    faqs?: Array<{ question: string; answer: string; citations: any[] }>
    quiz?: { id: string; title: string; questions: GeneratedQuizQuestion[] }
    citations?: any[]
    provider?: string
    model?: string
  } | null>(null)
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = React.useState(false)

  const { data: notebooksData, isLoading: notebooksLoading } = useQuery({
    queryKey: ["research-notebooks"],
    queryFn: async () => {
      const res = await fetch("/api/research/notebooks")
      if (!res.ok) throw new Error("Failed to fetch notebooks")
      return res.json()
    },
  })

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ["research-sources", selectedNotebook],
    queryFn: async () => {
      if (!selectedNotebook) return { sources: [] }
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/sources`)
      if (!res.ok) throw new Error("Failed to fetch sources")
      return res.json()
    },
    enabled: Boolean(selectedNotebook),
  })

  const { data: notesData } = useQuery({
    queryKey: ["research-notes", selectedNotebook],
    queryFn: async () => {
      if (!selectedNotebook) return { notes: [] }
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/notes`)
      if (!res.ok) throw new Error("Failed to fetch notes")
      return res.json()
    },
    enabled: Boolean(selectedNotebook),
  })

  const { data: allUserDocuments } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) return { documents: [] }
      return res.json()
    },
  })

  const notebookSources: NotebookSourceItem[] = sourcesData?.sources || []

  React.useEffect(() => {
    const readyDocIds = notebookSources
      .map(s => s.documentId)
      .filter((id): id is string => Boolean(id))
    setSelectedSourceDocIds(readyDocIds)
  }, [selectedNotebook, sourcesData])

  const createNotebook = useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      const res = await fetch("/api/research/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Failed to create notebook")
      return payload
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setSelectedNotebook(data.notebook.id)
      setShowCreateNotebook(false)
      setActiveTab("sources")
      toast({ title: "Notebook created", description: `"${data.notebook.title}" is ready for sources.` })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const deleteNotebook = useMutation({
    mutationFn: async (notebookId: string) => {
      const res = await fetch(`/api/research/notebooks/${notebookId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete notebook")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setSelectedNotebook(null)
      setActiveTab("notebooks")
      toast({ title: "Notebook deleted" })
    },
  })

  const addSourceMutation = useMutation({
    mutationFn: async (payload: { documentId?: string; title?: string; content?: string }) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to add source")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-sources", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setShowAddTextSource(false)
      setTextSourceTitle("")
      setTextSourceContent("")
      setSelectedExistingDocId("")
      toast({ title: "Source added and indexed in notebook" })
    },
    onError: (err: Error) =>
      toast({ title: "Error adding source", description: err.message, variant: "destructive" }),
  })

  const removeSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(
        `/api/research/notebooks/${selectedNotebook}/sources?sourceId=${encodeURIComponent(sourceId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to remove source")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-sources", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      toast({ title: "Source removed from notebook" })
    },
  })

  const createNoteMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string; tags?: string[] }) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          sourceIds: selectedSourceDocIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to save note")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setShowCreateNote(false)
      setNoteTitle("")
      setNoteContent("")
      toast({ title: "Note saved to notebook" })
    },
    onError: (err: Error) =>
      toast({ title: "Error saving note", description: err.message, variant: "destructive" }),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(
        `/api/research/notebooks/${selectedNotebook}/notes?noteId=${encodeURIComponent(noteId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete note")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      toast({ title: "Note deleted" })
    },
  })

  const generateArtifactMutation = useMutation({
    mutationFn: async (type: "summary" | "study_guide" | "faq" | "quiz") => {
      if (!selectedNotebook) throw new Error("Select a notebook first")
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          documentIds: selectedSourceDocIds.length > 0 ? selectedSourceDocIds : undefined,
          count: 5,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Generation failed")
      return data
    },
    onSuccess: (data) => {
      setGeneratedSynthesis(data)
      setQuizAnswers({})
      setQuizSubmitted(false)
      queryClient.invalidateQueries({ queryKey: ["research-notes", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      toast({
        title: `${data.title || "Notebook synthesis"} ready`,
        description: `Grounded in ${data.sourcesUsed || 1} source(s) via ${data.provider} (${data.model}).`,
      })
    },
    onError: (err: Error) =>
      toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  })

  const toggleSourceSelection = (docId: string | null) => {
    if (!docId) return
    setSelectedSourceDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    )
  }

  const currentNotebook: ResearchNotebook | undefined = (notebooksData?.notebooks || []).find(
    (n: ResearchNotebook) => n.id === selectedNotebook
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Research Lab</h1>
          <p className="text-muted-foreground mt-1">
            Source-grounded notebooks for multi-document analysis, study guides, FAQs, quizzes, and cited Q&A
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentNotebook && (
            <Badge variant="secondary" className="text-xs px-3 py-1">
              Active: {currentNotebook.title} ({notebookSources.length} sources)
            </Badge>
          )}
          <Button onClick={() => setShowCreateNotebook(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Notebook
          </Button>
        </div>
      </div>

      {showCreateNotebook && (
        <Card className="max-w-2xl border-primary/40">
          <CardHeader>
            <CardTitle>Create New Research Notebook</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={e => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createNotebook.mutate({
                  title: fd.get("title") as string,
                  description: fd.get("description") as string,
                })
              }}
              className="space-y-4"
            >
              <div>
                <Label>Title</Label>
                <Input name="title" placeholder="e.g., Molecular Biology & CRISPR Review" required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" placeholder="Research scope, course, or thesis topic..." />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createNotebook.isPending}>
                  {createNotebook.isPending ? "Creating..." : "Create Notebook"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateNotebook(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="notebooks">Notebooks ({notebooksData?.notebooks?.length || 0})</TabsTrigger>
          <TabsTrigger value="sources">Sources ({notebookSources.length})</TabsTrigger>
          <TabsTrigger value="synthesis">Summaries, Guides, FAQs & Quizzes</TabsTrigger>
          <TabsTrigger value="chat">Grounded Q&A</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notesData?.notes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="notebooks" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notebooksData?.notebooks?.map((notebook: ResearchNotebook) => (
              <Card
                key={notebook.id}
                onClick={() => {
                  setSelectedNotebook(notebook.id)
                  setActiveTab("sources")
                }}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  selectedNotebook === notebook.id ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle>{notebook.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notebook.description || "No description"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={e => {
                      e.stopPropagation()
                      deleteNotebook.mutate(notebook.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{notebook._count?.sources ?? 0} sources</span>
                    <span>•</span>
                    <span>{notebook._count?.notes ?? 0} notes</span>
                    <span>•</span>
                    <span>{formatRelativeTime(notebook.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card
              onClick={() => setShowCreateNotebook(true)}
              className="cursor-pointer hover:shadow-md transition-shadow border-dashed"
            >
              <CardContent className="pt-12 pb-12 text-center">
                <Plus className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Create new notebook</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          {selectedNotebook ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <DocumentUpload
                  notebookId={selectedNotebook}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["research-sources", selectedNotebook] })
                    queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
                  }}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Add Existing Document or Pasted Text Source
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Link Existing Processed Document</Label>
                      <div className="flex gap-2">
                        <Select value={selectedExistingDocId} onValueChange={setSelectedExistingDocId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Choose from your uploaded documents..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(allUserDocuments?.documents || []).map((doc: any) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.title} ({doc.documentType})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          disabled={!selectedExistingDocId || addSourceMutation.isPending}
                          onClick={() => addSourceMutation.mutate({ documentId: selectedExistingDocId })}
                        >
                          Link Source
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      {!showAddTextSource ? (
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => setShowAddTextSource(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Paste Raw Text / Lecture Notes as Source
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <Input
                            placeholder="Source title (e.g., Lecture 4 Transcript)"
                            value={textSourceTitle}
                            onChange={e => setTextSourceTitle(e.target.value)}
                          />
                          <Textarea
                            placeholder="Paste source text, abstract, or markdown content here..."
                            value={textSourceContent}
                            onChange={e => setTextSourceContent(e.target.value)}
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={
                                !textSourceTitle.trim() ||
                                !textSourceContent.trim() ||
                                addSourceMutation.isPending
                              }
                              onClick={() =>
                                addSourceMutation.mutate({
                                  title: textSourceTitle,
                                  content: textSourceContent,
                                })
                              }
                            >
                              {addSourceMutation.isPending ? "Processing..." : "Process & Add Source"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAddTextSource(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Notebook Sources ({notebookSources.length})</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Checked sources ({selectedSourceDocIds.length}) are active for Grounded Q&A, Summaries, Study Guides, FAQs, and Quizzes.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveTab("synthesis")}
                      disabled={notebookSources.length === 0}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Synthesize & Quiz
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("chat")}
                      disabled={notebookSources.length === 0}
                    >
                      <Brain className="mr-1.5 h-4 w-4" />
                      Ask Sources
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {sourcesLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading sources...</div>
                  ) : notebookSources.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      <FileText className="mx-auto h-10 w-10 mb-2 opacity-50" />
                      <p>No sources in this notebook yet. Upload a document or paste text above to begin.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {notebookSources.map(source => {
                        const isSelected = Boolean(
                          source.documentId && selectedSourceDocIds.includes(source.documentId)
                        )
                        return (
                          <div
                            key={source.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSourceSelection(source.documentId)}
                                className="h-4 w-4 rounded border-primary"
                                aria-label={`Include ${source.title}`}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{source.title}</span>
                                  <Badge variant="outline" className="text-[11px]">
                                    {source.documentType}
                                  </Badge>
                                  <Badge
                                    variant={source.status === "READY" ? "secondary" : "destructive"}
                                    className="text-[11px]"
                                  >
                                    {source.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                                  <span>{source.fileName}</span>
                                  {source.pageCount && <span>· {source.pageCount} page(s)</span>}
                                  <span>· {source.chunksCount} indexed chunks</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeSourceMutation.mutate(source.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a notebook to manage its sources</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="synthesis" className="mt-4">
          {selectedNotebook ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  {
                    type: "summary" as const,
                    title: "Notebook Summary",
                    desc: "Executive briefing across all active sources",
                    icon: Sparkles,
                  },
                  {
                    type: "study_guide" as const,
                    title: "Study Guide",
                    desc: "Key concepts, definitions, formulas & review questions",
                    icon: BookOpen,
                  },
                  {
                    type: "faq" as const,
                    title: "Generate FAQs",
                    desc: "Frequently asked questions with page/section citations",
                    icon: HelpCircle,
                  },
                  {
                    type: "quiz" as const,
                    title: "Grounded Quiz",
                    desc: "Interactive multiple-choice quiz with cited explanations",
                    icon: CheckCircle2,
                  },
                ].map(action => (
                  <Card
                    key={action.type}
                    onClick={() => {
                      if (!generateArtifactMutation.isPending) {
                        generateArtifactMutation.mutate(action.type)
                      }
                    }}
                    className="cursor-pointer hover:shadow-md transition-shadow border-primary/20"
                  >
                    <CardContent className="pt-6 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                          <action.icon className="h-5 w-5" />
                        </div>
                        {generateArtifactMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <h4 className="font-semibold text-sm">{action.title}</h4>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {generatedSynthesis && (
                <Card className="border-primary/30">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{generatedSynthesis.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Grounded in your active notebook sources ({generatedSynthesis.provider} · {generatedSynthesis.model})
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                      Source-Supported
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {generatedSynthesis.type === "quiz" && generatedSynthesis.quiz ? (
                      <div className="space-y-4">
                        {generatedSynthesis.quiz.questions.map((q, qIdx) => (
                          <div key={q.id} className="p-4 border rounded-lg space-y-3">
                            <p className="font-medium text-sm">
                              {qIdx + 1}. {q.prompt}
                            </p>
                            <div className="grid gap-2">
                              {q.options.map((opt, oIdx) => {
                                const selected = quizAnswers[q.id] === oIdx
                                const isCorrect = q.answer === oIdx
                                return (
                                  <Button
                                    key={oIdx}
                                    type="button"
                                    variant={
                                      quizSubmitted
                                        ? isCorrect
                                          ? "default"
                                          : selected
                                            ? "destructive"
                                            : "outline"
                                        : selected
                                          ? "default"
                                          : "outline"
                                    }
                                    className="justify-start text-left h-auto py-2 px-3 text-sm"
                                    onClick={() => {
                                      if (!quizSubmitted) {
                                        setQuizAnswers(prev => ({ ...prev, [q.id]: oIdx }))
                                      }
                                    }}
                                  >
                                    {opt}
                                  </Button>
                                )
                              })}
                            </div>
                            {quizSubmitted && (
                              <div className="p-3 rounded bg-muted text-xs space-y-1">
                                <p className="font-medium">{q.explanation}</p>
                                {q.citations && q.citations.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {q.citations.map((c, cIdx) => (
                                      <Badge key={cIdx} variant="outline" className="text-[10px]">
                                        {c.documentTitle}
                                        {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                        {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center gap-3">
                          {!quizSubmitted ? (
                            <Button onClick={() => setQuizSubmitted(true)}>Check Quiz Answers</Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setQuizAnswers({})
                                setQuizSubmitted(false)
                              }}
                            >
                              Retake Quiz
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : generatedSynthesis.type === "faq" && generatedSynthesis.faqs ? (
                      <div className="space-y-3">
                        {generatedSynthesis.faqs.map((faq, idx) => (
                          <div key={idx} className="p-4 border rounded-lg space-y-2">
                            <h4 className="font-semibold text-sm">
                              Q{idx + 1}: {faq.question}
                            </h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
                            {faq.citations && faq.citations.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {faq.citations.map((c: any, cIdx: number) => (
                                  <Badge key={cIdx} variant="outline" className="text-xs">
                                    [{cIdx + 1}] {c.documentTitle}
                                    {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                    {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="prose max-w-none whitespace-pre-wrap text-sm border rounded-lg p-4 bg-muted/20">
                          {generatedSynthesis.content}
                        </div>
                        {generatedSynthesis.citations && generatedSynthesis.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {generatedSynthesis.citations.map((c: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                [{idx + 1}] {c.documentTitle}
                                {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  Select a notebook to generate summaries, study guides, FAQs, and quizzes
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {selectedNotebook ? (
            <RAGChat
              notebookId={selectedNotebook}
              documentIds={selectedSourceDocIds.length > 0 ? selectedSourceDocIds : undefined}
              onSaveAsNote={(title, content) =>
                createNoteMutation.mutate({ title, content, tags: ["qa-saved"] })
              }
            />
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a notebook to chat with its sources</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {selectedNotebook ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Notebook Notes ({notesData?.notes?.length || 0})</h2>
                <Button onClick={() => setShowCreateNote(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Note
                </Button>
              </div>

              {showCreateNote && (
                <Card className="border-primary/40">
                  <CardHeader>
                    <CardTitle className="text-base">Add Research Note</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Note title..."
                      value={noteTitle}
                      onChange={e => setNoteTitle(e.target.value)}
                    />
                    <Textarea
                      placeholder="Write your research observations or synthesis..."
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={!noteTitle.trim() || !noteContent.trim() || createNoteMutation.isPending}
                        onClick={() =>
                          createNoteMutation.mutate({
                            title: noteTitle,
                            content: noteContent,
                            tags: ["manual"],
                          })
                        }
                      >
                        Save Note
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateNote(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {notesData?.notes?.map((note: ResearchNote) => (
                  <Card key={note.id}>
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">{note.title}</CardTitle>
                        <div className="flex gap-1 mt-1">
                          {(note.tags || []).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="prose max-h-60 overflow-y-auto whitespace-pre-wrap text-sm">
                        {note.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a notebook to view its notes</p>
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