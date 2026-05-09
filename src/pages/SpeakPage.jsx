import { useState, useCallback } from 'react'
import { useBookStore } from '../hooks/useStore'
import { useSpeech } from '../hooks/useSpeech'
import { useEdgeTTS } from '../hooks/useEdgeTTS'

/**
 * 口语练习页面 v0.3
 * 朗读评估（录音+评分）+ AI 口语对话
 */

function SpeakPage() {
  const currentBook = useBookStore(state => state.currentBook)
  const currentChapter = useBookStore(state => state.currentChapter)
  const currentParagraph = useBookStore(state => state.currentParagraph)
  const settings = useBookStore(state => state.settings)
  const addSpeechRecord = useBookStore(state => state.addSpeechRecord)

  const { isListening, transcript, startListening, stopListening, isRecognitionSupported } = useSpeech()
  const { play: playTTS, isPlaying: isTTSPlaying } = useEdgeTTS()

  const [mode, setMode] = useState('read') // read, chat
  const [score, setScore] = useState(null)
  const [isScoring, setIsScoring] = useState(false)

  // AI 对话状态
  const [chatHistory, setChatHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const chapter = currentBook?.chapters?.[currentChapter]
  const paragraph = chapter?.paragraphs?.[currentParagraph]
  const text = paragraph?.text || ''

  // ========== 朗读评估 ==========

  const handleStartRecording = () => {
    setScore(null)
    setIsScoring(false)
    startListening({
      onEnd: () => {
        // 录音结束时自动评分（用最新的 transcript）
        setTimeout(() => {
          const finalTranscript = document.getElementById('transcript-hidden')?.textContent || ''
          if (finalTranscript) {
            calculateScore(finalTranscript, text)
          }
        }, 500)
      }
    })
  }

  // 用 useCallback 包装评分逻辑，同时监听 transcript 变化自动评分
  const calculateScore = useCallback((recognized, original) => {
    if (!recognized || !original) return
    setIsScoring(true)

    const origWords = original.toLowerCase().split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0)
    const recWords = recognized.toLowerCase().split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0)

    // 1. 准确度：识别出的单词中有多少匹配原文
    let matched = 0
    const missed = []
    const matchedSet = new Set()

    origWords.forEach(word => {
      const clean = word.replace(/[^a-z]/g, '')
      if (!clean) return
      const isMatched = recWords.some(r => {
        const rc = r.replace(/[^a-z]/g, '')
        return rc && (rc === clean || rc.includes(clean) || clean.includes(rc))
      })
      if (isMatched) {
        matched++
        matchedSet.add(clean)
      } else {
        missed.push(clean)
      }
    })

    const accuracy = origWords.length > 0 ? Math.round((matched / origWords.length) * 100) : 0

    // 2. 完整度：读了多少词 / 总词数
    const completeness = origWords.length > 0 ? Math.round((recWords.length / origWords.length) * 100) : 0

    // 3. 流畅度：根据识别文本长度与原文长度比估算（简化）
    const fluency = Math.min(100, Math.round((recognized.length / Math.max(original.length * 0.8, 1)) * 100))

    const finalScore = Math.round(accuracy * 0.5 + completeness * 0.3 + Math.min(fluency, 100) * 0.2)

    const result = {
      accuracy,
      completeness,
      fluency: Math.min(fluency, 100),
      final: finalScore,
      matched,
      total: origWords.length,
      missed: missed.slice(0, 8),
      recognizedText: recognized,
      date: Date.now()
    }

    setScore(result)
    setIsScoring(false)

    // 保存记录
    addSpeechRecord({
      paragraphId: paragraph?.id || 0,
      transcript: recognized,
      score: result,
      date: Date.now()
    })
  }, [text, paragraph, addSpeechRecord])

  // 监听 transcript 变化，录音结束后自动评分
  const handleForceScore = () => {
    if (transcript && text) {
      calculateScore(transcript, text)
    }
  }

  // ========== AI 对话 ==========

  const handleGenerateQuestion = async () => {
    if (!settings.aiApiKey || !text) return
    setIsLoading(true)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.aiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an English teacher. Based on the given paragraph, ask one thought-provoking question in English. The question should encourage the user to express their opinion or understanding. Keep it under 25 words.'
            },
            {
              role: 'user',
              content: `Paragraph: "${text.slice(0, 400)}"`
            }
          ]
        })
      })
      const data = await response.json()
      const question = data.choices[0].message.content
      setChatHistory([{ role: 'ai', content: question }])
      // 自动朗读问题
      playTTS(question)
    } catch (err) {
      setChatHistory([{ role: 'ai', content: '生成问题失败，请检查 API Key' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!transcript || !settings.aiApiKey || chatHistory.length === 0) return
    const question = chatHistory[0].content

    setChatHistory(prev => [...prev, { role: 'user', content: transcript }])
    setIsLoading(true)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.aiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a strict but encouraging English teacher. Evaluate the user\'s spoken answer on three dimensions: Fluency (0-10), Accuracy (0-10), Vocabulary (0-10). Then briefly correct any grammar mistakes and suggest a better native-like expression. Respond in English with Chinese translations in parentheses. Format:\n\n**Fluency:** X/10\n**Accuracy:** X/10\n**Vocabulary:** X/10\n\n**Feedback:** ...\n\n**Better expression:** ...'
            },
            {
              role: 'user',
              content: `Question: ${question}\nUser's answer: ${transcript}`
            }
          ]
        })
      })
      const data = await response.json()
      const feedback = data.choices[0].message.content
      setChatHistory(prev => [...prev, { role: 'ai', content: feedback }])
      // 自动朗读反馈的前两句
      const firstSentence = feedback.split('.').slice(0, 2).join('.') + '.'
      playTTS(firstSentence)
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', content: '评估失败，请检查 API Key' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetChat = () => {
    setChatHistory([])
  }

  if (!currentBook) {
    return (
      <div className="speak-page">
        <h2>🎤 口语练习</h2>
        <div className="empty-state">
          <p>请先导入一本书，才能进行口语练习</p>
        </div>
      </div>
    )
  }

  return (
    <div className="speak-page">
      <h2>🎤 口语练习</h2>

      <div className="mode-tabs">
        <button className={mode === 'read' ? 'active' : ''} onClick={() => setMode('read')}>📖 朗读评估</button>
        <button className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')}>💬 AI 对话</button>
      </div>

      <div className="speak-source">
        <p className="source-label">当前段落:</p>
        <p className="source-text">{text}</p>
        <button className="icon-btn" onClick={() => playTTS(text)} disabled={isTTSPlaying}>
          {isTTSPlaying ? '🔊' : '▶️'} 朗读原文
        </button>
      </div>

      {mode === 'read' && (
        <div className="speak-section">
          <h3>朗读评估</h3>
          <p>点击下方按钮，朗读上面的段落，系统会评估你的准确度、完整度和流畅度</p>

          {!isRecognitionSupported && (
            <div className="warning">⚠️ 你的浏览器不支持语音识别，请使用 Chrome 或 Edge</div>
          )}

          <div className="record-area">
            {isListening ? (
              <button className="btn-recording" onClick={() => { stopListening(); handleForceScore(); }}>
                ⏹️ 停止录音
              </button>
            ) : (
              <button className="btn-record" onClick={handleStartRecording} disabled={!isRecognitionSupported}>
                🎤 开始朗读
              </button>
            )}
          </div>

          {transcript && (
            <div className="transcript-box">
              <p><strong>识别结果:</strong> {transcript}</p>
              <span id="transcript-hidden" style={{ display: 'none' }}>{transcript}</span>
              {!isListening && !score && (
                <button className="btn-secondary" onClick={handleForceScore} disabled={isScoring}>
                  {isScoring ? '评分中...' : '重新评分'}
                </button>
              )}
            </div>
          )}

          {score && (
            <div className="score-box">
              <div className="score-main">
                <span className="score-number">{score.final}</span>
                <span className="score-label">综合评分</span>
              </div>
              <div className="score-details">
                <div className="score-item">
                  <span className="score-label-sm">准确度</span>
                  <div className="score-bar"><div className="score-fill" style={{ width: `${score.accuracy}%`, background: '#e74c3c' }} /></div>
                  <span className="score-val">{score.accuracy}%</span>
                </div>
                <div className="score-item">
                  <span className="score-label-sm">完整度</span>
                  <div className="score-bar"><div className="score-fill" style={{ width: `${score.completeness}%`, background: '#3498db' }} /></div>
                  <span className="score-val">{score.completeness}%</span>
                </div>
                <div className="score-item">
                  <span className="score-label-sm">流畅度</span>
                  <div className="score-bar"><div className="score-fill" style={{ width: `${score.fluency}%`, background: '#27ae60' }} /></div>
                  <span className="score-val">{score.fluency}%</span>
                </div>
              </div>
              <p className="score-match">匹配 {score.matched} / {score.total} 个词</p>
              {score.missed.length > 0 && (
                <p className="missed-words">漏读/错读: {score.missed.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'chat' && (
        <div className="speak-section">
          <h3>AI 口语对话</h3>
          {!settings.aiApiKey && (
            <div className="warning">⚠️ 请先前往「设置」配置 OpenAI API Key</div>
          )}

          <div className="chat-toolbar">
            <button
              className="btn-primary"
              onClick={handleGenerateQuestion}
              disabled={!settings.aiApiKey || isLoading}
            >
              {isLoading && chatHistory.length === 0 ? '生成中...' : '生成问题'}
            </button>
            {chatHistory.length > 0 && (
              <button className="btn-secondary" onClick={handleResetChat}>重新开始</button>
            )}
          </div>

          {chatHistory.length > 0 && (
            <div className="chat-box">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <strong>{msg.role === 'ai' ? 'AI' : 'You'}:</strong>
                  <div className="chat-content">{msg.content}</div>
                  {msg.role === 'ai' && (
                    <button className="icon-btn" onClick={() => playTTS(msg.content)}>▶️</button>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="chat-loading">AI 思考中...</div>
              )}

              {/* 用户语音输入区域 */}
              {!isLoading && (
                <div className="record-area">
                  {isListening ? (
                    <button className="btn-recording" onClick={stopListening}>
                      ⏹️ 停止回答
                    </button>
                  ) : (
                    <button className="btn-record" onClick={() => startListening()} disabled={!isRecognitionSupported}>
                      🎤 语音回答
                    </button>
                  )}
                </div>
              )}

              {transcript && !isListening && (
                <div className="chat-message user">
                  <strong>You:</strong> {transcript}
                  <button className="btn-secondary" onClick={handleSubmitAnswer} disabled={isLoading}>
                    {isLoading ? '评估中...' : '提交回答'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SpeakPage
