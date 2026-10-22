"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface StudyMaterial {
  id: string
  title: string
  content: string
  type: string
  sourceDocId: string | null
  subjectId: string | null
  topic: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface FlashcardDeck {
  id: string
  title: string
  description: string | null
  subjectId: string | null
  sourceDocId: string | null
  algorithm: string
  _count: { cards: number }
  createdAt: string
  updatedAt: string
}

interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  difficulty: number
  interval: number
  repetitions: number
  easeFactor: number
  nextReview: string
  lastReviewed: string | null
}

export default function StudyStudioPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("notes")
  const [selectedDeck, setSelectedDeck] = React.useState<string | null>(null)
  const [reviewMode, setReviewMode] = React.useState(false)
  const [currentCardIndex, setCurrentCardIndex] = React.useState(0)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [selectedSourceDoc, setSelectedSourceDoc] = React.useState("")
  const [generatedOutput, setGeneratedOutput] = React.useState<string | null>(null)
  const generateStructured = async (kind: 'mindmaps' | 'diagrams' | 'quizzes') => {
    if (!selectedSourceDoc) { toast({ title: "Select a document first" }); return }
    const endpoint = kind === 'mindmaps' ? '/api/mindmaps/generate' : kind === 'quizzes' ? '/api/quizzes/generate' : '/api/diagrams/generate'
    const body = kind === 'diagrams' ? { customType: 'mermaid', customCode: 'flowchart TD\n  A[Source document] --> B[Key concepts]', title: 'Document overview', sourceDocId: selectedSourceDoc } : { sourceDocId: selectedSourceDoc }
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { toast({ title: 'Generation failed', description: data.error, variant: 'destructive' }); return }
    setGeneratedOutput(JSON.stringify(data, null, 2))
    toast({ title: `${kind.slice(0, -1)} generated` })
  }

  const { data: notes } = useQuery({
    queryKey: ['study-materials'],
    queryFn: async () => {
      const res = await fetch('/api/study-materials')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: decks } = useQuery({
    queryKey: ['flashcard-decks'],
    queryFn: async () => {
      const res = await fetch('/api/flashcards/decks')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
  })

  const { data: deckCards } = useQuery({
    queryKey: ['flashcards', selectedDeck],
    queryFn: async () => {
      if (!selectedDeck) return { cards: [] }
      const res = await fetch(`/api/flashcards/decks/${selectedDeck}/cards`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedDeck,
  })

  const generateNotes = useMutation({
    mutationFn: async ({ sourceDocId, type }: { sourceDocId: string; type: string }) => {
      const res = await fetch('/api/study-materials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId, type }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-materials'] })
      toast({ title: "Notes generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate notes", variant: "destructive" }),
  })

  const generateFlashcards = useMutation({
    mutationFn: async ({ sourceDocId, count }: { sourceDocId: string; count: number }) => {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId, count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] })
      setSelectedDeck(data.deckId)
      setActiveTab("flashcards")
      toast({ title: "Flashcards generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate flashcards", variant: "destructive" }),
  })

  const reviewCard = useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
      const res = await fetch(`/api/flashcards/${cardId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      if (!res.ok) throw new Error('Review failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedDeck] })
      if (currentCardIndex < (deckCards?.cards?.length || 0) - 1) {
        setCurrentCardIndex(prev => prev + 1)
      } else {
        setReviewMode(false)
        toast({ title: "Review complete!" })
      }
      setShowAnswer(false)
    },
    onError: () => toast({ title: "Error", description: "Failed to submit review", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Study Studio</h1>
        <p className="text-muted-foreground mt-1">Generate and manage your study materials</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="notes">Smart Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="mindmaps">Mind Maps</TabsTrigger>
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { type: "concise", title: "Concise Notes", icon: FileText, desc: "Key points only" },
              { type: "detailed", title: "Detailed Notes", icon: BookOpen, desc: "Comprehensive coverage" },
              { type: "exam", title: "Exam Notes", icon: Target, desc: "High-yield for tests" },
              { type: "formulas", title: "Formula Sheet", icon: Zap, desc: "Equations & constants" },
              { type: "definitions", title: "Definitions", icon: Sparkles, desc: "Key terms explained" },
              { type: "comparison", title: "Comparison Table", icon: Brain, desc: "Side-by-side analysis" },
            ].map(item => (
              <Card key={item.type} onClick={() => { if (selectedSourceDoc) generateNotes.mutate({ sourceDocId: selectedSourceDoc, type: item.type }); else toast({ title: "Select a document first", description: "Choose a processed document below to generate this study material." }) }} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc}>
              <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
              <SelectContent>
                {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DocumentUpload
            onSuccess={(doc) => {
              setSelectedSourceDoc(doc.id)
            }}
          />
          <DocumentList documents={documents?.documents || []} showUpload={false} />

          {notes?.materials?.map((material: StudyMaterial) => (
            <Card key={material.id} className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{material.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{material.type} · {material.topic || 'General'}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-h-60 overflow-y-auto whitespace-pre-wrap">{material.content}</div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="flashcards" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Flashcard Decks</h2>
            <Button onClick={() => setSelectedDeck("new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Deck
            </Button>
          </div>

          {selectedDeck === "new" ? (
            <Card>
              <CardHeader>
                <CardTitle>Create New Deck</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={e => { e.preventDefault(); }} className="space-y-4">
                  <div>
                    <Label>Deck Title</Label>
                    <Input placeholder="e.g., Biology Chapter 1" />
                  </div>
                  <div>
                    <Label>Source Document</Label>
                    <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc}>
                      <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                      <SelectContent>
                        {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Number of Cards</Label>
                    <Input type="number" defaultValue="20" min="5" max="100" />
                  </div>
                  <Button type="submit" disabled={!selectedSourceDoc} onClick={e => { e.preventDefault(); generateFlashcards.mutate({ sourceDocId: selectedSourceDoc, count: 20 }) }}>
                    Generate Flashcards
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : selectedDeck ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Review Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    {deckCards?.cards?.length || 0} cards · Card {currentCardIndex + 1} of {deckCards?.cards?.length || 0}
                  </p>
                </div>
                <Button onClick={() => setReviewMode(true)} disabled={reviewMode}>
                  {reviewMode ? "Reviewing..." : "Start Review"}
                </Button>
              </div>

              {reviewMode && deckCards?.cards?.[currentCardIndex] ? (
                <Card className="max-w-2xl mx-auto">
                  <CardContent className="pt-6 pb-8">
                    <div className="text-center">
                      <div className="mb-4 text-sm text-muted-foreground">
                        Card {currentCardIndex + 1} of {deckCards.cards.length}
                      </div>
                      <div
                        className="h-64 border rounded-lg p-8 flex items-center justify-center cursor-pointer bg-card"
                        onClick={() => setShowAnswer(true)}
                      >
                        {showAnswer ? (
                          <div className="text-center">
                            <p className="text-2xl font-medium mb-4">Answer</p>
                            <p className="text-lg whitespace-pre-wrap">{deckCards.cards[currentCardIndex].back}</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-2xl font-medium mb-4">Question</p>
                            <p className="text-lg whitespace-pre-wrap">{deckCards.cards[currentCardIndex].front}</p>
                            <p className="mt-4 text-sm text-muted-foreground">Click to reveal answer</p>
                          </div>
                        )}
                      </div>
                      {showAnswer && (
                        <div className="mt-6 flex justify-center gap-2">
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 1 })}>Again</Button>
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 2 })}>Hard</Button>
                          <Button variant="default" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 3 })}>Good</Button>
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 4 })}>Easy</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {decks?.decks?.map((deck: FlashcardDeck) => (
                    <Card key={deck.id} onClick={() => setSelectedDeck(deck.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle>{deck.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{deck._count.cards} cards · {deck.algorithm}</p>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" variant="outline" onClick={e => { e.stopPropagation(); setSelectedDeck(deck.id) }}>
                          Review
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {decks?.decks?.map((deck: FlashcardDeck) => (
                <Card key={deck.id} onClick={() => setSelectedDeck(deck.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{deck.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{deck._count.cards} cards · {deck.algorithm}</p>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={e => { e.stopPropagation(); setSelectedDeck(deck.id) }}>
                      Review
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

        </TabsContent>

        <TabsContent value="mindmaps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Mind Maps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4"><p className="text-muted-foreground">Generate a saved mind map from the selected processed document.</p><Button onClick={() => generateStructured('mindmaps')}>Generate Mind Map</Button>{generatedOutput && <pre className="max-h-80 overflow-auto rounded bg-muted p-4 text-xs">{generatedOutput}</pre>}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagrams" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagrams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4"><p className="text-muted-foreground">Generate and save a Mermaid overview diagram.</p><Button onClick={() => generateStructured('diagrams')}>Generate Diagram</Button>{generatedOutput && <pre className="max-h-80 overflow-auto rounded bg-muted p-4 text-xs">{generatedOutput}</pre>}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quizzes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Quizzes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4"><p className="text-muted-foreground">Generate a saved quiz from the selected processed document.</p><Button onClick={() => generateStructured('quizzes')}>Generate Quiz</Button>{generatedOutput && <pre className="max-h-80 overflow-auto rounded bg-muted p-4 text-xs">{generatedOutput}</pre>}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
