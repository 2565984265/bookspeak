import { useState, useRef, useCallback } from 'react'
import { parseTXT, parseEPUB, readFileAsText, readFileAsArrayBuffer } from '../utils/bookParser'
import { useBookStore } from '../hooks/useStore'

/**
 * 书籍上传组件
 * 支持 TXT / EPUB 文件上传和解析
 */

function BookUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const importBook = useBookStore(state => state.importBook)

  const handleFile = useCallback(async (file) => {
    if (!file) return

    const fileName = file.name.toLowerCase()
    const isTXT = fileName.endsWith('.txt') || file.type === 'text/plain'
    const isEPUB = fileName.endsWith('.epub') || file.type === 'application/epub+zip'

    if (!isTXT && !isEPUB) {
      setError('目前仅支持 TXT 和 EPUB 文件')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let book
      const title = file.name.replace(/\.(txt|epub)$/i, '')

      if (isTXT) {
        const text = await readFileAsText(file)
        book = parseTXT(text, title)
      } else if (isEPUB) {
        const arrayBuffer = await readFileAsArrayBuffer(file)
        book = await parseEPUB(arrayBuffer, title)
      }

      if (book) {
        importBook(book)
      }
    } catch (err) {
      setError('文件解析失败：' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [importBook])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onFileInputChange = useCallback((e) => {
    const file = e.target.files[0]
    handleFile(file)
    e.target.value = '' // 清空，允许重复上传
  }, [handleFile])

  return (
    <div className="book-uploader">
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-icon">📚</div>
        <p className="upload-text">
          {isLoading ? '正在解析...' : '点击或拖拽上传书籍'}
        </p>
        <p className="upload-hint">支持 .txt / .epub 格式，自动分段解析</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.epub,text/plain,application/epub+zip"
          onChange={onFileInputChange}
          style={{ display: 'none' }}
        />
      </div>
      {error && <div className="upload-error">⚠️ {error}</div>}
    </div>
  )
}

export default BookUploader
