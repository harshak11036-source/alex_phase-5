import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()

    const { id } = await params
    const [resources, subjectDocs] = await Promise.all([
      prisma.subjectResource.findMany({
        where: { subjectId: id, isPublished: true },
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.document?.findMany
        ? prisma.document.findMany({
            where: { subjectId: id },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { chunks: true } } },
          })
        : Promise.resolve([]),
    ])

    const resourcePaths = new Set(resources.map(r => r.storagePath).filter(Boolean))
    const mergedDocs = (subjectDocs || [])
      .filter(d => !resourcePaths.has(d.storagePath))
      .map(d => ({
        id: d.id,
        subjectId: id,
        title: d.title,
        description: d.description,
        category: 'DOCUMENT',
        fileName: d.fileName,
        storagePath: d.storagePath,
        fileSize: d.fileSize.toString(),
        mimeType: d.mimeType,
        documentType: d.documentType,
        status: d.status,
        pageCount: d.pageCount,
        chunksCount: d._count?.chunks ?? 0,
        version: 1,
        isPublished: true,
        uploadedBy: d.ownerId,
        createdAt: d.createdAt,
      }))

    const serialized = [
      ...resources.map(r => ({
        ...r,
        fileSize: r.fileSize.toString(),
      })),
      ...mergedDocs,
    ]

    return NextResponse.json({ resources: serializeBigInt(serialized) })
  } catch (error) {
    console.error('[Subjects] Subject resources list error:', error)
    return NextResponse.json({ error: 'Failed to list resources' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const body = await request.json()
    const { title, description, category, fileName, storagePath, fileSize, mimeType, isPublished = true } = body

    const resource = await prisma.subjectResource.create({
      data: {
        subjectId: id,
        title,
        description: description || null,
        category: category || 'LECTURE_NOTES',
        fileName: fileName || title,
        storagePath: storagePath || '',
        fileSize: BigInt(fileSize || 0),
        mimeType: mimeType || 'application/pdf',
        isPublished: Boolean(isPublished),
        publishedAt: isPublished ? new Date() : null,
        uploadedBy: user.id,
      },
    })

    return NextResponse.json({
      resource: serializeBigInt({
        ...resource,
        fileSize: resource.fileSize.toString(),
      }),
    })
  } catch (error) {
    console.error('[Subjects] Subject resource create error:', error)
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}