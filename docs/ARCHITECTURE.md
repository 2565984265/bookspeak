# BookSpeak 架构说明

> 通过阅读一本书学英语 —— 阅读、词汇、口语三位一体

## 一、技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| **前端框架** | React 18 + Vite | 轻量、热更新快、生态成熟 |
| **路由** | React Router v6 | 单页应用，6个页面切换 |
| **状态管理** | Zustand | 比 Redux 轻量，比 Context 好维护 |
| **构建工具** | Vite | 秒级启动，配置简单 |
| **样式** | CSS Modules / 原生 CSS | 不引入 UI 库，保持轻量 |
| **语音** | Web Speech API | 浏览器原生，免费，无需后端 |
| **AI 查词** |  OpenAI API  / 在线词典 | 解释词义、口语对话 |
| **数据存储** | localStorage + IndexedDB | 纯前端，零配置，用户数据本地保存 |
| **书籍解析** | 纯 JS 文本处理 | TXT 直接读，EPUB 用 JSZip 解压 |

> **无需后端服务器。** 所有功能在浏览器完成，部署静态文件即可。

---

## 二、项目目录结构

```
bookspeak/
├── index.html              # 入口 HTML
├── package.json            # 依赖配置
├── vite.config.js          # Vite 构建配置
├── public/                 # 静态资源
│   └── logo.svg            # Logo
├── src/
│   ├── main.jsx            # React 入口
│   ├── App.jsx             # 根组件 + 路由配置
│   ├── styles/
│   │   └── global.css      # 全局样式
│   ├── components/         # 可复用组件
│   │   ├── Layout.jsx      # 侧边栏 + 主内容区布局
│   │   ├── BookUploader.jsx # 上传书籍（TXT/PDF/EPUB）
│   │   ├── Reader.jsx      # 阅读器核心组件
│   │   ├── WordTooltip.jsx # 查词弹窗（点击单词弹出释义）
│   │   ├── VocabList.jsx   # 生词列表
│   │   ├── SpeechRecorder.jsx # 录音组件
│   │   ├── SpeechPlayer.jsx   # 朗读组件（Web Speech）
│   │   ├── ProgressChart.jsx  # 进度图表
│   │   └── WordHighlighter.jsx # 单词高亮（已知/未知/生词本）
│   ├── pages/              # 页面组件
│   │   ├── HomePage.jsx    # 首页：上传入口 + 书籍列表 + 统计
│   │   ├── ReaderPage.jsx  # 阅读页：书籍内容 + 查词 + 分段
│   │   ├── VocabPage.jsx   # 生词本页：词汇列表 + 复习 + 导出
│   │   ├── SpeakPage.jsx   # 口语页：朗读 + AI对话 + 复述
│   │   ├── ProgressPage.jsx # 进度页：可视化学习数据
│   │   └── SettingsPage.jsx # 设置页：水平选择 + API配置
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useStore.js     # Zustand 全局状态（核心）
│   │   ├── useSpeech.js    # Web Speech API 封装（朗读 + 识别）
│   │   ├── useBookParser.js # 书籍解析（TXT/EPUB/PDF）
│   │   ├── useWordLookup.js # 查词（调用词典 API / AI）
│   │   └── useProgress.js   # 学习进度计算
│   ├── utils/              # 工具函数
│   │   ├── bookParser.js   # TXT 分段、EPUB 解压解析
│   │   ├── vocabAnalyzer.js # 词汇难度分析、CEFR 分级
│   │   ├── speechScorer.js  # 语音评分算法（识别结果对比）
│   │   ├── storage.js       # localStorage / IndexedDB 封装
│   │   └── export.js        # Anki 导出、学习报告生成
│   └── assets/             # 资源文件
│       └── demo-book.txt   # 测试用书（纳瓦尔宝典英文版）
├── docs/
│   └── ARCHITECTURE.md     # 本文档
└── scripts/
    └── build.sh            # 构建脚本
```

---

## 三、数据流架构

```
用户操作 → Zustand Store → 组件响应 → localStorage 持久化
                ↑
         Web Speech API（语音）
         在线词典 API（查词）
         OpenAI API（AI对话）
```

### 核心状态（Zustand）

```javascript
// src/hooks/useStore.js

{
  // 书籍
  currentBook: { id, title, content, chapters[], totalWords },
  books: [],
  
  // 阅读位置
  currentChapter: 0,
  currentParagraph: 0,
  
  // 词汇状态
  knownWords: Set(['the', 'is']),      // 标记为"认识"
  unknownWords: Set(['entrepreneur']), // 标记为"不认识"
  wordList: [                           // 生词本（带释义）
    { word, translation, context, date, reviewCount }
  ],
  
  // 口语记录
  speechRecords: [
    { paragraphId, audioBlob, transcript, score, date }
  ],
  
  // 用户设置
  settings: { englishLevel: 'intermediate', aiApiKey: '', theme: 'light' }
}
```

### 持久化策略

| 数据 | 存储方式 | 说明 |
|------|---------|------|
| 书籍原文 | IndexedDB | 大文本，存本地数据库 |
| 词汇、进度 | localStorage | 小数据，JSON 序列化 |
| 录音音频 | IndexedDB | Blob 数据 |
| 设置 | localStorage | 简单键值 |

---

## 四、六大核心模块

### 模块 1：书籍导入（BookUploader）

**功能：** 用户上传 TXT / EPUB / PDF，解析为可阅读的分段文本。

**技术要点：**
- TXT：按段落分割，每段 3-5 句
- EPUB：用 `JSZip` 解压，解析 XML 提取正文
- PDF：用 `pdfjs-dist` 提取文本
- 自动统计：总词数、总段落数、预估难度（词汇频率分析）

**输出数据结构：**
```javascript
{
  id: 'uuid',
  title: 'The Almanack of Naval Ravikant',
  author: 'Eric Jorgenson',
  language: 'en',
  chapters: [
    {
      title: 'Chapter 1',
      paragraphs: [
        { id: 0, text: '...', wordCount: 45 },
        { id: 1, text: '...', wordCount: 38 }
      ]
    }
  ],
  totalWords: 45000,
  uniqueWords: 3200
}
```

---

### 模块 2：阅读器（Reader）

**功能：** 分段显示原文，点击查词，高亮已知/未知词汇。

**UI 布局：**
```
+----------------------------------+
|  书名: The Almanack...            |
|  进度: Chapter 2 · 15%          |
+----------------------------------+
|                                  |
|  [段落文字...]                    |
|  [点击任意单词 → 查词弹窗]         |
|                                  |
|  [段落文字...]                    |
|  [已知词汇正常色]                  |
|  [未知词汇红色高亮]                |
|  [生词本词汇黄色高亮]              |
|                                  |
+----------------------------------+
|  [← 上一段]  [标记读完 →]        |
+----------------------------------+
```

**技术要点：**
- 用 `span` 包裹每个单词，绑定点击事件
- 查词弹窗：`WordTooltip` 组件，显示释义 + 发音按钮 + "加入生词本"按钮
- 单词高亮：根据 `knownWords` / `unknownWords` / `wordList` 动态添加 CSS class

---

### 模块 3：查词（WordTooltip）

**功能：** 点击单词 → 弹出释义、发音、收藏。

**数据来源：**
1. **优先：** 免费词典 API（如 Free Dictionary API、DictionaryAPI.dev）
2. **备用：** OpenAI API（`"Explain the word 'entrepreneur' in simple English"`）
3. **本地缓存：** 查过的词存 localStorage，下次秒开

**弹窗内容：**
- 单词 + 音标
- 中文释义 / 英文释义（可切换）
- 发音按钮（Web Speech `speechSynthesis`）
- 例句（来自原文或词典）
- 按钮：「认识」/「不认识」/「加入生词本」

---

### 模块 4：生词本（VocabList）

**功能：** 管理所有收藏词汇，复习模式，Anki 导出。

**核心功能：**
- 列表展示：单词、释义、出处上下文、收藏日期
- 筛选：全部 / 未复习 / 已掌握
- 复习模式：卡片翻转（正面单词 → 背面释义）
- 书中高亮：生词本里的词，在正文中黄色高亮
- 导出 Anki：生成 `.apkg` 或 `.csv` 格式

**复习算法（简化版）：**
- 新词 → 1天后复习
- 第一次复习正确 → 3天后
- 第二次复习正确 → 7天后
- 错误 → 回到1天

---

### 模块 5：口语练习（SpeakPage）

**三种模式：**

#### 模式 A：朗读评估
```
1. 用户朗读当前段落
2. Web Speech API `speechRecognition` 识别文本
3. 对比原文 → 计算相似度
4. 输出：总分 + 漏读/错读单词列表
```

**评分维度：**
- 准确度（识别文本 vs 原文匹配率）
- 流畅度（语速、停顿）
- 完整度（是否读完）

#### 模式 B：AI 对话
```
1. AI 基于当前段落内容提问（OpenAI API）
2. 用户用英语语音回答（Web Speech 识别）
3. AI 纠正语法和用词，给出更好的表达
4. 显示：用户说的 → AI 修正版 → 发音练习
```

**Prompt 示例：**
```
Based on this paragraph about wealth creation, 
ask the user a thought-provoking question in English. 
When they respond, correct their grammar and suggest better expressions.

Paragraph: "Seek wealth, not money or status. Wealth is having assets that earn while you sleep."
```

#### 模式 C：复述练习
```
1. 用户读完一段
2. 隐藏原文
3. 用户用自己的话复述大意（语音输入）
4. AI 评估：是否准确、是否流畅
```

---

### 模块 6：进度追踪（ProgressChart）

**可视化数据：**

| 指标 | 展示方式 |
|------|---------|
| 阅读进度 | 进度条（第 X 章 / 共 Y 章） |
| 词汇增长 | 折线图（每天新增词汇数） |
| 口语评分趋势 | 柱状图（每次朗读分数） |
| 连续打卡 | 日历热力图 |
| 这本书帮我学会了 | 数字卡片（+N 词汇，+M 口语练习） |

---

## 五、关键技术实现

### Web Speech API 使用

```javascript
// 朗读（Text-to-Speech）
const utterance = new SpeechSynthesisUtterance('Hello world')
utterance.lang = 'en-US'
speechSynthesis.speak(utterance)

// 识别（Speech-to-Text）
const recognition = new webkitSpeechRecognition()
recognition.lang = 'en-US'
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript
  console.log('用户说：', transcript)
}
recognition.start()
```

> ⚠️ 限制：Speech Recognition 只在 Chrome/Edge 支持，需提示用户。

---

### 书籍解析（TXT 为例）

```javascript
// 按段落分割，过滤空行
const paragraphs = text
  .split(/\n\s*\n/)      // 按空行分段
  .map(p => p.trim())
  .filter(p => p.length > 20)  // 过滤太短的
  .map((text, id) => ({ id, text, wordCount: text.split(/\s+/).length }))
```

---

### 词汇难度分析

```javascript
// CEFR 词汇表（简化）
const CEFR_WORDS = {
  A1: ['the', 'be', 'to', 'of', 'and'],
  A2: ['always', 'week', 'answer', 'money'],
  B1: ['although', 'environment', 'opinion'],
  B2: ['analyze', 'circumstance', 'significant'],
  C1: ['ambiguous', 'hypothetical', 'paradigm']
}

// 分析段落难度
function analyzeDifficulty(text) {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g)
  const levels = words.map(w => getLevel(w))  // 查表
  return {
    averageLevel: average(levels),
    unknownRatio: levels.filter(l => l === 'unknown').length / words.length
  }
}
```

---

## 六、开发顺序（MVP → v1.0）

### MVP（v0.1）—— 能跑起来，自己先用
**目标：2周内完成**

1. ✅ 项目骨架（Vite + React + Router）
2. ✅ 布局组件（侧边栏 + 主内容区）
3. 📋 上传 TXT 文件 + 分段显示
4. 📋 点击查词（调用在线词典 API）
5. 📋 标记「认识/不认识」+ 生词收藏
6. 📋 Web Speech 朗读功能
7. 📋 简单进度保存（localStorage）

### v0.2 —— 完善阅读体验
**目标：1周**

1. EPUB 支持（JSZip 解析）
2. 单词高亮（已知/未知/生词本）
3. 生词列表页面
4. 阅读位置记忆

### v0.3 —— 口语功能
**目标：1-2周**

1. 录音功能（Web Speech Recognition）
2. 朗读评分（原文 vs 识别结果对比）
3. AI 口语对话（OpenAI API）

### v0.4 —— 数据 & 导出
**目标：1周**

1. IndexedDB 存储（替代 localStorage，存大文本）
2. 进度可视化图表
3. Anki 导出（CSV 格式）
4. 学习报告

### v1.0 —— 发布
**目标：1周打磨**

1. 桌面应用（Electron 打包）
2. 主题切换（浅色/深色）
3. 多本书管理
4. 文档完善

---

## 七、API 参考

### 免费词典 API
```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}

Response:
[{
  "word": "entrepreneur",
  "phonetic": "/ˌɒntrəprəˈnɜː/",
  "meanings": [{
    "partOfSpeech": "noun",
    "definitions": [{
      "definition": "A person who organizes and operates a business..."
    }]
  }]
}]
```

### OpenAI API（查词 / 对话）
```javascript
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an English teacher. Explain words simply.' },
      { role: 'user', content: 'Explain "leverage" in simple English, with an example.' }
    ]
  })
})
```

---

## 八、文件清单（需实现）

### 已生成框架（占位）
- ✅ `index.html`
- ✅ `package.json`
- ✅ `vite.config.js`
- ✅ `src/main.jsx`
- ✅ `src/App.jsx`
- ✅ `src/styles/global.css`
- ✅ `src/hooks/useStore.js`
- ✅ `src/components/Layout.jsx`
- ✅ `src/pages/*.jsx`（6个页面空壳）

### 待实现（按优先级）
1. `src/components/BookUploader.jsx` —— 文件上传 + 解析
2. `src/components/Reader.jsx` —— 阅读器核心
3. `src/components/WordTooltip.jsx` —— 查词弹窗
4. `src/hooks/useBookParser.js` —— 书籍解析逻辑
5. `src/hooks/useSpeech.js` —— Web Speech 封装
6. `src/hooks/useWordLookup.js` —— 查词 API 封装
7. `src/utils/bookParser.js` —— TXT/EPUB 解析工具
8. `src/utils/storage.js` —— 本地存储封装

---

*文档版本：v0.1 | 生成时间：2026-05-08*
