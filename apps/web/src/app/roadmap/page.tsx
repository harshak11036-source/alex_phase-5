import Link from "next/link"
import { ArrowLeft, CheckCircle2, Clock3, Code2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const available = [
  "Account registration and sign in",
  "AI credential storage and connection testing",
  "Document upload and document processing",
  "RAG document questions",
  "Study notes and flashcard generation",
  "Mind-map, diagram, and quiz generation",
  "Assignments, assessments, attendance, projects, and research notebooks",
  "Planner task creation and task completion",
]

const comingSoon = [
  {
    title: "PowerPoint text extraction",
    detail: "PPTX uploads currently require conversion to PDF or another supported format.",
  },
  {
    title: "Persistent Document Studio history",
    detail: "Generation history is currently available for the active browser session; durable history needs a saved generated-document model and API.",
  },
  {
    title: "Advanced AI-generated study content",
    detail: "Mind maps, quizzes, and flashcards currently use deterministic source-text generation. Provider-powered semantic generation, grading, and citations are next.",
  },
  {
    title: "Full Dropbox production setup",
    detail: "The integration is implemented, but the Dropbox app secret must be configured in the deployment environment before production connection.",
  },
  {
    title: "Live end-to-end deployment QA",
    detail: "A real authenticated user must test every flow against the deployed Render, Neon, and Cloudflare services.",
  },
]

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to ALEX
        </Link>
        <div>
          <p className="mb-2 text-sm font-medium text-primary">ALEX product status</p>
          <h1 className="text-4xl font-bold tracking-tight">What is live and what is coming soon</h1>
          <p className="mt-3 text-muted-foreground">This page keeps the product status clear for users and gives developers an actionable build list.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Available now</CardTitle></CardHeader>
            <CardContent><ul className="space-y-3 text-sm">{available.map(item => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{item}</li>)}</ul></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-amber-600" /> Coming soon</CardTitle></CardHeader>
            <CardContent><div className="space-y-5">{comingSoon.map(item => <div key={item.title}><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div>)}</div></CardContent>
          </Card>
        </div>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <Code2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p><span className="font-medium">Developer note:</span> complete the items above only after adding automated tests and live Render/Neon verification. Do not mark a feature available based on UI presence alone.</p>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">ALEX is built by <span className="font-medium text-foreground">G V Adithiyha</span> and <span className="font-medium text-foreground">Harsha K</span>.</p>
      </div>
    </main>
  )
}
