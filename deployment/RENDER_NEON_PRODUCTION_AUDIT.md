# Alex — Render + Neon production audit notes

This file is a source-code audit checklist, not evidence that the live Render or Neon services have been accessed.

## Deployment assumptions

- The root `Dockerfile` builds the Next.js standalone application. Render should deploy the repository root as the Docker build context.
- Neon PostgreSQL is configured with `DATABASE_URL` in Render. Use the Neon connection string appropriate for the application's Prisma runtime; retain SSL parameters supplied by Neon.
- No Render service configuration or `.git` directory was present in the uploaded ZIP, so live disk mounts, environment values, service health, and repository tracking could not be inspected.
- Cloudflare is not required by the active Next.js storage adapter. The repo contains a `cloudflare-worker/` directory, but this audit does not make it part of the Render deployment.

## Required Render environment variables

| Variable | Required? | Purpose | Secret/stability |
| --- | --- | --- | --- |
| `NODE_ENV` | Required for production behavior | Set to `production` | Non-secret; per environment |
| `NEXT_PUBLIC_APP_URL` | Required for canonical/public links | Public deployed URL, including `https://` | Public; update if domain changes |
| `NEXTAUTH_URL` | Configure to match the public app URL where used | Auth callback/canonical URL | Public; update if domain changes |
| `AUTH_MODE` | Use the mode supported by the current auth implementation; example uses `local` | Authentication behavior | Non-secret; coordinate with auth setup |
| `NEXT_PUBLIC_AUTH_MODE` | Match `AUTH_MODE` if client-side mode checks are used | Client auth-mode flag | Public; must match auth mode |
| `AUTH_SECRET` | Required for local HMAC sessions per current project docs/tests | Session signing | Secret; keep stable to preserve sessions |
| `DATABASE_URL` | Required | Neon PostgreSQL connection string | Secret; rotate only with coordinated DB changes |
| `ENCRYPTION_KEY` | Required in production after this audit fix | Encrypt/decrypt stored AI credentials and other encrypted tokens | Secret; **must remain stable**. To preserve existing ciphertext, set it to the exact value previously used by the encryption code: old `ENCRYPTION_KEY`, else old `AUTH_SECRET`, else old `NEXTAUTH_SECRET`. Do this before deploying the stricter check. |
| `AI_MODE` | Required if the default provider behavior is intended | AI service mode; source example uses `nemotron` | Non-secret; select a mode supported by code |
| Provider API key(s) | Required only for the corresponding live AI provider | NVIDIA, OpenAI, Gemini, Anthropic, Mistral, Groq, OpenRouter, Together, etc. | Secret; configure only providers actually used |
| `STORAGE_MODE` | Required for an intentional production storage choice | `local` or S3-compatible mode (`s3`, `r2`, `cloudflare-r2`) | Non-secret; do not change without a migration plan |
| `STORAGE_LOCAL_ROOT` | Required when using local storage in production | Storage directory; e.g. `/var/data/alex-storage` | Non-secret; must match Render Persistent Disk mount path |
| `S3_ENDPOINT` | Required only for S3-compatible storage | Provider endpoint | Usually not secret; provider-specific |
| `S3_ACCESS_KEY_ID` | Required only for S3-compatible storage | Object storage access | Secret |
| `S3_SECRET_ACCESS_KEY` | Required only for S3-compatible storage | Object storage secret | Secret |
| `S3_BUCKET` | Required only for S3-compatible storage | Physical bucket name; logical document buckets are prefixes | Non-secret; preserve existing bucket/object keys |
| `S3_REGION` / `AWS_REGION` | Optional depending on provider; code defaults region to `auto` | Object-storage signing/client region | Non-secret |
| `MAX_FILE_SIZE_MB` | Optional | Upload size limit | Non-secret |
| `ALLOWED_FILE_TYPES` | Optional | File extension allow-list | Non-secret |
| `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI` | Optional, only if Dropbox integration is used | User-owned Dropbox storage integration | App secret is secret; URL must match deployed callback |
| `OPENAI_BASE_URL`, `AI_BASE_URL`, provider-specific `*_BASE_URL` values | Optional | Custom API-compatible endpoints if used | Usually non-secret; must be trusted endpoints |

Do not set `STORAGE_MODE=local` on an ephemeral Render filesystem and expect uploaded files to survive redeploys. If using local storage, attach a Render Persistent Disk to the web service and mount it at the exact path configured in `STORAGE_LOCAL_ROOT`. Confirm the service plan supports disks and understand disk/instance scaling limitations. If there is no persistent disk, use a configured S3-compatible provider only after a data-preserving migration plan.

## Important pre-deploy checks

1. Set `ENCRYPTION_KEY` to the previous effective encryption password before deploying the stricter production validation. Otherwise existing API keys and encrypted integration tokens may become undecryptable.
2. Back up Neon before schema changes. The Docker startup no longer passes Prisma's `--accept-data-loss`; schema synchronization should fail rather than automatically accept a destructive change. Reviewed, committed Prisma migrations are preferable for production; this archive contains no `apps/web/prisma/migrations` directory.
3. Keep `.env` files, real secrets, and private uploads out of Git. Commit reviewed Prisma migration files; the `.gitignore` no longer ignores migration directories.
4. Check Render logs after deploy for missing configuration and migration errors. Do not share secret values in logs or chat.
5. This project still has `typescript.ignoreBuildErrors: true` in `apps/web/next.config.ts`. A clean build under this setting does not establish TypeScript correctness. This was not removed because dependencies could not be installed in the audit environment, so the underlying TypeScript stack overflow cannot be reproduced or safely fixed here.

## What remains unverified

The uploaded archive did not include a `.git` directory, installed dependencies, live Render access, Neon credentials, object-storage credentials, or browser permissions. Consequently this audit cannot verify Git tracking history, a real Neon connection, live provider calls, microphone permissions, live uploads/downloads, or restart durability. Do not mark the deployment production-ready until those checks pass in the actual environment.
