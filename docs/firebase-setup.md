# Firebase Project Setup Guide

## Creating Firebase Projects

### 1. Create Projects in Firebase Console

Go to [Firebase Console](https://console.firebase.google.com) and create three projects:

| Environment | Project ID Suffix | Purpose |
|-------------|-------------------|---------|
| Development | `-dev` | Local emulator testing, feature development |
| Staging | `-staging` | Pre-production testing, QA |
| Production | `-prod` | Live production application |

Example: `alex-dev`, `alex-staging`, `alex-prod`

### 2. Enable Required Services

For each project, enable:

1. **Authentication**
   - Sign-in method: Email/Password
   - Authorized domains: Add your domains

2. **Firestore Database**
   - Start in **Production mode** (rules will be deployed)
   - Select location closest to users

3. **Storage**
   - Start in **Production mode**
   - Same location as Firestore

4. **Hosting**
   - Will be configured via CLI

5. **Functions**
   - Upgrade to **Blaze plan** (required for Gen 2 Functions)
   - Select same region as Firestore

### 3. Configure Firebase CLI

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize in project root (if not already done)
firebase init

# Select features:
# - Firestore: Rules & Indexes
# - Functions: TypeScript
# - Hosting: Configure
# - Storage: Rules
# - Emulators: All

# Select projects for each alias:
# firebase use --add
# ? Which project do you want to add? alex-dev
# ? What alias do you want to use? default
# ? Which project do you want to add? alex-staging
# ? What alias do you want to use? staging
# ? Which project do you want to add? alex-prod
# ? What alias do you want to use? production
```

### 4. Verify .firebaserc Configuration

```json
{
  "projects": {
    "default": "alex-dev",
    "production": "alex-prod",
    "staging": "alex-staging"
  },
  "targets": {
    "default": {
      "hosting": {
        "default": ["alex-web"]
      }
    }
  }
}
```

## Service Configuration

### Firestore Rules Deployment

```bash
# Deploy rules to current project
firebase deploy --only firestore:rules

# Deploy to specific project
firebase deploy --only firestore:rules --project alex-prod
```

### Firestore Indexes

Indexes are defined in `firebase/firestore.indexes.json`. Deploy with:

```bash
firebase deploy --only firestore:indexes
```

### Storage Rules

```bash
firebase deploy --only storage
```

### Functions Configuration

Set secrets for sensitive configuration:

```bash
# Set secrets (one-time, stored securely)
firebase functions:secrets:set NVIDIA_NEMOTRON_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set GOOGLE_GEMINI_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set SMTP_PASSWORD
firebase functions:secrets:set ENCRYPTION_KEY
firebase functions:secrets:set NEXTAUTH_SECRET
firebase functions:secrets:set DATABASE_URL

# Set config (non-sensitive, visible in console)
firebase functions:config:set \
  nvidia.model="nvidia/nemotron-3-ultra" \
  email.from="noreply@yourdomain.com" \
  smtp.host="smtp.example.com" \
  smtp.port="587"
```

View current config:
```bash
firebase functions:config:get
```

### Hosting Configuration

The `firebase.json` configures hosting for static export:

```json
{
  "hosting": {
    "public": "apps/web/out",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [...]
  }
}
```

Deploy hosting:
```bash
# Preview channel
firebase hosting:channel:deploy preview --expires 7d

# Production
firebase deploy --only hosting
```

## Emulator Configuration

The `firebase.json` includes emulator config:

```json
{
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "auth": { "port": 9099 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

Start emulators:
```bash
firebase emulators:start

# With data import/export
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

## CI/CD Setup (GitHub Actions)

### Required GitHub Secrets

Go to Repository Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Description |
|-------------|-------------|
| `FIREBASE_PROJECT_ID` | Production Firebase project ID |
| `FIREBASE_TOKEN` | `firebase login:ci` output token |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON for Admin SDK |

Generate CI token:
```bash
firebase login:ci
# Copy the token output
```

### Service Account for Admin SDK

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Add as `FIREBASE_SERVICE_ACCOUNT` secret (entire JSON)

## Project-Specific Configuration

### Development (alex-dev)
- Used with emulators locally
- Can deploy preview channels for testing
- Lower quotas, no cost concerns

### Staging (alex-staging)
- Mirrors production configuration
- Used for QA, stakeholder demos
- Connect to staging database
- Enable all monitoring

### Production (alex-prod)
- Production Firebase project
- Strict security rules
- Monitoring & alerting enabled
- Budget alerts configured
- Custom domain configured

## Custom Domain Setup

```bash
# Add custom domain
firebase hosting:channel:deploy production

# Or via console:
# 1. Go to Hosting → Add custom domain
# 2. Follow verification steps
# 3. Update DNS records
# 4. SSL provisioned automatically
```

## Monitoring & Alerting

Enable in Firebase Console:
1. **Performance Monitoring**: Automatic for Hosting
2. **Crashlytics**: For mobile (if applicable)
3. **Analytics**: Optional, for user insights
4. **Cloud Monitoring**: Set up alerts for:
   - Function errors > 1%
   - Function latency > 5s
   - Firestore read/write errors
   - Storage bandwidth

## Budget Alerts

```bash
# Set budget alert (via gcloud or console)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Alex Production Budget" \
  --budget-filter=projects=alex-prod \
  --amount=100USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0
```

## Security Checklist

- [ ] Firestore rules deployed and tested
- [ ] Storage rules deployed and tested
- [ ] Functions secrets configured (not in config)
- [ ] CORS configured for Functions
- [ ] App Check enabled (recommended)
- [ ] reCAPTCHA Enterprise for Auth (recommended)
- [ ] Custom domain with SSL verified
- [ ] Budget alerts configured
- [ ] Monitoring alerts configured
- [ ] IAM roles: Principle of least privilege

## Troubleshooting

### Functions Deploy Fails
```bash
# Check logs
firebase functions:log

# Common issues:
# - Node version mismatch (use 20)
# - Missing dependencies (run npm install in functions/)
# - Secrets not set
# - Region mismatch
```

### Firestore Rules Deny Access
```bash
# Test rules in emulator
firebase emulators:start

# Use Rules Playground in Firebase Console
# Check rules syntax: firebase deploy --only firestore:rules --dry-run
```

### Hosting 404 on Refresh
- Ensure `rewrites` in firebase.json for SPA fallback
- For static export: all routes must be pre-rendered

### Storage CORS Issues
```bash
# Configure CORS for Storage bucket
cat > cors.json <<EOF
[
  {
    "origin": ["http://localhost:3000", "https://yourdomain.com"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set cors.json gs://your-bucket
```