# Alex source audit — Render + Neon

## Scope and limitations

Audited the uploaded source archive, not the live Render service or Neon database. The archive has no `.git` directory and no installed dependencies. A full build, typecheck, lint run, live provider request, browser/microphone test, production storage persistence test, or database connection test could not be completed in this environment.

## Findings and changes

| Area | Finding | Change / status | Validation |
| --- | --- | --- | --- |
| API-key encryption | Production encryption fell back to `AUTH_SECRET` or `NEXTAUTH_SECRET` if `ENCRYPTION_KEY` was missing. | Production now requires `ENCRYPTION_KEY`; development retains a local fallback. Existing ciphertext compatibility requires setting the new variable to the exact previous effective key before deploy. | Added regression test; suite could not execute because `@babel/core` is not installed and package download failed. |
| Storage root | Example/deployment configuration uses `STORAGE_LOCAL_ROOT`, but storage client only read `LOCAL_STORAGE_ROOT`. | Client now accepts `STORAGE_LOCAL_ROOT` first, then legacy `LOCAL_STORAGE_ROOT`. | Static source check passed; test suite blocked by missing dependencies. |
| Render filesystem | Local storage is default; the archive cannot establish whether a Render Persistent Disk is attached. | Added Render + Neon deployment checklist. Do not rely on ephemeral local disk for durable files. | Live durability remains unverified. |
| Docker database startup | Startup ran `prisma db push --accept-data-loss`, which could permit destructive schema changes. | Removed `--accept-data-loss`; schema synchronization should fail instead of automatically accepting destructive changes. | Static check confirms destructive override is absent. Production database behavior untested. |
| Prisma migration tracking | `.gitignore` ignored Prisma migration directories. No migrations directory was included. | Removed migration ignore rules so reviewed migrations can be committed. | Static ignore-file review. Existing production schema history still needs a deliberate migration plan. |
| TypeScript/Prisma | `tsconfig.json` hardcoded `@prisma/client` to an internal pnpm store path, and Next config still has `typescript.ignoreBuildErrors: true`. | Removed the brittle internal-path alias. Did not remove error suppression without the ability to reproduce and fix the reported compiler stack overflow. | Typecheck/build not run; this remains a release blocker/limitation. |
| Voice | Voice assistant initialization unconditionally accessed `window.speechSynthesis`, potentially leaving unsupported browsers stuck on the loading screen. Avatar speech recognition could throw on `.start()` and displayed generic permission errors. | Made TTS initialization conditional, ensured the UI exits loading state on initialization errors, improved final-result selection, permission/network error messages, and guarded `recognition.start()`. | Source reviewed; no browser or microphone environment available. |
| Google speech-to-text | `GoogleSTTProvider` advertises support but its implementation always calls `onError` and says WebSocket integration is required. VoiceAssistant itself currently uses the browser provider. | Not represented as fixed: implementing real Google STT requires an audio-capture/upload/API design that is not present in the current interface. | Live STT remains unverified and the Google STT provider remains incomplete. |
| AI providers | Provider code and credentials routes exist; no provider secrets or external connectivity were available. | No claim of live provider success. | Not tested against live services. |
| Neon/database | Prisma uses `DATABASE_URL`; archive has no production URL or access to Neon. | Added environment checklist and cautions; no destructive database operations run. | Not connected/tested. |
| Pages/routes | Archive has 22 `page.tsx` routes and 78 API `route.ts` handlers. | Inventory is discoverable from `apps/web/src/app`; no authenticated browser testing possible. | Route behavior unverified. |
| Git integrity | ZIP does not include `.git`, so tracking status and actual working-tree diff cannot be inspected. | Fixed migration ignore rules; did not push or commit. | Must run Git checks in the actual repository. |

## Files changed

- `apps/web/src/lib/encryption.ts`
- `apps/web/src/lib/storage/client.ts`
- `apps/web/src/components/ai/VoiceAssistant.tsx`
- `apps/web/src/components/ai/Avatar.tsx`
- `apps/web/tests/infrastructure.test.cjs`
- `apps/web/tsconfig.json`
- `Dockerfile`
- `.gitignore`
- `deployment/environment/render-neon.example` (created; placeholders only)
- `deployment/RENDER_NEON_PRODUCTION_AUDIT.md` (created)

No files were deleted. No secrets were added. No Git push, production secret change, or production database operation was performed.

## Commands and results

- `node --check apps/web/tests/*.test.cjs`: passed for all six test files.
- JSON parsing of `package.json`, `apps/web/package.json`, and `apps/web/tsconfig.json`: passed.
- Static check that Docker startup no longer uses `db push --accept-data-loss`: passed.
- `npm test --workspace=apps/web`: blocked before tests ran because `@babel/core` is missing.
- `corepack pnpm --version`: failed because the environment could not reach `registry.npmjs.org` (`EAI_AGAIN`); dependencies could not be installed.
- Build, lint, typecheck, Prisma generation, integration tests, browser tests, and live provider/storage/database tests: not run.

## Release status

**Not ready for production sign-off.** The source-level fixes above are applied to this working copy, but dependency-based checks and all live-service/browser verification remain outstanding. In particular, resolve TypeScript build errors and remove `ignoreBuildErrors` only after a successful typecheck; verify a stable `ENCRYPTION_KEY`; verify persistent/object storage; and verify Neon schema changes with a backup and reviewed migration plan before deploying.
