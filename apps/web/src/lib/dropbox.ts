import { decrypt, encrypt } from '@/lib/encryption'

const API = 'https://api.dropboxapi.com/2'
const CONTENT = 'https://content.dropboxapi.com/2'

function config() {
  const appKey = process.env.DROPBOX_APP_KEY
  const appSecret = process.env.DROPBOX_APP_SECRET
  if (!appKey || !appSecret) throw new Error('Dropbox integration is not configured')
  return { appKey, appSecret }
}

export function getDropboxAuthorizeUrl(state: string) {
  const { appKey } = config()
  const redirectUri = process.env.DROPBOX_REDIRECT_URI
  if (!redirectUri) throw new Error('DROPBOX_REDIRECT_URI is not configured')
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    token_access_type: 'offline',
    redirect_uri: redirectUri,
    state,
  })
  return `https://www.dropbox.com/oauth2/authorize?${params}`
}

export async function exchangeDropboxCode(code: string) {
  const { appKey, appSecret } = config()
  const redirectUri = process.env.DROPBOX_REDIRECT_URI
  const body = new URLSearchParams({ code, grant_type: 'authorization_code', client_id: appKey, client_secret: appSecret, redirect_uri: redirectUri || '' })
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) throw new Error('Dropbox authorization failed')
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
}

export async function refreshDropboxToken(refreshToken: string) {
  const { appKey, appSecret } = config()
  const body = new URLSearchParams({ refresh_token: refreshToken, grant_type: 'refresh_token', client_id: appKey, client_secret: appSecret })
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) throw new Error('Dropbox token refresh failed')
  return response.json() as Promise<{ access_token: string; expires_in?: number }>
}

export async function dropboxRpc<T>(token: string, endpoint: string, input: unknown): Promise<T> {
  const response = await fetch(`${API}/${endpoint}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(input) })
  if (!response.ok) throw new Error(`Dropbox request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export async function dropboxUpload(token: string, path: string, body: Buffer, contentType: string) {
  const response = await fetch(`${CONTENT}/files/upload`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }), 'content-length': String(body.length) }, body: body as unknown as BodyInit })
  if (!response.ok) throw new Error(`Dropbox upload failed: ${response.status}`)
  return response.json()
}

export async function getDropboxToken(encryptedAccessToken: string, encryptedRefreshToken?: string | null, expiresAt?: Date | null) {
  if (expiresAt && expiresAt.getTime() > Date.now() + 60_000) return { accessToken: await decrypt(encryptedAccessToken), refreshed: false }
  if (!encryptedRefreshToken) return { accessToken: await decrypt(encryptedAccessToken), refreshed: false }
  const refreshed = await refreshDropboxToken(await decrypt(encryptedRefreshToken))
  return { accessToken: refreshed.access_token, refreshed: true, expiresAt: new Date(Date.now() + (refreshed.expires_in || 14_400) * 1000), encryptedAccessToken: await encrypt(refreshed.access_token) }
}
