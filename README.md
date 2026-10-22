# ALEX - Academic Intelligence Platform

AI-powered student intelligence and academic management platform with RAG, personal AI assistant, document processing, and academic management features.

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** 20+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **PostgreSQL** 16+ (Docker Desktop is recommended)
- **Redis** 7+ (via Docker, optional for background jobs)
- **pnpm** (recommended) or npm/yarn

### 1. Clone and Install

```bash
git clone <repository-url>
cd alex
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

**For PostgreSQL (recommended, production-like):**
```bash
# .env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alex?schema=public"
```

The current Prisma data model requires PostgreSQL features (enums, JSON, arrays, and pgvector). The SQLite draft is retained for reference but is not a supported runtime schema.

### 3. Start Infrastructure (PostgreSQL + Redis)

```bash
docker-compose up -d
```

Verify services are healthy:
```bash
docker-compose ps
```

### 4. Initialize Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed with demo data (creates 1 admin, 2 lecturers, 1 mentor, 5 students, courses, subjects, etc.)
pnpm db:seed
```

### 5. Start Development Server

```bash
pnpm dev
```

On Windows, `.\dev-start.ps1 postgres` is the repeatable setup command. It starts PostgreSQL and Redis, prepares Prisma, seeds synthetic data, and starts Next.js. Local signed auth and local file storage are enabled by default, so Supabase is optional for the basic localhost experience.

Health check: `http://localhost:3000/api/health`. Frontend and API routes use the same Next.js process at `http://localhost:3000`.

Development reset: `pnpm db:reset`. Confirm `DATABASE_URL` points at the local `alex` database before running it; never run it against production.

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Demo Credentials

After seeding, you can log in with:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@techuniversity.edu` | `password123` |
| **Lecturer 1** | `prof.smith@techuniversity.edu` | `password123` |
| **Lecturer 2** | `prof.jones@techuniversity.edu` | `password123` |
| **Mentor** | `mentor.wilson@techuniversity.edu` | `password123` |
| **Student 1** | `alice.student@techuniversity.edu` | `password123` |
| **Student 2** | `bob.student@techuniversity.edu` | `password123` |
| **Student 3** | `carol.student@techuniversity.edu` | `password123` |
| **Student 4** | `david.student@techuniversity.edu` | `password123` |
| **Student 5** | `eve.student@techuniversity.edu` | `password123` |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ALEX Application                         │
├─────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router) + React 19 + TypeScript            │
├─────────────────────────────────────────────────────────────┤
│  Prisma ORM → PostgreSQL/SQLite + Vector Search (pgvector) │
├─────────────────────────────────────────────────────────────┤
│  Supabase Auth + Storage (or local alternatives)            │
├─────────────────────────────────────────────────────────────┤
│  AI Providers: NVIDIA Nemotron, OpenAI, Gemini, Anthropic, │
│  Mistral, Groq, OpenRouter, Together AI                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Configuration

### NVIDIA Nemotron (Default)

The application uses **NVIDIA Nemotron 3 Ultra** via NVIDIA's integration API:

```bash
# Add to .env.local
NVIDIA_NEMOTRON_API_KEY="your-nvidia-api-key"
```

### Other Supported Providers

| Provider | Environment Variable | Default Model |
|----------|---------------------|---------------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Google Gemini | `GOOGLE_GEMINI_API_KEY` | `gemini-1.5-pro` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet` |
| Mistral | `MISTRAL_API_KEY` | `mistral-large` |
| Groq | `GROQ_API_KEY` | `llama-3.1-70b` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/auto` |
| Together AI | `TOGETHER_AI_API_KEY` | `meta-llama/Meta-Llama-3.1-70B` |

**No API keys are required for local UI testing** - the app uses an explicitly labeled mock chat provider and deterministic mock embeddings when no provider is configured. These are not real AI results. Set `AI_MODE="nemotron"` and `NVIDIA_NEMOTRON_API_KEY` in `.env.local` to use the real backend provider.

### Configure via UI

1. Log in as any user
2. Go to **Settings → AI Settings**
3. Add your API keys (encrypted and stored securely)
4. Test connections before saving

---

## 📁 Key Directories

```
alex/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── (auth)/             # Login, register, password reset
│   │   ├── (dashboard)/        # Protected dashboard pages
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── ai/                 # AI Avatar, Voice Assistant
│   │   ├── diagrams/           # Mermaid/GraphViz/PlantUML rendering
│   │   ├── documents/          # Upload, list, processing
│   │   └── ui/                 # Radix UI primitives
│   ├── lib/                    # Core libraries
│   │   ├── ai/                 # Embeddings, providers
│   │   ├── rag/                # RAG pipeline (generation, vector-search)
│   │   ├── document-processing/ # Extract, chunk, embed
│   │   └── voice/              # STT/TTS providers
│   └── hooks/                  # Custom React hooks
├── prisma/
│   ├── schema.prisma           # PostgreSQL schema (production)
│   ├── schema.sqlite.prisma    # SQLite schema (local dev)
│   └── seed.ts                 # Demo data seeding
├── docker-compose.yml          # PostgreSQL + Redis
└── .env.local                  # Local environment (gitignored)
```

---

## 🧪 Testing Features

### 1. Personal AI Assistant
- Go to **Dashboard → AI Assistant**
- Chat with your personal assistant
- Upload documents and ask questions
- Try the floating AI avatar (bottom-right)

### 2. Document Processing & RAG
- Go to **Documents** → Upload PDF, DOCX, PPTX, TXT, etc.
- Wait for processing (extract → chunk → embed → index)
- Ask questions in AI Assistant - citations link to sources

### 3. Document Studio
- Go to **Document Studio**
- Generate documents from prompts, templates, or RAG
- Export as PDF or DOCX

### 4. Solution Generator
- Go to **Solution Generator**
- Enter a question, select source documents
- Generate structured solutions (short/exam/detailed)
- Export as PDF/DOCX with diagrams

### 5. Academic Features
- **Attendance**: Mark/view attendance, low-attendance alerts
- **Assessments**: Create, grade, publish assessments
- **Assignments**: Create, submit, grade assignments
- **Subjects**: Enroll, view resources, syllabus
- **Projects**: Collaborate, track milestones
- **Research Lab**: Notebooks, sources, notes

### 6. Study Studio
- **Smart Notes**: Generate notes from documents
- **Flashcards**: SM2 spaced repetition
- **Mind Maps**: Visual concept mapping
- **Diagrams**: Mermaid, GraphViz, PlantUML
- **Quizzes**: Generate and take practice quizzes

### 7. Voice Assistant
- Go to **AI Assistant** → Voice tab
- Push-to-talk (browser Web Speech API)
- Configure TTS/STT providers in Settings

---

## 🛠️ Development Commands

```bash
# Development
pnpm dev              # Start dev server (Turbopack)
pnpm dev:https        # Start with HTTPS (for mobile testing)

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema changes (no migration)
pnpm db:migrate       # Create and apply migration
pnpm db:migrate:deploy # Apply migrations (production)
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed demo data
pnpm db:reset         # Reset database + seed

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues
pnpm typecheck        # TypeScript check

# Testing
pnpm test             # Run Jest tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report

# Build
pnpm build            # Production build
pnpm start            # Start production server
```

---

## 🔧 Troubleshooting

### Database Issues

**Prisma Client not generated:**
```bash
pnpm db:generate
```

**Migration failed:**
```bash
pnpm db:migrate:reset  # Resets and re-applies all migrations
```

**PostgreSQL connection refused:**
```bash
docker-compose up -d
docker-compose logs postgres
```

**SQLite database locked:**
```bash
# Kill any Node processes
pkill -f "next dev"
# Delete dev.db and re-seed
rm dev.db
pnpm db:push && pnpm db:seed
```

### Supabase Issues

**Auth not working locally:**
- Ensure Supabase is running: `docker-compose up -d supabase` (if configured)
- Or use Supabase Cloud project with correct keys in `.env.local`

**Storage upload fails:**
- Check `STORAGE_BUCKET_DOCUMENTS` exists in Supabase
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

### AI/Provider Issues

**Nemotron API errors:**
- Verify `NVIDIA_NEMOTRON_API_KEY` is set
- Check quota at https://integrate.api.nvidia.com
- Test connection in Settings → AI Settings

**Embeddings fail:**
- Ensure embedding provider API key is configured
- For local dev without keys, the app falls back to mock embeddings

**Voice not working:**
- Browser must be HTTPS or localhost
- Grant microphone permission
- Check browser console for Web Speech API support

### Build/TypeScript Errors

**Type errors after schema changes:**
```bash
pnpm db:generate
pnpm typecheck
```

**Missing types for dependencies:**
```bash
pnpm install  # Reinstalls with correct types
```

### Port Conflicts

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 pnpm dev
```

---

## 🐳 Docker Development

### Full Stack with Docker

```bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f app
```

### Production Build

```bash
docker build -t alex:latest .
docker run -p 3000:3000 --env-file .env.production alex:latest
```

---

## 🔒 Security Notes

- **Never commit `.env.local` or `.env`** - they're in `.gitignore`
- API keys are encrypted with AES-256-GCM before storage
- Supabase RLS policies enforce row-level security
- All API routes validate authentication and authorization
- File uploads validated by type, size, and content
- CSP headers configured in middleware

---

## 📚 API Reference

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rag/query` | POST | RAG chat with citations |
| `/api/documents` | GET/POST | List/upload documents |
| `/api/documents/[id]` | GET/DELETE | Document details/download |
| `/api/solutions/generate` | POST | Generate solutions |
| `/api/attendance/*` | GET/POST | Attendance management |
| `/api/assessments/*` | GET/POST | Assessment management |
| `/api/ai/credentials` | GET/POST | AI provider keys |
| `/api/ai/test-connection` | POST | Test provider connection |

---

## 📖 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [NVIDIA Nemotron API](https://integrate.api.nvidia.com)
- [Radix UI Components](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
