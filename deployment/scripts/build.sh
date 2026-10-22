#!/bin/bash
set -e

echo "🔨 Building ALEX for deployment..."

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🔧 Building shared packages..."
pnpm --filter @alex/shared-types run build
pnpm --filter @alex/shared-utils run build
pnpm --filter @alex/validation-schemas run build

echo "🌐 Building web application..."
pnpm --filter apps/web run build

echo "⚡ Building Firebase Functions..."
pnpm --filter functions run build

echo "✅ Build completed successfully!"