# ALEX Security Practices

## Security Overview

ALEX implements defense-in-depth security across all layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                            │
├─────────────────────────────────────────────────────────────┤
│  Network          │  WAF, DDoS protection (Firebase)        │
│  Transport        │  TLS 1.3 everywhere (Firebase)          │
│  Application      │  AuthZ/AuthN, Input validation, CSP     │
│  Data             │  Encryption at rest, field-level encrypt│
│  Infrastructure   │  IAM least privilege, secret management │
└─────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization

### User Authentication

- **Primary**: Supabase Auth (email/password, OAuth providers)
- **Integration**: Custom Firebase tokens for Firestore/Functions access
- **Session**: JWT tokens with automatic refresh
- **MFA**: Supported via Supabase (TOTP, SMS)

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| `STUDENT` | Own data, enrolled subjects, own projects |
| `LECTURER` | Assigned subjects, all students in subjects, create assessments/assignments |
| `PROJECT_MENTOR` | Mentored projects, project data |
| `ADMIN` | Full system access, user management, institution config |

### Resource-Level Authorization

Implemented at multiple layers:

1. **Firestore Rules**: Database-level enforcement
2. **Function Checks**: Server-side validation in each callable
3. **Frontend Guards**: UI-level route protection (not trusted)

```typescript
// Example: Function authorization check
export const someFunction = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  const userData = userDoc.data();
  
  if (userData.role !== 'LECTURER' && userData.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Lecturer access required');
  }
  
  // Proceed with operation
});
```

## Data Protection

### Encryption

| Data Type | At Rest | In Transit | Notes |
|-----------|---------|------------|-------|
| User PII | AES-256 (Firestore) | TLS 1.3 | Email, names, IDs |
| AI API Keys | AES-256 (Application) | TLS 1.3 | Encrypted before DB storage |
| Passwords | bcrypt (Supabase) | TLS 1.3 | Never stored in plaintext |
| File Contents | AES-256 (Storage) | TLS 1.3 | Firebase Storage default |
| Database | AES-256 (Cloud SQL) | TLS 1.3 | PostgreSQL encryption |

### AI Credential Encryption

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
```

### Field-Level Encryption

Sensitive fields encrypted before database storage:
- AI API keys (`aiCredentials.encryptedKey`)
- OAuth tokens
- Personal identification numbers

## Input Validation & Sanitization

### Zod Schemas (Shared Package)

All API inputs validated with Zod schemas:

```typescript
// packages/validation-schemas/src/index.ts
export const documentInputSchema = z.object({
  title: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().regex(/^(application|image|text)\//),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB
  subjectId: z.string().cuid().optional(),
});
```

### File Upload Validation

```typescript
// Functions: document.ts
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Validate before processing
if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
  throw new HttpsError('invalid-argument', 'File type not allowed');
}
if (fileSize > MAX_FILE_SIZE) {
  throw new HttpsError('invalid-argument', 'File too large');
}
```

### XSS Prevention

- **Content Security Policy**: Configured in `next.config.ts` and Firebase Hosting headers
- **React Auto-escaping**: Default in JSX
- **Sanitization**: DOMPurify for user-generated HTML content
- **Trusted Types**: Enforced where supported

## Firestore Security Rules

Rules enforce authorization at database level. Key patterns:

```javascript
// Owner-only access
match /documents/{documentId} {
  allow read, write: if isOwner(resource.data.ownerId);
}

// Role-based access
match /assessments/{assessmentId} {
  allow read: if isLecturerOrAdmin(request.auth.uid) 
                || (resource.data.isPublished && isEnrolled(...));
  allow write: if isLecturerOrAdmin(request.auth.uid);
}

// Sub-collection inheritance
match /projects/{projectId} {
  allow read: if isProjectMember(request.auth.uid, projectId);
  
  match /tasks/{taskId} {
    allow read, write: if isProjectMember(request.auth.uid, projectId);
  }
}
```

### Rule Testing

```bash
# Test locally with emulator
firebase emulators:start

# Run rule tests
cd functions && npm test -- --testPathPattern="rules"
```

## API Security

### Rate Limiting

Implemented in Functions using in-memory store (per instance) + Firestore for persistence:

```typescript
// lib/rate-limiter.ts
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  userId: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const key = `ratelimit:${userId}`;
  const now = Date.now();
  const record = rateLimiter.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) return false;
  record.count++;
  return true;
}
```

### CORS Configuration

```typescript
// functions/index.ts
import { onCall } from 'firebase-functions/v2/https';

export const apiFunction = onCall(
  { cors: ['https://alex.example.com', 'http://localhost:3000'] },
  async (request) => { ... }
);
```

### Request Validation

All callable functions validate:
1. Authentication (`request.auth`)
2. Input schema (Zod)
3. Authorization (role/resource checks)
4. Rate limits

## Secret Management

### Firebase Secret Manager

All production secrets stored in Secret Manager:

```bash
# Set secrets
firebase functions:secrets:set NVIDIA_NEMOTRON_API_KEY
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set ENCRYPTION_KEY

# Access in function
const apiKey = process.env.NVIDIA_NEMOTRON_API_KEY;
```

### Secret Rotation

```bash
# Rotate secret
firebase functions:secrets:set NVIDIA_NEMOTRON_API_KEY

# Redeploy functions to pick up new value
firebase deploy --only functions
```

### Local Development

Use `.env` files (never committed):

```bash
# .env.local (gitignored)
NVIDIA_NEMOTRON_API_KEY=nvapi-dev-key
DATABASE_URL=postgresql://localhost:5432/alex_dev
```

## Infrastructure Security

### IAM Roles

| Principal | Roles | Resources |
|-----------|-------|-----------|
| GitHub Actions | `Firebase Hosting Admin`, `Cloud Functions Admin` | Deploy only |
| Developers | `Firebase Viewer`, `Logs Viewer` | Read-only |
| Service Account (Functions) | `Datastore User`, `Storage Object Admin` | Runtime only |

### Network Security

- **Firebase Hosting**: Automatic TLS, CDN, DDoS protection
- **Functions**: VPC connector for private database access (optional)
- **Database**: Private IP, authorized networks only
- **Storage**: Signed URLs for uploads/downloads

## Monitoring & Incident Response

### Security Logging

```typescript
// Audit logging for sensitive operations
await db.collection('auditLogs').add({
  userId: request.auth.uid,
  action: 'EXPORT_STUDENT_DATA',
  entityType: 'StudentRecord',
  entityId: studentId,
  ipAddress: request.rawRequest.ip,
  userAgent: request.rawRequest.headers['user-agent'],
  timestamp: FieldValue.serverTimestamp()
});
```

### Alerting Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| Auth Failures | > 10 failed logins/min | High |
| Permission Denied | > 50 denied calls/min | Medium |
| Function Errors | > 5% error rate | High |
| Data Export | Any bulk export | Critical |
| Secret Access | Unauthorized secret access | Critical |

### Incident Response

1. **Detect**: Monitoring alerts / user reports
2. **Contain**: Revoke tokens, disable functions, restrict IPs
3. **Investigate**: Audit logs, function logs, database logs
4. **Remediate**: Patch vulnerability, rotate secrets
5. **Recover**: Restore data, verify integrity
6. **Postmortem**: Document, improve defenses

## Compliance Considerations

### Data Residency

- Configure Firestore/Storage region for data sovereignty
- Use regional endpoints for Functions

### Privacy (GDPR/FERPA)

- **Right to Access**: User data export function
- **Right to Deletion**: Account deletion cascade
- **Data Minimization**: Collect only necessary data
- **Consent**: Explicit consent for guardian communications
- **Retention**: Automated cleanup of old notifications/logs

### Educational Records (FERPA)

- Student records: Restricted to student, guardians, authorized staff
- Directory information: Opt-out available
- Audit trail: All access logged

## Security Checklist for Deployment

- [ ] All secrets in Secret Manager (not config)
- [ ] Firestore rules deployed and tested
- [ ] Storage rules deployed and tested
- [ ] Functions CORS restricted to known domains
- [ ] Rate limiting enabled on all public endpoints
- [ ] App Check enabled for Firebase services
- [ ] reCAPTCHA Enterprise on Auth endpoints
- [ ] Custom domain with valid TLS
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Budget alerts for cost anomalies
- [ ] Audit logging enabled for sensitive operations
- [ ] Backup/recovery tested
- [ ] Penetration test scheduled (annually)

## Vulnerability Reporting

Report security issues to: `security@alex.example.com`

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

Response time: 48 hours for critical, 1 week for others.