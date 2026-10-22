"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DocumentUpload } from "./document-upload"
import { DocumentStatus } from "@prisma/client"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import {
  FileText,
  Search,
  Filter,
  Download,
  RotateCcw,
  Trash2,
  Edit,
  Eye,
  MoreHorizontal,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  File,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

interface DocumentListProps {
  documents: DocumentListItem[]
  isLoading?: boolean
  onRetry?: (id: string) => void
  onDelete?: (id: string) => void
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  subjectId?: string
  projectId?: string
  notebookId?: string
  showUpload?: boolean
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  UPLOADED: { label: "Uploaded", color: "bg-gray-100 text-gray-800", icon: <File className="h-3 w-3" /> },
  QUEUED: { label: "Queued", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-3 w-3" /> },
  EXTRACTING: { label: "Extracting", color: "bg-yellow-100 text-yellow-800", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  CHUNKING: { label: "Chunking", color: "bg-yellow-100 text-yellow-800", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  EMBEDDING: { label: "Embedding", color: "bg-yellow-100 text-yellow-800", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  INDEXING: { label: "Indexing", color: "bg-yellow-100 text-yellow-800", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  READY: { label: "Ready", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4 text-red-500" />,
  DOC: <FileText className="h-4 w-4 text-blue-500" />,
  DOCX: <FileText className="h-4 w-4 text-blue-500" />,
  TXT: <FileText className="h-4 w-4 text-gray-500" />,
  MARKDOWN: <FileText className="h-4 w-4 text-gray-500" />,
  CSV: <FileText className="h-4 w-4 text-green-500" />,
  XLS: <FileText className="h-4 w-4 text-green-500" />,
  XLSX: <FileText className="h-4 w-4 text-green-500" />,
  PPT: <FileText className="h-4 w-4 text-orange-500" />,
  PPTX: <FileText className="h-4 w-4 text-orange-500" />,
  PNG: <FileText className="h-4 w-4 text-purple-500" />,
  JPG: <FileText className="h-4 w-4 text-purple-500" />,
  JPEG: <FileText className="h-4 w-4 text-purple-500" />,
}

export function DocumentList({
  documents,
  isLoading = false,
  onRetry,
  onDelete,
  onView,
  onEdit,
  subjectId,
  projectId,
  notebookId,
  showUpload = true,
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const statuses = Object.keys(STATUS_CONFIG) as DocumentStatus[]

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading documents...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {showUpload && (
        <DocumentUpload
          subjectId={subjectId}
          projectId={projectId}
          notebookId={notebookId}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <SelectWrapper>
              <Label htmlFor="status-filter" className="sr-only">Filter by status</Label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-9 w-40 border border-input bg-background px-3 py-2 text-sm rounded-md"
              >
                <option value="all">All Status</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                ))}
              </select>
            </SelectWrapper>
            <SelectWrapper>
              <Label htmlFor="type-filter" className="sr-only">Filter by type</Label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="h-9 w-40 border border-input bg-background px-3 py-2 text-sm rounded-md"
              >
                <option value="all">All Types</option>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="TXT">TXT</option>
                <option value="MARKDOWN">Markdown</option>
                <option value="CSV">CSV</option>
                <option value="XLSX">XLSX</option>
                <option value="PPTX">PPTX</option>
                <option value="PNG">PNG</option>
                <option value="JPG">JPG</option>
              </select>
            </SelectWrapper>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                {documents.length === 0 ? "No documents uploaded yet" : "No documents match your filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map(doc => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onRetry={onRetry}
                  onDelete={onDelete}
                  onView={onView}
                  onEdit={onEdit}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>
}

interface DocumentRowProps {
  document: DocumentListItem
  onRetry?: (id: string) => void
  onDelete?: (id: string) => void
  onView?: (id: string) => void
  onEdit?: (id: string) => void
}

function DocumentRow({ document, onRetry, onDelete, onView, onEdit }: DocumentRowProps) {
  const statusConfig = STATUS_CONFIG[document.status]

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-shrink-0 p-2 bg-muted rounded-lg">
        {TYPE_ICONS[document.documentType] || <File className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{document.title}</p>
          <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.label}</span>
          </Badge>
          {document.subject && (
            <Badge variant="secondary" className="text-xs">
              {document.subject.code}
            </Badge>
          )}
          {document.project && (
            <Badge variant="secondary" className="text-xs">
              {document.project.title}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span>{document.fileName}</span>
          <span>•</span>
          <span>{(Number(document.fileSize) / 1024 / 1024).toFixed(2)} MB</span>
          {document.pageCount && (
            <>
              <span>•</span>
              <span>{document.pageCount} pages</span>
            </>
          )}
          <span>•</span>
          <span>{document.chunksCount} chunks</span>
          <span>•</span>
          <span>{formatRelativeTime(document.createdAt)}</span>
        </div>
        {document.errorMessage && (
          <p className="mt-1 text-sm text-destructive">{document.errorMessage}</p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onView?.(document.id)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit?.(document.id)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Metadata
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.location.href = `/api/documents/${document.id}/download`}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {document.status === DocumentStatus.FAILED && (
            <DropdownMenuItem onClick={() => onRetry?.(document.id)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Processing
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete?.(document.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}