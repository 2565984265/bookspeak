import { useState, useRef, useCallback } from 'react'

/**
 * Web Speech API 封装
 * 提供朗读（TTS）和语音识别（STT）功能
 */

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  // 检查浏览器支持
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const isRecognitionSupported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  /**
   * 朗读文本
   */
  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text) return

    // 停止当前朗读
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = options.lang || 'en-US'
    utterance.rate = options.rate || 0.9
    utterance.pitch = options.pitch || 1
    utterance.volume = options.volume || 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  /**
   * 停止朗读
   */
  const stopSpeaking = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [isSupported])

  /**
   * 开始语音识别
   */
  const startListening = useCallback((options = {}) => {
    if (!isRecognitionSupported) {
      console.warn('Speech recognition not supported in this browser')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = options.lang || 'en-US'
    recognition.continuous = options.continuous || false
    recognition.interimResults = options.interimResults || false

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
    }

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript
      setTranscript(result)
      if (options.onResult) {
        options.onResult(result)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      if (options.onError) {
        options.onError(event.error)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      if (options.onEnd) {
        options.onEnd()
      }
    }

    recognition.start()
  }, [isRecognitionSupported])

  /**
   * 停止语音识别
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  return {
    isSupported,
    isRecognitionSupported,
    isSpeaking,
    isListening,
    transcript,
    speak,
    stopSpeaking,
    startListening,
    stopListening
  }
}
