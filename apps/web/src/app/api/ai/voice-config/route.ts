import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const voiceCreds = await prisma.aICredential.findFirst({
      where: {
        userId: user.id,
        provider: 'OTHER',
        providerName: { in: ['elevenlabs', 'openai-tts', 'google-stt'] },
        isActive: true,
      },
    })

    if (!voiceCreds) {
      return NextResponse.json({
        sttProvider: 'browser',
        ttsProvider: 'browser',
        hasSttCredential: false,
        hasTtsCredential: false,
        defaultLanguage: 'en-US',
      })
    }

    let sttProvider = 'browser'
    let ttsProvider = 'browser'

    if (voiceCreds.providerName === 'elevenlabs') {
      ttsProvider = 'elevenlabs'
    } else if (voiceCreds.providerName === 'openai-tts') {
      ttsProvider = 'openai-tts'
    } else if (voiceCreds.providerName === 'google-stt') {
      sttProvider = 'google-stt'
    }

    // Security: NEVER return decrypted sttApiKey or ttsApiKey to browser clients
    return NextResponse.json({
      sttProvider,
      ttsProvider,
      hasSttCredential: voiceCreds.providerName === 'google-stt',
      hasTtsCredential: ['elevenlabs', 'openai-tts'].includes(voiceCreds.providerName),
      defaultLanguage: 'en-US',
    })
  } catch (error) {
    console.error('[Voice Config] Error:', error)
    return NextResponse.json({ error: 'Failed to get voice config' }, { status: 500 })
  }
}
