import { useState, useMemo } from 'react'
import { useBookStore } from '../hooks/useStore'

/**
 * 学习进度页面 v0.4
 * 进度图表、打卡日历、口语评分趋势、学习报告导出
 */

function ProgressPage() {
  const currentBook = useBookStore(state => state.currentBook)
  const currentChapter = useBookStore(state => state.currentChapter)
  const currentParagraph = useBookStore(state => state.currentParagraph)
  const wordList = useBookStore(state => state.wordList)
  const knownWords = useBookStore(state => state.knownWords)
  const speechRecords = useBookStore(state => state.speechRecords)

  const totalChapters = currentBook?.chapters?.length || 0
  const totalParagraphs = currentBook?.chapters?.[currentChapter]?.paragraphs?.length || 0

  // 计算阅读进度
  const readProgress = totalChapters > 0
    ? Math.round(((currentChapter / totalChapters) + (totalParagraphs > 0 ? (currentParagraph / totalParagraphs) / totalChapters : 0)) * 100)
    : 0

  // ===== 近7天词汇增长 =====
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  })

  const vocabByDay = last7Days.map(date => {
    return wordList.filter(w => {
      const wDate = new Date(w.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
      return wDate === date
    }).length
  })
  const maxVocab = Math.max(...vocabByDay, 1)

  // ===== 近30天打卡日历 =====
  const last30Days = useMemo(() => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({
        date: d.toISOString().slice(0, 10),
        dayOfMonth: d.getDate(),
        dayOfWeek: d.getDay()
      })
    }
    return days
  }, [])

  // 判断某天是否有学习活动（有查词/有口语练习/有阅读进度变化）
  const getDayActivity = (dateStr) => {
    const dayStart = new Date(dateStr).setHours(0, 0, 0, 0)
    const dayEnd = dayStart + 24 * 60 * 60 * 1000

    const hasWord = wordList.some(w => w.date >= dayStart && w.date < dayEnd)
    const hasSpeech = speechRecords.some(r => r.date >= dayStart && r.date < dayEnd)

    if (hasWord && hasSpeech) return 'high'
    if (hasWord || hasSpeech) return 'medium'
    return 'none'
  }

  // ===== 口语评分趋势（最近10次） =====
  const recentScores = useMemo(() => {
    return speechRecords
      .slice(-10)
      .map((r, idx) => ({
        index: idx + 1,
        final: r.score?.final || 0,
        accuracy: r.score?.accuracy || 0
      }))
  }, [speechRecords])

  const maxScore = Math.max(...recentScores.map(s => s.final), 100)

  // ===== 学习报告导出 =====
  const handleExportReport = () => {
    const today = new Date().toLocaleDateString('zh-CN')
    const lines = [
      `📚 BookSpeak 学习报告`,
      `生成时间: ${today}`,
      ``,
      `═══ 阅读进度 ═══`,
      currentBook ? `书籍: ${currentBook.title}` : '暂无书籍',
      currentBook ? `进度: ${readProgress}% (第 ${currentChapter + 1}/${totalChapters} 章)` : '',
      ``,
      `═══ 词汇统计 ═══`,
      `生词本: ${wordList.length} 个`,
      `已掌握: ${knownWords.size} 个`,
      `待复习: ${wordList.filter(w => w.nextReview <= Date.now()).length} 个`,
      ``,
      `═══ 口语练习 ═══`,
      `练习次数: ${speechRecords.length} 次`,
      speechRecords.length > 0 ? `平均分: ${Math.round(speechRecords.reduce((s, r) => s + (r.score?.final || 0), 0) / speechRecords.length)} 分` : '',
      ``,
      `═══ 学习建议 ═══`,
    ]

    if (wordList.length === 0) lines.push('• 开始阅读并标记生词，积累词汇量')
    if (wordList.filter(w => w.nextReview <= Date.now()).length > 0) {
      lines.push(`• 有 ${wordList.filter(w => w.nextReview <= Date.now()).length} 个单词待复习`)
    }
    if (speechRecords.length === 0) lines.push('• 尝试口语练习，朗读段落提升发音')
    if (readProgress >= 50 && readProgress < 100) lines.push('• 已经读完一半了，继续加油！')
    if (readProgress >= 100) lines.push('• 🎉 恭喜读完一本书！')

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bookspeak_report_${today.replace(/\//g, '-')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="progress-page">
      <h2>📊 学习进度</h2>

      {!currentBook ? (
        <div className="empty-state">
          <p>请先导入一本书开始学习</p>
        </div>
      ) : (
        <>
          {/* 当前书籍进度 */}
          <div className="progress-section">
            <h3>📖 {currentBook.title}</h3>
            <div className="progress-card">
              <div className="progress-ring">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none" stroke="#4CAF50"
                    strokeWidth="8"
                    strokeDasharray={`${readProgress * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="progress-ring-text">
                  <span className="progress-percent">{readProgress}%</span>
                </div>
              </div>
              <div className="progress-details">
                <p>第 {currentChapter + 1} / {totalChapters} 章</p>
                <p>段落 {currentParagraph + 1} / {totalParagraphs}</p>
                <p>总词汇 {currentBook.totalWords?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{wordList.length}</div>
              <div className="stat-label">生词本</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{knownWords.size}</div>
              <div className="stat-label">已掌握</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{speechRecords.length}</div>
              <div className="stat-label">口语练习</div>
            </div>
          </div>

          {/* 学习报告导出 */}
          <div className="progress-section">
            <div className="report-header">
              <h3>📋 学习报告</h3>
              <button className="btn-primary" onClick={handleExportReport}>导出报告</button>
            </div>
            <div className="report-preview">
              <div className="report-item">
                <span className="report-label">阅读进度</span>
                <span className="report-value">{readProgress}%</span>
              </div>
              <div className="report-item">
                <span className="report-label">词汇积累</span>
                <span className="report-value">{wordList.length} 个生词</span>
              </div>
              <div className="report-item">
                <span className="report-label">口语练习</span>
                <span className="report-value">{speechRecords.length} 次</span>
              </div>
              {speechRecords.length > 0 && (
                <div className="report-item">
                  <span className="report-label">口语均分</span>
                  <span className="report-value">
                    {Math.round(speechRecords.reduce((s, r) => s + (r.score?.final || 0), 0) / speechRecords.length)} 分
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 近30天打卡日历 */}
          <div className="progress-section">
            <h3>🔥 近30天打卡</h3>
            <div className="calendar-grid">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="calendar-weekday">{d}</div>
              ))}
              {/* 填充空白，让第一天对齐正确的星期 */}
              {Array.from({ length: last30Days[0]?.dayOfWeek || 0 }, (_, i) => (
                <div key={`empty-${i}`} className="calendar-day empty" />
              ))}
              {last30Days.map(day => {
                const activity = getDayActivity(day.date)
                return (
                  <div
                    key={day.date}
                    className={`calendar-day ${activity}`}
                    title={day.date}
                  >
                    {day.dayOfMonth}
                  </div>
                )
              })}
            </div>
            <div className="calendar-legend">
              <span><span className="dot none" /> 未学习</span>
              <span><span className="dot medium" /> 轻度</span>
              <span><span className="dot high" /> 高强度</span>
            </div>
          </div>

          {/* 词汇增长柱状图 */}
          <div className="progress-section">
            <h3>📈 近7天词汇增长</h3>
            <div className="bar-chart">
              {last7Days.map((date, i) => (
                <div key={date} className="bar-item">
                  <div className="bar-wrapper">
                    <div
                      className="bar"
                      style={{ height: `${(vocabByDay[i] / maxVocab) * 100}%` }}
                      title={`${vocabByDay[i]} 个`}
                    />
                  </div>
                  <div className="bar-label">{date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 口语评分趋势 */}
          {recentScores.length > 0 && (
            <div className="progress-section">
              <h3>🎤 口语评分趋势（最近 {recentScores.length} 次）</h3>
              <div className="line-chart">
                <div className="line-chart-bars">
                  {recentScores.map((s, i) => (
                    <div key={i} className="line-chart-item">
                      <div className="line-chart-bar-wrapper">
                        <div
                          className="line-chart-bar"
                          style={{ height: `${(s.final / maxScore) * 100}%` }}
                          title={`综合 ${s.final} 分`}
                        />
                      </div>
                      <div className="line-chart-label">{s.index}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 学习建议 */}
          <div className="progress-section">
            <h3>💡 学习建议</h3>
            <div className="tips-list">
              {wordList.length === 0 && <p>• 开始阅读并标记生词，积累词汇量</p>}
              {wordList.filter(w => w.nextReview <= Date.now()).length > 0 && (
                <p>• 你有 {wordList.filter(w => w.nextReview <= Date.now()).length} 个单词待复习，去生词本复习吧</p>
              )}
              {speechRecords.length === 0 && <p>• 尝试口语练习，朗读段落提升发音</p>}
              {readProgress >= 50 && readProgress < 100 && <p>• 已经读完一半了，继续加油！</p>}
              {readProgress >= 100 && <p>• 🎉 恭喜读完一本书！</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ProgressPage
