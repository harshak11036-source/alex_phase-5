# ALEX Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALEX Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │    │   Backend    │    │  Firebase    │      │
│  │  (Next.js)   │◄──►│  (Functions) │◄──►│  Services    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Shared Packages                        │   │
│  │  @alex/shared-types  │  @alex/shared-utils  │  @alex/     │   │
│  │                      │                      │ validation- │   │
│  │                      │                      │ schemas     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend (apps/web)
- **Framework**: Next.js 16 (App Router) with React 19
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **UI Components**: Radix UI + Custom components
- **Authentication**: Supabase Auth + NextAuth
- **Build Output**: Static Export (`output: 'export'`) for Firebase Hosting

### Backend (functions)
- **Runtime**: Node.js 20 on Firebase Cloud Functions (Gen 2)
- **Language**: TypeScript
- **Database**: Firestore (primary) + Prisma/PostgreSQL (relational data)
- **AI Providers**: NVIDIA Nemotron (primary), OpenAI, Gemini, Anthropic, etc.
- **Storage**: Firebase Storage
- **Background Jobs**: Pub/Sub scheduled functions

### Database
- **Firestore**: Real-time data, documents, chat, notifications, presence
- **PostgreSQL (via Prisma)**: Relational data - users, enrollments, assessments, grades, projects

### Shared Packages
- **@alex/shared-types**: TypeScript types/enums for all data models
- **@alex/shared-utils**: Utility functions (formatting, validation, etc.)
- **@alex/validation-schemas**: Zod schemas for API validation

## Data Flow

### Authentication Flow
```
User → Next.js Frontend → Supabase Auth → Firebase Auth (custom token) → Firestore/Functions
```

### API Request Flow
```
Frontend → Firebase Functions (HTTPS Callable) → Firestore/PostgreSQL → Response
```

### AI Processing Flow
```
Document Upload → Storage Trigger → Functions → Document Processing Pipeline
                                                      ↓
                                              Chunking → Embeddings → Vector Store
                                                      ↓
                                              RAG Query → AI Response
```

## Firebase Services Used

| Service | Purpose |
|---------|---------|
| **Hosting** | Static Next.js export deployment |
| **Functions (Gen 2)** | Backend API, triggers, scheduled jobs |
| **Firestore** | Real-time data, documents, conversations, notifications |
| **Storage** | File uploads (documents, avatars, resources) |
| **Auth** | User authentication (via Supabase integration) |
| **Emulators** | Local development testing |

## Security Architecture

### Authentication & Authorization
- **Frontend**: Supabase JWT tokens
- **Backend**: Firebase Auth verification in Functions
- **Database**: Firestore security rules + Prisma row-level security
- **API**: Role-based access control (STUDENT, LECTURER, ADMIN, PROJECT_MENTOR)

### Data Protection
- **Encryption**: AES-256 for AI API keys at rest
- **Secrets**: Firebase Secret Manager for production
- **CORS**: Configured per environment
- **Rate Limiting**: Built into Functions

## Deployment Architecture

### Environments
- **Development**: Local emulators + local database
- **Preview**: Firebase Preview Channels (per PR)
- **Staging**: Dedicated Firebase project
- **Production**: Dedicated Firebase project

### Deployment Pipeline
```
Push → CI (Lint, Typecheck, Test, Build) → Preview Deploy (PR) → Manual Production Deploy
```

## Scalability Considerations

- **Frontend**: Static hosting, CDN cached, ISR not used (static export)
- **Functions**: Auto-scaling, max instances configurable
- **Firestore**: Automatic scaling, composite indexes for queries
- **Storage**: Multi-region buckets for global access
- **Database**: Connection pooling for PostgreSQL

## Monitoring & Observability

- **Logging**: Structured logging in Functions
- **Errors**: Sentry integration (optional)
- **Performance**: Firebase Performance Monitoring
- **Analytics**: Firebase Analytics (optional)