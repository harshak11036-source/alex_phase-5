"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Shield, Key, Bot, Sparkles, Bell, Palette, Database, Globe, Save, Loader2, XCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
  createdAt: string
}

interface AICredential {
  id: string
  provider: string
  providerName: string
  isActive: boolean
  isDefault: boolean
  models: Record<string, unknown> | null
  usageCount: number
  lastUsedAt: string | null
}

interface NotificationPreference {
  category: string
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("profile")
  const [isLoading, setIsLoading] = React.useState(false)

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: aiCredentials } = useQuery({
    queryKey: ['ai-credentials'],
    queryFn: async () => {
      const res = await fetch('/api/ai/credentials')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: notifPrefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const updateProfile = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast({ title: "Profile updated" })
    },
    onError: () => toast({ title: "Error", description: "Failed to update profile", variant: "destructive" }),
  })

  const addCredential = useMutation({
    mutationFn: async (data: { provider: string; providerName: string; apiKey: string }) => {
      const res = await fetch('/api/ai/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to add')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] })
      toast({ title: "API key added" })
    },
    onError: () => toast({ title: "Error", description: "Failed to add API key", variant: "destructive" }),
  })

  const deleteCredential = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/credentials/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] })
      toast({ title: "API key removed" })
    },
    onError: () => toast({ title: "Error", description: "Failed to remove API key", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ai">AI Providers</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateProfile.mutate({ firstName: fd.get('firstName') as string, lastName: fd.get('lastName') as string }) }} className="space-y-4 max-w-md">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>First Name</Label>
                    <Input name="firstName" defaultValue={profile?.user?.firstName} required />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input name="lastName" defaultValue={profile?.user?.lastName} required />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" defaultValue={profile?.user?.email} disabled />
                  <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Input defaultValue={profile?.user?.role} disabled />
                </div>
                <div>
                  <Label>Member Since</Label>
                  <Input defaultValue={profile?.user?.createdAt ? formatDate(profile?.user?.createdAt) : 'Unknown'} disabled />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Button variant="outline">Enable 2FA</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your account password</p>
                </div>
                <Button variant="outline">Change Password</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">Manage your logged-in devices</p>
                </div>
                <Button variant="outline">View Sessions</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Provider Configuration
              </CardTitle>
              <p className="text-sm text-muted-foreground">Add your API keys to enable AI features. Keys are encrypted and stored securely.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], color: '#00a67e' },
                  { id: 'google_gemini', name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash'], color: '#4285f4' },
                  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet', 'claude-3-opus'], color: '#d4a843' },
                  { id: 'mistral', name: 'Mistral', models: ['mistral-large', 'mistral-medium'], color: '#ff5722' },
                  { id: 'groq', name: 'Groq', models: ['llama-3.1-70b', 'mixtral-8x7b'], color: '#f55036' },
                  { id: 'openrouter', name: 'OpenRouter', models: ['various'], color: '#3b82f6' },
                  { id: 'nvidia_nemotron', name: 'NVIDIA Nemotron', models: ['nvidia/nemotron-3-ultra', 'nvidia/nemotron-3-ultra-550b-a55b'], color: '#76b900' },
                ].map(provider => {
                  const credsList: AICredential[] = Array.isArray(aiCredentials) ? aiCredentials : (aiCredentials?.credentials || [])
                  const cred = credsList.find((c: AICredential) => c.provider.toLowerCase() === provider.id.toLowerCase())
                  return (
                    <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: provider.color }}>
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Models: {provider.models.join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cred ? (
                          <>
                            <Badge variant={cred.isActive ? 'success' : 'secondary'}>
                              {cred.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={() => deleteCredential.mutate(cred.id)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" asChild>
                            <a href="/dashboard/ai-settings">
                              <Key className="mr-2 h-4 w-4" />
                              Add API Key
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Model Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Default Chat Model</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Embedding Model</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                      <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Image Model</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                      <SelectItem value="gpt-image-1">GPT Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {CATEGORIES.map(category => (
                  <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{category.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">Notifications for {category.toLowerCase().replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Switch checked={true} />
                        <span className="text-sm">In-App</span>
                      </Label>
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Switch checked={false} />
                        <span className="text-sm">Email</span>
                      </Label>
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Switch checked={false} />
                        <span className="text-sm">Push</span>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Theme</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="System" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label>Font Size</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label>Compact Mode</Label>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Data Export</p>
                    <p className="text-sm text-muted-foreground">Download all your data in JSON format</p>
                  </div>
                  <Button variant="outline">Export Data</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                  </div>
                  <Button variant="destructive">Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
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
