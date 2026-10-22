import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getLocalUserId, LOCAL_AUTH_COOKIE } from '@/lib/local-auth'

export const runtime = 'nodejs'

const PUBLIC_API_ROUTES = [
  '/api/auth/',
  '/api/health',
]

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://integrate.api.nvidia.com https://api.anthropic.com https://api.mistral.ai https://api.groq.com https://openrouter.ai https://api.together.xyz wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return response
}

function cloneRequestUrl(nextUrl: NextRequest['nextUrl'] | URL): URL {
  if (typeof (nextUrl as NextRequest['nextUrl']).clone === 'function') {
    return (nextUrl as NextRequest['nextUrl']).clone()
  }
  return new URL(nextUrl.toString())
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  
  const sessionCookie = request.cookies.get(LOCAL_AUTH_COOKIE)?.value
  const userId = getLocalUserId(sessionCookie)
  const isAuthenticated = !!userId

  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/")

  const isPublicPage =
    pathname === '/' ||
    pathname.startsWith('/roadmap') ||
    isAuthPage
  const isApiRoute = pathname.startsWith("/api/")

  if (!isApiRoute && !isPublicPage && !isAuthenticated) {
    const url = cloneRequestUrl(request.nextUrl)
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return addSecurityHeaders(NextResponse.redirect(url))
  }

  if (isAuthPage && isAuthenticated) {
    const url = cloneRequestUrl(request.nextUrl)
    url.pathname = "/dashboard"
    return addSecurityHeaders(NextResponse.redirect(url))
  }

  if (isApiRoute && !isPublicApiRoute(pathname) && !isAuthenticated) {
    return addSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
