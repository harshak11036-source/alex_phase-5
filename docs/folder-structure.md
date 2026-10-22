# ALEX Folder Structure

## Root Directory

```
alex/
├── apps/
│   ├── web/                 # Next.js frontend application
│   └── api/                 # Reserved for future API service (currently unused)
├── functions/               # Firebase Cloud Functions (Gen 2)
├── packages/                # Shared internal packages
│   ├── shared-types/        # TypeScript types & enums
│   ├── shared-utils/        # Utility functions
│   └── validation-schemas/  # Zod validation schemas
├── firebase/                # Firebase configuration
│   ├── firestore.rules      # Firestore security rules
│   ├── firestore.indexes.json # Firestore composite indexes
│   ├── storage.rules        # Firebase Storage rules
│   ├── firebase.json        # Firebase CLI config (at root)
│   └── .firebaserc          # Firebase project aliases (at root)
├── deployment/              # Deployment configuration
│   ├── firebase/            # Firebase-specific deployment docs
│   ├── local/               # Local development setup
│   ├── scripts/             # Build/deploy/validation scripts
│   └── environment/         # Environment variable templates
├── infrastructure/          # Infrastructure as Code
│   ├── firebase/            # Firebase resource definitions
│   └── monitoring/          # Monitoring/alerting configs
├── scripts/                 # Root-level utility scripts
├── tests/                   # Test suites
│   ├── integration/
│   ├── end-to-end/
│   ├── security/
│   └── fixtures/
├── docs/                    # Documentation
├── prisma/                  # Prisma schema & migrations (in apps/web/prisma)
├── .github/
│   └── workflows/           # CI/CD pipelines
├── .gitignore
├── .dockerignore
├── .env.example
├── pnpm-workspace.yaml
├── package.json             # Root workspace package.json
├── README.md
└── LICENSE
```

## Apps/Web (Frontend)

```
apps/web/
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Auth route group
│   │   ├── (dashboard)/     # Dashboard route group
│   │   ├── api/             # API routes (legacy, migrating to Functions)
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── ai/              # AI-related components
│   │   ├── dashboard/       # Dashboard components
│   │   ├── diagrams/        # Diagram components
│   │   ├── documents/       # Document components
│   │   ├── layout/          # Layout components
│   │   ├── rag/             # RAG chat components
│   │   └── ui/              # Base UI components (Radix-based)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core libraries & utilities
│   │   ├── ai/              # AI integration
│   │   ├── diagrams/        # Diagram generation
│   │   ├── document-processing/ # Document pipeline
│   │   ├── rag/             # RAG implementation
│   │   ├── storage/         # Storage client
│   │   ├── supabase/        # Supabase client
│   │   └── voice/           # Voice integration
│   ├── types/               # Frontend-specific types
│   └── middleware.ts        # Next.js middleware
├── prisma/                  # Prisma schema & seeds
├── tests/                   # Frontend tests
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local (gitignored)
```

## Functions (Firebase Backend)

```
functions/
├── src/
│   ├── index.ts             # Main entry point, exports all functions
│   ├── user.ts              # User management functions
│   ├── document.ts          # Document processing functions
│   ├── rag.ts               # RAG query functions
│   ├── ai.ts                # AI provider functions
│   ├── study.ts             # Study materials functions
│   ├── planner.ts           # Planner/calendar functions
│   ├── research.ts          # Research notebook functions
│   ├── project.ts           # Project management functions
│   ├── attendance.ts        # Attendance functions
│   ├── assessment.ts        # Assessment functions
│   ├── assignment.ts        # Assignment functions
│   ├── achievement.ts       # Achievement functions
│   ├── notification.ts      # Notification functions
│   ├── subject.ts           # Subject management functions
│   └── system.ts            # System/admin functions
├── lib/                     # Compiled output (gitignored)
├── node_modules/            # Dependencies (gitignored)
├── package.json
├── tsconfig.json
└── .env.example
```

## Packages

### @alex/shared-types
```
packages/shared-types/
├── src/
│   └── index.ts             # All shared TypeScript types/enums
├── dist/                    # Compiled output (gitignored)
├── package.json
└── tsconfig.json
```

### @alex/shared-utils
```
packages/shared-utils/
├── src/
│   └── index.ts             # Utility functions
├── dist/
├── package.json
└── tsconfig.json
```

### @alex/validation-schemas
```
packages/validation-schemas/
├── src/
│   └── index.ts             # Zod schemas for all models
├── dist/
├── package.json
└── tsconfig.json
```

## Firebase Configuration

```
firebase/
├── firestore.rules          # Security rules for Firestore
├── firestore.indexes.json   # Required composite indexes
├── storage.rules            # Security rules for Storage
└── public/                  # Static hosting files (legacy, minimal)
```

## Deployment Scripts

```
deployment/scripts/
├── build.sh                 # Full build pipeline
├── deploy.sh                # Deploy to preview/production
├── pre-deploy-check.sh      # Pre-deployment validation
└── rollback-notes.md        # Rollback procedures
```

## Environment Templates

```
deployment/environment/
├── .env.example             # All environment variables with placeholders
└── production-variables.example # Production-specific reference
```

## Documentation

```
docs/
├── architecture.md          # System architecture overview
├── folder-structure.md      # This file
├── local-development.md     # Local dev setup guide
├── firebase-setup.md        # Firebase project setup
├── deployment.md            # Deployment guide
├── environment-variables.md # Env var reference
├── api-documentation.md     # API reference
├── security.md              # Security practices
└── troubleshooting.md       # Common issues & fixes
```

## Key Conventions

1. **Workspace Packages**: Use `workspace:*` protocol for internal dependencies
2. **Path Aliases**: `@/*` for app src, `@alex/*` for shared packages
3. **Firebase Config**: `firebase.json` at root, rules in `firebase/`
4. **Environment**: `.env.example` at root, real `.env` files gitignored
5. **Build Output**: `apps/web/out/` for static export, `functions/lib/` for Functions
6. **Tests**: Co-located with source or in `tests/` for integration/e2e