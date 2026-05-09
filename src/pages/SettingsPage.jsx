import { useState } from 'react'
import { useBookStore } from '../hooks/useStore'

function SettingsPage() {
  const settings = useBookStore(state => state.settings)
  const updateSettings = useBookStore(state => state.updateSettings)
  const clearAllData = useBookStore(state => state.clearAllData)

  const [form, setForm] = useState({ ...settings })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearData = () => {
    clearAllData()
    setShowClearConfirm(false)
    setForm({
      englishLevel: 'intermediate',
      aiApiKey: '',
      theme: 'light',
      tencentSecretId: '',
      tencentSecretKey: '',
      ttsBackendUrl: ''
    })
  }

  return (
    <div className="settings-page">
      <h2>⚙️ 设置</h2>

      <div className="settings-section">
        <h3>学习设置</h3>
        <div className="setting-item">
          <label htmlFor="englishLevel">英语水平</label>
          <select id="englishLevel" name="englishLevel" value={form.englishLevel} onChange={handleChange}>
            <option value="beginner">初级 (Beginner)</option>
            <option value="intermediate">中级 (Intermediate)</option>
            <option value="advanced">高级 (Advanced)</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>后端服务</h3>
        <div className="setting-item">
          <label htmlFor="ttsBackendUrl">后端地址</label>
          <input
            type="text"
            id="ttsBackendUrl"
            name="ttsBackendUrl"
            value={form.ttsBackendUrl}
            onChange={handleChange}
            placeholder="留空表示同域（Nginx 自动代理）"
          />
          <p className="setting-hint">
            留空 = 同域部署（生产环境推荐，由 Nginx 自动代理到后端）。<br/>
            本地开发可填 http://localhost:8000，或留空由 Vite 代理。
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>OpenAI（可选）</h3>
        <div className="setting-item">
          <label htmlFor="aiApiKey">OpenAI API Key</label>
          <input
            type="password"
            id="aiApiKey"
            name="aiApiKey"
            value={form.aiApiKey}
            onChange={handleChange}
            placeholder="sk-..."
          />
          <p className="setting-hint">用于 AI 查词和口语对话。仅存储在本地浏览器中。</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>外观</h3>
        <div className="setting-item">
          <label htmlFor="theme">主题</label>
          <select id="theme" name="theme" value={form.theme} onChange={handleChange}>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave}>
          {saved ? '✅ 已保存' : '保存设置'}
        </button>
      </div>

      <div className="settings-section danger-zone">
        <h3>⚠️ 危险区域</h3>
        {!showClearConfirm ? (
          <button className="btn-danger" onClick={() => setShowClearConfirm(true)}>
            清除所有数据
          </button>
        ) : (
          <div className="confirm-box">
            <p>确定要清除所有数据吗？此操作不可恢复。</p>
            <button className="btn-secondary" onClick={() => setShowClearConfirm(false)}>取消</button>
            <button className="btn-danger" onClick={handleClearData}>确认清除</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
