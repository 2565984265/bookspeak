/**
 * IndexedDB 封装
 * 用于存储大体积数据：书籍原文、录音音频、翻译缓存等
 * localStorage 只存小数据（设置、词汇、进度等）
 */

const DB_NAME = 'BookSpeakDB'
const DB_VERSION = 2

const STORES = {
  BOOKS: 'books',           // 书籍完整数据（含 chapters/paragraphs）
  AUDIO: 'audio',           // 录音音频 Blob
  RECORDS: 'records',       // 学习记录快照
  TRANSLATIONS: 'translations'  // 段落翻译缓存 {key, bookId, chapterIndex, paragraphIndex, originalText, translation, timestamp}
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
      if (!db.objectStoreNames.contains(STORES.TRANSLATIONS)) {
        const store = db.createObjectStore(STORES.TRANSLATIONS, { keyPath: 'key' })
        store.createIndex('byBook', 'bookId', { unique: false })
        store.createIndex('byBookChapter', ['bookId', 'chapterIndex'], { unique: false })
      }
    }
  })
}

export const idbStorage = {
  // ==================== 书籍 ====================
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

  // ==================== 录音 ====================
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

  // ==================== 学习记录 ====================
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

  // ==================== 翻译缓存 ====================
  async saveTranslation(record) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readwrite')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const request = store.put({
        key: `${record.bookId}_${record.chapterIndex}_${record.paragraphIndex}`,
        ...record,
        timestamp: Date.now()
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  async getTranslation(bookId, chapterIndex, paragraphIndex) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readonly')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const request = store.get(`${bookId}_${chapterIndex}_${paragraphIndex}`)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  async getTranslationsByChapter(bookId, chapterIndex) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readonly')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const index = store.index('byBookChapter')
      const request = index.getAll([bookId, chapterIndex])
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  },

  async deleteTranslationsByBook(bookId) {
    const db = await openDB()
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readonly')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const index = store.index('byBook')
      const request = index.getAll(bookId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    return Promise.all(records.map(r => new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readwrite')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const request = store.delete(r.key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })))
  },

  async deleteOldTranslations(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
    const db = await openDB()
    const cutoff = Date.now() - maxAgeMs
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readonly')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    const toDelete = records.filter(r => r.timestamp < cutoff)
    return Promise.all(toDelete.map(r => new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSLATIONS, 'readwrite')
      const store = tx.objectStore(STORES.TRANSLATIONS)
      const request = store.delete(r.key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })))
  },

  // ==================== 清空 ====================
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
      }),
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.TRANSLATIONS, 'readwrite')
        const request = tx.objectStore(STORES.TRANSLATIONS).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    ])
  }
}
