"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Bell,
  CheckCircle,
  XCircle,
  Mail,
  Smartphone,
  BellOff,
  Filter,
  FileText,
  UserCheck,
  BarChart,
  Target,
  MessageSquare,
  FlaskConical,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Notification {
  id: string
  userId: string
  category: string
  title: string
  message: string
  referenceId: string | null
  referenceType: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

const CATEGORIES = [
  "ASSIGNMENT",
  "ATTENDANCE",
  "INTERNAL_ASSESSMENT",
  "ACADEMIC_ANNOUNCEMENT",
  "PROJECT_MILESTONE",
  "MENTOR_FEEDBACK",
  "RESEARCH_UPDATE",
  "STUDY_REMINDER",
  "UPCOMING_DEADLINE",
  "DOCUMENT_PROCESSING_FAILURE",
  "AI_TASK_COMPLETION",
]

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("all")
  const [filterCategory, setFilterCategory] = React.useState<string>("all")

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to mark")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "POST" })
      if (!res.ok) throw new Error("Failed to mark all")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" }),
  })

  const filteredNotifications = notifications?.notifications?.filter((n: Notification) =>
    (activeTab === "all" || (activeTab === "unread" ? !n.isRead : n.isRead)) &&
    (filterCategory === "all" || n.category === filterCategory)
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Stay updated with your academic activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => markAllRead.mutate()}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label htmlFor="category-filter" className="sr-only">Filter by category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="pt-0">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                {activeTab === "unread" ? "No unread notifications" : "No notifications"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredNotifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-4 border-b ${notification.isRead ? "bg-background" : "bg-primary/5"}`}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: getCategoryColor(notification.category) }}
                  >
                    {getCategoryIcon(notification.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium ${notification.isRead ? "" : "font-semibold"}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {notification.category.replace("_", " ")}
                      </Badge>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => markRead.mutate(notification.id)}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    ASSIGNMENT: "#3b82f6",
    ATTENDANCE: "#ef4444",
    INTERNAL_ASSESSMENT: "#f59e0b",
    ACADEMIC_ANNOUNCEMENT: "#8b5cf6",
    PROJECT_MILESTONE: "#10b981",
    MENTOR_FEEDBACK: "#ec4899",
    RESEARCH_UPDATE: "#06b6d4",
    STUDY_REMINDER: "#84cc16",
    UPCOMING_DEADLINE: "#f97316",
    DOCUMENT_PROCESSING_FAILURE: "#ef4444",
    AI_TASK_COMPLETION: "#6366f1",
  }
  return colors[category] || "#6b7280"
}

function getCategoryIcon(category: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    ASSIGNMENT: <FileText className="h-5 w-5" />,
    ATTENDANCE: <UserCheck className="h-5 w-5" />,
    INTERNAL_ASSESSMENT: <BarChart className="h-5 w-5" />,
    ACADEMIC_ANNOUNCEMENT: <Mail className="h-5 w-5" />,
    PROJECT_MILESTONE: <Target className="h-5 w-5" />,
    MENTOR_FEEDBACK: <MessageSquare className="h-5 w-5" />,
    RESEARCH_UPDATE: <FlaskConical className="h-5 w-5" />,
    STUDY_REMINDER: <Bell className="h-5 w-5" />,
    UPCOMING_DEADLINE: <Clock className="h-5 w-5" />,
    DOCUMENT_PROCESSING_FAILURE: <AlertCircle className="h-5 w-5" />,
    AI_TASK_COMPLETION: <Sparkles className="h-5 w-5" />,
  }
  return icons[category] || <Bell className="h-5 w-5" />
}