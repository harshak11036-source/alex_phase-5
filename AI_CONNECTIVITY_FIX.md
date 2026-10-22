# AI connectivity repair

## Change made
- RAG/document embedding configuration now follows the user's default `embeddings` model configuration when present, instead of always selecting whichever embedding-capable credential happens to be default.
- A specifically selected embedding provider is respected.
- Missing or undecryptable embedding credentials now produce actionable errors instead of silently falling back to fake/mock embeddings in production.
- Environment-variable keys remain a fallback when no saved user credential is selected.
- Mock embeddings remain available only for non-production development/test mode.

## Required configuration
1. In AI Settings, save an active API credential.
2. For document indexing and RAG retrieval, configure an embeddings model from a supported provider: OpenAI, Google Gemini, or Mistral. Chat generation may use a different provider.
3. Ensure `ENCRYPTION_KEY` in the deployed backend matches the key used to encrypt existing saved credentials. If it changed, restore the original value before re-saving keys.
4. Test both chat and document upload/RAG query after deployment. Existing documents indexed with mock embeddings may need reprocessing with the real embeddings provider.

## Security
API keys must remain server-side. Do not place provider secrets in `NEXT_PUBLIC_*` environment variables or return plaintext keys from API routes.
