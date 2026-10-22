#!/bin/bash
set -e

# Deployment script for ALEX
# Usage: ./deploy.sh [preview|production] [project-id]

ENVIRONMENT=${1:-preview}
PROJECT_ID=${2:-}

if [ "$ENVIRONMENT" != "preview" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "❌ Invalid environment. Use 'preview' or 'production'"
  exit 1
fi

echo "🚀 Deploying ALEX to $ENVIRONMENT..."

if [ -n "$PROJECT_ID" ]; then
  echo "📋 Using Firebase project: $PROJECT_ID"
  firebase use $PROJECT_ID
fi

echo "🔍 Running pre-deployment checks..."
./deployment/scripts/pre-deploy-check.sh

echo "🔨 Building application..."
./deployment/scripts/build.sh

if [ "$ENVIRONMENT" = "preview" ]; then
  echo "🌐 Deploying to Firebase Hosting Preview Channel..."
  firebase hosting:channel:deploy preview --expires 7d
else
  echo "🌐 Deploying to Firebase Hosting Production..."
  firebase deploy --only hosting
fi

echo "⚡ Deploying Firebase Functions..."
firebase deploy --only functions

echo "📋 Deploying Firestore Rules & Indexes..."
firebase deploy --only firestore:rules,firestore:indexes

echo "📦 Deploying Storage Rules..."
firebase deploy --only storage

echo "✅ Deployment to $ENVIRONMENT completed successfully!"

if [ "$ENVIRONMENT" = "preview" ]; then
  echo "🔗 Preview URL: https://<project-id>--preview-<channel-id>.web.app"
fi