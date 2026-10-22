"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DocumentUpload } from "@/components/documents/document-upload"
import { 
  Upload, 
  FileText, 
  Loader2, 
  Download, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  Brain,
  Type,
  LayoutTemplate,
  FileQuestion,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Document {
  id: string
  title: string
  fileName: string
  documentType: string
  status: string
  pageCount: number | null
  createdAt: string
}

interface SolutionRequest {
  question: string
  questionBank?: string
  sourceDocumentIds: string[]
  supportingDocumentIds: string[]
  answerMode: "short" | "exam" | "detailed"
  subjectId?: string
}

interface SolutionResponse {
  questionNumber: string
  originalQuestion: string
  topic: string
  explanation: string
  definitions: string[]
  formulas: string[]
  calculations: string
  tables: Array<{ headers: string[]; rows: string[][] }>
  diagrams: Array<{ type: string; definition: string; title: string }>
  finalAnswer: string
  citations: Array<{
    id: string
    documentTitle: string
    pageNumber: number | null
    excerpt: string
  }>
  sources: Array<{
    id: string
    documentId: string
    content: string
    pageNumber: number | null
    similarity: number
  }>
  answerMode: string
  generatedAt: string
}

interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

export default function SolutionGeneratorPage() {
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState("")
  const [questionBank, setQuestionBank] = useState("")
  const [sourceDocumentIds, setSourceDocumentIds] = useState<string[]>([])
  const [supportingDocumentIds, setSupportingDocumentIds] = useState<string[]>([])
  const [answerMode, setAnswerMode] = useState<"short" | "exam" | "detailed">("detailed")
  const [subjectId, setSubjectId] = useState("")
  const [generatedSolution, setGeneratedSolution] = useState<SolutionResponse | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate")

  // Fetch user documents
  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects/my")
      if (!res.ok) throw new Error("Failed to fetch subjects")
      return res.json()
    },
  })

  // Fetch solution history
  const { data: solutionHistory = [] } = useQuery({
    queryKey: ["solution-history"],
    queryFn: async () => {
      const res = await fetch("/api/solutions")
      if (!res.ok) return []
      return res.json()
    },
  })

  const generateSolutionMutation = useMutation({
    mutationFn: async (request: SolutionRequest) => {
      const res = await fetch("/api/solutions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate solution")
      }
      return res.json()
    },
    onSuccess: (data) => {
      setGeneratedSolution(data)
      queryClient.invalidateQueries({ queryKey: ["solution-history"] })
      toast({ title: "Solution generated successfully!" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
    onSettled: () => setIsGenerating(false),
  })

  const handleGenerate = useCallback(() => {
    if (!question.trim() && !questionBank.trim()) {
      toast({ title: "Error", description: "Please enter a question or upload a question bank", variant: "destructive" })
      return
    }
    if (sourceDocumentIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one source document", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    generateSolutionMutation.mutate({
      question,
      questionBank: questionBank || undefined,
      sourceDocumentIds,
      supportingDocumentIds,
      answerMode,
      subjectId: subjectId || undefined,
    })
  }, [question, questionBank, sourceDocumentIds, supportingDocumentIds, answerMode, subjectId, generateSolutionMutation])

  const handleExportPDF = async () => {
    if (!generatedSolution) return
    try {
      const res = await fetch("/api/solutions/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution: generatedSolution }),
      })
      if (!res.ok) throw new Error("Failed to export PDF")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `solution-${generatedSolution.questionNumber}-${Date.now()}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({ title: "PDF exported successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" })
    }
  }

  const handleExportDOCX = async () => {
    if (!generatedSolution) return
    try {
      const res = await fetch("/api/solutions/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution: generatedSolution }),
      })
      if (!res.ok) throw new Error("Failed to export DOCX")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `solution-${generatedSolution.questionNumber}-${Date.now()}.docx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({ title: "DOCX exported successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to export DOCX", variant: "destructive" })
    }
  }

  const handleCopySolution = () => {
    if (!generatedSolution) return
    const text = `
Question ${generatedSolution.questionNumber}: ${generatedSolution.originalQuestion}
Topic: ${generatedSolution.topic}

Explanation:
${generatedSolution.explanation}

Definitions:
${generatedSolution.definitions.map(d => `- ${d}`).join("\n")}

Formulas:
${generatedSolution.formulas.map(f => `- ${f}`).join("\n")}

Calculations:
${generatedSolution.calculations}

Final Answer:
${generatedSolution.finalAnswer}

Sources:
${generatedSolution.citations.map((c, i) => `[${i + 1}] ${c.documentTitle}${c.pageNumber ? `, p.${c.pageNumber}` : ""}: ${c.excerpt}`).join("\n")}
    `.trim()
    navigator.clipboard.writeText(text)
    toast({ title: "Solution copied to clipboard" })
  }

  const documents: Document[] = Array.isArray(documentsData) ? documentsData : (documentsData?.documents || [])
  const subjects = Array.isArray(subjectsData) ? subjectsData : (subjectsData?.subjects || [])
  const filteredDocuments = documents.filter((d: Document) => d.status === "READY")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileQuestion className="h-8 w-8 text-primary" />
          Document-to-Solution Engine
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate structured academic solutions from your documents using AI-powered retrieval and reasoning.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v: "generate" | "history") => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Solution
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileText className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Panel - Input */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Question & Sources
                  </CardTitle>
                  <CardDescription>
                    Enter your question or upload a question bank, then select source documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label htmlFor="question">Question</Label>
                    <Textarea
                      id="question"
                      placeholder="Enter your question here... (e.g., 'Derive the expression for the electric field of a uniformly charged sphere using Gauss&apos; law')"
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      className="min-h-[100px]"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="questionBank">Question Bank (Optional)</Label>
                    <Textarea
                      id="questionBank"
                      placeholder="Paste multiple questions from a question bank (one per line)..."
                      value={questionBank}
                      onChange={e => setQuestionBank(e.target.value)}
                      className="min-h-[80px]"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Each line will be treated as a separate question. The first question will be used for generation.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label>Answer Mode</Label>
                    <div className="flex gap-4">
                      {[
                        { value: "short", label: "Short Answer", desc: "Concise, direct answer", icon: Type },
                        { value: "exam", label: "Exam Oriented", desc: "Structured for exam responses", icon: LayoutTemplate },
                        { value: "detailed", label: "Detailed", desc: "Full derivation with steps", icon: Brain },
                      ].map(mode => (
                        <Button
                          key={mode.value}
                          variant={answerMode === mode.value ? "default" : "outline"}
                          className="flex-1 flex flex-col items-start gap-1 text-left p-4"
                          onClick={() => setAnswerMode(mode.value as any)}
                        >
                          <mode.icon className="h-5 w-5" />
                          <span className="font-medium">{mode.label}</span>
                          <span className="text-xs text-muted-foreground">{mode.desc}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label>Subject (Optional)</Label>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a subject to filter documents..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Source Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Primary Source Documents
                  </CardTitle>
                  <CardDescription>
                    Select documents containing the primary content for answering the question
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentUpload
                    onSuccess={(doc) => {
                      setSourceDocumentIds(prev => [...prev, doc.id])
                    }}
                    maxFiles={10}
                  />
                  <div className="mt-4">
                    <Label className="block mb-2">Selected: {sourceDocumentIds.length} document(s)</Label>
                    <ScrollArea className="h-40 border rounded p-2">
                      {sourceDocumentIds.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">No documents selected. Upload or select from below.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sourceDocumentIds.map((id: string) => {
                            const doc = filteredDocuments.find((d: Document) => d.id === id)
                            return doc ? (
                              <Badge key={doc.id} variant="secondary" className="gap-1">
                                {doc.title}
                                <button
                                  onClick={() => setSourceDocumentIds((prev: string[]) => prev.filter((d: string) => d !== id))}
                                  className="ml-1 hover:text-red-500"
                                  aria-label="Remove"
                                >
                                  <AlertCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            ) : null
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              {/* Supporting Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Supporting Textbooks & Notes (Optional)
                  </CardTitle>
                  <CardDescription>
                    Additional documents for context and reference material
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {filteredDocuments.filter((d: Document) => !sourceDocumentIds.includes(d.id)).map((doc: Document) => (
                      <label key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={supportingDocumentIds.includes(doc.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSupportingDocumentIds(prev => [...prev, doc.id])
                            } else {
                              setSupportingDocumentIds(prev => prev.filter(d => d !== doc.id))
                            }
                          }}
                          className="h-4 w-4 rounded border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.documentType} • {doc.pageCount || "?"} pages • {formatRelativeTime(doc.createdAt)}
                          </p>
                        </div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </label>
                    ))}
                    {filteredDocuments.filter((d: Document) => !sourceDocumentIds.includes(d.id)).length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        No additional documents available. Upload documents first.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (!question.trim() && !questionBank.trim()) || sourceDocumentIds.length === 0}
                className="w-full py-4 text-lg"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Solution...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Structured Solution
                  </>
                )}
              </Button>
            </div>

            {/* Right Panel - Preview */}
            <div className="space-y-6">
              {generatedSolution ? (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Generated Solution
                    </CardTitle>
                    <CardDescription>
                      {generatedSolution.answerMode} mode • {generatedSolution.citations.length} citations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto">
                    <ScrollArea className="h-[600px] space-y-4">
                      <div className="space-y-4">
                        <div className="p-4 bg-primary/5 rounded-lg border">
                          <p className="font-medium">Question {generatedSolution.questionNumber}</p>
                          <p className="mt-1">{generatedSolution.originalQuestion}</p>
                          <Badge variant="outline" className="mt-2">{generatedSolution.topic}</Badge>
                        </div>

                        {generatedSolution.definitions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-1">
                              <Type className="h-4 w-4" /> Definitions
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {generatedSolution.definitions.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {generatedSolution.formulas.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-1">
                              <LayoutTemplate className="h-4 w-4" /> Formulas
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm font-mono">
                              {generatedSolution.formulas.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {generatedSolution.calculations && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-1">
                              <Brain className="h-4 w-4" /> Calculations
                            </h4>
                            <pre className="p-3 bg-muted rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                              {generatedSolution.calculations}
                            </pre>
                          </div>
                        )}

                        {generatedSolution.tables.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-1">
                              <LayoutTemplate className="h-4 w-4" /> Tables
                            </h4>
                            {generatedSolution.tables.map((table, ti) => (
                              <div key={ti} className="overflow-x-auto mb-4">
                                <table className="min-w-full border-collapse text-sm">
                                  <thead>
                                    <tr className="border-b">
                                      {table.headers.map((h, i) => (
                                        <th key={i} className="p-2 text-left border border-muted bg-muted/50">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {table.rows.map((row, ri) => (
                                      <tr key={ri} className="border-b">
                                        {row.map((cell, ci) => (
                                          <td key={ci} className="p-2 border">{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        )}

                        {generatedSolution.diagrams.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-1">
                              <Sparkles className="h-4 w-4" /> Diagrams
                            </h4>
                            {generatedSolution.diagrams.map((diagram, di) => (
                              <div key={di} className="p-3 bg-muted/50 rounded-lg mb-2">
                                <p className="font-medium mb-1">{diagram.title} ({diagram.type})</p>
                                <pre className="text-xs font-mono overflow-x-auto">{diagram.definition}</pre>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="font-medium text-green-800 mb-2 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> Final Answer
                          </h4>
                          <p className="text-green-900 whitespace-pre-wrap">{generatedSolution.finalAnswer}</p>
                        </div>

                        {generatedSolution.citations.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-1">
                              <FileText className="h-4 w-4" /> Sources & Citations
                            </h4>
                            <div className="space-y-2">
                              {generatedSolution.citations.map((citation, i) => (
                                <div key={citation.id} className="p-3 bg-muted/50 rounded-lg border">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <span className="font-medium">[{i + 1}] {citation.documentTitle}</span>
                                      {citation.pageNumber && (
                                        <span className="ml-2 text-sm text-muted-foreground">Page {citation.pageNumber}</span>
                                      )}
                                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{citation.excerpt}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(citation.excerpt)}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <Separator className="my-4" />
                    <div className="flex gap-2">
                      <Button onClick={handleExportPDF} variant="outline" className="flex-1">
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                      </Button>
                      <Button onClick={handleExportDOCX} variant="outline" className="flex-1">
                        <Download className="mr-2 h-4 w-4" />
                        Export DOCX
                      </Button>
                      <Button onClick={handleCopySolution} variant="ghost" className="flex-1">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-[700px]">
                  <CardContent className="flex flex-col items-center justify-center h-full text-center">
                    <Sparkles className="h-16 w-16 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">No Solution Generated Yet</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs">
                      Enter a question, select source documents, and click Generate to create a structured solution.
                    </p>
                    <div className="mt-6 flex gap-2">
                      <Badge variant="outline">Short Answer</Badge>
                      <Badge variant="outline">Exam Oriented</Badge>
                      <Badge variant="outline">Detailed</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solution Generation History</CardTitle>
            </CardHeader>
            <CardContent>
              {solutionHistory.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No solutions generated yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {solutionHistory.map((solution: any) => (
                    <div key={solution.id} className="p-4 border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{solution.originalQuestion || solution.question}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <Badge variant="outline">{solution.answerMode}</Badge>
                            <span>{solution.citations?.length || 0} citations</span>
                            <span>{formatRelativeTime(solution.generatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setGeneratedSolution(solution)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}