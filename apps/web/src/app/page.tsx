"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GraduationCap,
  Bot,
  Brain,
  BookOpen,
  Calendar,
  Shield,
  Users,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
} from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Agentic AI Assistant",
    description: "ALEX understands natural language, searches your documents, and executes tasks with persistent memory.",
  },
  {
    icon: BookOpen,
    title: "RAG-Powered Learning",
    description: "Upload documents and get grounded answers with citations. Generate flashcards, mind maps, and study notes.",
  },
  {
    icon: Calendar,
    title: "Smart Academic Planner",
    description: "AI-generated study schedules based on your goals, deadlines, and performance. Daily briefings and reminders.",
  },
  {
    icon: Users,
    title: "Collaborative Research",
    description: "NotebookLM-style research workspaces with source-grounded answers, literature matrices, and paper drafting.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure multi-tenant architecture with student, lecturer, mentor, and admin roles. Row-level security.",
  },
  {
    icon: Zap,
    title: "Multi-Model AI Router",
    description: "Bring your own API keys. Support for OpenAI, Gemini, Anthropic, Mistral, Groq, and more.",
  },
]

const stats = [
  { value: "10+", label: "AI Providers Supported" },
  { value: "15+", label: "Document Formats" },
  { value: "50+", label: "Academic Features" },
  { value: "∞", label: "Customizable Workflows" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">ALEX</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              How It Works
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <Link href="/register">
              <Button>Get Started Free</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">New: AI Research Lab & Collaborative Projects</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Your AI Academic{" "}
              <span className="text-primary">Intelligence</span> Companion
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              ALEX combines autonomous agentic AI, fully functional RAG, persistent memory, and academic management
              into one powerful platform for students, lecturers, and institutions.
            </p>
            <div className="flex flex-col sm:flex_row items-center justify-center gap-4 mb-16">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Explore Features
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">Everything You Need to Excel</h2>
            <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
              ALEX is built for real academic workflows with connected documents, planning, assessment, and AI tools.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="p-3 rounded-lg bg-primary/10 text-primary inline-flex">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="container mx-auto px-4 py-20 bg-muted/50">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">How ALEX Works</h2>
            <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
              From document upload to AI-powered insights in four steps.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Upload Documents", description: "Drag & drop PDFs, DOCX, PPTX, images, and more. Supports 15+ formats with OCR." },
              { step: "02", title: "Automatic Processing", description: "ALEX extracts, chunks, embeds, and indexes your content with full provenance tracking." },
              { step: "03", title: "Ask Questions", description: "Chat with your documents. Get grounded answers with citations linking to exact pages." },
              { step: "04", title: "Generate & Learn", description: "Create flashcards, mind maps, diagrams, quizzes, and study plans from your content." },
            ].map((item) => (
              <Card key={item.step}>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-primary/50 mb-2">{item.step}</div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold tracking-tight mb-6">Ready to Transform Your Academic Life?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of students and educators using ALEX to study smarter, research faster, and achieve more.
            </p>
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Create Your Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Free forever · No credit card required · Open source
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">ALEX</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered student intelligence and academic management platform.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/assistant" className="hover:text-foreground">AI Assistant</Link></li>
                <li><Link href="/documents" className="hover:text-foreground">RAG Pipeline</Link></li>
                <li><Link href="/study-studio" className="hover:text-foreground">Study Studio</Link></li>
                <li><Link href="/planner" className="hover:text-foreground">Smart Planner</Link></li>
                <li><Link href="/research" className="hover:text-foreground">Research Lab</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/#how-it-works" className="hover:text-foreground">Documentation</Link></li>
                <li><Link href="/api/health" className="hover:text-foreground">API Reference</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">Blog</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">Community</Link></li>
                <li><Link href="/roadmap" className="hover:text-foreground">Roadmap</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/#features" className="hover:text-foreground">About</Link></li>
                <li><Link href="mailto:contact@alex-ai.example" className="hover:text-foreground">Careers</Link></li>
                <li><Link href="/#privacy" className="hover:text-foreground">Privacy</Link></li>
                <li><Link href="/#terms" className="hover:text-foreground">Terms</Link></li>
                <li><Link href="/api/health" className="hover:text-foreground">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2024 ALEX. Built by G V Adithiyha and Harsha K.
          </div>
        </div>
      </footer>
    </div>
  )
}
