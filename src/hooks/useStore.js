import { create } from 'zustand'
import { storage } from '../utils/storage'
import { idbStorage } from '../utils/indexedDB'

/**
 * 全局状态管理（Zustand）
 * 书籍、生词、学习进度等核心数据
 * 自动同步到 localStorage
 */

export const useBookStore = create((set, get) => ({
  // 书籍数据
  currentBook: storage.getCurrentBook(),
  books: storage.getBooks(),

  // 阅读进度
  currentChapter: storage.getProgress().currentChapter,
  currentParagraph: storage.getProgress().currentParagraph,
  readingHistory: [],

  // 词汇
  knownWords: storage.getKnownWords(),
  unknownWords: storage.getUnknownWords(),
  wordList: storage.getWordList(),

  // 口语
  speechRecords: storage.getSpeechRecords(),
  speechScores: [],

  // 设置
  settings: storage.getSettings(),

  // 书签
  bookmarks: storage.getBookmarks(),

  // Actions
  importBook: async (book) => {
    // 完整书籍数据存 IndexedDB（大文本）
    await idbStorage.saveBook(book)
    // 轻量元数据存 localStorage
    const metaBook = { id: book.id, title: book.title, author: book.author, language: book.language, totalWords: book.totalWords, uniqueWords: book.uniqueWords, chaptersCount: book.chapters?.length || 0, importedAt: book.importedAt }
    const books = [...get().books.filter(b => b.id !== book.id), metaBook]
    storage.saveBooks(books)
    storage.saveCurrentBook(metaBook)
    storage.saveProgress(0, 0)
    set({
      currentBook: book,
      books,
      currentChapter: 0,
      currentParagraph: 0
    })
  },

  loadBookFromIDB: async (bookId) => {
    const fullBook = await idbStorage.getBook(bookId)
    if (fullBook) {
      set({ currentBook: fullBook })
    }
    return fullBook
  },

  setCurrentBook: (book) => {
    storage.saveCurrentBook(book)
    set({ currentBook: book })
  },

  setProgress: (chapter, paragraph) => {
    storage.saveProgress(chapter, paragraph)
    set({ currentChapter: chapter, currentParagraph: paragraph })
  },

  markWord: (word, status) => {
    const { knownWords, unknownWords } = get()
    const newKnown = new Set(knownWords)
    const newUnknown = new Set(unknownWords)

    if (status === 'known') {
      newKnown.add(word.toLowerCase())
      newUnknown.delete(word.toLowerCase())
    } else if (status === 'unknown') {
      newUnknown.add(word.toLowerCase())
      newKnown.delete(word.toLowerCase())
    } else {
      // 'neutral' - 移除标记
      newKnown.delete(word.toLowerCase())
      newUnknown.delete(word.toLowerCase())
    }

    storage.saveKnownWords(newKnown)
    storage.saveUnknownWords(newUnknown)
    set({ knownWords: newKnown, unknownWords: newUnknown })
  },

  addToWordList: (wordInfo) => {
    const wordList = get().wordList
    const exists = wordList.some(w => w.word === wordInfo.word)
    if (exists) return

    const newList = [...wordList, {
      ...wordInfo,
      date: Date.now(),
      reviewCount: 0,
      nextReview: Date.now() + 24 * 60 * 60 * 1000 // 1天后复习
    }]
    storage.saveWordList(newList)
    set({ wordList: newList })
  },

  removeFromWordList: (word) => {
    const newList = get().wordList.filter(w => w.word !== word)
    storage.saveWordList(newList)
    set({ wordList: newList })
  },

  updateWordReview: (word, correct) => {
    const newList = get().wordList.map(w => {
      if (w.word !== word) return w
      const reviewCount = w.reviewCount + 1
      let nextReview
      if (correct) {
        const days = reviewCount === 1 ? 3 : reviewCount === 2 ? 7 : 14
        nextReview = Date.now() + days * 24 * 60 * 60 * 1000
      } else {
        nextReview = Date.now() + 24 * 60 * 60 * 1000
      }
      return { ...w, reviewCount, nextReview, lastReviewed: Date.now() }
    })
    storage.saveWordList(newList)
    set({ wordList: newList })
  },

  addSpeechRecord: (record) => {
    const records = [...get().speechRecords, record]
    storage.saveSpeechRecords(records)
    set({ speechRecords: records })
  },

  updateSettings: (newSettings) => {
    const settings = { ...get().settings, ...newSettings }
    storage.saveSettings(settings)
    set({ settings })
  },

  addBookmark: (bookmark) => {
    const bookmarks = [...get().bookmarks, {
      ...bookmark,
      id: `${bookmark.bookId}_${bookmark.chapter}_${bookmark.paragraph}_${Date.now()}`,
      createdAt: Date.now()
    }]
    storage.saveBookmarks(bookmarks)
    set({ bookmarks })
  },

  removeBookmark: (id) => {
    const bookmarks = get().bookmarks.filter(b => b.id !== id)
    storage.saveBookmarks(bookmarks)
    set({ bookmarks })
  },

  deleteBook: async (bookId) => {
    const books = get().books.filter(b => b.id !== bookId)
    storage.saveBooks(books)
    await idbStorage.deleteBook(bookId)
    set({ books })
    if (get().currentBook?.id === bookId) {
      storage.saveCurrentBook(null)
      storage.saveProgress(0, 0)
      set({ currentBook: null, currentChapter: 0, currentParagraph: 0 })
    }
  },

  clearAllData: async () => {
    storage.clearAll()
    await idbStorage.clearAll()
    set({
      currentBook: null,
      books: [],
      currentChapter: 0,
      currentParagraph: 0,
      knownWords: new Set(),
      unknownWords: new Set(),
      wordList: [],
      speechRecords: [],
      bookmarks: [],
      settings: { englishLevel: 'intermediate', aiApiKey: '', theme: 'light', tencentSecretId: '', tencentSecretKey: '', ttsBackendUrl: '' }
    })
  }
}))
