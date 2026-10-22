<#
.SYNOPSIS
    ALEX - Complete Setup & Run Script (PostgreSQL + Demo Data) for Windows PowerShell
#>

$ErrorActionPreference = 'Stop'

Write-Host "🚀 ALEX - Complete Local Setup" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

function Log-Info { Write-Host "[INFO] $1" -ForegroundColor Green }
function Log-Warn { Write-Host "[WARN] $1" -ForegroundColor Yellow }
function Log-Error { Write-Host "[ERROR] $1" -ForegroundColor Red }

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Log-Error "Run this script from the alex directory"
    exit 1
}

# Check prerequisites
function Check-Command {
    param($Command)
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        Log-Error "$Command is not installed. Please install it first."
        exit 1
    }
}

Check-Command node
Check-Command pnpm
Check-Command docker

# 1. Install dependencies
Log-Info "Installing dependencies..."
pnpm install

# 2. Approve build scripts
Log-Info "Approving build scripts..."
try { pnpm run approve-builds } catch { }

# 3. Start PostgreSQL and Redis with Docker
Log-Info "Starting PostgreSQL and Redis with Docker..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
Log-Info "Waiting for PostgreSQL to be ready..."
for ($i = 1; $i -le 30; $i++) {
    try {
        docker-compose exec -T postgres pg_isready -U postgres | Out-Null
        Log-Info "PostgreSQL is ready!"
        break
    } catch {
        if ($i -eq 30) {
            Log-Error "PostgreSQL failed to start in time"
            exit 1
        }
        Start-Sleep 1
    }
}

# 4. Configure PostgreSQL database
Log-Info "Configuring PostgreSQL database..."
(Get-Content .env.example) -replace '^DATABASE_URL=.*', 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alex?schema=public"' | Set-Content .env.local

# 5. Generate Prisma client
Log-Info "Generating Prisma client..."
pnpm db:generate

# 6. Push schema to PostgreSQL
Log-Info "Creating PostgreSQL database..."
pnpm db:push

# 7. Seed demo data
Log-Info "Seeding demo data (this may take a minute)..."
pnpm db:seed

# 8. Start dev server
Log-Info "Starting development server..."
Write-Host ""
Write-Host "✅ Setup complete! Starting dev server..." -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Opening: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📋 Demo credentials will work after server starts" -ForegroundColor Cyan
Write-Host ""

# Start dev server
pnpm dev