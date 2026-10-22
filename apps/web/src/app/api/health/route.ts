import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
export async function GET() { try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: 'ok', database: 'ok', authMode: process.env.AUTH_MODE || 'local', aiMode: process.env.AI_MODE || 'mock' }) } catch { return NextResponse.json({ status: 'error', database: 'unavailable' }, { status: 503 }) } }
