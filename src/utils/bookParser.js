import JSZip from 'jszip'

/**
 * 书籍解析工具
 * 支持 TXT / EPUB 格式
 */

/**
 * 解析 TXT 文本为书籍结构
 * @param {string} text - 原始文本内容
 * @param {string} title - 书名（从文件名提取）
 * @returns {object} 书籍对象
 */
export function parseTXT(text, title = 'Untitled') {
  // 按空行分段，过滤空行和太短的段落
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\s+/g, ' '))
    .filter(p => p.length > 20)
    .map((text, id) => ({
      id,
      text,
      wordCount: text.split(/\s+/).length
    }))

  // 简单分章：每 50 个段落为一章
  const chapters = []
  const chapterSize = 50
  for (let i = 0; i < paragraphs.length; i += chapterSize) {
    const chapterParagraphs = paragraphs.slice(i, i + chapterSize)
    chapters.push({
      title: `Chapter ${Math.floor(i / chapterSize) + 1}`,
      paragraphs: chapterParagraphs.map((p, idx) => ({
        ...p,
        id: i + idx
      }))
    })
  }

  // 如果内容太少，全部作为一章
  if (chapters.length === 0 && paragraphs.length > 0) {
    chapters.push({
      title: 'Chapter 1',
      paragraphs
    })
  }

  const totalWords = paragraphs.reduce((sum, p) => sum + p.wordCount, 0)
  const uniqueWords = new Set(
    text.toLowerCase().match(/\b[a-z]+\b/g) || []
  ).size

  return {
    id: generateId(),
    title,
    author: 'Unknown',
    language: detectLanguage(text),
    chapters,
    totalWords,
    uniqueWords,
    importedAt: Date.now()
  }
}

/**
 * 解析 EPUB 文件为书籍结构
 * @param {ArrayBuffer} arrayBuffer - EPUB 文件的二进制数据
 * @param {string} title - 书名（从文件名提取，作为 fallback）
 * @returns {Promise<object>} 书籍对象
 */
export async function parseEPUB(arrayBuffer, title = 'Untitled') {
  const zip = await JSZip.loadAsync(arrayBuffer)

  // 1. 读取 container.xml，找到 content.opf 路径
  const containerXml = await zip.file('META-INF/container.xml')?.async('text')
  if (!containerXml) {
    throw new Error('无效的 EPUB 文件：缺少 META-INF/container.xml')
  }

  const opfPath = extractOpfPath(containerXml)
  if (!opfPath) {
    throw new Error('无效的 EPUB 文件：无法定位 content.opf')
  }

  // 2. 读取 content.opf
  const opfXml = await zip.file(opfPath)?.async('text')
  if (!opfXml) {
    throw new Error('无效的 EPUB 文件：无法读取 content.opf')
  }

  // 解析 opf：获取 spine（阅读顺序）和 manifest
  const { spineIds, manifest, metadata } = parseOpf(opfXml)
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  // 从 metadata 提取书名和作者
  const bookTitle = metadata.title || title
  const bookAuthor = metadata.author || 'Unknown'

  // 3. 按 spine 顺序读取 HTML/XHTML 内容并提取文本
  let fullText = ''
  const chapters = []

  for (const idref of spineIds) {
    const item = manifest[idref]
    if (!item) continue

    const filePath = opfDir + item.href
    const file = zip.file(filePath)
    if (!file) continue

    const htmlContent = await file.async('text')
    const text = extractTextFromHtml(htmlContent)

    if (text.length > 50) {
      // 将每个 HTML 文件作为一个章节
      const paragraphs = splitToParagraphs(text)
      if (paragraphs.length > 0) {
        chapters.push({
          title: item.href.replace(/\.xhtml?$/i, '').replace(/\.html?$/i, '').split('/').pop() || `Chapter ${chapters.length + 1}`,
          paragraphs: paragraphs.map((p, idx) => ({
            id: chapters.length * 10000 + idx,
            text: p,
            wordCount: p.split(/\s+/).length
          }))
        })
      }
      fullText += '\n\n' + text
    }
  }

  if (chapters.length === 0) {
    throw new Error('EPUB 解析失败：未能提取到有效文本内容')
  }

  // 如果章节太多（比如每页一章），合并为每 5 个原始章节一个大章
  const mergedChapters = mergeChapters(chapters, 5)

  const totalWords = mergedChapters.reduce(
    (sum, ch) => sum + ch.paragraphs.reduce((s, p) => s + p.wordCount, 0),
    0
  )
  const uniqueWords = new Set(
    fullText.toLowerCase().match(/\b[a-z]+\b/g) || []
  ).size

  return {
    id: generateId(),
    title: bookTitle,
    author: bookAuthor,
    language: detectLanguage(fullText),
    chapters: mergedChapters,
    totalWords,
    uniqueWords,
    importedAt: Date.now()
  }
}

/**
 * 从 container.xml 中提取 content.opf 路径
 */
function extractOpfPath(containerXml) {
  // 简单正则匹配 rootfile 的 full-path
  const match = containerXml.match(/full-path=["']([^"']+)["']/i)
  return match ? match[1] : null
}

/**
 * 解析 content.opf XML
 * 返回 spine 顺序、manifest 映射、metadata
 */
function parseOpf(opfXml) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(opfXml, 'application/xml')

  // manifest: id -> { href, media-type }
  const manifest = {}
  const manifestItems = doc.querySelectorAll('manifest item')
  manifestItems.forEach(item => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    const mediaType = item.getAttribute('media-type')
    if (id && href) {
      manifest[id] = { href, mediaType }
    }
  })

  // spine: 阅读顺序的 idref 列表（只取文本内容）
  const spineIds = []
  const spineItems = doc.querySelectorAll('spine itemref')
  spineItems.forEach(item => {
    const idref = item.getAttribute('idref')
    if (idref && manifest[idref]) {
      const mt = manifest[idref].mediaType || ''
      // 只取 HTML/XHTML 文本内容，跳过图片等
      if (mt.includes('html') || mt.includes('xhtml') || hrefLooksLikeHtml(manifest[idref].href)) {
        spineIds.push(idref)
      }
    }
  })

  // metadata
  const metadata = {}
  const titleEl = doc.querySelector('metadata title')
  if (titleEl) metadata.title = titleEl.textContent?.trim()
  const creatorEl = doc.querySelector('metadata creator')
  if (creatorEl) metadata.author = creatorEl.textContent?.trim()

  // 如果上面没匹配到，尝试用 namespace 或更通用的选择器
  if (!metadata.title) {
    const anyTitle = doc.querySelector('title')
    if (anyTitle) metadata.title = anyTitle.textContent?.trim()
  }
  if (!metadata.author) {
    const anyCreator = doc.querySelector('creator')
    if (anyCreator) metadata.author = anyCreator.textContent?.trim()
  }

  return { spineIds, manifest, metadata }
}

function hrefLooksLikeHtml(href) {
  return /\.(x?html?)$/i.test(href)
}

/**
 * 从 HTML 中提取纯文本
 */
function extractTextFromHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 移除 script/style 标签
  doc.querySelectorAll('script, style, nav').forEach(el => el.remove())

  // 获取 body 文本
  const body = doc.body
  if (!body) return ''

  // 将块级元素前后加换行
  const blockElements = body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, br')
  blockElements.forEach(el => {
    el.insertAdjacentText('beforebegin', '\n')
    el.insertAdjacentText('afterend', '\n')
  })

  let text = body.textContent || ''

  // 清理多余空白
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

/**
 * 将长文本分段
 */
function splitToParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\s+/g, ' '))
    .filter(p => p.length > 20)
}

/**
 * 合并章节（将每 N 个原始章节合并为一个大章节）
 */
function mergeChapters(chapters, batchSize) {
  if (chapters.length <= batchSize) return chapters

  const merged = []
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize)
    const allParagraphs = batch.flatMap((ch, idx) =>
      ch.paragraphs.map(p => ({
        ...p,
        id: i * 10000 + idx * 1000 + p.id % 10000
      }))
    )
    merged.push({
      title: batch[0].title + (batch.length > 1 ? ` +${batch.length - 1}` : ''),
      paragraphs: allParagraphs
    })
  }
  return merged
}

/**
 * 从 File 对象读取文本
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}

/**
 * 从 File 对象读取 ArrayBuffer
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 检测文本语言（简单判断）
 */
function detectLanguage(text) {
  const sample = text.slice(0, 500)
  // 简单判断：如果有较多英文单词则认为是英文
  const englishWords = sample.match(/\b[a-zA-Z]+\b/g) || []
  const ratio = englishWords.length / Math.max(sample.split(/\s+/).length, 1)
  return ratio > 0.5 ? 'en' : 'zh'
}

/**
 * 生成唯一 ID
 */
function generateId() {
  return 'book_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
}
