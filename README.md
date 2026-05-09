# 📚 BookSpeak

> 通过阅读一本书学英语——阅读、词汇、口语三位一体

## 这是什么

BookSpeak 是一个**开源的英语学习工具**，核心理念：

**拿一本你真正想读的书（比如《纳瓦尔宝典》英文版），一页一页读下去，读完这本书，英语也提升了。**

不是背单词表，不是刷题，而是**用阅读驱动学习**。

## 核心功能

| 功能 | 说明 |
|------|------|
| 📖 **滚动阅读** | 支持 TXT / EPUB，自动分段分章，按屏幕滚动阅读 |
| 🌐 **中英对照** | 一键开启翻译，原文右侧并排显示中文 |
| 📝 **点击查词** | 点任意单词，弹出英文释义 + 中文翻译 + Edge TTS 发音 |
| 🔗 **连环查词** | 释义里的单词也能点击继续查，支持面包屑返回 |
| 🎯 **生词本** | 标记生词，书中重复出现时高亮提醒，支持复习和 Anki 导出 |
| 🔖 **书签定位** | 手动标记阅读位置，方便下次快速定位 |
| 🎤 **朗读评估** | 朗读段落，AI 三维评分（准确度/完整度/流畅度） |
| 💬 **AI 口语对话** | 基于书中内容提问，用英语回答，AI 评分 + 语法纠正 |
| 📊 **进度追踪** | 30 天打卡热力图、词汇增长、口语评分趋势、学习报告 |

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + Vite v4 + React Router + Zustand |
| **状态持久化** | localStorage（轻量数据）+ IndexedDB（书籍原文/录音） |
| **语音合成** | Python `edge-tts` + FastAPI 后端 |
| **语音识别** | Web Speech API（浏览器原生） |
| **翻译** | Google 免费翻译（`deep-translator`，后端代理，无需 API Key） |
| **查词** | DictionaryAPI.dev + Google 翻译 |
| **部署** | Docker Compose + Nginx |

## 项目结构

```
bookspeak/
├── backend/                 # Python FastAPI 后端
│   ├── main.py              # TTS + 翻译 + 查词接口
│   ├── requirements.txt     # Python 依赖
│   └── Dockerfile           # 后端容器镜像
├── src/                     # React 前端源码
│   ├── components/          # 可复用组件（Reader、WordTooltip...）
│   ├── hooks/               # Zustand Store + 自定义 Hooks
│   ├── pages/               # 页面（Home、Reader、Vocab、Speak、Progress、Settings）
│   ├── utils/               # 书籍解析、storage、indexedDB
│   └── styles/              # 全局 CSS
├── docs/
│   └── ARCHITECTURE.md      # 架构文档
├── docker-compose.yml       # 生产部署配置
├── Dockerfile.frontend      # 前端多阶段构建（Node → Nginx）
├── nginx.conf               # Nginx 反向代理配置
├── package.json
├── vite.config.js
└── README.md
```

---

## 🚀 快速开始（开发模式）

### 1. 启动前端

```bash
# 安装依赖
npm install

# 启动开发服务器（自带 API 代理到 localhost:8000）
npm run dev

# 前端运行在 http://localhost:3000
```

### 2. 启动后端

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py

# 后端运行在 http://localhost:8000
```

### 3. 浏览器访问

打开 http://localhost:3000，导入一本书即可开始阅读。

> 翻译、查词、TTS 全部走后端代理，**无需配置任何 API Key**。
> 如需使用 AI 口语对话功能，可在「设置」中配置 OpenAI API Key（可选）。

---

## 🐳 生产部署（Docker Compose 一键启动）

### 前置要求

- Docker + Docker Compose
- 服务器至少有 1GB 内存（edge-tts 运行时需要）

### 部署步骤

```bash
# 1. 克隆代码到服务器
git clone <你的仓库地址> bookspeak
cd bookspeak

# 2. 一键构建并启动（前端自动编译 + 后端自动安装依赖）
docker-compose up -d --build

# 3. 查看运行状态
docker-compose ps

# 4. 访问应用
# 浏览器打开服务器 IP 或域名即可（默认 80 端口）
```

### 常用命令

```bash
# 查看日志
docker-compose logs -f

# 单独查看后端日志
docker-compose logs -f backend

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新代码后重新构建
git pull
docker-compose up -d --build
```

---

## 🦾 用 KimiClaw 部署（推荐）

KimiClaw 可以帮你自动完成服务器配置、代码拉取、Docker 部署。只需提供以下信息：

### 1. 给 KimiClaw 的部署指令

```
请帮我将 BookSpeak 部署到这台服务器上。

项目信息：
- 仓库地址：https://github.com/2565984265/bookspeak.git
- 部署方式：Docker Compose
- 需要暴露的端口：80（HTTP）
- 数据存储：全部在浏览器本地，服务器无持久化数据

部署步骤：
1. git clone 仓库
2. cd bookspeak
3. docker-compose up -d --build
4. 确认容器运行正常

如果 80 端口被占用，请改用 8080 或其他端口，并告诉我访问地址。
```

### 2. 部署完成后验证

```bash
# 检查容器状态
docker-compose ps

# 应该看到两个容器都在运行：
# - bookspeak-backend   Up
# - bookspeak-frontend  Up

# 测试后端 API
curl http://localhost/
# 期望返回：{"service": "BookSpeak", "version": "0.3.0", ...}

# 测试翻译
curl -X POST http://localhost/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world", "source": "auto", "target": "zh-CN"}'
# 期望返回：{"TargetText": "你好世界"}
```

### 3. 域名配置（可选）

如果有域名，让 KimiClaw 帮你配置 Nginx 反向代理或 Caddy：

```
另外请帮我配置域名 bookspeak.example.com 指向这个服务，并开启 HTTPS。
```

---

## ⚙️ 配置说明

### 前端设置（浏览器内）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| **后端地址** | `''`（空） | 空 = 同域部署（生产推荐）。本地开发可填 `http://localhost:8000` |
| **OpenAI Key** | `''` | AI 口语对话可选，不填则该功能不可用 |
| **主题** | `light` | 浅色/深色 |

> 翻译、查词、TTS **不再需要任何腾讯云密钥**，全部走后端免费服务。

### 后端环境变量

后端目前不需要任何环境变量。翻译使用 Google 免费接口（通过 `deep-translator`），TTS 使用 `edge-tts`（无需 API Key）。

---

## 💾 数据存储架构

**所有用户数据都在浏览器端**，后端不保存任何持久化数据。

| 存储位置 | 数据内容 | 大小 |
|----------|---------|------|
| **localStorage** | 书籍列表、阅读进度、词汇、书签、设置、查词缓存、翻译缓存 | 几百 KB ~ 几 MB |
| **IndexedDB** | 书籍完整原文（chapters/paragraphs）、录音 Blob | 几 MB ~ 几十 MB |
| **后端内存** | 翻译结果缓存（进程重启清空） | 无持久化 |

**换电脑/清浏览器数据 = 数据丢失**。建议定期在「设置」→「导出数据」备份。

---

## 🔌 后端 API

```
GET  /              # 服务状态
GET  /voices       # 可用语音列表
POST /tts          # 文本转语音（返回 MP3 流）
POST /translate    # 文本翻译（Google 免费）
GET  /dict         # 查词：英文释义 + 中文翻译
```

### POST /tts

```json
{
  "text": "Seek wealth, not money or status.",
  "voice": "en-US-AriaNeural",
  "rate": "+0%",
  "pitch": "+0Hz",
  "volume": "+0%"
}
```

返回：`audio/mpeg` 音频流

### POST /translate

```json
{
  "text": "Hello world",
  "source": "auto",
  "target": "zh-CN"
}
```

返回：
```json
{
  "TargetText": "你好世界",
  "SourceText": "Hello world",
  "Source": "auto",
  "Target": "zh-CN"
}
```

### GET /dict

```bash
curl "http://localhost/dict?word=seek"
```

返回：单词音标、音频、英文释义（含中文翻译）

---

## 🗺️ 开发路线图

| 版本 | 目标 | 状态 |
|------|------|------|
| v0.1 | TXT/EPUB 上传、分段阅读、查词、TTS、生词本 | ✅ 已完成 |
| v0.2 | 单词高亮、复习模式、Anki 导出 | ✅ 已完成 |
| v0.3 | 朗读评估、AI 口语对话 | ✅ 已完成 |
| v0.4 | 滚动阅读、书签、翻译对照、IndexedDB、进度图表 | ✅ 已完成 |
| v1.0 | 用户系统、云端同步、主题系统、PWA | 📋 待开发 |

---

## ❓ 常见问题

**Q: 部署后翻译功能报错？**
A: 检查后端容器是否正常运行：`docker-compose logs -f backend`。Google 翻译偶尔会因网络波动失败，后端会自动重试。

**Q: 如何备份我的学习数据？**
A: 浏览器端「设置」→「导出数据」，会下载一个 JSON 备份文件。换电脑后可在同一位置导入。

**Q: 支持哪些书籍格式？**
A: 目前支持 `.txt` 和 `.epub`。`.pdf` 和 `.mobi` 后续版本支持。

**Q: 服务器需要多少配置？**
A: 最低 1 核 1GB 内存即可。edge-tts 运行时占用约 200MB 内存，无并发时几乎不占用 CPU。

---

## 📄 License

MIT —— 自由使用、修改、分发。

---

*Made with ❤️ by a programmer exploring English, AI, and independent development.*
