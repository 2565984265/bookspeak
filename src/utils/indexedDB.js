/**
 * IndexedDB 封装
 * 用于存储大体积数据：书籍原文、录音音频等
 * localStorage 只存小数据（设置、词汇、进度等）
 */

const DB_NAME = 'BookSpeakDB'
const DB_VERSION = 1

const STORES = {
  BOOKS: 'books',       // 书籍完整数据（含 chapters/paragraphs）
  AUDIO: 'audio',       // 录音音频 Blob
  RECORDS: 'records'    // 学习记录快照
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORES.BOOKS)) {
        db.createObjectStore(STORES.BOOKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.AUDIO)) {
        db.createObjectStore(STORES.AUDIO, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORES.RECORDS)) {
        db.createObjectStore(STORES.RECORDS, { keyPath: 'date' })
      }
    }
  })
}

export const idbStorage = {
  /**
   * 保存书籍（含完整原文）
   */
  async saveBook(book) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOOKS, 'readwrite')
      const store = tx.objectStore(STORES.BOOKS)
      const request = store.put(book)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 获取书籍
   */
  async getBook(bookId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOOKS, 'readonly')
      const store = tx.objectStore(STORES.BOOKS)
      const request = store.get(bookId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 获取所有书籍
   */
  async getAllBooks() {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOOKS, 'readonly')
      const store = tx.objectStore(STORES.BOOKS)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 删除书籍
   */
  async deleteBook(bookId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOOKS, 'readwrite')
      const store = tx.objectStore(STORES.BOOKS)
      const request = store.delete(bookId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 保存录音音频
   */
  async saveAudio(blob, metadata = {}) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO, 'readwrite')
      const store = tx.objectStore(STORES.AUDIO)
      const request = store.put({ blob, ...metadata, date: Date.now() })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 获取录音音频
   */
  async getAudio(audioId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO, 'readonly')
      const store = tx.objectStore(STORES.AUDIO)
      const request = store.get(audioId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 获取所有录音
   */
  async getAllAudio() {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO, 'readonly')
      const store = tx.objectStore(STORES.AUDIO)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 删除录音
   */
  async deleteAudio(audioId) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.AUDIO, 'readwrite')
      const store = tx.objectStore(STORES.AUDIO)
      const request = store.delete(audioId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 保存每日学习记录快照
   */
  async saveDailyRecord(record) {
    const db = await openDB()
    const date = new Date().toISOString().slice(0, 10)
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readwrite')
      const store = tx.objectStore(STORES.RECORDS)
      const request = store.put({ date, ...record, updatedAt: Date.now() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 获取每日学习记录
   */
  async getDailyRecord(date) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readonly')
      const store = tx.objectStore(STORES.RECORDS)
      const request = store.get(date)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 获取所有学习记录
   */
  async getAllRecords() {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readonly')
      const store = tx.objectStore(STORES.RECORDS)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * 清空所有数据
   */
  async clearAll() {
    const db = await openDB()
    await Promise.all([
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.BOOKS, 'readwrite')
        const request = tx.objectStore(STORES.BOOKS).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.AUDIO, 'readwrite')
        const request = tx.objectStore(STORES.AUDIO).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.RECORDS, 'readwrite')
        const request = tx.objectStore(STORES.RECORDS).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    ])
  }
}
