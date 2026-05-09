import { useState, useRef, useCallback } from 'react'
import { useBookStore } from '../hooks/useStore'

/**
 * Edge TTS Hook（后端代理版）
 * 通过 BookSpeak Python 后端服务调用 edge-tts 库
 * 无需 API Key，后端 Docker 容器内运行
 */

const DEFAULT_VOICE = 'en-US-AriaNeural'

export function useEdgeTTS() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)
  const currentAudioRef = useRef(null)
  const abortRef = useRef(false)

  const settings = useBookStore(state => state.settings)
  const ttsBackendUrl = settings?.ttsBackendUrl ?? ''

  const stop = useCallback(() => {
    abortRef.current = true
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setIsPlaying(false)
    setError(null)
  }, [])

  /**
   * 调用后端 TTS API 合成并播放
   * @param {string} text
   * @param {object} options
   * @param {string} options.voice - 语音名称
   */
  const play = useCallback(async (text, options = {}) => {
    if (!text || !text.trim()) return

    stop()
    abortRef.current = false
    setError(null)
    setIsPlaying(true)

    try {
      const voice = options.voice || DEFAULT_VOICE

      const response = await fetch(`${ttsBackendUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: voice,
          rate: '+0%',
          pitch: '+0Hz',
          volume: '+0%'
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `TTS 服务错误: ${response.status}`)
      }

      const blob = await response.blob()
      if (blob.size === 0) {
        throw new Error('TTS 返回空音频')
      }

      const audioUrl = URL.createObjectURL(blob)

      if (abortRef.current) {
        URL.revokeObjectURL(audioUrl)
        return
      }

      const a = new Audio(audioUrl)
      currentAudioRef.current = a

      a.onended = () => {
        currentAudioRef.current = null
        URL.revokeObjectURL(audioUrl)
        if (!abortRef.current) setIsPlaying(false)
      }

      a.onerror = () => {
        currentAudioRef.current = null
        URL.revokeObjectURL(audioUrl)
        if (!abortRef.current) {
          setError('音频播放失败')
          setIsPlaying(false)
        }
      }

      await a.play()
    } catch (err) {
      if (!abortRef.current) {
        setError(err.message)
        setIsPlaying(false)
      }
    }
  }, [stop, ttsBackendUrl])

  return {
    isPlaying,
    error,
    play,
    stop
  }
}
