import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSignedUrl } from '@/lib/storage/client'
import { canAccessDocument } from '@/lib/document-processing/access'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, document)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const signedUrl = await getSignedUrl(document.storageBucket, document.storagePath, 3600)
    const redirectUrl =
      signedUrl.startsWith('http://') || signedUrl.startsWith('https://')
        ? signedUrl
        : new URL(signedUrl, request.url).toString()

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Download error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}