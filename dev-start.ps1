<#
.SYNOPSIS
    ALEX Development Startup Script for Windows PowerShell

.DESCRIPTION
    Starts the ALEX development environment with SQLite or PostgreSQL.

.PARAMETER Mode
    Database mode: 'sqlite' (default, zero-config) or 'postgres' (requires Docker).

.EXAMPLE
    .\dev-start.ps1
    .\dev-start.ps1 sqlite
    .\dev-start.ps1 postgres
#>

param(
    [ValidateSet('sqlite', 'postgres')]
    [string]$Mode = 'postgres'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ProjectRoot

Write-Host "🚀 Starting ALEX development environment..." -ForegroundColor Green
Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan

# Check prerequisites
function Check-Command {
    param($Command)
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        Write-Host "❌ $Command is not installed. Please install it first." -ForegroundColor Red
        exit 1
    }
}

Check-Command node
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        Write-Host "pnpm was not on PATH; using Corepack's pnpm..." -ForegroundColor Yellow
        function pnpm { corepack pnpm @args }
    } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host "pnpm was not found; installing it with npm..." -ForegroundColor Yellow
        npm install --global pnpm
    } else {
        Write-Host "❌ Neither pnpm, Corepack, nor npm is available. Install Node.js 20+ first." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Node version: $(node --version)" -ForegroundColor Gray
Write-Host "pnpm version: $(pnpm --version)" -ForegroundColor Gray

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "ℹ️  Please edit .env.local with your configuration" -ForegroundColor Cyan
}

# Configure database based on mode
if ($Mode -eq 'postgres') {
    Write-Host "🐘 Starting PostgreSQL and Redis with Docker..." -ForegroundColor Green
    docker-compose up -d postgres redis
    
    # Wait for PostgreSQL to be ready
    Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    for ($i = 1; $i -le 30; $i++) {
        try {
            docker-compose exec -T postgres pg_isready -U postgres | Out-Null
            Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
            break
        } catch {
            if ($i -eq 30) {
                Write-Host "❌ PostgreSQL failed to start in time" -ForegroundColor Red
                exit 1
            }
            Start-Sleep 1
        }
    }
    
    # Update .env.local for PostgreSQL
    (Get-Content .env.local) -replace '^DATABASE_URL=.*', 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alex?schema=public"' | Set-Content .env.local
    
} else {
    throw "SQLite mode is unavailable: prisma/schema.sqlite.prisma is not valid for the current data model. Use postgres mode with Docker/PostgreSQL."
}

# Install dependencies if needed
if (-not (Test-Path "node_modules") -or (Get-Item "package.json").LastWriteTime -gt (Get-Item "node_modules").LastWriteTime) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Green
    pnpm install --ignore-scripts
    # Create timestamp file
    $null = New-Item -Path "node_modules/.install-stamp" -ItemType File -Force
}

# Generate Prisma client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Green
$schemaPath = Join-Path $ProjectRoot 'apps', 'web', 'prisma', 'schema.prisma'
$prismaPath = Join-Path $ProjectRoot 'node_modules', '.bin', 'prisma.cmd'
if (-not (Test-Path -LiteralPath $prismaPath)) { throw "Prisma executable not found at $prismaPath. Run pnpm install --ignore-scripts first." }
& $prismaPath generate --schema=$schemaPath

# Push schema to database
Write-Host "🗄️  Pushing database schema..." -ForegroundColor Green
& $prismaPath db push --schema=$schemaPath

# Check if database needs seeding
try {
    $userCount = & node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.user.count().then(n=>process.stdout.write(String(n))).finally(()=>p.\$disconnect())" 2>$null
} catch {
    $userCount = "0"
}

if ([int]$userCount -eq 0) {
    Write-Host "🌱 Database is empty. Seeding demo data..." -ForegroundColor Green
    & (Join-Path $ProjectRoot 'node_modules', '.bin', 'tsx.cmd') (Join-Path $ProjectRoot 'apps', 'web', 'prisma', 'seed.ts')
} else {
    Write-Host "✅ Database already has $userCount users. Skipping seed." -ForegroundColor Green
}

# Start development server
Write-Host "🚀 Starting development server..." -ForegroundColor Green
Write-Host "🌐 Application will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📊 Prisma Studio: pnpm db:studio" -ForegroundColor Cyan
Write-Host "📋 Demo credentials are in README.md" -ForegroundColor Cyan

# Start the dev server
$nextPath = Join-Path $ProjectRoot 'node_modules', '.bin', 'next.cmd'
if (-not (Test-Path -LiteralPath $nextPath)) { throw "Next.js executable not found at $nextPath." }
& $nextPath dev
