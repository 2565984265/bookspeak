/**
 * 本地存储封装
 * 使用 localStorage 保存小数据（设置、词汇、进度）
 */

const STORAGE_KEYS = {
  BOOKS: 'bookspeak_books',
  CURRENT_BOOK: 'bookspeak_current_book',
  PROGRESS: 'bookspeak_progress',
  KNOWN_WORDS: 'bookspeak_known_words',
  UNKNOWN_WORDS: 'bookspeak_unknown_words',
  WORD_LIST: 'bookspeak_word_list',
  SPEECH_RECORDS: 'bookspeak_speech_records',
  SETTINGS: 'bookspeak_settings',
  BOOKMARKS: 'bookspeak_bookmarks'
}

export const storage = {
  // 书籍列表
  getBooks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKS)
      const parsed = data ? JSON.parse(data) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveBooks(books) {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books))
  },

  // 当前书籍
  getCurrentBook() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_BOOK)
      const parsed = data ? JSON.parse(data) : null
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  saveCurrentBook(book) {
    if (book) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_BOOK, JSON.stringify(book))
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_BOOK)
    }
  },

  // 阅读进度
  getProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS)
      const parsed = data ? JSON.parse(data) : null
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : { currentChapter: 0, currentParagraph: 0 }
    } catch {
      return { currentChapter: 0, currentParagraph: 0 }
    }
  },

  saveProgress(chapter, paragraph) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({ currentChapter: chapter, currentParagraph: paragraph }))
  },

  // 词汇
  getKnownWords() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.KNOWN_WORDS)
      return data ? new Set(JSON.parse(data)) : new Set()
    } catch {
      return new Set()
    }
  },

  saveKnownWords(words) {
    localStorage.setItem(STORAGE_KEYS.KNOWN_WORDS, JSON.stringify([...words]))
  },

  getUnknownWords() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.UNKNOWN_WORDS)
      return data ? new Set(JSON.parse(data)) : new Set()
    } catch {
      return new Set()
    }
  },

  saveUnknownWords(words) {
    localStorage.setItem(STORAGE_KEYS.UNKNOWN_WORDS, JSON.stringify([...words]))
  },

  // 生词本
  getWordList() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORD_LIST)
      const parsed = data ? JSON.parse(data) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveWordList(list) {
    localStorage.setItem(STORAGE_KEYS.WORD_LIST, JSON.stringify(list))
  },

  // 口语记录
  getSpeechRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SPEECH_RECORDS)
      const parsed = data ? JSON.parse(data) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveSpeechRecords(records) {
    localStorage.setItem(STORAGE_KEYS.SPEECH_RECORDS, JSON.stringify(records))
  },

  // 设置
  getSettings() {
    const defaults = {
      englishLevel: 'intermediate',
      aiApiKey: '',
      theme: 'light',
      tencentSecretId: '',
      tencentSecretKey: '',
      ttsBackendUrl: ''
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
      if (!data) return defaults
      const parsed = JSON.parse(data)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? { ...defaults, ...parsed }
        : defaults
    } catch {
      return defaults
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  },

  // 导出所有数据
  exportAll() {
    return {
      books: this.getBooks(),
      currentBook: this.getCurrentBook(),
      progress: this.getProgress(),
      knownWords: [...this.getKnownWords()],
      unknownWords: [...this.getUnknownWords()],
      wordList: this.getWordList(),
      speechRecords: this.getSpeechRecords(),
      settings: this.getSettings()
    }
  },

  // 书签
  getBookmarks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
      const parsed = data ? JSON.parse(data) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveBookmarks(bookmarks) {
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks))
  },

  // 清除所有数据
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
  }
}
