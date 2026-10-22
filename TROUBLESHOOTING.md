# ALEX Troubleshooting Guide

## 📋 Quick Diagnosis

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| `Cannot find module '@prisma/client'` | Prisma client not generated | `pnpm db:generate` |
| `P1001: Can't reach database server` | PostgreSQL not running | `docker-compose up -d postgres` |
| `P2003: Foreign key constraint failed` | Seeding order issue | `pnpm db:seed` (after reset) |
| `Port 3000 already in use` | Another dev server running | `npx kill-port 3000` |
| `Module not found: @/lib/...` | TS path aliases not resolved | Restart TS server in IDE |
| `Authentication failed` | Supabase keys invalid | Check `.env.local` Supabase keys |
| `AI provider error` | API key missing/invalid | Check Settings → AI Settings |

---

## 🗄️ Database Issues

### Prisma Client Not Generated
```bash
# Regenerate Prisma client
pnpm db:generate

# If still failing, clean and regenerate
rm -rf node_modules/.prisma
pnpm db:generate
```

### PostgreSQL Connection Refused
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Check logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres pg_isready -U postgres
```

### SQLite is not supported by the current schema
```bash
# Start PostgreSQL, then use the PostgreSQL URL from .env.local
docker compose up -d postgres redis
pnpm db:push
pnpm db:seed
```

### Migration Failed / Drift Detected
```bash
# Reset and re-apply migrations (DEVELOPMENT ONLY)
pnpm db:migrate:reset

# Or force push (loses migration history)
pnpm db:push --force-reset
```

### Foreign Key Constraint Failed During Seed
```bash
# The seed runs in dependency order. If it fails:
# 1. Reset database
pnpm db:migrate:reset

# 2. Re-seed
pnpm db:seed
```

---

## 🔐 Authentication Issues

### Supabase Auth Not Working
```bash
# Verify Supabase keys in .env.local
cat .env.local | grep SUPABASE

# Required keys:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

**Common issues:**
- Using Supabase Cloud? Ensure URL and keys match your project
- Using local Supabase? Run `docker-compose up -d supabase` (if configured)
- Keys must be from the same Supabase project

### Session/Logout Issues
```bash
# Clear browser cookies for localhost:3000
# Or use incognito/private window

# Check NEXTAUTH_SECRET is set (min 32 chars)
grep NEXTAUTH_SECRET .env.local
```

### Role-Based Access Not Working
- Verify user has correct `CollegeMembership` with `status: ACTIVE`
- Check `role` field matches expected (STUDENT/LECTURER/ADMIN/PROJECT_MENTOR)
- Ensure `semesterId` and `courseId` are set for students

---

## 🤖 AI Provider Issues

### NVIDIA Nemotron API Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Invalid API key | Check key at https://integrate.api.nvidia.com |
| `429 Rate Limited` | Exceeded quota | Wait or upgrade plan |
| `404 Model Not Found` | Wrong model name | Use `nvidia/nemotron-3-ultra` |
| `500 Internal Error` | NVIDIA service issue | Retry, check status page |

```bash
# Test Nemotron connection
curl -X POST https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_NEMOTRON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "nvidia/nemotron-3-ultra", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}'
```

### Embeddings Fail
```bash
# Check embedding provider is configured
# In Settings → AI Settings → Add embedding provider API key

# For local dev without keys, mock embeddings are used
```

### No AI Provider Configured
```
Error: "No AI provider configured for chat"
```
**Fix:** Go to Settings → AI Settings → Add Credential → Select provider → Enter API key → Set as default

### Test Connection Fails
```bash
# Test via API
curl -X POST http://localhost:3000/api/ai/test-connection \
  -H "Content-Type: application/json" \
  -d '{"provider": "NVIDIA_NEMOTRON", "apiKey": "your-key"}'
```

---

## 🌐 Network & Port Issues

### Port 3000 Already in Use
```bash
# Find and kill process
npx kill-port 3000

# Or use different port
PORT=3001 pnpm dev
```

### CORS Errors
```bash
# Check NEXT_PUBLIC_APP_URL matches your dev URL
grep NEXT_PUBLIC_APP_URL .env.local

# Should be: http://localhost:3000
```

### HTTPS Required for Voice/Microphone
```bash
# Use mkcert for local HTTPS
mkcert -install
mkcert localhost 127.0.0.1 ::1

# Start with HTTPS
pnpm dev:https
```

---

## 📁 File Upload & Storage Issues

### Upload Fails / Times Out
```bash
# Check file size limit
grep MAX_FILE_SIZE_MB .env.local

# Increase if needed (max 50MB default)
MAX_FILE_SIZE_MB="100"
```

### Supabase Storage Upload Fails
```bash
# Verify bucket exists in Supabase Dashboard
# Buckets needed: documents, avatars, resources

# Check service role key has storage permissions
```

### File Processing Stuck
```bash
# Check document processing jobs
# In Prisma Studio: DocumentProcessingJob table

# Common statuses: UPLOADED → QUEUED → EXTRACTING → CHUNKING → EMBEDDING → INDEXING → READY/FAILED

# If stuck at EMBEDDING: Check embedding provider API key
# If stuck at EXTRACTING: File may be corrupted or unsupported format
```

---

## 🏗️ Build & TypeScript Errors

### Type Errors After Schema Changes
```bash
# Always regenerate after schema changes
pnpm db:generate
pnpm typecheck
```

### Missing Type Definitions
```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Next.js Build Fails
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
pnpm build
```

### Turbopack Issues (Next.js 16+)
```bash
# Disable Turbopack temporarily
# In next.config.ts: turbopack: false

# Or clear Turbopack cache
rm -rf .next/turbo
```

---

## 🎤 Voice Assistant Issues

### Microphone Not Working
- **Browser permission**: Click lock icon → Microphone → Allow
- **HTTPS required**: Use `pnpm dev:https` or `mkcert`
- **Browser support**: Chrome/Edge/Firefox only (no Safari)

### No Speech Recognition
```bash
# Check browser console for errors
# Web Speech API not supported in all browsers
# Fallback: Type instead of speak
```

### TTS Not Playing
- Check browser autoplay policy (user interaction required first)
- Verify TTS provider API key if using ElevenLabs/OpenAI TTS
- Browser TTS uses system voices (varies by OS)

---

## 📊 Performance Issues

### Slow Page Loads
```bash
# Enable Turbopack (default in Next.js 16+)
# Check next.config.ts for turbopack config

# Analyze bundle
pnpm build && npx @next/bundle-analyzer
```

### Slow Database Queries
```bash
# Enable query logging in development
# In .env.local: LOG_LEVEL="query"

# Check Prisma Studio for slow queries
pnpm db:studio
```

### Memory Leaks
```bash
# Monitor Node memory
# In dev: Node --max-old-space-size=4096

# Restart dev server periodically
```

---

## 🔄 Reset Commands

### Full Reset (Nuclear Option)
```bash
# Stop everything
pkill -f "next dev"
docker-compose down -v

# Clean all
rm -rf node_modules .next .turbo dev.db dev.db-journal

# Fresh start
pnpm install
docker-compose up -d
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

### Database Only Reset
```bash
pnpm db:migrate:reset
pnpm db:seed
```

### Clear Next.js Cache Only
```bash
rm -rf .next
pnpm dev
```

---

## 📱 Mobile Testing

### Test on Real Device
```bash
# Find your local IP
ipconfig | findstr IPv4  # Windows
ifconfig | grep inet     # Mac/Linux

# Access via http://YOUR_IP:3000
# Must be on same network
```

### HTTPS for Mobile
```bash
# Generate certs
mkcert -install
mkcert localhost 127.0.0.1 ::1 192.168.x.x

# Start with HTTPS
pnpm dev:https
```

---

## 📞 Getting Help

### Check Logs
```bash
# Next.js dev server logs (terminal where pnpm dev runs)
# Browser console (F12)
# Docker logs: docker-compose logs -f postgres redis
# Prisma Studio: pnpm db:studio
```

### Create Minimal Reproduction
1. Create new branch: `git checkout -b debug/issue-name`
2. Make minimal changes to reproduce
3. Document exact steps
4. Include: OS, Node version, pnpm version, browser

### Report Issues
- GitHub Issues: Include error messages, logs, steps to reproduce
- Check existing issues first
- Provide `.env.local` (with secrets redacted)

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `pnpm dev` starts without errors
- [ ] http://localhost:3000 loads
- [ ] Can log in with demo credentials
- [ ] Dashboard shows correct role-based navigation
- [ ] AI Assistant responds (even without API keys - uses mock)
- [ ] Documents page loads, can upload PDF
- [ ] Document processes to READY status
- [ ] AI Assistant cites uploaded document
- [ ] Attendance page shows demo data
- [ ] Assessments page shows demo assessments
- [ ] Settings → AI Settings → Test Connection works (with API key)
- [ ] Voice Assistant → Push to Talk works (HTTPS/localhost)
- [ ] Document Studio generates PDF/DOCX
- [ ] Solution Generator produces structured output

---

## 🆘 Still Stuck?

1. Check this guide again
2. Search GitHub Issues
3. Run verification checklist above
4. Try full reset (nuclear option)
5. Create GitHub Issue with:
   - Error message (full)
   - Steps to reproduce
   - OS, Node version, pnpm version
   - Relevant logs (redact secrets)
