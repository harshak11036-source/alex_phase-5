# ALEX Local Development Guide

## Prerequisites

- **Node.js**: 20.x (LTS)
- **pnpm**: 9.x
- **Firebase CLI**: `npm install -g firebase-tools`
- **PostgreSQL**: 15+ (or use Docker)
- **Git**: 2.x

## Initial Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd alex
pnpm install
```

### 2. Configure Environment

```bash
# Copy example environment files
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local 2>/dev/null || true
cp functions/.env.example functions/.env 2>/dev/null || true

# Edit .env with your local configuration
# Minimum required for local dev:
# - DATABASE_URL (PostgreSQL)
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - ENCRYPTION_KEY (generate with: openssl rand -hex 32)
```

### 3. Setup Database

```bash
# Start PostgreSQL (using Docker)
docker-compose up -d postgres

# Or use your local PostgreSQL instance
# Create database: CREATE DATABASE alex;

# Generate Prisma client
pnpm --filter apps/web run db:generate

# Push schema to database
pnpm --filter apps/web run db:push

# Seed development data
pnpm --filter apps/web run db:seed
```

### 4. Setup Firebase (Optional for Local Dev)

```bash
# Login to Firebase
firebase login

# Use a Firebase project (create one at console.firebase.google.com)
firebase use --add

# Start Firebase Emulators (for Firestore, Functions, Auth, Storage)
firebase emulators:start
```

## Running the Application

### Option 1: Full Stack with Emulators (Recommended)

```bash
# Terminal 1: Start Firebase Emulators
firebase emulators:start

# Terminal 2: Start Next.js dev server
pnpm --filter apps/web run dev

# Terminal 3 (optional): Start Functions emulator with hot reload
pnpm --filter functions run serve
```

### Option 2: Frontend Only (with Mock Data)

```bash
# Set AI_MODE=mock in .env.local
pnpm --filter apps/web run dev
```

### Option 3: Backend Only (Functions)

```bash
pnpm --filter functions run serve
```

## Available Commands

### Root Level (from `alex/` directory)

```bash
# Install all dependencies
pnpm install

# Run all linters
pnpm run lint

# Run all typechecks
pnpm run typecheck

# Run all tests
pnpm run test

# Build all packages
pnpm run build

# Start development (frontend + functions)
pnpm run dev

# Database commands
pnpm run db:generate
pnpm run db:push
pnpm run db:migrate
pnpm run db:studio
pnpm run db:seed
pnpm run db:reset

# Firebase commands
pnpm run firebase:emulators
pnpm run firebase:deploy
pnpm run firebase:deploy:hosting
pnpm run firebase:deploy:functions

# Deployment validation
pnpm run validate:config
```

### Frontend (apps/web)

```bash
cd apps/web

# Development server with Turbopack
pnpm run dev

# Production build
pnpm run build

# Start production server
pnpm run start

# Linting
pnpm run lint
pnpm run lint:fix

# Type checking
pnpm run typecheck

# Testing
pnpm run test
pnpm run test:watch
pnpm run test:coverage

# Database
pnpm run db:generate
pnpm run db:push
pnpm run db:migrate
pnpm run db:studio
pnpm run db:seed
```

### Functions

```bash
cd functions

# Build TypeScript
pnpm run build

# Start emulator with hot reload
pnpm run serve

# Interactive shell
pnpm run shell

# Deploy to Firebase
pnpm run deploy

# View logs
pnpm run logs

# Linting
pnpm run lint

# Testing
pnpm run test
```

## Environment Variables

### Required for Local Development

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/alex` |
| `NEXTAUTH_SECRET` | NextAuth.js secret (32+ chars) | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | AES-256 key for AI credentials | `openssl rand -hex 32` |
| `NODE_ENV` | Environment mode | `development` |
| `NEXT_PUBLIC_APP_URL` | Frontend URL | `http://localhost:3000` |

### Optional (for Full Features)

| Variable | Description |
|----------|-------------|
| `NVIDIA_NEMOTRON_API_KEY` | NVIDIA Nemotron API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SMTP_*` | Email configuration |
| `REDIS_URL` | Redis for background jobs |

## Firebase Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Functions | 5001 |
| Firestore | 8080 |
| Storage | 9199 |
| Emulator UI | 4000 |

## Common Issues

### Port Conflicts
```bash
# Check what's using a port
lsof -i :3000
lsof -i :5001

# Kill process
kill -9 <PID>
```

### Database Connection Issues
```bash
# Verify PostgreSQL is running
pg_isready -h localhost -p 5432

# Check DATABASE_URL format
# postgresql://user:password@host:port/database?schema=public
```

### Prisma Issues
```bash
# Regenerate client after schema changes
pnpm --filter apps/web run db:generate

# Reset database completely
pnpm --filter apps/web run db:reset
```

### Firebase Emulator Issues
```bash
# Clear emulator data
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data

# Reset emulator data
rm -rf ~/.cache/firebase/emulators
firebase setup:emulators:firestore
firebase setup:emulators:functions
```

## Development Workflow

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Edit code in `apps/web/src/` or `functions/src/`
3. **Run checks**: `pnpm run lint && pnpm run typecheck && pnpm run test`
4. **Test locally**: Verify in browser at `http://localhost:3000`
5. **Commit**: `git add . && git commit -m "feat: your feature"`
6. **Push**: `git push origin feature/your-feature`
7. **Create PR**: CI will run automatically

## Debugging

### Frontend (VS Code)
```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Next.js: Debug",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter apps/web run dev"
    }
  ]
}
```

### Functions (VS Code)
```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Functions: Debug",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "localRoot": "${workspaceFolder}/functions/lib",
      "remoteRoot": "/home/node/lib"
    }
  ]
}
```

### Firestore Emulator Data
Access at: `http://localhost:4000/firestore`

## Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)