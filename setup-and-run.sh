#!/bin/bash
# ALEX - Complete Setup & Run Script (PostgreSQL + Demo Data)
# Run this script to set up everything and start the dev server

set -e  # Exit on error

echo "🚀 ALEX - Complete Local Setup"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Run this script from the alex directory"
    exit 1
fi

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

check_command node
check_command pnpm
check_command docker

# 1. Install dependencies
log_info "Installing dependencies..."
pnpm install

# 2. Approve build scripts (for Prisma, etc.)
log_info "Approving build scripts..."
pnpm run approve-builds 2>/dev/null || true

# 3. Start PostgreSQL and Redis with Docker
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

# 4. Configure PostgreSQL database
log_info "Configuring PostgreSQL database..."
sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alex?schema=public"|' .env.local

# 5. Generate Prisma client
log_info "Generating Prisma client..."
pnpm db:generate

# 6. Push schema to PostgreSQL
log_info "Creating PostgreSQL database..."
pnpm db:push

# 7. Seed demo data
log_info "Seeding demo data (this may take a minute)..."
pnpm db:seed

# 8. Start dev server
log_info "Starting development server..."
echo ""
echo "✅ Setup complete! Starting dev server..."
echo ""
echo "🌐 Opening: http://localhost:3000"
echo "📋 Demo credentials will work after server starts"
echo ""

# Start dev server
pnpm dev