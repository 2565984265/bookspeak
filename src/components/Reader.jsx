import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useBookStore } from '../hooks/useStore'
import { useWordLookup } from '../hooks/useWordLookup'
import { useEdgeTTS } from '../hooks/useEdgeTTS'
import { resolveBackendUrl } from '../utils/backend'
import { idbStorage } from '../utils/indexedDB'
import WordTooltip from './WordTooltip'
import WordHighlightLegend from './WordHighlightLegend'
import BookmarkList from './BookmarkList'

/**
 * 阅读器核心组件
 * 分段显示原文，点击查词，高亮已知/未知词汇
 */

function Reader() {
  const currentBook = useBookStore(state => state.currentBook)
  const currentChapter = useBookStore(state => state.currentChapter)
  const currentParagraph = useBookStore(state => state.currentParagraph)
  const setProgress = useBookStore(state => state.setProgress)
  const loadBookFromIDB = useBookStore(state => state.loadBookFromIDB)
  const knownWords = useBookStore(state => state.knownWords)
  const unknownWords = useBookStore(state => state.unknownWords)
  const wordList = useBookStore(state => state.wordList)
  const bookmarks = useBookStore(state => state.bookmarks)
  const addBookmark = useBookStore(state => state.addBookmark)
  const removeBookmark = useBookStore(state => state.removeBookmark)
  const settings = useBookStore(state => state.settings)

  const { play: playAudio, isPlaying, stop: stopAudio } = useEdgeTTS()
  const { lookup } = useWordLookup()

  const [tooltipData, setTooltipData] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [playingParagraphId, setPlayingParagraphId] = useState(null)
  const [showHighlight, setShowHighlight] = useState(true)
  const [isLoadingBook, setIsLoadingBook] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showTranslation, setShowTranslation] = useState(() => localStorage.getItem('bookspeak_show_translation') === 'true')
  const [translations, setTranslations] = useState({})
  const [translatingIds, setTranslatingIds] = useState(new Set())
  const [visibleParagraphs, setVisibleParagraphs] = useState(new Set())

  // v0.4: localStorage 中 currentBook 只有元数据，需从 IndexedDB 加载完整数据
  useEffect(() => {
    if (currentBook?.id && !currentBook?.chapters?.length && !isLoadingBook) {
      setIsLoadingBook(true)
      loadBookFromIDB(currentBook.id).finally(() => {
        setIsLoadingBook(false)
      })
    }
  }, [currentBook?.id, currentBook?.chapters?.length, loadBookFromIDB, isLoadingBook])

  // 获取当前章节和段落
  const chapter = currentBook?.chapters?.[currentChapter]
  const paragraphs = chapter?.paragraphs || []
  const totalParagraphs = paragraphs.length
  const totalChapters = currentBook?.chapters?.length || 0
  const isLastChapter = currentChapter >= totalChapters - 1
  const isFirstChapter = currentChapter === 0

  // 滚动到目标段落的 ref
  const paragraphRefs = useRef({})

  // 组件挂载时滚动到保存位置（从其他页面跳转回来时触发）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (paragraphs.length > 0 && currentParagraph >= 0 && currentParagraph < paragraphs.length) {
        const targetEl = paragraphRefs.current[currentParagraph]
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
      }
    }, 100)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 章节切换时滚动到新章节的保存位置
  useEffect(() => {
    if (paragraphs.length > 0 && currentParagraph >= 0 && currentParagraph < paragraphs.length) {
      const targetEl = paragraphRefs.current[currentParagraph]
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [currentChapter])

  // 章节切换时清空可见段落集合
  useEffect(() => {
    setVisibleParagraphs(new Set())
  }, [currentChapter])

  // 从 IndexedDB 加载当前章节的翻译缓存
  useEffect(() => {
    if (!currentBook?.id || paragraphs.length === 0) return
    const load = async () => {
      try {
        const records = await idbStorage.getTranslationsByChapter(currentBook.id, currentChapter)
        const map = {}
        records.forEach(r => {
          map[`${currentBook.id}_${currentChapter}_${r.paragraphIndex}`] = r.translation
        })
        setTranslations(map)
      } catch (err) {
        console.error('加载翻译缓存失败:', err)
      }
    }
    load()
  }, [currentBook?.id, currentChapter, paragraphs.length])

  // Intersection Observer：滚动时自动保存进度 + 检测可见段落（用于按需翻译）
  useEffect(() => {
    if (!paragraphs.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        // 保存进度：找到最靠近视口顶部的可见段落
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]

        if (visible) {
          const idx = parseInt(visible.target.dataset.paragraphIndex, 10)
          if (!isNaN(idx)) {
            setProgress(currentChapter, idx)
          }
        }

        // 更新可见段落集合（用于按需翻译）
        setVisibleParagraphs(prev => {
          const next = new Set(prev)
          entries.forEach(e => {
            const idx = parseInt(e.target.dataset.paragraphIndex, 10)
            if (isNaN(idx)) return
            if (e.isIntersecting) next.add(idx)
            else next.delete(idx)
          })
          return next
        })
      },
      { threshold: 0.1, rootMargin: '200px 0px 200px 0px' }
    )

    Object.values(paragraphRefs.current).forEach(el => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [paragraphs, currentChapter, setProgress])

  // 翻译开关变化时，调整外层 .reader-page 宽度（兼容不支持 :has() 的浏览器）
  useEffect(() => {
    const pageEl = document.querySelector('.reader-page')
    if (pageEl) {
      pageEl.classList.toggle('translation-open', showTranslation)
    }
  }, [showTranslation])

  // 按需翻译：只有段落进入视口（或即将进入）时才翻译
  const backendBase = resolveBackendUrl(settings?.ttsBackendUrl)
  const translatingIdsRef = useRef(translatingIds)
  translatingIdsRef.current = translatingIds

  useEffect(() => {
    if (!showTranslation || visibleParagraphs.size === 0 || !currentBook?.id || !paragraphs.length) return

    const timer = setTimeout(async () => {
      // 获取已缓存的段落索引
      let cachedIndices = new Set()
      try {
        const records = await idbStorage.getTranslationsByChapter(currentBook.id, currentChapter)
        cachedIndices = new Set(records.map(r => r.paragraphIndex))
      } catch (err) {
        console.error('读取翻译缓存失败:', err)
      }

      // 收集需要翻译的段落：可见段 + 前后各2段（预加载）
      const toTranslate = new Set()
      visibleParagraphs.forEach(idx => {
        for (let i = Math.max(0, idx - 2); i <= Math.min(paragraphs.length - 1, idx + 2); i++) {
          if (!cachedIndices.has(i) && !translatingIdsRef.current.has(i)) {
            toTranslate.add(i)
          }
        }
      })

      if (toTranslate.size === 0) return

      const indices = Array.from(toTranslate).sort((a, b) => a - b)
      const texts = indices.map(idx => paragraphs[idx].text.trim())

      // 标记正在翻译
      setTranslatingIds(prev => {
        const next = new Set(prev)
        indices.forEach(i => next.add(i))
        return next
      })

      try {
        const response = await fetch(`${backendBase}/translate/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts, source: 'auto', target: 'zh-CN' })
        })
        if (!response.ok) throw new Error('批量翻译失败')
        const data = await response.json()

        const newTranslations = {}
        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i]
          const translated = data.results[i]?.translation || ''
          const key = `${currentBook.id}_${currentChapter}_${idx}`
          newTranslations[key] = translated

          // 异步保存到 IndexedDB（不阻塞渲染）
          idbStorage.saveTranslation({
            bookId: currentBook.id,
            chapterIndex: currentChapter,
            paragraphIndex: idx,
            originalText: paragraphs[idx].text,
            translation: translated
          }).catch(err => console.error('保存翻译缓存失败:', err))
        }
        setTranslations(prev => ({ ...prev, ...newTranslations }))
      } catch (err) {
        console.error('批量翻译失败:', err)
      } finally {
        setTranslatingIds(prev => {
          const next = new Set(prev)
          indices.forEach(i => next.delete(i))
          return next
        })
      }
    }, 300) // 防抖 300ms，避免滚动时频繁触发

    return () => clearTimeout(timer)
  }, [visibleParagraphs, showTranslation, currentBook?.id, currentChapter, paragraphs.length, backendBase])

  // 进度百分比（全书进度）
  const progressPercent = useMemo(() => {
    if (!totalChapters) return 0
    const chapterProgress = currentChapter / totalChapters
    const paragraphProgress = totalParagraphs > 0 ? currentParagraph / totalParagraphs / totalChapters : 0
    return Math.round((chapterProgress + paragraphProgress) * 100)
  }, [currentChapter, currentParagraph, totalChapters, totalParagraphs])

  // 处理点击单词
  const handleWordClick = useCallback(async (e, word, contextText) => {
    e.stopPropagation()
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '')
    if (!cleanWord || cleanWord.length < 2) return

    setTooltipPosition({ x: e.clientX, y: e.clientY })

    const result = await lookup(cleanWord)
    if (result) {
      setTooltipData({ ...result, contextText })
    }
  }, [lookup])

  // 关闭弹窗
  const closeTooltip = useCallback(() => {
    setTooltipData(null)
  }, [])

  // 渲染带点击的单词文本
  const renderParagraph = useCallback((text) => {
    // 将文本按单词分割，保留标点
    const tokens = text.split(/(\s+|[.,;!?"'()[\]{}])/)
    return tokens.map((token, idx) => {
      const isWord = /^[a-zA-Z]+$/.test(token)
      if (!isWord) {
        return <span key={idx}>{token}</span>
      }

      const lowerWord = token.toLowerCase()
      let wordClass = ''
      if (showHighlight) {
        if (wordList.some(w => w.word === lowerWord)) {
          wordClass = 'word-highlight vocab'
        } else if (unknownWords.has(lowerWord)) {
          wordClass = 'word-highlight unknown'
        } else if (knownWords.has(lowerWord)) {
          wordClass = 'word-highlight known'
        }
      }

      return (
        <span
          key={idx}
          className={`reader-word ${wordClass}`}
          onClick={(e) => handleWordClick(e, token, text)}
        >
          {token}
        </span>
      )
    })
  }, [knownWords, unknownWords, wordList, handleWordClick])

  // 播放段落朗读（Edge TTS）
  const handleSpeakParagraph = (paragraph) => {
    if (playingParagraphId === paragraph.id) {
      stopAudio()
      setPlayingParagraphId(null)
    } else {
      setPlayingParagraphId(paragraph.id)
      playAudio(paragraph.text)
    }
  }

  // 上一章
  const goPrevChapter = () => {
    if (currentChapter > 0) {
      const prevChapterIndex = currentChapter - 1
      const prevChapter = currentBook.chapters[prevChapterIndex]
      const targetParagraph = Math.max(0, (prevChapter.paragraphs?.length || 1) - 1)
      setProgress(prevChapterIndex, targetParagraph)
    }
  }

  // 下一章
  const goNextChapter = () => {
    if (!isLastChapter) {
      setProgress(currentChapter + 1, 0)
    }
  }

  if (!currentBook?.chapters?.length) {
    return (
      <div className="reader-empty">
        {isLoadingBook ? (
          <>
            <p>⏳ 正在加载书籍数据...</p>
            <p>从 IndexedDB 读取完整原文</p>
          </>
        ) : (
          <>
            <p>📖 还没有导入书籍</p>
            <p>请先上传一本 TXT 或 EPUB 格式的英文书籍</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="reader">
      {/* 顶部信息栏 */}
      <div className="reader-header">
        <div className="reader-header-top">
          <h3 className="reader-title">{currentBook.title}</h3>
          <div className="reader-header-actions">
            <button
              className={`translation-toggle ${showTranslation ? 'active' : ''}`}
              onClick={() => {
                const next = !showTranslation
                setShowTranslation(next)
                localStorage.setItem('bookspeak_show_translation', String(next))
              }}
              title={showTranslation ? '关闭翻译' : '中英对照'}
            >
              {showTranslation ? '🔤 原文' : '🌐 翻译'}
            </button>
            <button
              className="bookmark-list-btn"
              onClick={() => setShowBookmarks(true)}
              title="书签列表"
            >
              🔖 书签
            </button>
          </div>
        </div>
        <div className="reader-meta">
          <span>{chapter?.title || ''}</span>
          <span className="reader-progress">
            进度: {progressPercent}% · 段落 {currentParagraph + 1} / {totalParagraphs}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <WordHighlightLegend
          showHighlight={showHighlight}
          onToggle={() => setShowHighlight(v => !v)}
        />
      </div>

      {/* 段落内容 - 滚动模式，显示全部段落 */}
      <div className={`reader-content ${showTranslation ? 'translation-open' : ''}`}>
        {paragraphs.map((paragraph, idx) => {
          const isThisPlaying = playingParagraphId === paragraph.id && isPlaying
          const existingBookmark = bookmarks.find(
            b => b.bookId === currentBook.id && b.chapter === currentChapter && b.paragraph === idx
          )
          const previewText = paragraph.text?.slice(0, 80) + (paragraph.text?.length > 80 ? '...' : '')
          const transKey = `${currentBook.id}_${currentChapter}_${idx}`
          const translatedText = translations[transKey]
          const isTranslating = translatingIds.has(idx)

          const handleToggleBookmark = () => {
            if (existingBookmark) {
              removeBookmark(existingBookmark.id)
            } else {
              addBookmark({
                bookId: currentBook.id,
                chapter: currentChapter,
                paragraph: idx,
                preview: previewText
              })
            }
          }

          return (
            <div
              key={paragraph.id}
              ref={el => { paragraphRefs.current[idx] = el }}
              className={`reader-paragraph ${existingBookmark ? 'has-bookmark' : ''} ${showTranslation ? 'with-translation' : ''}`}
              data-paragraph-index={idx}
            >
              <div className="paragraph-main">
                <div className="paragraph-actions">
                  <button
                    className={`para-speak-btn ${isThisPlaying ? 'speaking' : ''}`}
                    onClick={() => handleSpeakParagraph(paragraph)}
                    title={isThisPlaying ? '停止播放' : '朗读本段'}
                  >
                    {isThisPlaying ? '⏹️' : '▶️'}
                  </button>
                  <button
                    className={`bookmark-btn ${existingBookmark ? 'active' : ''}`}
                    onClick={handleToggleBookmark}
                    title={existingBookmark ? '移除书签' : '添加书签'}
                  >
                    {existingBookmark ? '🔖' : '📑'}
                  </button>
                </div>
                <p className="paragraph-text">
                  {renderParagraph(paragraph.text)}
                </p>
              </div>
              {showTranslation && (
                <div className="paragraph-translation">
                  {translatedText ? (
                    translatedText
                  ) : isTranslating ? (
                    <span className="translation-loading">⏳ 翻译中...</span>
                  ) : (
                    <span className="translation-placeholder">—</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 章节导航 */}
      <div className="reader-nav">
        <button
          className="nav-btn"
          onClick={goPrevChapter}
          disabled={isFirstChapter}
        >
          ← 上一章
        </button>
        <button
          className="nav-btn primary"
          onClick={goNextChapter}
          disabled={isLastChapter}
        >
          {isLastChapter ? '已读完' : '下一章 →'}
        </button>
      </div>

      {/* 查词弹窗 */}
      {tooltipData && (
        <WordTooltip
          wordData={tooltipData}
          position={tooltipPosition}
          onClose={closeTooltip}
          contextText={tooltipData.contextText}
        />
      )}

      {/* 书签列表弹窗 */}
      {showBookmarks && (
        <BookmarkList
          bookId={currentBook.id}
          onClose={() => setShowBookmarks(false)}
          onJump={(chapter, paragraph) => setProgress(chapter, paragraph)}
        />
      )}
    </div>
  )
}

export default Reader
