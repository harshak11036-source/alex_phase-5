"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Mic, MicOff, Volume2, VolumeX, Settings, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { 
  BrowserSpeechProvider, 
  type STTOptions,
  type TTSOptions 
} from "@/lib/voice"

interface VoiceAssistantProps {
  onTranscript?: (text: string) => void
  onSpeakingChange?: (isSpeaking: boolean) => void
  className?: string
}

export function VoiceAssistant({
  onTranscript,
  onSpeakingChange,
  className,
}: VoiceAssistantProps) {
  const { toast } = useToast()
  const [sttProvider, setSttProvider] = React.useState<BrowserSpeechProvider | null>(null)
  const [ttsProvider, setTtsProvider] = React.useState<BrowserSpeechProvider | null>(null)
  const [isListening, setIsListening] = React.useState(false)
  const [isSpeaking, setIsSpeaking] = React.useState(false)
  const [isInitialized, setIsInitialized] = React.useState(false)
  const [sttLanguage, setSttLanguage] = React.useState<string>('en-US')
  const [ttsLanguage, setTtsLanguage] = React.useState<string>('en-US')
  const [ttsVoice, setTtsVoice] = React.useState<string>('')
  const [availableVoices, setAvailableVoices] = React.useState<SpeechSynthesisVoice[]>([])
  const [showSettings, setShowSettings] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  // Initialize voice providers
  React.useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true)
        
        // Initialize browser provider
        const browserStt = new BrowserSpeechProvider()
        setSttProvider(browserStt)
        
        const browserTts = new BrowserSpeechProvider()
        setTtsProvider(browserTts)
        
        // Load available voices
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices()
          if (voices.length > 0) {
            setAvailableVoices(voices)
            if (!ttsVoice && voices.length > 0) {
              setTtsVoice(voices[0].name)
            }
          }
        }
        
        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
        
        setIsInitialized(true)
      } catch (error) {
        console.error('Voice init error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    init()
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null
      sttProvider?.stopListening()
      ttsProvider?.stopSpeaking()
    }
  }, [])

  const startListening = () => {
    if (!sttProvider || isListening) return
    
    const options: STTOptions = {
      language: sttLanguage,
      continuous: false,
      interimResults: true,
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onResult: (transcript, isFinal) => {
        if (isFinal && onTranscript) {
          onTranscript(transcript)
        }
      },
      onError: (error) => {
        setIsListening(false)
        toast({ title: "Voice error", description: error, variant: "destructive" })
      },
    }
    
    sttProvider.startListening(options)
  }

  const stopListening = () => {
    sttProvider?.stopListening()
    setIsListening(false)
  }

  const speak = async (text: string) => {
    if (!ttsProvider || isSpeaking || !text.trim()) return
    
    const options: TTSOptions = {
      text,
      language: ttsLanguage,
      voice: ttsVoice || undefined,
      onStart: () => {
        setIsSpeaking(true)
        onSpeakingChange?.(true)
      },
      onEnd: () => {
        setIsSpeaking(false)
        onSpeakingChange?.(false)
      },
      onError: (error) => {
        setIsSpeaking(false)
        onSpeakingChange?.(false)
        toast({ title: "TTS error", description: error, variant: "destructive" })
      },
    }
    
    ttsProvider.speak(options)
  }

  const stopSpeaking = () => {
    ttsProvider?.stopSpeaking()
    setIsSpeaking(false)
    onSpeakingChange?.(false)
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      stopSpeaking()
    } else {
      speak(text)
    }
  }

  if (!isInitialized) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Initializing voice...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("space-y-4", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Voice Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Controls */}
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isListening ? "destructive" : "default"}
                  size="lg"
                  className="flex-1 flex items-center justify-center gap-2 h-14"
                  onClick={toggleListening}
                  disabled={isLoading || (!sttProvider?.supportsSTT && !isListening)}
                  aria-label={isListening ? "Stop listening" : "Start listening"}
                >
                  {isListening ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Listening...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5" />
                      <span>Push to Talk</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isListening ? "Click to stop listening" : "Click to start voice input"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isSpeaking ? "destructive" : "outline"}
                  size="lg"
                  className="flex items-center justify-center gap-2 h-14 px-6"
                  onClick={() => handleSpeak("This is a test of the voice assistant.")}
                  disabled={isLoading || !ttsProvider?.supportsTTS}
                  aria-label={isSpeaking ? "Stop speaking" : "Test voice output"}
                >
                  {isSpeaking ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Speaking...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-5 w-5" />
                      <span>Test TTS</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isSpeaking ? "Click to stop" : "Test text-to-speech"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className={cn("flex items-center gap-1", isListening && "text-green-500")}>
            <CheckCircle className={cn("h-4 w-4", isListening && "text-green-500")} />
            <span>STT: Browser {isListening ? "(active)" : "(ready)"}</span>
          </div>
          <div className={cn("flex items-center gap-1", isSpeaking && "text-blue-500")}>
            <CheckCircle className={cn("h-4 w-4", isSpeaking && "text-blue-500")} />
            <span>TTS: Browser {isSpeaking ? "(active)" : "(ready)"}</span>
          </div>
        </div>

        {/* Settings Panel */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
          {showSettings ? <X className="h-4 w-4" /> : <span>Show Settings</span>}
        </Button>

        {showSettings && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>STT Language</Label>
                <Select value={sttLanguage} onValueChange={setSttLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                    <SelectItem value="it-IT">Italian</SelectItem>
                    <SelectItem value="ja-JP">Japanese</SelectItem>
                    <SelectItem value="ko-KR">Korean</SelectItem>
                    <SelectItem value="zh-CN">Chinese</SelectItem>
                    <SelectItem value="hi-IN">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>TTS Language</Label>
                <Select value={ttsLanguage} onValueChange={setTtsLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                    <SelectItem value="it-IT">Italian</SelectItem>
                    <SelectItem value="ja-JP">Japanese</SelectItem>
                    <SelectItem value="ko-KR">Korean</SelectItem>
                    <SelectItem value="zh-CN">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>TTS Voice ({availableVoices.length} available)</Label>
                <Select value={ttsVoice} onValueChange={setTtsVoice}>
                  <SelectTrigger><SelectValue placeholder="Select voice (auto if empty)" /></SelectTrigger>
                  <SelectContent>
                    {availableVoices.map(voice => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleSpeak("Voice assistant is ready. How can I help you today?")}
                disabled={isLoading || !ttsProvider?.supportsTTS}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                Test Current Settings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}