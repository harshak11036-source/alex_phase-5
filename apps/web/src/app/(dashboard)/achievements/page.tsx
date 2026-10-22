"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { DocumentUpload } from "@/components/documents/document-upload"
import { Plus, Award, Trophy, Medal, Star, Calendar, Download, FileText } from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Achievement {
  id: string
  userId: string
  title: string
  category: string
  organization: string | null
  startDate: string | null
  endDate: string | null
  description: string | null
  status: string
  verificationStatus: string
  verifiedBy: string | null
  verifiedAt: string | null
  certificateUrl: string | null
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  "INTERNSHIP",
  "CERTIFICATION",
  "WORKSHOP",
  "HACKATHON",
  "RESEARCH_PUBLICATION",
  "TECHNICAL_COMPETITION",
  "CLUB_ACTIVITY",
  "VOLUNTEERING",
  "PROJECT",
  "AWARD",
  "PLACEMENT_PREPARATION",
  "OTHER",
]

export default function AchievementsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("achievements")
  const [showCreate, setShowCreate] = React.useState(false)

  const { data: achievements } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const res = await fetch('/api/achievements')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const createAchievement = useMutation({
    mutationFn: async (data: Partial<Achievement>) => {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      setShowCreate(false)
      toast({ title: "Achievement added" })
    },
    onError: () => toast({ title: "Error", description: "Failed to add achievement", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
          <p className="text-muted-foreground mt-1">Track your certificates, internships, and extracurricular activities</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Achievement
        </Button>
      </div>

      {showCreate && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Add New Achievement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createAchievement.mutate({ title: fd.get('title') as string, category: fd.get('category') as string, organization: fd.get('organization') as string, description: fd.get('description') as string, startDate: fd.get('startDate') as string, endDate: fd.get('endDate') as string }) }} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input name="title" placeholder="e.g., AWS Certified Solutions Architect" required />
              </div>
              <div>
                <Label>Category</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Organization</Label>
                <Input name="organization" placeholder="e.g., Amazon Web Services" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Start Date</Label>
                  <DatePicker />
                </div>
                <div>
                  <Label>End Date</Label>
                  <DatePicker />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" placeholder="Details about this achievement..." />
              </div>
              <div>
                <Label>Certificate</Label>
                <DocumentUpload />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Add Achievement</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="achievements">All Achievements</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {achievements?.achievements?.map((achievement: Achievement) => (
              <Card key={achievement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{achievement.title}</CardTitle>
                      <Badge variant="outline" className="mt-1">{achievement.category.replace('_', ' ')}</Badge>
                    </div>
                    <Badge variant={
                      achievement.verificationStatus === 'VERIFIED' ? 'success' :
                      achievement.verificationStatus === 'PENDING' ? 'warning' : 'outline'
                    }>
                      {achievement.verificationStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {achievement.organization && (
                      <p className="text-muted-foreground">{achievement.organization}</p>
                    )}
                    {achievement.startDate && achievement.endDate && (
                      <p className="text-muted-foreground">
                        {formatDate(achievement.startDate)} - {formatDate(achievement.endDate)}
                      </p>
                    )}
                    {achievement.description && (
                      <p className="text-muted-foreground line-clamp-2">{achievement.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Card onClick={() => setShowCreate(true)} className="cursor-pointer hover:shadow-md transition-shadow border-dashed">
              <CardContent className="pt-12 pb-12 text-center">
                <Plus className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Add new achievement</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Achievement Portfolio</CardTitle>
              <p className="text-sm text-muted-foreground">Generate a downloadable portfolio of your achievements</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Total Achievements</p>
                  <p className="text-sm text-muted-foreground">{achievements?.achievements?.length || 0} items</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </Button>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {["Certifications", "Internships", "Awards", "Projects", "Competitions", "Other"].map(cat => (
                  <Card key={cat}>
                    <CardContent className="pt-6">
                      <p className="text-3xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">{cat}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}