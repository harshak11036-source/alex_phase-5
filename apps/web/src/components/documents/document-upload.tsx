"use client"

import * as React from "react"
import { useDropzone, type FileRejection } from "react-dropzone"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Upload, FileText, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

export interface UploadedDocumentInfo {
  id: string
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  documentType: string
  status: string
  pageCount?: number | null
  chunksCount?: number
}

interface DocumentUploadProps {
  onSuccess?: (document: UploadedDocumentInfo) => void
  subjectId?: string
  projectId?: string
  notebookId?: string
  multiple?: boolean
  maxFiles?: number
}

export const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/jpg",
]

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "txt",
  "md",
  "markdown",
  "csv",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
]

export const MAX_FILE_SIZE = 50 * 1024 * 1024

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number, stage: string) => void
): Promise<{ ok: boolean; status: number; data: any }> {
  if (typeof XMLHttpRequest !== "undefined") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", url, true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const uploadPct = Math.min(75, Math.max(5, Math.round((event.loaded / event.total) * 75)))
          onProgress(uploadPct, uploadPct < 75 ? `Uploading (${uploadPct}%)...` : "Extracting & indexing text...")
        }
      }

      xhr.onload = () => {
        let parsed: any = {}
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {}
        } catch {
          parsed = { error: xhr.statusText || "Invalid server response" }
        }
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data: parsed,
        })
      }

      xhr.onerror = () => {
        reject(new Error("Network error while uploading file"))
      }

      xhr.ontimeout = () => {
        reject(new Error("Upload timed out"))
      }

      onProgress(10, "Uploading file...")
      xhr.send(formData)
    })
  }

  // Fallback for non-browser test environments
  onProgress(25, "Uploading file...")
  return fetch(url, { method: "POST", body: formData }).then(async (res) => {
    onProgress(85, "Extracting & indexing text...")
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  })
}

export function DocumentUpload({
  onSuccess,
  subjectId,
  projectId,
  notebookId,
  multiple = true,
  maxFiles = 10,
}: DocumentUploadProps) {
  const queryClient = useQueryClient()
  const [files, setFiles] = React.useState<File[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const [stageLabels, setStageLabels] = React.useState<Record<string, string>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [completedDocs, setCompletedDocs] = React.useState<UploadedDocumentInfo[]>([])

  const validateFileClientSide = React.useCallback((file: File): string | null => {
    if (file.size === 0) {
      return "File is empty (0 bytes)"
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 50MB limit`
    }
    const ext = file.name.includes(".")
      ? file.name.split(".").pop()?.trim().toLowerCase() || ""
      : ""
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
      return `Unsupported file type "${ext || file.type || "unknown"}". Supported: PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX, PPT, PPTX, PNG, JPG.`
    }
    return null
  }, [])

  const onDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const nextErrors: Record<string, string> = {}

      for (const rejection of fileRejections) {
        const f = rejection.file
        const customErr = validateFileClientSide(f)
        if (customErr) {
          nextErrors[f.name] = customErr
        } else {
          const dropzoneReason = rejection.errors.map(e => e.message).join("; ")
          nextErrors[f.name] = dropzoneReason || "File rejected"
        }
      }

      const validFiles: File[] = []
      for (const file of acceptedFiles) {
        const err = validateFileClientSide(file)
        if (err) {
          nextErrors[file.name] = err
        } else {
          validFiles.push(file)
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...nextErrors }))
      }

      if (validFiles.length > 0) {
        setFiles(prev => {
          const existingNames = new Set(prev.map(p => p.name))
          const deduped = validFiles.filter(f => !existingNames.has(f.name))
          return [...prev, ...deduped].slice(0, maxFiles)
        })
      }
    },
    [maxFiles, validateFileClientSide]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md", ".markdown"],
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    multiple,
    maxFiles,
    maxSize: MAX_FILE_SIZE,
  })

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName))
    setErrors(prev => {
      const next = { ...prev }
      delete next[fileName]
      return next
    })
    setProgress(prev => {
      const next = { ...prev }
      delete next[fileName]
      return next
    })
    setStageLabels(prev => {
      const next = { ...prev }
      delete next[fileName]
      return next
    })
  }

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return
    setUploading(true)
    setErrors({})
    const failedFiles: File[] = []
    const newlyCompleted: UploadedDocumentInfo[] = []

    for (const file of files) {
      try {
        const clientError = validateFileClientSide(file)
        if (clientError) {
          throw new Error(clientError)
        }

        setProgress(prev => ({ ...prev, [file.name]: 5 }))
        setStageLabels(prev => ({ ...prev, [file.name]: "Starting upload..." }))

        const formData = new FormData()
        formData.append("file", file)
        if (subjectId) formData.append("subjectId", subjectId)
        if (projectId) formData.append("projectId", projectId)
        if (notebookId) formData.append("notebookId", notebookId)

        const { ok, data } = await uploadWithProgress(
          "/api/documents",
          formData,
          (pct, stage) => {
            setProgress(prev => ({ ...prev, [file.name]: pct }))
            setStageLabels(prev => ({ ...prev, [file.name]: stage }))
          }
        )

        if (!ok) {
          throw new Error(data?.error || "Document upload and processing failed")
        }

        const doc: UploadedDocumentInfo | undefined = data?.document
        if (!doc || doc.status === "FAILED") {
          throw new Error(
            data?.error ||
              (doc as any)?.errorMessage ||
              "Document processing failed to reach READY state"
          )
        }

        setProgress(prev => ({ ...prev, [file.name]: 100 }))
        setStageLabels(prev => ({
          ...prev,
          [file.name]: `Ready (${doc.chunksCount ?? 1} chunks${doc.pageCount ? `, ${doc.pageCount}p` : ""})`,
        }))
        newlyCompleted.push(doc)
        onSuccess?.(doc)
      } catch (error) {
        failedFiles.push(file)
        const msg = error instanceof Error ? error.message : "Upload failed"
        setErrors(prev => ({ ...prev, [file.name]: msg }))
        setStageLabels(prev => ({ ...prev, [file.name]: "Failed" }))
      }
    }

    if (newlyCompleted.length > 0) {
      setCompletedDocs(prev => [...newlyCompleted, ...prev].slice(0, 5))
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      queryClient.invalidateQueries({ queryKey: ["subject-resources"] })
      queryClient.invalidateQueries({ queryKey: ["research-sources"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      toast({
        title: `Processed ${newlyCompleted.length} document${newlyCompleted.length > 1 ? "s" : ""}`,
        description: `${newlyCompleted.map(d => d.title).join(", ")} ready for AI analysis and search.`,
      })
    }

    setUploading(false)
    setFiles(failedFiles)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {isDragActive ? "Drop files here..." : "Drag & drop files here, or click to select"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX, PPT, PPTX, PNG, JPG, JPEG (max 50MB each)
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-medium">Files queued for upload ({files.length})</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map(file => (
                <div key={file.name} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      {stageLabels[file.name] && (
                        <span className="text-xs text-muted-foreground">{stageLabels[file.name]}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {progress[file.name] !== undefined && (
                      <Progress value={progress[file.name]} className="mt-1 h-1.5" />
                    )}
                  </div>
                  {errors[file.name] && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent side="top">{errors[file.name]}</TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.name)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading & Processing...
                  </>
                ) : (
                  `Upload & Process ${files.length} File${files.length > 1 ? "s" : ""}`
                )}
              </Button>
              <Button variant="outline" onClick={() => setFiles([])} disabled={uploading}>
                Clear All
              </Button>
            </div>
          </div>
        )}

        {completedDocs.length > 0 && files.length === 0 && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Processed & Connected to AI Engine
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setCompletedDocs([])}
              >
                Dismiss
              </Button>
            </div>
            {completedDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate font-medium text-foreground">{doc.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {doc.status} · {doc.chunksCount ?? 1} chunks
                </Badge>
              </div>
            ))}
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h5 className="text-sm font-medium text-destructive">Upload & Validation Errors</h5>
            <ul className="mt-1 text-sm text-destructive space-y-1">
              {Object.entries(errors).map(([fileName, error]) => (
                <li key={fileName}>
                  <strong>{fileName}</strong>: {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}