import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLocalStorageRoot } from '@/lib/storage/client'
import { canAccessDocument } from '@/lib/document-processing/access'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await requireAuth()

    const segments = await params
    const [bucket, ...fileParts] = (segments.path || []).map(s => decodeURIComponent(s))
    if (!bucket || fileParts.length === 0) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    const filePath = fileParts.join('/')

    const document = await prisma.document.findFirst({
      where: {
        storageBucket: bucket,
        OR: [
          { storagePath: filePath },
          { storagePath: `${bucket}/${filePath}` },
        ],
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, document)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const root = getLocalStorageRoot()
    const bucketRoot = path.resolve(root, bucket)
    const target = path.resolve(bucketRoot, filePath)

    if (!target.startsWith(bucketRoot + path.sep)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fileBuffer = await readFile(target)
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${document.fileName.replace(/"/g, '')}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}