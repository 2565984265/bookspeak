import { useBookStore } from '../hooks/useStore'

/**
 * 书签列表弹窗
 * 显示当前书籍的所有书签，支持跳转和删除
 */

function BookmarkList({ bookId, onClose, onJump }) {
  const bookmarks = useBookStore(state => state.bookmarks)
  const removeBookmark = useBookStore(state => state.removeBookmark)
  const currentBook = useBookStore(state => state.currentBook)

  const bookBookmarks = bookmarks
    .filter(b => b.bookId === bookId)
    .sort((a, b) => b.createdAt - a.createdAt)

  const formatDate = (timestamp) => {
    const d = new Date(timestamp)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const handleJump = (bookmark) => {
    onJump(bookmark.chapter, bookmark.paragraph)
    onClose()
  }

  return (
    <div className="bookmark-overlay" onClick={onClose}>
      <div className="bookmark-panel" onClick={e => e.stopPropagation()}>
        <div className="bookmark-header">
          <h3>🔖 我的书签 ({bookBookmarks.length})</h3>
          <button className="bookmark-close" onClick={onClose}>✕</button>
        </div>

        {bookBookmarks.length === 0 ? (
          <div className="bookmark-empty">
            <p>还没有添加书签</p>
            <p className="bookmark-hint">阅读时点击段落旁的 🔖 按钮即可标记位置</p>
          </div>
        ) : (
          <div className="bookmark-list">
            {bookBookmarks.map(bm => (
              <div key={bm.id} className="bookmark-item">
                <div
                  className="bookmark-content"
                  onClick={() => handleJump(bm)}
                  title="点击跳转"
                >
                  <div className="bookmark-chapter">
                    {currentBook?.chapters?.[bm.chapter]?.title || `第 ${bm.chapter + 1} 章`}
                  </div>
                  <div className="bookmark-preview">
                    {bm.preview}
                  </div>
                  <div className="bookmark-meta">
                    段落 {bm.paragraph + 1} · {formatDate(bm.createdAt)}
                  </div>
                </div>
                <button
                  className="bookmark-delete"
                  onClick={() => removeBookmark(bm.id)}
                  title="删除书签"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookmarkList
