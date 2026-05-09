import { useState } from 'react'
import { useBookStore } from '../hooks/useStore'
import { useEdgeTTS } from '../hooks/useEdgeTTS'

function VocabPage() {
  const wordList = useBookStore(state => state.wordList)
  const removeFromWordList = useBookStore(state => state.removeFromWordList)
  const updateWordReview = useBookStore(state => state.updateWordReview)

  const { play: playAudio, isPlaying } = useEdgeTTS()
  const [filter, setFilter] = useState('all') // all, due, mastered
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)

  const filteredWords = wordList.filter(w => {
    if (filter === 'due') return w.nextReview <= Date.now()
    if (filter === 'mastered') return w.reviewCount >= 2
    return true
  })

  // 导出 CSV
  const handleExportCSV = () => {
    const headers = ['Word', 'Phonetic', 'Translation', 'Context', 'Date']
    const rows = wordList.map(w => [
      w.word,
      w.phonetic || '',
      `"${w.translation || ''}"`,
      `"${w.context || ''}"`,
      new Date(w.date).toLocaleDateString()
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bookspeak_vocab.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // 导出 Anki 格式（制表符分隔）
  const handleExportAnki = () => {
    // Anki 导入格式：正面\t背面\t标签
    // 正面：单词 + 音标
    // 背面：中文释义 + 英文释义 + 上下文
    const lines = wordList.map(w => {
      const front = w.phonetic ? `${w.word} [${w.phonetic}]` : w.word
      const backParts = []
      if (w.translation) backParts.push(`🈯 ${w.translation}`)
      if (w.context) backParts.push(`📖 ${w.context}`)
      const back = backParts.join('<br>')
      return `${front}\t${back}\tBookSpeak`
    })
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bookspeak_anki.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const startReview = () => {
    if (filteredWords.length === 0) return
    setReviewMode(true)
    setReviewIndex(0)
    setShowAnswer(false)
  }

  /**
   * 复习结果处理
   * @param {string} result - 'correct' | 'vague' | 'wrong'
   */
  const handleReviewResult = (result) => {
    const word = filteredWords[reviewIndex]
    if (word) {
      const correct = result === 'correct'
      const vague = result === 'vague'
      updateWordReviewV2(word.word, correct, vague)
    }
    if (reviewIndex < filteredWords.length - 1) {
      setReviewIndex(reviewIndex + 1)
      setShowAnswer(false)
    } else {
      setReviewMode(false)
      setReviewIndex(0)
    }
  }

  /**
   * 改进版复习算法
   * correct: 间隔翻倍（1→3→7→14）
   * vague:   间隔不变（保持当前间隔）
   * wrong:   回到1天
   */
  const updateWordReviewV2 = (word, correct, vague) => {
    const list = wordList.map(w => {
      if (w.word !== word) return w
      const reviewCount = w.reviewCount + 1
      let nextReview
      if (correct) {
        const days = reviewCount === 1 ? 3 : reviewCount === 2 ? 7 : 14
        nextReview = Date.now() + days * 24 * 60 * 60 * 1000
      } else if (vague) {
        // 模糊：保持当前间隔的一半，至少1天
        const currentInterval = w.nextReview - (w.lastReviewed || w.date)
        const days = Math.max(1, Math.floor(currentInterval / (2 * 24 * 60 * 60 * 1000)))
        nextReview = Date.now() + days * 24 * 60 * 60 * 1000
      } else {
        nextReview = Date.now() + 24 * 60 * 60 * 1000
      }
      return { ...w, reviewCount, nextReview, lastReviewed: Date.now() }
    })
    useBookStore.getState().wordList = list
    // 持久化
    localStorage.setItem('bookspeak_word_list', JSON.stringify(list))
  }

  if (reviewMode && filteredWords.length > 0) {
    const current = filteredWords[reviewIndex]
    return (
      <div className="vocab-page">
        <h2>📝 复习模式</h2>
        <div className="review-progress">
          {reviewIndex + 1} / {filteredWords.length}
        </div>
        <div className="review-card">
          <div className="review-word">
            <h3>{current.word}</h3>
            <button
              className={`speak-btn ${isPlaying ? 'speaking' : ''}`}
              onClick={() => playAudio(current.word)}
              title="播放发音"
            >
              {isPlaying ? '🔊' : '▶️'}
            </button>
          </div>
          {current.phonetic && <p className="review-phonetic">{current.phonetic}</p>}

          {showAnswer ? (
            <>
              <div className="review-answer">
                <p><strong>🈯 释义：</strong>{current.translation}</p>
                {current.context && (
                  <p className="review-context">📖 上下文: {current.context}</p>
                )}
              </div>
              <div className="review-actions three">
                <button className="btn-correct" onClick={() => handleReviewResult('correct')}>
                  ✅ 记住了
                </button>
                <button className="btn-vague" onClick={() => handleReviewResult('vague')}>
                  🤔 模糊
                </button>
                <button className="btn-wrong" onClick={() => handleReviewResult('wrong')}>
                  ❌ 没记住
                </button>
              </div>
            </>
          ) : (
            <button className="btn-show" onClick={() => setShowAnswer(true)}>显示答案</button>
          )}
        </div>
        <button className="btn-secondary" onClick={() => setReviewMode(false)}>退出复习</button>
      </div>
    )
  }

  return (
    <div className="vocab-page">
      <h2>📝 生词本</h2>

      <div className="vocab-toolbar">
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            全部 ({wordList.length})
          </button>
          <button className={filter === 'due' ? 'active' : ''} onClick={() => setFilter('due')}>
            待复习 ({wordList.filter(w => w.nextReview <= Date.now()).length})
          </button>
          <button className={filter === 'mastered' ? 'active' : ''} onClick={() => setFilter('mastered')}>
            已掌握 ({wordList.filter(w => w.reviewCount >= 2).length})
          </button>
        </div>
        <div className="vocab-actions">
          <button className="btn-primary" onClick={startReview} disabled={filteredWords.length === 0}>
            开始复习
          </button>
          <button className="btn-secondary" onClick={handleExportCSV} disabled={wordList.length === 0}>
            导出 CSV
          </button>
          <button className="btn-secondary" onClick={handleExportAnki} disabled={wordList.length === 0}>
            导出 Anki
          </button>
        </div>
      </div>

      {filteredWords.length === 0 ? (
        <div className="empty-state">
          <p>暂无词汇</p>
          <p>在阅读时点击单词，加入生词本</p>
        </div>
      ) : (
        <div className="vocab-list">
          {filteredWords.map(word => (
            <div key={word.word} className="vocab-item">
              <div className="vocab-main">
                <span className="vocab-word">{word.word}</span>
                {word.phonetic && <span className="vocab-phonetic">{word.phonetic}</span>}
                <span className="vocab-translation">{word.translation}</span>
              </div>
              <div className="vocab-meta">
                <span className="review-badge">复习 {word.reviewCount} 次</span>
                {word.context && <span className="context-hint" title={word.context}>上下文</span>}
                <button className="icon-btn" onClick={() => playAudio(word.word)} title="朗读">▶️</button>
                <button className="icon-btn danger" onClick={() => removeFromWordList(word.word)} title="删除">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default VocabPage
