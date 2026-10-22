# ALEX Deployment Guide

## Overview

ALEX deploys to Firebase with:
- **Frontend**: Static Next.js export → Firebase Hosting
- **Backend**: Firebase Cloud Functions (Gen 2)
- **Database**: Firestore + PostgreSQL (Prisma)
- **Storage**: Firebase Storage
- **Auth**: Supabase + Firebase Auth integration

## Deployment Environments

| Environment | Firebase Project | URL | Purpose |
|-------------|------------------|-----|---------|
| Preview | `alex-dev` | `https://alex-dev--pr-<num>.web.app` | Per-PR testing |
| Staging | `alex-staging` | `https://alex-staging.web.app` | QA, demos |
| Production | `alex-prod` | `https://alex-prod.web.app` (custom domain) | Live users |

## Prerequisites

- Firebase CLI: `npm install -g firebase-tools`
- Access to Firebase projects
- GitHub repository with Actions enabled
- Required secrets configured in GitHub

## Quick Deployment Commands

### From Local Machine

```bash
# Full deployment to preview
./deployment/scripts/deploy.sh preview

# Full deployment to production
./deployment/scripts/deploy.sh production alex-prod

# Individual services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

### From GitHub Actions

1. **Preview**: Automatic on Pull Requests
2. **Production**: Manual workflow dispatch on `main` branch

## Pre-Deployment Checklist

Run before every deployment:

```bash
./deployment/scripts/pre-deploy-check.sh
```

This validates:
- [ ] All required files present
- [ ] Firebase project configured
- [ ] No secrets in source code
- [ ] Environment example files exist
- [ ] firebase.json syntax valid
- [ ] Firestore/Storage rules syntax valid
- [ ] Build succeeds

## Deployment Process

### 1. Preview Deployment (Automatic on PR)

```mermaid
graph LR
    A[Push to PR] --> B[CI: Lint, Typecheck, Test]
    B --> C[Build All Packages]
    C --> D[Deploy to Preview Channel]
    D --> E[Comment PR with Preview URL]
```

### 2. Production Deployment (Manual)

```bash
# Option 1: GitHub Actions (Recommended)
# Go to Actions → Firebase Deploy → Run workflow
# Select: environment=production, project_id=alex-prod

# Option 2: Local (Emergency only)
./deployment/scripts/deploy.sh production alex-prod
```

Production deployment steps:
1. Validate configuration
2. Build all packages
3. Deploy Firestore rules & indexes
4. Deploy Storage rules
5. Deploy Functions
6. Deploy Hosting
7. Verify deployment

## Build Process

```bash
# Full build pipeline
./deployment/scripts/build.sh
```

Steps:
1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Build shared packages (types, utils, validation-schemas)
3. Build web application (`next build` → `apps/web/out/`)
4. Build Functions (`tsc` → `functions/lib/`)

## Environment Variables

### Frontend (Build Time)

Set in GitHub Actions or `.env.production`:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
# ... other NEXT_PUBLIC_* vars
```

### Functions (Runtime)

Set via Firebase Secret Manager:

```bash
firebase functions:secrets:set NVIDIA_NEMOTRON_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set ENCRYPTION_KEY
firebase functions:secrets:set NEXTAUTH_SECRET
```

Set via Functions Config (non-sensitive):

```bash
firebase functions:config:set \
  nvidia.model="nvidia/nemotron-3-ultra" \
  email.from="noreply@domain.com"
```

## Database Migrations

### PostgreSQL (Prisma)

```bash
# Generate client
pnpm --filter apps/web run db:generate

# Deploy migrations (production)
pnpm --filter apps/web run db:migrate:deploy

# Or push schema directly (development only)
pnpm --filter apps/web run db:push:postgres
```

### Firestore

Rules and indexes deployed via Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Rollback Procedures

### Hosting Rollback

```bash
# List versions
firebase hosting:channel:list

# Rollback to specific version
firebase hosting:clone alex-prod:<VERSION_ID> alex-prod:live
```

### Functions Rollback

```bash
# List deployed functions
firebase functions:list

# Delete and redeploy specific function
firebase functions:delete <function-name> --force
firebase deploy --only functions:<function-name>
```

### Firestore Rules Rollback

```bash
# Deploy previous rules version
firebase deploy --only firestore:rules
```

## Post-Deployment Verification

### Automated Checks

1. GitHub Actions workflow status
2. Firebase Console deployment history
3. Functions logs: `firebase functions:log`

### Manual Verification

- [ ] Homepage loads: `https://your-domain.com`
- [ ] Authentication works (sign in/up)
- [ ] Dashboard loads with data
- [ ] Document upload works
- [ ] AI chat responds
- [ ] Real-time features (notifications, presence)
- [ ] File download works
- [ ] Admin functions accessible (if admin)

## Monitoring Deployment

### Firebase Console

- **Hosting**: Releases tab → Version history
- **Functions**: Logs tab → Filter by function
- **Firestore**: Usage tab → Read/write counts
- **Storage**: Usage tab → Bandwidth

### GitHub Actions

- Workflow run status
- Artifact uploads (build outputs)
- Deployment summary comments

## Troubleshooting

### Build Failures

```bash
# Clear caches
pnpm store prune
rm -rf node_modules apps/web/node_modules functions/node_modules
pnpm install

# Check Node version
node --version  # Should be 20.x
```

### Functions Deploy Timeout

```bash
# Increase timeout in firebase.json
"functions": {
  "runtime": "nodejs20",
  "timeoutSeconds": 540  # Max 9 minutes
}
```

### Firestore Index Build Stuck

```bash
# Check index status in Firebase Console
# Or wait - large indexes can take 30+ minutes
```

### Hosting Not Updated

```bash
# Clear CDN cache (if custom domain)
# Or deploy with new version
firebase hosting:channel:deploy production --expires 1h
```

## Cost Optimization

### Functions
- Set `maxInstances` for expensive functions
- Use `minInstances: 0` for cold starts acceptable
- Monitor GB-seconds in Console

### Firestore
- Use composite indexes efficiently
- Avoid unnecessary reads with `select()`
- Enable TTL policies for temporary data

### Hosting
- Static export = minimal cost
- Configure caching headers in firebase.json

### Storage
- Set lifecycle rules for temp uploads
- Compress images before upload

## Security in Production

- All secrets in Secret Manager (not config)
- Firestore rules: Default deny, explicit allow
- Storage rules: User-scoped access
- Functions: App Check + reCAPTCHA
- CORS: Restricted to known domains
- Rate limiting on public endpoints

## Maintenance Windows

- **Weekly**: Dependency updates (automated via Dependabot)
- **Monthly**: Security audit, log review
- **Quarterly**: Cost review, performance optimization
- **Annually**: Major version upgrades, architecture review