"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { X, Mic, Volume2, VolumeX, ChevronDown, Sparkles, Brain, Send, Maximize2, Home, FileText, BookOpen, Calendar, Bot, MessageSquare, RefreshCw, Trash2, Copy, Download, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Speech Recognition types (not in standard TypeScript lib)
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

function getTimestamp() {
  return Date.now()
}

interface AIAvatarProps {
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  pageContext?: string
}

const avatarComponents = {
  bot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="9" r="1" />
      <path d="M9 15h6" />
      <path d="M9 11v-1" />
      <path d="M15 11v-1" />
    </svg>
  ),
  cat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <path d="M12 5c.5 0 1 .5 1 1s-.5 1-1 1-1-.5-1-1 .5-1 1-1z" />
      <path d="M19 14c0 4-3 7-7 7H12c-4 0-7-3-7-7" />
      <circle cx="8" cy="14" r="1" />
      <circle cx="16" cy="14" r="1" />
      <path d="M12 12v4" />
      <path d="M8 17h8" />
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="16" cy="8" r="1" />
      <path d="M6 16h12" />
      <path d="M4 12h4" />
      <path d="M16 12h4" />
    </svg>
  ),
  orb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
}

const quickActions = [
  { label: "Summarize current page", icon: FileText, action: "summarize" },
  { label: "Explain this topic", icon: BookOpen, action: "explain" },
  { label: "Create study notes", icon: Bot, action: "notes" },
  { label: "Upcoming deadlines", icon: Calendar, action: "deadlines" },
  { label: "Clear conversation", icon: Trash2, action: "clear", destructive: true },
]

export function AIAvatar({
  subjectId,
  projectId,
  notebookId,
  documentIds,
  pageContext,
}: AIAvatarProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [isListening, setIsListening] = React.useState(false)
  const [isSpeaking, setIsSpeaking] = React.useState(false)
  const [avatarStyle, setAvatarStyle] = React.useState<"bot" | "cat" | "robot" | "orb">("bot")
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const [conversationId, setConversationId] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("alex-avatar-conv-default")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.conversationId || null
        } catch {}
      }
    }
    return null
  })
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "assistant"; content: string; timestamp: number }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("alex-avatar-conv-default")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.messages || []
        } catch {}
      }
    }
    return []
  })
  const [showQuickActions, setShowQuickActions] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Detect mobile viewport
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Save conversation to localStorage
  React.useEffect(() => {
    if (conversationId) {
      localStorage.setItem(`alex-avatar-conv-${conversationId}`, JSON.stringify({
        conversationId,
        messages,
        updatedAt: Date.now(),
      }))
    } else if (messages.length > 0) {
      localStorage.setItem(`alex-avatar-conv-default`, JSON.stringify({
        conversationId: null,
        messages,
        updatedAt: Date.now(),
      }))
    }
  }, [messages, conversationId])

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const toggleOpen = () => setIsOpen(!isOpen)
  const minimize = () => setIsMinimized(true)
  const maximize = () => setIsMinimized(false)
  const close = () => { setIsOpen(false); setIsMinimized(false) }

  const getCurrentAvatar = React.useCallback(() => avatarComponents[avatarStyle], [avatarStyle])

  const buildContext = React.useCallback(() => {
    const contexts: string[] = []
    
    if (pageContext) {
      contexts.push(`Current page context: ${pageContext}`)
    }
    
    if (subjectId) {
      contexts.push(`Subject context: ${subjectId}`)
    }
    
    if (projectId) {
      contexts.push(`Project context: ${projectId}`)
    }
    
    if (notebookId) {
      contexts.push(`Research notebook context: ${notebookId}`)
    }
    
    if (documentIds?.length) {
      contexts.push(`Referenced documents: ${documentIds.join(', ')}`)
    }
    
    return contexts.join('\n')
  }, [pageContext, subjectId, projectId, notebookId, documentIds])

  const handleSendMessage = async (content: string, contextOverride?: string) => {
    if (!content.trim()) return

    const timestamp = getTimestamp()
    const userMessage = { role: "user" as const, content, timestamp }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const context = contextOverride || buildContext()
      
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: content,
          subjectId,
          projectId,
          notebookId,
          documentIds,
          conversationId,
          context,
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, timestamp: Date.now() }])
      if (data.conversationId) setConversationId(data.conversationId)

      if (isSpeaking) {
        speak(data.answer)
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    handleSendMessage(input)
  }

  const speak = async (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast({ title: "Voice not supported", description: "Your browser doesn't support text-to-speech", variant: "destructive" })
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  const startListening = () => {
    const win = window as Window & {
      SpeechRecognition?: { new(): SpeechRecognition };
      webkitSpeechRecognition?: { new(): SpeechRecognition };
    }
    if (!("webkitSpeechRecognition" in win) && !("SpeechRecognition" in win)) {
      toast({ title: "Voice not supported", description: "Your browser doesn't support speech recognition", variant: "destructive" })
      return
    }

    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result: SpeechRecognitionResult) => result[0].transcript)
        .join("")

      if (event.results[0].isFinal) {
        handleSendMessage(transcript)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
      toast({ title: "Voice error", description: "Failed to recognize speech", variant: "destructive" })
    }

    recognition.start()
  }

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      summarize: "Please summarize the content of the current page I'm viewing.",
      explain: "Please explain the main topic of the current page in simple terms.",
      notes: "Create structured study notes from the current page content.",
      deadlines: "What are my upcoming deadlines and assignments?",
      clear: "",
    }
    
    const prompt = prompts[action]
    if (prompt) {
      handleSendMessage(prompt)
    } else if (action === "clear") {
      setMessages([])
      setConversationId(null)
      localStorage.removeItem(`alex-avatar-conv-default`)
      toast({ title: "Conversation cleared" })
    }
    setShowQuickActions(false)
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    toast({ title: "Copied to clipboard" })
  }

  const exportConversation = () => {
    const text = messages.map(m => `${m.role === 'user' ? 'You' : 'ALEX'}: ${m.content}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alex-conversation-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Pre-compute message elements
  const messageElements = React.useMemo(() => {
    if (messages.length === 0) return null
    return messages.map((message, index) => (
      <motion.div
        key={`${index}-${message.role}-${message.timestamp}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
      >
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}>
          {message.role === "user" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            getCurrentAvatar()
          )}
        </div>
        <div className={cn("flex-1 max-w-[85%]", message.role === "user" ? "text-right" : "text-left")}>
          <div className={cn(
            "inline-block rounded-2xl px-4 py-2 relative",
            message.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
          )}>
            <div className="whitespace-pre-wrap">{message.content}</div>
            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-0 mb-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyMessage(message.content)} title="Copy">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1 text-xs text-muted-foreground">
            <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </motion.div>
    ))
  }, [messages, getCurrentAvatar])

  // Responsive panel classes
  const isDesktop = !isMobile
  const panelClasses = cn(
    "fixed z-50 bg-card border rounded-2xl shadow-xl flex flex-col overflow-hidden",
    isDesktop
      ? "bottom-6 right-6 w-96 max-h-[600px]"
      : "bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl rounded-b-none",
    isMinimized && isDesktop && "h-16 max-h-16",
    isMinimized && isMobile && "h-16 max-h-16"
  )

  const panelAnimation = isMobile
    ? { initial: { opacity: 0, y: "100%" }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: "100%" } }
    : { initial: { opacity: 0, scale: 0.95, y: 20 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 20 } }

  const fabClasses = cn(
    "fixed z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg",
    "hover:shadow-xl transition-all duration-300",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isOpen && "hidden",
    isMobile ? "bottom-4 right-4" : "bottom-6 right-6"
  )

  // Get page context from URL
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const pageContextMap: Record<string, string> = {
    '/dashboard/documents': 'Document library - user can upload, view, and manage documents',
    '/dashboard/assistant': 'AI Assistant chat interface',
    '/dashboard/solution-generator': 'Document-to-Solution Engine - generate academic solutions from documents',
    '/dashboard/document-studio': 'Document Studio - create professional documents',
    '/dashboard/study-studio': 'Study Studio - flashcards, notes, mind maps, quizzes',
    '/dashboard/attendance': 'Attendance tracking and management',
    '/dashboard/assessments': 'Assessments and internal marks',
    '/dashboard/assignments': 'Assignments management',
    '/dashboard/projects': 'Project management and collaboration',
    '/dashboard/research': 'Research Lab - notebooks, sources, notes',
    '/dashboard/planner': 'Smart Planner - calendar, tasks, events',
    '/dashboard/subjects': 'Subject enrollment and resources',
    '/dashboard/achievements': 'Achievements and portfolio',
    '/dashboard/settings': 'Settings and preferences',
    '/dashboard/ai-settings': 'AI Model and API configuration',
  }

  const detectedContext = pageContext || pageContextMap[currentPath] || 'Dashboard home page'

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              onClick={toggleOpen}
              className={fabClasses}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{ rotate: isOpen ? 180 : 0 }}
              aria-label="Open AI Assistant"
            >
              <TooltipContent side="left">AI Assistant</TooltipContent>
              {getCurrentAvatar()}
            </motion.button>
          </TooltipTrigger>
        </Tooltip>

        {isOpen && (
          <AnimatePresence>
            <motion.div
              ref={panelRef}
              {...panelAnimation}
              transition={{ duration: isMobile ? 0.3 : 0.2, ease: "easeOut" }}
              className={panelClasses}
            >
              {/* Backdrop on mobile */}
              {isMobile && !isMinimized && (
                <div
                  className="fixed inset-0 bg-black/50 z-[-1] lg:hidden"
                  onClick={close}
                  aria-hidden="true"
                />
              )}

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 border-b bg-primary/5"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", "bg-primary/10 text-primary")}>
                      {getCurrentAvatar()}
                    </div>
                    <motion.div
                      animate={{ scale: isListening ? [1, 1.2, 1] : 1 }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className={cn("absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card", isListening && "bg-red-500 animate-pulse")}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">ALEX</p>
                    <p className="text-xs text-muted-foreground truncate">AI Academic Assistant</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const styles = ["bot", "cat", "robot", "orb"] as const
                          const idx = styles.indexOf(avatarStyle)
                          setAvatarStyle(styles[(idx + 1) % styles.length])
                        }}
                        aria-label="Change avatar"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Change Avatar</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Quick actions"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Quick Actions</TooltipContent>
                      </Tooltip>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {quickActions.map(action => (
                        <DropdownMenuItem
                          key={action.action}
                          onClick={() => handleQuickAction(action.action)}
                          className={cn(action.destructive && "text-destructive focus:text-destructive")}
                        >
                          <action.icon className="mr-2 h-4 w-4" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={exportConversation}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Conversation
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMessages([])}>
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        Clear History
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={isMinimized ? maximize : minimize}
                        aria-label={isMinimized ? "Maximize" : "Minimize"}
                      >
                        {isMinimized ? <Maximize2 className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{isMinimized ? "Maximize" : "Minimize"}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={close}
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Close</TooltipContent>
                  </Tooltip>
                </div>
              </motion.div>

              <AnimatePresence mode="wait">
                {!isMinimized && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <div className="flex-1 p-4 overflow-y-auto">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Brain className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="text-sm">How can I help you today?</p>
                            <p className="text-xs mt-1">Ask about your documents, assignments, or studies</p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                              {quickActions.slice(0, 4).map(action => (
                                <Button
                                  key={action.action}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickAction(action.action)}
                                  className="text-xs"
                                >
                                  <action.icon className="mr-1 h-3 w-3" />
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {messageElements}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Input area */}
                    <Separator />
                    <form onSubmit={handleSubmit} className="p-4 space-y-2">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Ask a question..."
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          className={cn(
                            "flex-1 min-h-[60px] max-h-[120px] resize-none",
                            isMobile && "text-base"
                          )}
                          disabled={isLoading}
                          rows={1}
                          autoComplete="off"
                        />
                        <Button
                          type="submit"
                          disabled={!input.trim() || isLoading}
                          size="icon"
                          className={cn("h-10 w-10", isMobile && "h-12 w-12")}
                          aria-label="Send"
                        >
                          {isLoading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}><Send className="h-4 w-4" /></motion.div>
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", isMobile && "h-10 w-10")}
                                onClick={isListening ? undefined : startListening}
                                disabled={isListening || isLoading}
                                aria-label={isListening ? "Listening..." : "Voice input"}
                              >
                                <Mic className={cn("h-4 w-4", isListening && "text-red-500 animate-pulse")} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Voice input</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", isMobile && "h-10 w-10")}
                                onClick={isSpeaking ? stopSpeaking : undefined}
                                disabled={!isSpeaking}
                                aria-label={isSpeaking ? "Stop speaking" : "Speak last answer"}
                              >
                                {isSpeaking ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{isSpeaking ? "Stop speaking" : "Speak last answer"}</TooltipContent>
                          </Tooltip>
                        </div>
                        <p>Powered by your documents & context</p>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        )}
      </TooltipProvider>
    </>
  )
}