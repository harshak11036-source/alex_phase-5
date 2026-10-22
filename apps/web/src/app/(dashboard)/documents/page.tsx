"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DocumentList } from "@/components/documents/document-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Download, X, FileText, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type DocumentStatus =
  | "UPLOADED"
  | "QUEUED"
  | "EXTRACTING"
  | "CHUNKING"
  | "EMBEDDING"
  | "INDEXING"
  | "READY"
  | "FAILED"

interface DocumentListItem {
  id: string
  title: string
  description: string | null
  fileName: string
  fileSize: string
  mimeType: string
  documentType: string
  status: DocumentStatus
  errorMessage: string | null
  pageCount: number | null
  subject: { id: string; name: string; code: string } | null
  project: { id: string; title: string } | null
  notebook: { id: string; title: string } | null
  chunksCount: number
  createdAt: string
  updatedAt: string
  processedAt: string | null
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("personal")
  const [viewingDocId, setViewingDocId] = React.useState<string | null>(null)
  const [editingDoc, setEditingDoc] = React.useState<DocumentListItem | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [aiSummary, setAiSummary] = React.useState<string | null>(null)

  const { data: allDocsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  const { data: viewedDocDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["document-detail", viewingDocId],
    queryFn: async () => {
      if (!viewingDocId) return null
      const res = await fetch(`/api/documents/${viewingDocId}`)
      if (!res.ok) throw new Error("Failed to load document details")
      return res.json()
    },
    enabled: !!viewingDocId,
  })

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}/retry`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Retry failed")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      if (viewingDocId) {
        queryClient.invalidateQueries({ queryKey: ["document-detail", viewingDocId] })
      }
      toast({ title: "Document reprocessed", description: "Text extraction and indexing completed." })
    },
    onError: (err: Error) =>
      toast({ title: "Reprocessing failed", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      setViewingDocId(null)
      toast({ title: "Document deleted" })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string }) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Update failed")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      setEditingDoc(null)
      toast({ title: "Document metadata updated" })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const summarizeMutation = useMutation({
    mutationFn: async (sourceDocId: string) => {
      const res = await fetch("/api/study-materials/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocId, type: "concise" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to summarize document")
      return data
    },
    onSuccess: (data) => {
      setAiSummary(data?.material?.content || "No summary returned.")
      toast({ title: "AI Summary Generated", description: `Generated using ${data.provider} (${data.model})` })
    },
    onError: (err: Error) =>
      toast({ title: "AI Summary Error", description: err.message, variant: "destructive" }),
  })

  const allDocuments: DocumentListItem[] = allDocsData?.documents || []
  const subjectDocuments = allDocuments.filter(d => Boolean(d.subject))
  const projectDocuments = allDocuments.filter(d => Boolean(d.project))
  const researchDocuments = allDocuments.filter(d => Boolean(d.notebook))

  const handleRetry = (id: string) => retryMutation.mutate(id)
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }
  const handleView = (id: string) => {
    setAiSummary(null)
    setViewingDocId(id)
  }
  const handleEdit = (id: string) => {
    const target = allDocuments.find(d => d.id === id)
    if (target) {
      setEditingDoc(target)
      setEditTitle(target.title)
      setEditDescription(target.description || "")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-1">
          Upload, inspect, and connect your academic documents to the AI engine
        </p>
      </div>

      {editingDoc && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Edit Document Metadata</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setEditingDoc(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Optional notes or description..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    id: editingDoc.id,
                    title: editTitle,
                    description: editDescription,
                  })
                }
                disabled={updateMutation.isPending || !editTitle.trim()}
              >
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditingDoc(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {viewingDocId && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {viewedDocDetail?.document?.title || "Document Inspector"}
              </CardTitle>
              {viewedDocDetail?.document?.status && (
                <Badge variant="outline">{viewedDocDetail.document.status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => summarizeMutation.mutate(viewingDocId)}
                disabled={summarizeMutation.isPending}
              >
                {summarizeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Summarize with AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/documents/${viewingDocId}/download`, "_blank")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download File
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setViewingDocId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading extracted content...
              </div>
            ) : viewedDocDetail?.document ? (
              <>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>File: {viewedDocDetail.document.fileName}</span>
                  <span>Type: {viewedDocDetail.document.documentType}</span>
                  <span>Pages: {viewedDocDetail.document.pageCount ?? 1}</span>
                  <span>Indexed Chunks: {viewedDocDetail.document.chunks?.length ?? 0}</span>
                </div>

                {aiSummary && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Document Summary
                    </h4>
                    <div className="text-sm whitespace-pre-wrap">{aiSummary}</div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Extracted Document Chunks</h4>
                  <div className="max-h-72 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted/20">
                    {(viewedDocDetail.document.chunks || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No extracted text chunks available.
                      </p>
                    ) : (
                      viewedDocDetail.document.chunks.map((chunk: any) => (
                        <div key={chunk.id} className="p-2.5 border rounded bg-background text-xs space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>
                              Chunk #{chunk.chunkIndex + 1}
                              {chunk.pageNumber ? ` · Page ${chunk.pageNumber}` : ""}
                              {chunk.sectionTitle ? ` · ${chunk.sectionTitle}` : ""}
                            </span>
                            <span>{chunk.tokenCount} tokens</span>
                          </div>
                          <p className="whitespace-pre-wrap text-foreground">{chunk.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">Could not load document details.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="personal">All Accessible ({allDocuments.length})</TabsTrigger>
          <TabsTrigger value="subjects">Subject Resources ({subjectDocuments.length})</TabsTrigger>
          <TabsTrigger value="projects">Project Documents ({projectDocuments.length})</TabsTrigger>
          <TabsTrigger value="research">Research Notebooks ({researchDocuments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <DocumentList
            documents={allDocuments}
            isLoading={docsLoading}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onView={handleView}
            onEdit={handleEdit}
            showUpload={true}
          />
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <DocumentList
            documents={subjectDocuments}
            isLoading={docsLoading}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onView={handleView}
            onEdit={handleEdit}
            showUpload={false}
          />
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <DocumentList
            documents={projectDocuments}
            isLoading={docsLoading}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onView={handleView}
            onEdit={handleEdit}
            showUpload={false}
          />
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <DocumentList
            documents={researchDocuments}
            isLoading={docsLoading}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onView={handleView}
            onEdit={handleEdit}
            showUpload={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}