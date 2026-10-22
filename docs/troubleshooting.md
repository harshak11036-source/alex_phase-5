# ALEX Troubleshooting Guide

## Quick Diagnosis

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| White screen / 500 | Build error / Missing env | Build logs, `.env` files |
| Auth not working | Firebase config / Supabase | `NEXT_PUBLIC_FIREBASE_*`, Supabase URL |
| API calls fail | Functions not deployed / CORS | Functions logs, CORS config |
| Documents not uploading | Storage rules / Bucket config | Storage rules, bucket exists |
| AI not responding | API keys / Quota | Functions logs, AI provider dashboard |
| Real-time not working | Firestore rules / Offline | Rules, network tab |
| Build fails | Dependencies / TypeScript | `pnpm install`, `tsc --noEmit` |

## Common Issues & Solutions

### Frontend Issues

#### "Module not found" errors after install
```bash
# Clear caches and reinstall
rm -rf node_modules apps/web/node_modules
pnpm store prune
pnpm install
```

#### TypeScript errors in IDE but build passes
```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl+Shift+P → "TypeScript: Restart TS Server"

# Or check tsconfig paths
# Ensure @alex/* paths resolve correctly
```

#### Next.js build fails with "Text content does not match server-rendered HTML"
```bash
# This happens with static export + dynamic content
# Check for:
# - Date/time formatting without fixed locale
# - Random IDs generated at render time
# - Browser-only APIs in components (use useEffect)

# Fix: Use suppressHydrationWarning or move to client component
```

#### Hydration mismatch in development
```bash
# Common causes:
# - Browser extensions modifying DOM
# - Invalid HTML nesting (e.g., <p> inside <p>)
# - Date formatting differences

# Check browser console for specific mismatch
```

#### Tailwind styles not applying
```bash
# Ensure content paths in tailwind.config.ts
# For workspace: include packages/*/src/**/*.{ts,tsx}

# Rebuild CSS
pnpm --filter apps/web run build
```

### Authentication Issues

#### "Firebase: Error (auth/unauthorized-domain)"
```bash
# Add domain to Firebase Console:
# Authentication → Settings → Authorized domains
# Add: localhost, your-preview-domain.web.app, your-production-domain.com
```

#### "Supabase: Invalid API key"
```bash
# Check:
# 1. NEXT_PUBLIC_SUPABASE_URL matches project
# 2. NEXT_PUBLIC_SUPABASE_ANON_KEY is correct (not service role)
# 3. No trailing slashes in URL
```

#### User redirected to login after refresh
```bash
# Check:
# 1. NEXTAUTH_SECRET set and consistent
# 2. NEXTAUTH_URL matches actual domain
# 3. Cookies not blocked (secure: true in production)
# 4. Firebase Auth persistence set to LOCAL
```

#### "Missing or insufficient permissions" in Functions
```bash
# Check:
# 1. User is authenticated (request.auth exists)
# 2. User document exists in Firestore
# 3. User role matches required role
# 4. Custom claims synced (if using)
```

### Backend (Functions) Issues

#### Functions deploy fails with "Build failed"
```bash
# Check functions build locally first
cd functions
npm run build

# Common fixes:
# - Fix TypeScript errors
# - Ensure all imports resolve
# - Check package.json dependencies
```

#### Function timeout (default 60s)
```bash
# Increase timeout in function definition
export const longFunction = onCall(
  { timeoutSeconds: 300, memory: '512MiB' },
  async (request) => { ... }
);

# Or in firebase.json for all functions
"functions": {
  "runtime": "nodejs20",
  "timeoutSeconds": 300
}
```

#### "Function crashed" / Out of memory
```bash
# Increase memory allocation
export const heavyFunction = onCall(
  { memory: '1GiB', timeoutSeconds: 540 },
  async (request) => { ... }
);

# Profile memory usage
# Add logging: console.log('Memory:', process.memoryUsage());
```

#### CORS errors from frontend
```bash
# Configure CORS in function options
export const myFunction = onCall(
  { cors: ['https://your-domain.com', 'http://localhost:3000'] },
  async (request) => { ... }
);

# For HTTP triggers (not callable):
export const httpFunction = onRequest(
  { cors: true }, // or specify origins
  async (req, res) => { ... }
);
```

#### Functions not picking up secret changes
```bash
# Secrets require redeploy to take effect
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:myFunction
```

#### Firestore permission denied in Functions
```bash
# Functions use Admin SDK (bypasses rules) by default
# If using user credentials (app.checkAuthorization):
// request.auth.token.firebase.sign_in_provider
// request.auth.token.email_verified

# Check service account has Datastore User role
```

### Database Issues

#### Prisma: "Can't reach database server"
```bash
# Check:
# 1. PostgreSQL running: pg_isready
# 2. DATABASE_URL correct format
# 3. Firewall/security groups allow connection
# 4. SSL mode: ?sslmode=require for managed DBs

# For connection pooling (PgBouncer):
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
```

#### Prisma: "Column does not exist" after schema change
```bash
# Generate client and migrate
pnpm --filter apps/web run db:generate
pnpm --filter apps/web run db:migrate dev

# For production:
pnpm --filter apps/web run db:migrate deploy
```

#### Firestore: "The query requires an index"
```bash
# 1. Check error message for index creation link
# 2. Or add to firebase/firestore.indexes.json
# 3. Deploy indexes
firebase deploy --only firestore:indexes

# 4. Wait for index building (can take 30+ min)
```

#### Firestore: Offline persistence issues
```bash
# Clear browser data for domain
# Or disable persistence:
import { enableIndexedDbPersistence } from 'firebase/firestore';
enableIndexedDbPersistence(db).catch(() => {});
```

### Storage Issues

#### "Permission denied" on upload
```bash
# Check storage.rules
match /documents/{userId}/{documentId}/{fileName} {
  allow write: if request.auth != null && request.auth.uid == userId;
}

# Ensure userId in path matches authenticated user
```

#### "File too large" error
```bash
# Check:
# 1. MAX_FILE_SIZE_MB env var
# 2. Firebase Storage limits (default 5GB per file)
# 3. Function timeout for large uploads
# 4. Client-side validation before upload
```

#### Download fails with 403
```bash
# For private files, use signed URLs
const url = await storage.bucket('documents')
  .file(path)
  .getSignedUrl({ action: 'read', expires: '1h' });
```

### AI Integration Issues

#### "Invalid API key" from AI provider
```bash
# Check:
# 1. Key is correct in Secret Manager
# 2. Key has not expired/revoked
# 3. Key has required permissions/models
# 4. Billing enabled on provider account

# Test key directly:
curl -H "Authorization: Bearer $KEY" https://api.provider.com/models
```

#### AI responses timeout
```bash
# Increase function timeout
export const aiFunction = onCall(
  { timeoutSeconds: 300 },
  async (request) => { ... }
);

# Add request timeout to AI client
const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000 // 60s
});
```

#### Streaming not working
```bash
# Firebase Callable Functions don't support streaming
# Options:
# 1. Use HTTP trigger with streaming response
# 2. Return full response (current approach)
# 3. Use Server-Sent Events via separate endpoint
```

#### High AI costs
```bash
# Monitor usage in provider dashboard
# Implement:
# - Per-user daily limits
# - Token counting before requests
# - Caching for repeated queries
# - Cheaper models for simple tasks
```

### Deployment Issues

#### "Firebase CLI version mismatch"
```bash
# Update CLI
npm install -g firebase-tools@latest

# Or use npx
npx firebase deploy
```

#### Hosting shows old version
```bash
# Clear CDN cache (custom domain)
# Or deploy new version
firebase hosting:channel:deploy production

# Check: firebase.json has correct public directory
"hosting": { "public": "apps/web/out" }
```

#### Preview channel not created
```bash
# Ensure:
# 1. Firebase project has Hosting enabled
# 2. GitHub Actions has FIREBASE_TOKEN
# 3. Repository has Actions permissions
```

#### GitHub Actions fails on "pnpm not found"
```yaml
# Add to workflow:
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'
```

### Performance Issues

#### Slow page loads
```bash
# Check:
# 1. Network tab for slow resources
# 2. Bundle size: pnpm --filter apps/web run build && npx @next/bundle-analyzer
# 3. Database query performance (Firestore indexes)
# 4. Function cold starts (set minInstances)
```

#### High Firestore read costs
```bash
# Optimize:
# 1. Use select() to fetch only needed fields
# 2. Add composite indexes for queries
# 3. Cache frequently accessed data
# 4. Use aggregation queries for counts
```

#### Function cold starts
```bash
# Set minimum instances for critical functions
export const criticalFunction = onCall(
  { minInstances: 1 },
  async (request) => { ... }
);

# Or in firebase.json
"functions": {
  "minInstances": 1
}
```

### Development Environment Issues

#### Emulator not starting
```bash
# Check ports available
lsof -i :4000 -i :5001 -i :8080 -i :9099 -i :9199

# Kill existing processes
firebase emulators:exec --kill-on-port-conflict

# Clear emulator cache
rm -rf ~/.cache/firebase/emulators
```

#### "Cannot find module" in functions
```bash
# Ensure dependencies installed
cd functions && npm install

# Check package.json has all imports
# Rebuild: npm run build
```

#### Hot reload not working
```bash
# For Next.js: uses Turbopack by default
pnpm --filter apps/web run dev

# For Functions: use serve script
cd functions && npm run serve
```

## Debugging Tools

### Firebase Emulator UI
```
http://localhost:4000
- Firestore: Data, Rules, Indexes
- Functions: Logs, Triggers
- Auth: Users, Tokens
- Storage: Files, Rules
```

### Function Logs
```bash
# Live logs
firebase functions:log --only functionName

# Filter by severity
firebase functions:log --level error

# Last 100 lines
firebase functions:log -n 100
```

### Network Debugging
```bash
# Chrome DevTools → Network tab
# Filter: "functions" or "firestore"
# Check: Request/Response, Timing, Headers
```

### Database Query Debugging
```typescript
// Add query logging
const query = db.collection('documents')
  .where('ownerId', '==', userId)
  .limit(20);

console.log('Query:', query._queryOptions);
const snapshot = await query.get();
console.log('Results:', snapshot.size);
```

## Getting Help

### Resources
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [GitHub Issues](https://github.com/your-org/alex/issues)

### Support Channels
1. **Documentation**: Check this guide and `/docs`
2. **GitHub Issues**: Bug reports, feature requests
3. **Discord/Slack**: Team chat for quick questions
4. **Firebase Support**: For Firebase-specific issues (Blaze plan)

### Creating Good Bug Reports

```markdown
## Bug Report

**Environment**: development / staging / production
**Component**: frontend / functions / database / auth
**Steps to Reproduce**:
1. Go to...
2. Click...
3. Observe...

**Expected Behavior**: ...
**Actual Behavior**: ...

**Logs/Errors**:
```
Paste relevant logs here
```

**Screenshots**: (if applicable)
```

## Maintenance Commands

```bash
# Reset development database
pnpm --filter apps/web run db:reset

# Clear all caches
pnpm store prune
rm -rf node_modules apps/web/node_modules functions/node_modules .next

# Update dependencies
pnpm update --latest

# Check for vulnerabilities
pnpm audit

# Generate Prisma client after schema changes
pnpm --filter apps/web run db:generate

# View Firebase projects
firebase projects:list

# Switch Firebase project
firebase use alex-staging
```