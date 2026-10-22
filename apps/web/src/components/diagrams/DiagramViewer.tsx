"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Download, Copy, Check, Loader2, RotateCcw, Maximize2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface DiagramViewerProps {
  definition: {
    type: "mermaid" | "graphviz" | "plantuml" | "svg" | "description"
    code: string
    title: string
    description?: string
  }
  className?: string
  editable?: boolean
  onSave?: (code: string) => void
  autoRender?: boolean
}

export function DiagramViewer({
  definition,
  className,
  editable = false,
  onSave,
  autoRender = true,
}: DiagramViewerProps) {
  const { toast } = useToast()
  const [rendered, setRendered] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editCode, setEditCode] = React.useState(definition.code)
  const [svgContent, setSvgContent] = React.useState<string | null>(null)
  const [isRendering, setIsRendering] = React.useState(false)
  const [retryCount, setRetryCount] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let isMounted = true
    
    const doRender = async () => {
      if (!autoRender) return
      
      if (definition.type === "mermaid" || definition.type === "graphviz" || definition.type === "plantuml" || definition.type === "svg") {
        if (definition.type === "mermaid") {
          if (!containerRef.current || !isMounted) return
          
          try {
            setIsRendering(true)
            setError(null)
            
            const mermaid = await import("mermaid")
            mermaid.default.initialize({
              startOnLoad: false,
              theme: "default",
              securityLevel: "loose",
              fontFamily: "inherit",
            })
  
            const { svg } = await mermaid.default.render(
              `diagram-${Date.now()}`,
              definition.code
            )
            
            if (isMounted) {
              setSvgContent(svg)
              setRendered(true)
            }
          } catch (err) {
            if (isMounted) {
              setError(err instanceof Error ? err.message : "Failed to render diagram")
              setRendered(true)
            }
          } finally {
            if (isMounted) {
              setIsRendering(false)
            }
          }
        } else if (definition.type === "svg") {
          if (isMounted) {
            setSvgContent(definition.code)
            setRendered(true)
          }
        } else if (definition.type === "graphviz" || definition.type === "plantuml") {
          try {
            setIsRendering(true)
            setError(null)
            
            const response = await fetch("/api/diagrams/render", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: definition.type,
                code: definition.code,
                title: definition.title,
              }),
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || "Server-side rendering failed")
            }
            
            const data = await response.json()
            if (isMounted) {
              setSvgContent(data.svg)
              setRendered(true)
            }
          } catch (err) {
            if (isMounted) {
              setError(err instanceof Error ? err.message : "Failed to render diagram")
              setRendered(true)
            }
          } finally {
            if (isMounted) {
              setIsRendering(false)
            }
          }
        }
      } else if (definition.type === "description") {
        if (isMounted) {
          setRendered(true)
        }
      }
    }
    
    doRender()
    
    return () => {
      isMounted = false
    }
  }, [definition.type, definition.code, autoRender, retryCount])

  const handleDownload = () => {
    if (svgContent) {
      const blob = new Blob([svgContent], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${definition.title.replace(/\s+/g, "-")}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(definition.code)
    toast({ title: "Code copied to clipboard" })
  }

  const handleSave = () => {
    if (onSave) {
      onSave(editCode)
    }
    setIsEditing(false)
  }

  const toggleEdit = () => {
    setIsEditing(!isEditing)
    if (!isEditing) {
      setEditCode(definition.code)
    }
  }

  const handleRetry = () => {
    setRendered(false)
    setError(null)
    setRetryCount(prev => prev + 1)
  }

  return (
    <TooltipProvider>
      <div className={cn("border rounded-xl overflow-hidden bg-card", className)}>
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium truncate">{definition.title}</span>
            <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{definition.type}</Badge>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {editable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleEdit}
                    aria-label={isEditing ? "Done editing" : "Edit diagram"}
                  >
                    {isEditing ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{isEditing ? "Done" : "Edit"}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  aria-label="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy code</TooltipContent>
            </Tooltip>
            {svgContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    aria-label="Download SVG"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Download SVG</TooltipContent>
              </Tooltip>
            )}
            {(definition.type === "mermaid" || definition.type === "graphviz" || definition.type === "plantuml") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRetry}
                    disabled={isRendering || !error}
                    aria-label="Retry render"
                  >
                    <RotateCcw className={cn("h-4 w-4", isRendering && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Retry render</TooltipContent>
              </Tooltip>
            )}
            {svgContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (containerRef.current) {
                        const svg = containerRef.current.querySelector("svg")
                        if (svg?.requestFullscreen) {
                          svg.requestFullscreen()
                        }
                      }
                    }}
                    aria-label="Fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Fullscreen</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="p-4 border-b bg-muted/50">
            <Textarea
              value={editCode}
              onChange={e => setEditCode(e.target.value)}
              className="font-mono text-sm min-h-[300px] resize-y"
              placeholder="Enter diagram code..."
              spellCheck={false}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className={cn(
            "p-4 min-h-[300px]",
            definition.type === "mermaid" && "mermaid-container",
            definition.type === "graphviz" && "graphviz-container",
            definition.type === "plantuml" && "plantuml-container"
          )}
        >
          {!rendered && isRendering && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Rendering diagram...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-red-500">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-medium">Failed to render diagram</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleRetry}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                {editable && (
                  <Button variant="ghost" onClick={() => setIsEditing(true)}>
                    Edit Code
                  </Button>
                )}
              </div>
            </div>
          )}

          {definition.type === "description" && rendered && (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded">{definition.code}</pre>
            </div>
          )}

          {definition.type === "svg" && rendered && svgContent && (
            <div className="w-full" dangerouslySetInnerHTML={{ __html: svgContent }} />
          )}

          {(definition.type === "mermaid" || definition.type === "graphviz" || definition.type === "plantuml") && rendered && svgContent && (
            <div className="w-full" dangerouslySetInnerHTML={{ __html: svgContent }} />
          )}
        </div>

        {definition.description && (
          <div className="p-3 border-t bg-muted/50 text-sm text-muted-foreground">
            {definition.description}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}