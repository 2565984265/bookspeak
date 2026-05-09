import { useState, useCallback } from 'react'
import { useBookStore } from '../hooks/useStore'

/**
 * 查词 Hook（后端代理版）
 * 通过 BookSpeak 后端统一调用词典 API + 腾讯云翻译
 * 避免浏览器 CORS 限制
 */

const CACHE_KEY = 'bookspeak_word_cache_v2'

function getCache() {
  try {
    const data = localStorage.getItem(CACHE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function setCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

export function useWordLookup() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const settings = useBookStore(state => state.settings)
  const backendUrl = settings?.ttsBackendUrl ?? ''

  /**
   * 查询单词释义（英文释义 + 中文翻译）
   * @param {string} word
   * @returns {Promise<object|null>}
   */
  const lookup = useCallback(async (word) => {
    if (!word || !word.trim()) return null

    const cleanWord = word.toLowerCase().trim()

    // 1. 查本地缓存
    const cache = getCache()
    if (cache[cleanWord]) {
      return cache[cleanWord]
    }

    setIsLoading(true)
    setError(null)

    try {
      // 2. 调用后端 /dict 接口（统一查词典 + 翻译）
      const response = await fetch(
        `${backendUrl}/dict?word=${encodeURIComponent(cleanWord)}`
      )

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || '查词失败')
      }

      const result = await response.json()

      // 存入缓存
      cache[cleanWord] = result
      setCache(cache)

      return result
    } catch (err) {
      setError(err.message)
      return {
        word: cleanWord,
        phonetic: '',
        audio: '',
        meanings: [],
        chineseTranslation: '',
        source: 'fallback'
      }
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  /**
   * 使用 OpenAI API 解释单词（备用）
   */
  const lookupWithAI = useCallback(async (word, apiKey) => {
    if (!apiKey) {
      setError('No API key configured')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an English teacher. Explain words simply in both English and Chinese. Return JSON with fields: word, phonetic, meanings (array of {partOfSpeech, definitions: [{definition, example}]}), simpleExplanation.'
            },
            {
              role: 'user',
              content: `Explain the word "${word}" in simple English, with Chinese translation and one example sentence. Return as JSON.`
            }
          ],
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error('AI lookup failed')
      }

      const data = await response.json()
      const result = JSON.parse(data.choices[0].message.content)
      return {
        ...result,
        source: 'openai'
      }
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    lookup,
    lookupWithAI,
    isLoading,
    error
  }
}
