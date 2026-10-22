# Environment Variables Reference

## Variable Categories

| Prefix | Scope | Security |
|--------|-------|----------|
| `NEXT_PUBLIC_*` | Client-side (browser) | Public - safe to expose |
| `FIREBASE_*` | Server-side (Functions) | Secret - use Secret Manager |
| `SUPABASE_*` | Server-side | Secret - use Secret Manager |
| `NVIDIA_*`, `OPENAI_*`, etc. | Server-side | Secret - use Secret Manager |
| `DATABASE_URL` | Server-side | Secret - use Secret Manager |
| `NEXTAUTH_*` | Server-side | Secret - use Secret Manager |
| `ENCRYPTION_KEY` | Server-side | Secret - use Secret Manager |
| `SMTP_*` | Server-side | Secret - use Secret Manager |

## Complete Variable List

### Application Core

| Variable | Required | Scope | Description | Example |
|----------|----------|-------|-------------|---------|
| `NODE_ENV` | Yes | Both | Runtime environment | `production` |
| `NEXT_PUBLIC_APP_URL` | Yes | Client | Frontend URL | `https://alex.example.com` |
| `NEXTAUTH_URL` | Yes | Server | NextAuth callback URL | `https://alex.example.com` |
| `NEXTAUTH_SECRET` | Yes | Server | NextAuth encryption key | `openssl rand -base64 32` |

### Database

| Variable | Required | Scope | Description | Example |
|----------|----------|-------|-------------|---------|
| `DATABASE_URL` | Yes | Server | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

### Firebase (Client - Public)

| Variable | Required | Scope | Description | Source |
|----------|----------|-------|-------------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Client | Firebase Web API Key | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Client | Auth domain | `project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Client | Project ID | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Client | Storage bucket | `project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Client | Sender ID | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Client | App ID | Firebase Console |

### Firebase (Server - Secret)

| Variable | Required | Scope | Description | Setup |
|----------|----------|-------|-------------|-------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes* | Server | Service account JSON | Secret Manager |
| `FIREBASE_PROJECT_ID` | Yes* | Server | Project ID | Functions Config |
| `FIREBASE_CLIENT_EMAIL` | Yes* | Server | Service account email | Functions Config |
| `FIREBASE_PRIVATE_KEY` | Yes* | Server | Private key (PEM) | Secret Manager |

*Use either service account JSON OR individual fields

### Supabase

| Variable | Required | Scope | Description | Source |
|----------|----------|-------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client | Supabase project URL | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client | Anon public key | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Service role key (admin) | Secret Manager |

### AI Providers (Server - All Secrets)

| Variable | Required | Provider | Description |
|----------|----------|----------|-------------|
| `NVIDIA_NEMOTRON_API_KEY` | Primary | NVIDIA | Nemotron API key |
| `NVIDIA_NEMOTRON_MODEL` | Primary | NVIDIA | Model name (`nvidia/nemotron-3-ultra`) |
| `NVIDIA_NEMOTRON_BASE_URL` | Primary | NVIDIA | API base URL |
| `OPENAI_API_KEY` | Fallback | OpenAI | GPT API key |
| `GOOGLE_GEMINI_API_KEY` | Fallback | Google | Gemini API key |
| `ANTHROPIC_API_KEY` | Fallback | Anthropic | Claude API key |
| `MISTRAL_API_KEY` | Optional | Mistral | Mistral API key |
| `GROQ_API_KEY` | Optional | Groq | Groq API key |
| `OPENROUTER_API_KEY` | Optional | OpenRouter | OpenRouter API key |
| `TOGETHER_AI_API_KEY` | Optional | Together | Together AI API key |

### Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_MODE` | No | `firebase` | `firebase` or `local` |
| `STORAGE_BUCKET_DOCUMENTS` | No | `documents` | Documents bucket |
| `STORAGE_BUCKET_AVATARS` | No | `avatars` | Avatars bucket |
| `STORAGE_BUCKET_RESOURCES` | No | `resources` | Resources bucket |
| `MAX_FILE_SIZE_MB` | No | `50` | Max upload size |
| `ALLOWED_FILE_TYPES` | No | `pdf,doc,docx,txt...` | Allowed extensions |

### Email

| Variable | Required | Description |
|----------|----------|-------------|
| `SMTP_HOST` | For emails | SMTP server host |
| `SMTP_PORT` | For emails | SMTP port (587) |
| `SMTP_USER` | For emails | SMTP username |
| `SMTP_PASSWORD` | For emails | SMTP password (Secret) |
| `EMAIL_FROM` | For emails | From address |

### Encryption

| Variable | Required | Description | Generation |
|----------|----------|-------------|------------|
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256 | `openssl rand -hex 32` |

### Background Jobs

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | For queues | Redis connection string |

### File Processing

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TESSERACT_PATH` | For OCR | `/usr/bin/tesseract` | Tesseract binary path |

### Monitoring

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_DSN` | Optional | Sentry DSN for error tracking |
| `LOG_LEVEL` | Optional | Log level (`debug`, `info`, `warn`, `error`) |

## Setting Variables

### Local Development

```bash
# Create .env files from examples
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp functions/.env.example functions/.env

# Edit with your values
# NEVER commit .env files with real secrets!
```

### Firebase Functions (Production)

```bash
# Secrets (encrypted, not visible in console)
firebase functions:secrets:set NVIDIA_NEMOTRON_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set GOOGLE_GEMINI_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set SMTP_PASSWORD
firebase functions:secrets:set ENCRYPTION_KEY
firebase functions:secrets:set NEXTAUTH_SECRET
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
firebase functions:secrets:set FIREBASE_SERVICE_ACCOUNT_JSON

# Config (visible in console, non-sensitive)
firebase functions:config:set \
  nvidia.model="nvidia/nemotron-3-ultra" \
  nvidia.base_url="https://integrate.api.nvidia.com/v1" \
  email.from="noreply@alex.example.com" \
  smtp.host="smtp.example.com" \
  smtp.port="587" \
  smtp.user="noreply@alex.example.com"
```

### GitHub Actions (CI/CD)

Add as Repository Secrets (Settings → Secrets → Actions):

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_PROJECT_ID` | Production project ID |
| `FIREBASE_TOKEN` | `firebase login:ci` output |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON |

### Vercel/Netlify (Alternative Hosting)

If not using Firebase Hosting, set in platform dashboard:

- All `NEXT_PUBLIC_*` variables
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `DATABASE_URL` (if using managed Postgres)

## Validation

### Check All Required Variables Set

```bash
# Local
node -e "
const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'ENCRYPTION_KEY'];
const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  console.error('Missing:', missing.join(', '));
  process.exit(1);
}
console.log('All required variables set');
"
```

### Functions Config Validation

```bash
# View current config
firebase functions:config:get

# View secrets (names only)
firebase functions:secrets:list
```

## Environment-Specific Values

### Development

```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alex
AI_MODE=mock
STORAGE_MODE=local
```

### Staging

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://alex-staging.web.app
NEXTAUTH_URL=https://alex-staging.web.app
DATABASE_URL=postgresql://user:pass@staging-db:5432/alex
STORAGE_MODE=firebase
```

### Production

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://alex.example.com
NEXTAUTH_URL=https://alex.example.com
DATABASE_URL=postgresql://user:pass@prod-db:5432/alex
STORAGE_MODE=firebase
LOG_LEVEL=warn
```

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use Secret Manager** for all production secrets
3. **Rotate keys regularly** - Especially AI API keys
4. **Use least privilege** - Separate keys per environment
5. **Monitor usage** - Set up billing alerts on AI providers
6. **Audit access** - Review who has access to secrets
7. **Use different keys** per environment (dev/staging/prod)