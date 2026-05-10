"""
BookSpeak Backend
提供 Edge TTS + 离线英汉词典服务
"""

import asyncio
import io
import os
import time
import hmac
import hashlib
import json as json_mod
import re
from datetime import datetime, timezone
from typing import Optional

import edge_tts
import httpx
from deep_translator import GoogleTranslator
import pronouncing
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import ecdict_db

# ========== NLTK / WordNet 离线词典 ==========
# 设置 NLTK 数据路径（支持开发和 Docker 环境）
NLTK_DATA_PATHS = [
    os.path.join(os.path.dirname(__file__), 'nltk_data'),
    '/usr/local/share/nltk_data',
    '/usr/share/nltk_data',
]
for p in NLTK_DATA_PATHS:
    if os.path.exists(p):
        os.environ['NLTK_DATA'] = p
        break

from nltk.corpus import wordnet as wn
from nltk.stem import WordNetLemmatizer

_wordnet_lemmatizer = None

def get_lemmatizer():
    global _wordnet_lemmatizer
    if _wordnet_lemmatizer is None:
        _wordnet_lemmatizer = WordNetLemmatizer()
    return _wordnet_lemmatizer


_POS_MAP = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 'r': 'adverb', 's': 'adjective'}


def get_wordnet_synsets(word: str):
    """查询 WordNet，支持词形还原。返回 synsets 列表。"""
    synsets = wn.synsets(word)
    if not synsets:
        lemmatizer = get_lemmatizer()
        # 只对动词和名词尝试还原（最常见）
        for pos in [wn.VERB, wn.NOUN]:
            lemma = lemmatizer.lemmatize(word, pos=pos)
            if lemma != word:
                synsets = wn.synsets(lemma)
                if synsets:
                    break
    return synsets


def build_wordnet_meanings(synsets, max_total=8, max_per_pos=3):
    """
    将 WordNet synsets 组织成前端期望的结构。
    max_total: 最多取多少个 synset
    max_per_pos: 每个词性最多取多少个 definition
    """
    synsets = synsets[:max_total]
    grouped = {}
    for ss in synsets:
        pos = _POS_MAP.get(ss.pos(), ss.pos())
        if pos not in grouped:
            grouped[pos] = []
        defs = grouped[pos]
        if len(defs) < max_per_pos:
            defs.append({
                "definition": ss.definition(),
                "example": ss.examples()[0] if ss.examples() else "",
                "definitionZh": ""
            })
    return [{"partOfSpeech": pos, "definitions": defs} for pos, defs in grouped.items()]

app = FastAPI(
    title="BookSpeak Backend",
    description="Edge TTS + 离线英汉词典",
    version="0.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== 语音列表 ==========
AVAILABLE_VOICES = {
    "en-US-AriaNeural": "Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)",
    "en-US-GuyNeural": "Microsoft Server Speech Text to Speech Voice (en-US, GuyNeural)",
    "en-US-JennyNeural": "Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)",
    "en-GB-SoniaNeural": "Microsoft Server Speech Text to Speech Voice (en-GB, SoniaNeural)",
    "en-GB-RyanNeural": "Microsoft Server Speech Text to Speech Voice (en-GB, RyanNeural)",
    "en-AU-NatashaNeural": "Microsoft Server Speech Text to Speech Voice (en-AU, NatashaNeural)",
    "en-CA-ClaraNeural": "Microsoft Server Speech Text to Speech Voice (en-CA, ClaraNeural)",
}

# ========== 翻译缓存（内存级，进程重启清空）==========
TRANSLATION_CACHE = {}

# 全局 GoogleTranslator 实例（复用连接）
_google_translator = None

def get_translator():
    global _google_translator
    if _google_translator is None:
        _google_translator = GoogleTranslator(source="en", target="zh-CN")
    return _google_translator


# ARPAbet 音素 → IPA 近似映射
_ARPABET_TO_IPA = {
    'AA': 'ɑ', 'AE': 'æ', 'AH': 'ə', 'AO': 'ɔ', 'AW': 'aʊ',
    'AY': 'aɪ', 'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð',
    'EH': 'ɛ', 'ER': 'ɚ', 'EY': 'eɪ', 'F': 'f', 'G': 'g',
    'HH': 'h', 'IH': 'ɪ', 'IY': 'i', 'JH': 'dʒ', 'K': 'k',
    'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'OW': 'oʊ',
    'OY': 'ɔɪ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ',
    'T': 't', 'TH': 'θ', 'UH': 'ʊ', 'UW': 'u', 'V': 'v',
    'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': 'ʒ'
}

def arpabet_to_ipa(phones: str) -> str:
    """将 ARPAbet 音标字符串转为近似 IPA"""
    tokens = phones.split()
    result = ""
    for t in tokens:
        base = t.rstrip('012')  # 去掉重音标记
        result += _ARPABET_TO_IPA.get(base, base)
    return result


def get_word_phonetic(word: str) -> str:
    """用 pronouncing 库获取音标（IPA 近似）"""
    phones_list = pronouncing.phones_for_word(word)
    if phones_list:
        return "/" + arpabet_to_ipa(phones_list[0]) + "/"
    return ""

def cache_key(text: str, source: str, target: str) -> str:
    return hashlib.md5(f"{text}:{source}:{target}".encode("utf-8")).hexdigest()


def get_cached_translation(text: str, source: str, target: str) -> Optional[str]:
    key = cache_key(text, source, target)
    return TRANSLATION_CACHE.get(key)


def set_cached_translation(text: str, source: str, target: str, result: str):
    key = cache_key(text, source, target)
    TRANSLATION_CACHE[key] = result


async def google_translate_text(text: str, source="auto", target="zh-CN") -> str:
    """调用 Google 免费翻译，带缓存。在线程池中执行避免阻塞事件循环。"""
    if not text or not text.strip():
        return ""
    
    # 1. 查缓存
    cached = get_cached_translation(text, source, target)
    if cached is not None:
        return cached
    
    # 2. 在线程池中调用 Google 翻译（避免阻塞 FastAPI 事件循环）
    try:
        translator = get_translator()
        result = await asyncio.to_thread(translator.translate, text.strip())
        set_cached_translation(text, source, target, result)
        return result
    except Exception as e:
        print(f"[翻译失败] {e}")
        return ""

# ========== Pydantic 模型 ==========
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = Field(default="en-US-AriaNeural")
    rate: str = Field(default="+0%")
    pitch: str = Field(default="+0Hz")
    volume: str = Field(default="+0%")


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=3000, description="要翻译的文本")
    source: str = Field(default="auto", description="源语言")
    target: str = Field(default="zh-CN", description="目标语言")


class DictLookupRequest(BaseModel):
    word: str = Field(..., min_length=1, description="要查词的英文单词")


# ========== 接口 ==========
@app.get("/")
def root():
    return {"service": "BookSpeak", "version": "0.3.0", "features": ["tts", "translate", "dict"], "translate_engine": "google_free", "dict_engine": "ecdict"}


@app.get("/voices")
def list_voices():
    return {
        "voices": [
            {"name": k, "display": v, "locale": k.split("-")[0] + "-" + k.split("-")[1]}
            for k, v in AVAILABLE_VOICES.items()
        ]
    }


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    if req.voice not in AVAILABLE_VOICES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的语音: {req.voice}"
        )
    try:
        communicate = edge_tts.Communicate(req.text, req.voice, rate=req.rate, pitch=req.pitch, volume=req.volume)
        output = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                output.write(chunk["data"])
        output.seek(0)
        if output.getbuffer().nbytes == 0:
            raise HTTPException(status_code=500, detail="TTS 返回空音频")
        return StreamingResponse(output, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 失败: {str(e)}")


@app.get("/tts")
async def tts_get(
    text: str,
    voice: str = "en-US-AriaNeural",
    rate: str = "+0%",
    pitch: str = "+0Hz",
    volume: str = "+0%"
):
    return await text_to_speech(TTSRequest(text=text, voice=voice, rate=rate, pitch=pitch, volume=volume))


@app.post("/translate")
async def translate(req: TranslateRequest):
    """Google 免费翻译代理（带缓存）"""
    try:
        result = await google_translate_text(req.text, req.source, req.target)
        if not result:
            raise HTTPException(status_code=500, detail="翻译返回空结果")
        return {"TargetText": result, "SourceText": req.text, "Source": req.source, "Target": req.target}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"翻译请求失败: {str(e)}")

@app.post("/dict")
async def dict_lookup(req: DictLookupRequest):
    """
    查词接口：优先 ECDICT 离线英汉词典，未命中时 fallback 到 WordNet + pronouncing
    全程零外部网络请求
    """
    word = req.word.lower().strip()

    # 1. 优先 ECDICT 离线英汉词典（76万词条，0.01ms 查询）
    result = ecdict_db.lookup_fuzzy(word)
    if result:
        # ECDICT 已有音标，无需 pronouncing fallback
        return result

    # 2. ECDICT 未命中，fallback 到 WordNet + pronouncing
    synsets = get_wordnet_synsets(word)
    meanings = build_wordnet_meanings(synsets)
    phonetic = get_word_phonetic(word)

    return {
        "word": word,
        "phonetic": phonetic,
        "audio": "",
        "meanings": meanings,
        "chineseTranslation": "",
        "source": "wordnet"
    }


@app.get("/dict")
async def dict_lookup_get(word: str):
    return await dict_lookup(DictLookupRequest(word=word))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
