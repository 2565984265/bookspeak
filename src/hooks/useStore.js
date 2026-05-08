import { create } from 'zustand'

// 全局状态管理
// 书籍、生词、学习进度等核心数据

export const useBookStore = create((set, get) => ({
  // 书籍数据
  currentBook: null,      // 当前阅读的书籍
  books: [],              // 所有已导入的书籍列表
  
  // 阅读进度
  currentChapter: 0,      // 当前章节索引
  currentParagraph: 0,    // 当前段落索引
  readingHistory: [],     // 阅读历史
  
  // 词汇
  knownWords: new Set(),  // 已标记为"认识"的词汇
  unknownWords: new Set(),// 已标记为"不认识"的词汇
  wordList: [],           // 生词本数组
  
  // 口语
  speechRecords: [],      // 录音记录
  speechScores: [],       // 口语评分历史
  
  // Actions
  importBook: (book) => set({ currentBook: book, books: [...get().books, book] }),
  setProgress: (chapter, paragraph) => set({ currentChapter: chapter, currentParagraph: paragraph }),
  markWord: (word, status) => {
    const { knownWords, unknownWords } = get()
    if (status === 'known') {
      knownWords.add(word)
      unknownWords.delete(word)
    } else {
      unknownWords.add(word)
      knownWords.delete(word)
    }
    set({ knownWords: new Set(knownWords), unknownWords: new Set(unknownWords) })
  },
  addToWordList: (word) => set({ wordList: [...get().wordList, word] }),
  addSpeechRecord: (record) => set({ speechRecords: [...get().speechRecords, record] }),
}))
