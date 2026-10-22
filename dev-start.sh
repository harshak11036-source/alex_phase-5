#!/bin/bash
# ALEX Development Startup Script
# Usage: ./dev-start.sh [sqlite|postgres]

set -e

MODE="${1:-postgres}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting ALEX development environment..."
echo "Mode: $MODE"
echo "Project root: $PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

check_command node
check_command pnpm

log_info "Node version: $(node --version)"
log_info "pnpm version: $(pnpm --version)"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    log_warn ".env.local not found. Creating from .env.example..."
    cp .env.example .env.local
    log_info "Please edit .env.local with your configuration"
fi

# Configure database based on mode
if [ "$MODE" = "postgres" ]; then
    log_info "Starting PostgreSQL and Redis with Docker..."
    docker-compose up -d postgres redis
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
            log_info "PostgreSQL is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL failed to start in time"
            exit 1
        fi
        sleep 1
    done
    
    # Update .env.local for PostgreSQL
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alex?schema=public"|' .env.local
    
else
    log_info "Using SQLite database (file: ./dev.db)"
    # Update .env.local for SQLite
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./dev.db"|' .env.local
fi

# Install dependencies if node_modules doesn't exist or package-lock is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.install-stamp" ]; then
    log_info "Installing dependencies..."
    pnpm install
    touch node_modules/.install-stamp
fi

# Generate Prisma client
log_info "Generating Prisma client..."
pnpm db:generate

# Push schema to database
log_info "Pushing database schema..."
pnpm db:push

# Seed database if empty
log_info "Checking if database needs seeding..."
USER_COUNT=$(pnpm --silent exec tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const count = await prisma.user.count()
  console.log(count)
  await prisma.\$disconnect()
}
main()
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq 0 ] 2>/dev/null || [ -z "$USER_COUNT" ]; then
    log_info "Database is empty. Seeding demo data..."
    pnpm db:seed
else
    log_info "Database already has $USER_COUNT users. Skipping seed."
fi

# Start development server
log_info "Starting development server..."
log_info "🌐 Application will be available at: http://localhost:3000"
log_info "📊 Prisma Studio: pnpm db:studio"
log_info "📋 Demo credentials are in README.md"

# Start the dev server
exec pnpm dev