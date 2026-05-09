import { useState, useCallback } from 'react'
import { useBookStore } from '../hooks/useStore'
import { useWordLookup } from '../hooks/useWordLookup'
import { useEdgeTTS } from '../hooks/useEdgeTTS'

/**
 * 查词弹窗组件
 * 支持连环查词：释义里的英文单词也能点击查词
 * 支持返回上一词、标记认识/不认识、Edge TTS 发音
 */

function WordTooltip({ wordData, position, onClose, contextText = '' }) {
  // 查词历史栈，支持连环查词
  const [history, setHistory] = useState([wordData])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const currentData = history[currentIndex] || {}
  const { word, phonetic, meanings, chineseTranslation } = currentData

  const settings = useBookStore(state => state.settings)
  const markWord = useBookStore(state => state.markWord)
  const addToWordList = useBookStore(state => state.addToWordList)
  const knownWords = useBookStore(state => state.knownWords)
  const unknownWords = useBookStore(state => state.unknownWords)
  const wordList = useBookStore(state => state.wordList)

  const { lookup } = useWordLookup()
  const { play: playAudio, isPlaying, stop: stopAudio } = useEdgeTTS()

  const isKnown = knownWords.has(word?.toLowerCase())
  const isUnknown = unknownWords.has(word?.toLowerCase())
  const isInWordList = wordList.some(w => w.word === word?.toLowerCase())

  // 在弹窗内查新词（释义里的单词点击）
  const handleLookupInTooltip = useCallback(async (newWord) => {
    const clean = newWord.toLowerCase().replace(/[^a-z]/g, '')
    if (!clean || clean.length < 2) return
    if (clean === word?.toLowerCase()) return // 点的是当前词，忽略

    setIsLookingUp(true)
    try {
      const result = await lookup(clean)
      if (result) {
        // 截断历史，只保留当前索引之前的，然后追加新词
        setHistory(prev => [...prev.slice(0, currentIndex + 1), result])
        setCurrentIndex(prev => prev + 1)
      }
    } finally {
      setIsLookingUp(false)
    }
  }, [lookup, settings, word, currentIndex])

  // 返回上一词
  const handleGoBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleMarkKnown = () => {
    markWord(word, 'known')
  }

  const handleMarkUnknown = () => {
    markWord(word, 'unknown')
  }

  const handleAddToWordList = () => {
    if (!isInWordList) {
      addToWordList({
        word: word.toLowerCase(),
        phonetic: phonetic || '',
        translation: chineseTranslation || meanings?.[0]?.definitions?.[0]?.definition || '',
        context: contextText
      })
    }
  }

  const handlePlayAudio = useCallback(() => {
    if (!word || isPlaying) return
    playAudio(word)
  }, [word, isPlaying, playAudio])

  const handleClose = () => {
    stopAudio()
    onClose()
  }

  /**
   * 把文本中的英文单词变成可点击的（用于释义和例句）
   */
  const renderClickableText = useCallback((text) => {
    if (!text) return null
    const tokens = text.split(/(\s+|[.,;!?"'()[\]{}])/)
    return tokens.map((token, idx) => {
      const isWord = /^[a-zA-Z]+$/.test(token)
      if (!isWord) return <span key={idx}>{token}</span>

      const lowerWord = token.toLowerCase()
      let wordClass = ''
      if (wordList.some(w => w.word === lowerWord)) {
        wordClass = 'tt-vocab'
      } else if (unknownWords.has(lowerWord)) {
        wordClass = 'tt-unknown'
      } else if (knownWords.has(lowerWord)) {
        wordClass = 'tt-known'
      }

      return (
        <span
          key={idx}
          className={`tt-word ${wordClass}`}
          onClick={() => handleLookupInTooltip(token)}
          title="点击查词"
        >
          {token}
        </span>
      )
    })
  }, [knownWords, unknownWords, wordList, handleLookupInTooltip])

  const style = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 340),
    top: position.y + 20,
    zIndex: 1000
  }

  if (!currentData.word) return null

  return (
    <>
      <div className="tooltip-overlay" onClick={handleClose} />
      <div className="word-tooltip" style={style}>
        {/* 顶部导航 */}
        <div className="tooltip-header">
          <div className="tooltip-nav">
            {currentIndex > 0 && (
              <button className="tt-back" onClick={handleGoBack} title="返回上一词">
                ← 返回
              </button>
            )}
            <span className="tt-breadcrumb">
              {currentIndex > 0 && `${history[0]?.word} → `}
              {currentIndex > 1 && `... → `}
            </span>
          </div>
          <h3 className="tooltip-word">{word}</h3>
          <button className="tooltip-close" onClick={handleClose}>×</button>
        </div>

        {isLookingUp && <div className="tt-loading">查询中...</div>}

        {phonetic && (
          <div className="tooltip-phonetic">
            {phonetic}
            <button
              className={`speak-btn ${isPlaying ? 'speaking' : ''}`}
              onClick={handlePlayAudio}
              title="播放发音"
            >
              {isPlaying ? '🔊' : '▶️'}
            </button>
          </div>
        )}

        {/* 中文翻译 */}
        {chineseTranslation && (
          <div className="tooltip-chinese">
            <span className="chinese-label">🈯 中译</span>
            <span className="chinese-text">{chineseTranslation}</span>
          </div>
        )}

        <div className="tooltip-meanings">
          {meanings?.length > 0 ? (
            meanings.map((m, idx) => (
              <div key={idx} className="meaning-item">
                <span className="part-of-speech">{m.partOfSpeech}</span>
                <ul>
                  {m.definitions?.slice(0, 2).map((d, dIdx) => (
                    <li key={dIdx}>
                      <span className="def-text">{renderClickableText(d.definition)}</span>
                      {d.definitionZh && (
                        <div className="def-zh">{d.definitionZh}</div>
                      )}
                      {d.example && (
                        <div className="example">"{renderClickableText(d.example)}"</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : chineseTranslation ? (
            <p className="no-definition">英文词典暂无释义，已提供中文翻译</p>
          ) : (
            <p className="no-definition">
              暂无释义
              <br />
              <small>建议配置腾讯云 SecretKey</small>
            </p>
          )}
        </div>

        {contextText && currentIndex === 0 && (
          <div className="tooltip-context">
            <small>上下文: "...{contextText.slice(0, 80)}..."</small>
          </div>
        )}

        <div className="tooltip-actions">
          <button
            className={`action-btn known ${isKnown ? 'active' : ''}`}
            onClick={handleMarkKnown}
          >
            ✓ 认识
          </button>
          <button
            className={`action-btn unknown ${isUnknown ? 'active' : ''}`}
            onClick={handleMarkUnknown}
          >
            ✗ 不认识
          </button>
          <button
            className={`action-btn add ${isInWordList ? 'active' : ''}`}
            onClick={handleAddToWordList}
            disabled={isInWordList}
          >
            {isInWordList ? '✓ 已收藏' : '⭐ 加入生词本'}
          </button>
        </div>
      </div>
    </>
  )
}

export default WordTooltip
