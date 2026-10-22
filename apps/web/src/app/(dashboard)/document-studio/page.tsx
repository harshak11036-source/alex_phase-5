"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  FileText, 
  Type, 
  Loader2, 
  Download, 
  Copy, 
  CheckCircle, 
  Sparkles,
  LayoutTemplate,
  PenSquare,
  BookOpen,
  FileQuestion,
  Database,
  Brain,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  Save,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { DiagramViewer } from "@/components/diagrams/DiagramViewer"

interface Document {
  id: string
  title: string
  fileName: string
  documentType: string
  status: string
  pageCount: number | null
  createdAt: string
}

interface Template {
  id: string
  name: string
  category: string
  content: string
  variables: Array<{ name: string; description: string; default?: string }>
}

interface GeneratedDocument {
  id: string
  title: string
  content: string
  format: "markdown" | "html"
  sections: Array<{
    id: string
    type: "heading" | "paragraph" | "list" | "table" | "code" | "diagram" | "quote"
    content: any
    level?: number
  }>
  metadata: {
    wordCount: number
    readingTime: number
    createdAt: string
  }
}

const documentTemplates: Template[] = [
  {
    id: "academic-paper",
    name: "Academic Paper",
    category: "Research",
    content: `# {{title}}

## Abstract
{{abstract}}

## Introduction
{{introduction}}

## Literature Review
{{literatureReview}}

## Methodology
{{methodology}}

## Results
{{results}}

## Discussion
{{discussion}}

## Conclusion
{{conclusion}}

## References
{{references}}`,
    variables: [
      { name: "title", description: "Paper title", default: "Research Paper" },
      { name: "abstract", description: "Brief summary", default: "" },
      { name: "introduction", description: "Introduction section", default: "" },
      { name: "literatureReview", description: "Literature review", default: "" },
      { name: "methodology", description: "Methodology section", default: "" },
      { name: "results", description: "Results section", default: "" },
      { name: "discussion", description: "Discussion section", default: "" },
      { name: "conclusion", description: "Conclusion", default: "" },
      { name: "references", description: "References", default: "" },
    ],
  },
  {
    id: "technical-report",
    name: "Technical Report",
    category: "Engineering",
    content: `# {{title}}

## Executive Summary
{{executiveSummary}}

## Problem Statement
{{problemStatement}}

## Technical Approach
{{technicalApproach}}

## Implementation Details
{{implementation}}

## Testing & Validation
{{testing}}

## Conclusions & Recommendations
{{recommendations}}

## Appendices
{{appendices}}`,
    variables: [
      { name: "title", description: "Report title", default: "Technical Report" },
      { name: "executiveSummary", description: "Brief overview", default: "" },
      { name: "problemStatement", description: "Problem description", default: "" },
      { name: "technicalApproach", description: "Technical approach", default: "" },
      { name: "implementation", description: "Implementation details", default: "" },
      { name: "testing", description: "Testing methodology", default: "" },
      { name: "recommendations", description: "Recommendations", default: "" },
      { name: "appendices", description: "Appendices", default: "" },
    ],
  },
  {
    id: "study-guide",
    name: "Study Guide",
    category: "Education",
    content: `# {{title}} - Study Guide

## Overview
{{overview}}

## Key Concepts
{{keyConcepts}}

## Important Formulas
{{formulas}}

## Practice Problems
{{practiceProblems}}

## Tips & Strategies
{{tips}}

## Summary
{{summary}}`,
    variables: [
      { name: "title", description: "Subject/Topic", default: "Study Guide" },
      { name: "overview", description: "Brief overview", default: "" },
      { name: "keyConcepts", description: "Key concepts", default: "" },
      { name: "formulas", description: "Important formulas", default: "" },
      { name: "practiceProblems", description: "Practice problems", default: "" },
      { name: "tips", description: "Study tips", default: "" },
      { name: "summary", description: "Summary", default: "" },
    ],
  },
  {
    id: "project-proposal",
    name: "Project Proposal",
    category: "Project Management",
    content: `# {{title}} - Project Proposal

## Project Overview
{{overview}}

## Objectives
{{objectives}}

## Scope
{{scope}}

## Methodology
{{methodology}}

## Timeline
{{timeline}}

## Resources & Budget
{{budget}}

## Risk Assessment
{{risks}}

## Success Criteria
{{successCriteria}}`,
    variables: [
      { name: "title", description: "Project name", default: "Project Proposal" },
      { name: "overview", description: "Project overview", default: "" },
      { name: "objectives", description: "Project objectives", default: "" },
      { name: "scope", description: "Project scope", default: "" },
      { name: "methodology", description: "Methodology", default: "" },
      { name: "timeline", description: "Timeline", default: "" },
      { name: "budget", description: "Budget", default: "" },
      { name: "risks", description: "Risk assessment", default: "" },
      { name: "successCriteria", description: "Success criteria", default: "" },
    ],
  },
  {
    id: "lesson-plan",
    name: "Lesson Plan",
    category: "Education",
    content: `# {{title}} - Lesson Plan

## Lesson Information
- **Subject:** {{subject}}
- **Grade/Level:** {{level}}
- **Duration:** {{duration}}
- **Date:** {{date}}

## Learning Objectives
{{objectives}}

## Materials Needed
{{materials}}

## Lesson Procedure
### Introduction ({{introTime}})
{{introduction}}

### Main Activity ({{mainTime}})
{{mainActivity}}

### Practice/Application ({{practiceTime}})
{{practice}}

### Closure ({{closureTime}})
{{closure}}

## Assessment
{{assessment}}

## Differentiation
{{differentiation}}

## Reflection
{{reflection}}`,
    variables: [
      { name: "title", description: "Lesson title", default: "Lesson Plan" },
      { name: "subject", description: "Subject", default: "" },
      { name: "level", description: "Grade/Level", default: "" },
      { name: "duration", description: "Duration", default: "" },
      { name: "date", description: "Date", default: "" },
      { name: "objectives", description: "Learning objectives", default: "" },
      { name: "materials", description: "Materials", default: "" },
      { name: "introTime", description: "Intro time", default: "10 min" },
      { name: "introduction", description: "Introduction", default: "" },
      { name: "mainTime", description: "Main activity time", default: "30 min" },
      { name: "mainActivity", description: "Main activity", default: "" },
      { name: "practiceTime", description: "Practice time", default: "15 min" },
      { name: "practice", description: "Practice", default: "" },
      { name: "closureTime", description: "Closure time", default: "5 min" },
      { name: "closure", description: "Closure", default: "" },
      { name: "assessment", description: "Assessment", default: "" },
      { name: "differentiation", description: "Differentiation", default: "" },
      { name: "reflection", description: "Reflection", default: "" },
    ],
  },
]

export default function DocumentStudioPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"generate" | "templates" | "library" | "history">("generate")
  const [sourceType, setSourceType] = useState<"prompt" | "notes" | "rag" | "question-bank" | "template">("prompt")
  const [prompt, setPrompt] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  const [outputFormat, setOutputFormat] = useState<"markdown" | "html" | "pdf" | "docx">("markdown")
  const [includeDiagrams, setIncludeDiagrams] = useState(true)
  const [includeTables, setIncludeTables] = useState(true)
  const [includeCitations, setIncludeCitations] = useState(true)
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null)
  const [documentHistory, setDocumentHistory] = useState<GeneratedDocument[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  const { data: diagrams = [] } = useQuery({
    queryKey: ["diagrams"],
    queryFn: async () => {
      const res = await fetch("/api/diagrams/generate")
      if (!res.ok) return []
      return res.json()
    },
  })

  const generateDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate document")
      }
      return res.json()
    },
    onSuccess: (data) => {
      setGeneratedDoc(data)
      setDocumentHistory(prev => [data, ...prev.filter(item => item.id !== data.id)])
      queryClient.invalidateQueries({ queryKey: ["document-history"] })
      toast({ title: "Document generated successfully!" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
    onSettled: () => setIsGenerating(false),
  })

  const handleGenerate = useCallback(() => {
    let content = ""
    let title = "Generated Document"

    switch (sourceType) {
      case "prompt":
        if (!prompt.trim()) {
          toast({ title: "Error", description: "Please enter a prompt", variant: "destructive" })
          return
        }
        content = prompt
        title = prompt.slice(0, 50)
        break
      case "notes":
        if (!notes.trim()) {
          toast({ title: "Error", description: "Please enter notes", variant: "destructive" })
          return
        }
        content = notes
        title = "Document from Notes"
        break
      case "template":
        if (!selectedTemplate) {
          toast({ title: "Error", description: "Please select a template", variant: "destructive" })
          return
        }
        const template = documentTemplates.find(t => t.id === selectedTemplate)
        if (template) {
          content = template.content
          title = template.name
          template.variables.forEach(v => {
            content = content.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), templateVariables[v.name] || v.default || "")
          })
        }
        break
      case "rag":
        // RAG-based generation would be handled by the API
        content = prompt || "Generate from RAG"
        break
      case "question-bank":
        content = prompt || "Generate from Question Bank"
        break
    }

    setIsGenerating(true)
    generateDocumentMutation.mutate({
      sourceType,
      prompt: content,
      title,
      outputFormat,
      includeDiagrams,
      includeTables,
      includeCitations,
      templateId: selectedTemplate,
      templateVariables,
    })
  }, [sourceType, prompt, notes, selectedTemplate, templateVariables, outputFormat, includeDiagrams, includeTables, includeCitations, generateDocumentMutation])

  const handleExport = async (format: "pdf" | "docx") => {
    if (!generatedDoc) return
    try {
      const res = await fetch(`/api/documents/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: generatedDoc }),
      })
      if (!res.ok) throw new Error(`Failed to export ${format.toUpperCase()}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${generatedDoc.title.replace(/\s+/g, "-")}-${Date.now()}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: `${format.toUpperCase()} exported successfully` })
    } catch (error) {
      toast({ title: "Error", description: `Failed to export ${format.toUpperCase()}`, variant: "destructive" })
    }
  }

  const handleCopy = () => {
    if (!generatedDoc) return
    navigator.clipboard.writeText(generatedDoc.content)
    toast({ title: "Document copied to clipboard" })
  }

  const documents: Document[] = Array.isArray(documentsData) ? documentsData : (documentsData?.documents || [])
  const filteredDocuments = documents.filter((d: Document) => d.status === "READY")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          Document Studio
        </h1>
        <p className="text-muted-foreground mt-1">
          Create professional documents from prompts, notes, templates, or AI-generated content.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v: "generate" | "templates" | "library" | "history") => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="templates">
            <LayoutTemplate className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="library">
            <Database className="mr-2 h-4 w-4" />
            My Library
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
                    Content Source
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to create your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      { id: "prompt", label: "AI Prompt", desc: "Generate from description", icon: Sparkles },
                      { id: "notes", label: "My Notes", desc: "Convert notes to document", icon: PenSquare },
                      { id: "template", label: "Template", desc: "Use structured template", icon: LayoutTemplate },
                      { id: "rag", label: "From RAG", desc: "Use your documents", icon: Database },
                      { id: "question-bank", label: "Question Bank", desc: "From questions", icon: FileQuestion },
                    ].map(option => (
                      <Button
                        key={option.id}
                        variant={sourceType === option.id ? "default" : "outline"}
                        className="flex flex-col items-start gap-1 p-4 text-left h-full"
                        onClick={() => {
                          setSourceType(option.id as any)
                          setSelectedTemplate("")
                        }}
                      >
                        <option.icon className="h-5 w-5" />
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.desc}</span>
                      </Button>
                    ))}
                  </div>

                  {sourceType === "prompt" && (
                    <div className="space-y-2">
                      <Label htmlFor="prompt">Describe the document you want to create</Label>
                      <Textarea
                        id="prompt"
                        placeholder="e.g., Create a comprehensive study guide for Calculus I covering limits, derivatives, and integrals with practice problems and solutions"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        className="min-h-[120px]"
                        rows={5}
                      />
                    </div>
                  )}

                  {sourceType === "notes" && (
                    <div className="space-y-2">
                      <Label htmlFor="notes">Paste your notes here</Label>
                      <Textarea
                        id="notes"
                        placeholder="Paste your raw notes, bullet points, or rough draft..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="min-h-[120px]"
                        rows={5}
                      />
                    </div>
                  )}

                  {sourceType === "template" && (
                    <div className="space-y-4">
                      <Label>Select Template</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {documentTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} ({t.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedTemplate && (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium">Template Variables</h4>
                          {documentTemplates.find(t => t.id === selectedTemplate)?.variables.map(v => (
                            <div key={v.name} className="space-y-1">
                              <Label htmlFor={`var-${v.name}`}>{v.name}</Label>
                              <Input
                                id={`var-${v.name}`}
                                placeholder={v.description}
                                defaultValue={v.default || ""}
                                value={templateVariables[v.name] || ""}
                                onChange={e => setTemplateVariables(prev => ({ ...prev, [v.name]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {sourceType === "rag" && (
                    <div className="space-y-2">
                      <Label htmlFor="ragPrompt">What should the document cover?</Label>
                      <Textarea
                        id="ragPrompt"
                        placeholder="Describe what you want to generate from your documents..."
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        className="min-h-[80px]"
                        rows={3}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Output Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="h-5 w-5" />
                    Output Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Output Format</Label>
                    <Select value={outputFormat} onValueChange={(v: "markdown" | "html" | "pdf" | "docx") => setOutputFormat(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="markdown">Markdown (.md)</SelectItem>
                        <SelectItem value="html">HTML (.html)</SelectItem>
                        <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                        <SelectItem value="docx">Word Document (.docx)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                      <input
                        type="checkbox"
                        checked={includeDiagrams}
                        onChange={e => setIncludeDiagrams(e.target.checked)}
                        className="h-4 w-4 rounded border-primary"
                      />
                      <span className="flex-1">
                        <span className="font-medium">Include Diagrams</span>
                        <p className="text-xs text-muted-foreground">Add Mermaid/Graphviz diagrams</p>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                      <input
                        type="checkbox"
                        checked={includeTables}
                        onChange={e => setIncludeTables(e.target.checked)}
                        className="h-4 w-4 rounded border-primary"
                      />
                      <span className="flex-1">
                        <span className="font-medium">Include Tables</span>
                        <p className="text-xs text-muted-foreground">Add formatted tables</p>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                      <input
                        type="checkbox"
                        checked={includeCitations}
                        onChange={e => setIncludeCitations(e.target.checked)}
                        className="h-4 w-4 rounded border-primary"
                      />
                      <span className="flex-1">
                        <span className="font-medium">Include Citations</span>
                        <p className="text-xs text-muted-foreground">Add source references</p>
                      </span>
                    </label>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-4 text-lg"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Document...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Document
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Preview */}
            <div className="space-y-6">
              {generatedDoc ? (
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Generated Document
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setShowPreview(!showPreview)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCopy}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExport("pdf")}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExport("docx")}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto">
                    {showPreview ? (
                      <div className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg min-h-[500px]">
                        {generatedDoc.format === "html" ? (
                          <div dangerouslySetInnerHTML={{ __html: generatedDoc.content }} />
                        ) : (
                          <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded">
                            {generatedDoc.content}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <pre className="whitespace-pre-wrap font-mono text-sm p-4">
                          {generatedDoc.content}
                        </pre>
                      </ScrollArea>
                    )}

                    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                      <p>Words: {generatedDoc.metadata.wordCount} | Reading time: ~{generatedDoc.metadata.readingTime} min</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-[700px]">
                  <CardContent className="flex flex-col items-center justify-center h-full text-center">
                    <Sparkles className="h-16 w-16 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">No Document Generated Yet</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs">
                      Select a content source, configure options, and click Generate to create your document.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documentTemplates.map(template => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{template.name}</CardTitle>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                  <CardDescription>
                    {template.variables.length} variables • Structured template
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {template.variables.slice(0, 4).map(v => (
                      <Badge key={v.name} variant="secondary" className="gap-1">
                        {"{{" + v.name + "}}"}
                      </Badge>
                    ))}
                    {template.variables.length > 4 && (
                      <Badge variant="outline">+{template.variables.length - 4} more</Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" className="flex-1" onClick={() => {
                    setSelectedTemplate(template.id)
                    setActiveTab("generate")
                    setSourceType("template")
                    template.variables.forEach(v => {
                      setTemplateVariables(prev => ({ ...prev, [v.name]: v.default || "" }))
                    })
                  }}>
                    Use Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No documents in library</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: Document) => (
                    <div key={doc.id} className="p-4 border rounded-lg hover:bg-accent transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium truncate max-w-md">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.documentType} • {doc.pageCount || "?"} pages • {formatRelativeTime(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Diagrams</CardTitle>
            </CardHeader>
            <CardContent>
              {diagrams.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No diagrams created yet</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {diagrams.map((diagram: any) => (
                    <Card key={diagram.id}>
                      <CardHeader>
                        <CardTitle>{diagram.title}</CardTitle>
                        <CardDescription>{diagram.type} diagram</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DiagramViewer
                          definition={{
                            type: diagram.type,
                            code: diagram.definition?.code || "",
                            title: diagram.title,
                          }}
                          className="h-64"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generation History</CardTitle>
            </CardHeader>
            <CardContent>
              {documentHistory.length === 0 ? <p className="text-muted-foreground text-center py-12">Generated documents will appear here during this session.</p> : <div className="space-y-3">{documentHistory.map(doc => <Card key={doc.id}><CardHeader><CardTitle>{doc.title}</CardTitle><CardDescription>{doc.metadata.wordCount} words · {formatRelativeTime(doc.metadata.createdAt)}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => { setGeneratedDoc(doc); setActiveTab('generate') }}>Open document</Button></CardContent></Card>)}</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
  
