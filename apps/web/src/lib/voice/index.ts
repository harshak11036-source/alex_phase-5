export interface VoiceProvider {
  name: string
  supportsSTT: boolean
  supportsTTS: boolean
  languages: string[]
}

export interface STTOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  onResult: (transcript: string, isFinal: boolean) => void
  onError: (error: string) => void
  onStart: () => void
  onEnd: () => void
}

export interface TTSOptions {
  text: string
  language?: string
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
  onStart: () => void
  onEnd: () => void
  onError: (error: string) => void
}

export class BrowserSpeechProvider implements VoiceProvider {
  name = 'browser'
  supportsSTT = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window
  languages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN']

  private recognition: any = null
  private utterance: SpeechSynthesisUtterance | null = null

  startListening(options: STTOptions): void {
    if (!this.supportsSTT) {
      options.onError('Speech recognition not supported in this browser')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = options.continuous ?? false
    this.recognition.interimResults = options.interimResults ?? true
    this.recognition.lang = options.language || 'en-US'

    this.recognition.onstart = () => options.onStart()
    this.recognition.onend = () => options.onEnd()

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('')
      
      options.onResult(transcript, event.results[0].isFinal)
    }

    this.recognition.onerror = (event: any) => {
      options.onError(event.error)
    }

    try {
      this.recognition.start()
    } catch (error) {
      options.onError('Failed to start speech recognition')
    }
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop()
      this.recognition = null
    }
  }

  speak(options: TTSOptions): void {
    if (!this.supportsTTS) {
      options.onError('Text-to-speech not supported in this browser')
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    this.utterance = new SpeechSynthesisUtterance(options.text)
    this.utterance.lang = options.language || 'en-US'
    this.utterance.rate = options.rate ?? 1
    this.utterance.pitch = options.pitch ?? 1
    this.utterance.volume = options.volume ?? 1

    // Try to find a matching voice
    if (options.voice) {
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.name === options.voice || v.lang.startsWith(options.language || 'en'))
      if (voice) this.utterance.voice = voice
    }

    this.utterance.onstart = () => options.onStart()
    this.utterance.onend = () => options.onEnd()
    this.utterance.onerror = (event) => options.onError(event.error)

    window.speechSynthesis.speak(this.utterance)
  }

  stopSpeaking(): void {
    window.speechSynthesis.cancel()
  }

  getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices()
  }
}

export class ElevenLabsProvider implements VoiceProvider {
  name = 'elevenlabs'
  supportsSTT = false
  supportsTTS = true
  languages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT', 'pl-PL', 'hi-IN', 'zh-CN']

  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async speak(options: TTSOptions): Promise<void> {
    options.onStart()

    try {
      const voiceId = options.voice || '21m00Tcm4TlvDq8ikWAM' // Default voice
      
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: options.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs error: ${response.statusText}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        options.onEnd()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        options.onError('Failed to play audio')
      }
      
      audio.play()
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'TTS failed')
    }
  }
}

export class OpenAITTSProvider implements VoiceProvider {
  name = 'openai-tts'
  supportsSTT = false
  supportsTTS = true
  languages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN']

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async speak(options: TTSOptions): Promise<void> {
    options.onStart()

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: options.text,
          voice: options.voice || 'alloy',
          response_format: 'mp3',
          speed: options.rate || 1,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI TTS error: ${response.statusText}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        options.onEnd()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        options.onError('Failed to play audio')
      }
      
      audio.play()
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'TTS failed')
    }
  }
}

export class GoogleSTTProvider implements VoiceProvider {
  name = 'google-stt'
  supportsSTT = true
  supportsTTS = false
  languages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN', 'hi-IN']

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async startListening(options: STTOptions): Promise<void> {
    options.onError('Google STT requires WebSocket connection - use browser speech recognition instead')
  }

  stopListening(): void {}
}

export function createVoiceProvider(
  type: 'browser' | 'elevenlabs' | 'openai-tts' | 'google-stt',
  apiKey?: string
): VoiceProvider {
  switch (type) {
    case 'browser':
      return new BrowserSpeechProvider()
    case 'elevenlabs':
      if (!apiKey) throw new Error('ElevenLabs API key required')
      return new ElevenLabsProvider(apiKey)
    case 'openai-tts':
      if (!apiKey) throw new Error('OpenAI API key required')
      return new OpenAITTSProvider(apiKey)
    case 'google-stt':
      if (!apiKey) throw new Error('Google Cloud API key required')
      return new GoogleSTTProvider(apiKey)
    default:
      throw new Error(`Unknown voice provider: ${type}`)
  }
}

export async function getUserVoiceConfig(userId: string): Promise<{
  sttProvider: "browser" | "elevenlabs" | "openai-tts" | "google-stt"
  ttsProvider: "browser" | "elevenlabs" | "openai-tts"
  hasSttCredential?: boolean
  hasTtsCredential?: boolean
  defaultVoice?: string
  defaultLanguage?: string
} | null> {
  const { prisma } = await import("@/lib/prisma")

  const voiceCreds = await prisma.aICredential.findFirst({
    where: {
      userId,
      provider: "OTHER",
      providerName: { in: ["elevenlabs", "openai-tts", "google-stt"] },
      isActive: true,
    },
  })

  if (!voiceCreds) {
    return {
      sttProvider: "browser",
      ttsProvider: "browser",
      hasSttCredential: false,
      hasTtsCredential: false,
      defaultLanguage: "en-US",
    }
  }

  return {
    sttProvider: voiceCreds.providerName === "google-stt" ? "google-stt" : "browser",
    ttsProvider:
      voiceCreds.providerName === "elevenlabs"
        ? "elevenlabs"
        : voiceCreds.providerName === "openai-tts"
          ? "openai-tts"
          : "browser",
    hasSttCredential: voiceCreds.providerName === "google-stt",
    hasTtsCredential: ["elevenlabs", "openai-tts"].includes(voiceCreds.providerName),
    defaultLanguage: "en-US",
  }
}
