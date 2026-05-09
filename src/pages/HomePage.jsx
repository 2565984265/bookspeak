import { Link } from 'react-router-dom'
import { useBookStore } from '../hooks/useStore'
import BookUploader from '../components/BookUploader'

function HomePage() {
  const books = useBookStore(state => state.books)
  const currentBook = useBookStore(state => state.currentBook)
  const wordList = useBookStore(state => state.wordList)
  const setCurrentBook = useBookStore(state => state.setCurrentBook)
  const setProgress = useBookStore(state => state.setProgress)

  const handleContinueReading = () => {
    // 已经在阅读页，不需要额外操作
  }

  const handleSelectBook = (book) => {
    setCurrentBook(book)
    setProgress(0, 0)
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <h2>📚 BookSpeak</h2>
        <p className="subtitle">通过阅读一本书学英语</p>
      </div>

      {/* 上传区域 */}
      <section className="home-section">
        <h3>📖 导入新书</h3>
        <BookUploader />
      </section>

      {/* 当前阅读 */}
      {currentBook && (
        <section className="home-section">
          <h3>📌 当前阅读</h3>
          <div className="current-book-card">
            <div className="book-info">
              <h4>{currentBook.title}</h4>
              <p className="book-meta">
                {currentBook.totalWords?.toLocaleString()} 词 ·
                {currentBook.chapters?.length} 章 ·
                {currentBook.uniqueWords?.toLocaleString()} 不同词汇
              </p>
            </div>
            <Link to="/reader" className="btn-primary">
              继续阅读 →
            </Link>
          </div>
        </section>
      )}

      {/* 书籍列表 */}
      {books.length > 0 && (
        <section className="home-section">
          <h3>📚 我的书库 ({books.length})</h3>
          <div className="book-list">
            {books.map(book => (
              <div
                key={book.id}
                className={`book-card ${currentBook?.id === book.id ? 'active' : ''}`}
                onClick={() => handleSelectBook(book)}
              >
                <h4>{book.title}</h4>
                <p className="book-meta">
                  {book.totalWords?.toLocaleString()} 词 ·
                  {book.chapters?.length} 章
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 学习统计 */}
      <section className="home-section">
        <h3>📊 学习概览</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{books.length}</div>
            <div className="stat-label">已导入书籍</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{wordList.length}</div>
            <div className="stat-label">生词本词汇</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{useBookStore.getState().knownWords.size}</div>
            <div className="stat-label">已掌握词汇</div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
