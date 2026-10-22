"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Bot,
  AlertCircle,
  CheckCircle2,
  BookmarkPlus,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

export interface Citation {
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
  excerpt: string
  relevanceScore: number
}

export interface SourceItem {
  id: string
  documentId: string
  documentTitle?: string
  content?: string
  excerpt?: string
  chunkIndex?: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  document?: {
    id: string
    title: string
    fileName: string
    documentType: string
    ownerId: string
  }
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  sources?: SourceItem[]
  isSourceSupported?: boolean
  groundingStatus?: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "NO_SOURCES"
  groundingNote?: string
  createdAt: string
}

interface RAGChatProps {
  conversationId?: string
  onConversationCreated?: (id: string) => void
  onSaveAsNote?: (title: string, content: string) => void
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  sourceIds?: string[]
  initialMessages?: Message[]
}

export function RAGChat({
  conversationId,
  onConversationCreated,
  onSaveAsNote,
  subjectId,
  projectId,
  notebookId,
  documentIds,
  sourceIds,
  initialMessages = [],
}: RAGChatProps) {
  const queryClient = useQueryClient()
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(
    conversationId
  )
  const [messages, setMessages] = React.useState<Message[]>(initialMessages)
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSources, setShowSources] = React.useState<Record<string, boolean>>({})
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setActiveConversationId(conversationId)
  }, [conversationId])

  React.useEffect(() => {
    if (!conversationId) {
      setActiveConversationId(undefined)
      setMessages(initialMessages)
    }
  }, [notebookId, projectId, subjectId])

  const {
    data: conversationData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    error: historyError,
  } = useQuery({
    queryKey: ["conversation", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null
      const res = await fetch(`/api/conversations/${activeConversationId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load conversation messages")
      }
      return res.json()
    },
    enabled: Boolean(activeConversationId),
  })

  React.useEffect(() => {
    if (!activeConversationId) {
      return
    }
    if (conversationData?.messages && Array.isArray(conversationData.messages)) {
      setMessages(
        conversationData.messages.map((m: any) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          citations: m.metadata?.citations || [],
          sources: m.metadata?.sources || [],
          isSourceSupported: m.metadata?.isSourceSupported,
          groundingStatus: m.metadata?.groundingStatus,
          groundingNote: m.metadata?.groundingNote,
          createdAt: m.createdAt || new Date().toISOString(),
        }))
      )
    }
  }, [activeConversationId, conversationData])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversationId: activeConversationId,
          subjectId,
          projectId,
          notebookId,
          documentIds,
          sourceIds,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Query failed")
      }

      return response.json()
    },
    onSuccess: (data) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        sources: data.sources || [],
        isSourceSupported: data.isSourceSupported,
        groundingStatus: data.groundingStatus,
        groundingNote: data.groundingNote,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, newMessage])
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
      if (data.conversationId) {
        setActiveConversationId(data.conversationId)
        queryClient.invalidateQueries({ queryKey: ["conversation", data.conversationId] })
        if (!conversationId && onConversationCreated) {
          onConversationCreated(data.conversationId)
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })
    },
    onSettled: () => {
      setIsLoading(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsLoading(true)
    sendMessage.mutate(currentInput)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {conversationData?.conversation?.title ||
              (notebookId ? "Notebook Grounded Q&A" : "AI Assistant")}
            <Badge variant="outline" className="text-xs font-normal">
              {notebookId ? "Source-Grounded" : "RAG"}
            </Badge>
          </CardTitle>
          {activeConversationId && messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setActiveConversationId(undefined)
                setMessages([])
              }}
            >
              New Thread
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 pb-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading conversation history...</span>
              </div>
            ) : isHistoryError ? (
              <div className="flex items-center justify-center py-8 text-destructive gap-2">
                <AlertCircle className="h-5 w-5" />
                <span>
                  {historyError instanceof Error ? historyError.message : "Failed to load conversation"}
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm">
                  {notebookId
                    ? "Ask a question about your notebook sources. Answers cite the exact source, page, and section, and clearly flag unsupported topics."
                    : "No messages in this conversation yet. Ask a question below to begin."}
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showSources={Boolean(showSources[message.id])}
                  onToggleSources={() =>
                    setShowSources((prev) => ({ ...prev, [message.id]: !prev[message.id] }))
                  }
                  onCopy={copyToClipboard}
                  onSaveAsNote={onSaveAsNote}
                />
              ))
            )}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3 animate-pulse">
                    <div className="h-4 bg-muted-foreground/50 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted-foreground/50 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <Separator />
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={
                notebookId
                  ? "Ask a question or follow-up grounded in your notebook sources..."
                  : "Ask a question about your documents or coursework..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              className="flex-1 min-h-[80px] max-h-[200px] resize-none"
              disabled={isLoading}
              rows={2}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="lg"
              className="self-end"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground text-center">
            Responses cite source title, page, and section when supported, and explicitly identify unsupported questions.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

interface MessageBubbleProps {
  message: Message
  showSources: boolean
  onToggleSources: () => void
  onCopy: (text: string) => void
  onSaveAsNote?: (title: string, content: string) => void
}

function MessageBubble({
  message,
  showSources,
  onToggleSources,
  onCopy,
  onSaveAsNote,
}: MessageBubbleProps) {
  const isUser = message.role === "user"
  const hasCitations = Boolean(message.citations && message.citations.length > 0)
  const hasSources = Boolean(message.sources && message.sources.length > 0)
  const isSupported =
    message.isSourceSupported !== undefined
      ? message.isSourceSupported
      : message.groundingStatus === "SUPPORTED" || hasCitations

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn("flex-1 max-w-[85%]", isUser ? "text-right" : "text-left")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5",
            isUser ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
          )}
        >
          {!isUser && (message.groundingStatus || message.isSourceSupported !== undefined) && (
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              {isSupported ? (
                <Badge
                  variant="outline"
                  className="text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Source-Supported
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  Unsupported by Sources
                </Badge>
              )}
              {message.groundingNote && (
                <span className="text-[11px] text-muted-foreground">{message.groundingNote}</span>
              )}
            </div>
          )}

          <div className="whitespace-pre-wrap">{message.content}</div>

          {hasCitations && (
            <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
              {message.citations!.map((citation, index) => (
                <Badge
                  key={citation.id || index}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={() => navigator.clipboard.writeText(citation.excerpt || "")}
                  title={citation.excerpt}
                >
                  [{index + 1}] {citation.documentTitle}
                  {citation.pageNumber && <span className="ml-1">· p.{citation.pageNumber}</span>}
                  {citation.sectionTitle && <span className="ml-1">· {citation.sectionTitle}</span>}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{formatRelativeTime(message.createdAt)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCopy(message.content)}
            title="Copy message"
          >
            <Copy className="h-3 w-3" />
          </Button>
          {!isUser && onSaveAsNote && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                onSaveAsNote(
                  `Q&A Note (${new Date().toLocaleDateString()})`,
                  message.content
                )
              }
              title="Save answer to Notebook Notes"
            >
              <BookmarkPlus className="h-3 w-3" />
            </Button>
          )}
          {(hasCitations || hasSources) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleSources}
              title={showSources ? "Hide cited excerpts" : "Show cited excerpts"}
            >
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
        </div>
        {showSources && (
          <div className="mt-2 ml-4 mr-2 space-y-2 border-l-2 border-muted pl-3">
            {(message.sources && message.sources.length > 0
              ? message.sources
              : (message.citations || []).map(c => ({
                  id: c.id,
                  documentId: c.documentId,
                  documentTitle: c.documentTitle,
                  pageNumber: c.pageNumber,
                  sectionTitle: c.sectionTitle,
                  similarity: c.relevanceScore,
                  excerpt: c.excerpt,
                }))
            ).map((source, index) => (
              <SourceCard key={source.id || index} source={source} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface SourceCardProps {
  source: SourceItem
  index: number
}

function SourceCard({ source, index }: SourceCardProps) {
  const title = source.documentTitle || source.document?.title || `Source ${index + 1}`
  const text = source.excerpt || source.content || ""
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm">
          [{index + 1}] {title}
        </span>
        {typeof source.similarity === "number" && (
          <Badge variant="outline" className="text-xs">
            {Math.round(source.similarity * 100)}% match
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {source.pageNumber && <span>Page {source.pageNumber}</span>}
        {source.sectionTitle && <span>· Section: {source.sectionTitle}</span>}
      </div>
      {text && <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{text}</div>}
    </div>
  )
}