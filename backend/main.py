"""
BookSpeak Backend
提供 Edge TTS + Google 免费翻译服务
"""

import io
import time
import hmac
import hashlib
import json as json_mod
from datetime import datetime, timezone
from typing import Optional

import edge_tts
import httpx
import re
from deep_translator import GoogleTranslator
from PyMultiDictionary import MultiDictionary
import pronouncing
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="BookSpeak Backend",
    description="Edge TTS + Google 免费翻译",
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


# 全局离线词典实例
_offline_dict = None

def get_offline_dict():
    global _offline_dict
    if _offline_dict is None:
        _offline_dict = MultiDictionary()
    return _offline_dict


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


def parse_offline_meanings(word: str, meaning_result) -> list:
    """
    解析 PyMultiDictionary 的 meaning 结果，提取结构化 definition。
    返回: [{"partOfSpeech": "verb", "definitions": [{"definition": "...", "example": "", "definitionZh": ""}]}]
    """
    parts_of_speech, definitions_text, _ = meaning_result
    
    if not definitions_text or len(definitions_text) < 10:
        return []
    
    # 按句号分割
    raw_sentences = [s.strip() for s in definitions_text.split('.') if s.strip()]
    
    # 去掉模板前缀
    patterns = [
        rf"The first definition of {re.escape(word)} in the dictionary is\s*",
        rf"Other definition of {re.escape(word)} is\s*",
        rf"{re.escape(word)} is also\s*",
        rf"The definition of {re.escape(word)} in the dictionary is\s*",
    ]
    
    definitions = []
    for sentence in raw_sentences:
        clean = sentence
        for p in patterns:
            clean = re.sub(p, "", clean, flags=re.IGNORECASE)
        clean = clean.strip(" ;")
        if clean and len(clean) > 3:
            definitions.append({"definition": clean, "example": "", "definitionZh": ""})
    
    if not definitions:
        return []
    
    # 按词性组织（PyMultiDictionary 可能返回多个词性，但释义是混在一起的）
    # 简单处理：取第一个词性，所有 definition 放在下面
    pos = parts_of_speech[0].lower() if parts_of_speech else "definition"
    return [{
        "partOfSpeech": pos,
        "definitions": definitions[:3]
    }]


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
    """调用 Google 免费翻译，带缓存"""
    if not text or not text.strip():
        return ""
    
    # 1. 查缓存
    cached = get_cached_translation(text, source, target)
    if cached is not None:
        return cached
    
    # 2. 调用 Google 翻译
    try:
        translator = get_translator()
        result = translator.translate(text.strip())
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
    return {"service": "BookSpeak", "version": "0.3.0", "features": ["tts", "translate", "dict"], "translate_engine": "google_free"}


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
    查词接口：PyMultiDictionary 离线词典 + pronouncing 音标 + Google 翻译
    无需外部网络请求（除首次 Google 翻译外，有缓存）
    """
    word = req.word.lower().strip()

    # 1. 离线查词（PyMultiDictionary）
    offline_dict = get_offline_dict()
    meaning_result = offline_dict.meaning('en', word)
    meanings = parse_offline_meanings(word, meaning_result)
    
    # 2. 音标（pronouncing）
    phonetic = get_word_phonetic(word)
    
    # 3. 组装结果
    result = {
        "word": word,
        "phonetic": phonetic,
        "audio": "",  # 离线库不提供音频，前端可 fallback 到 edge-tts 朗读单词
        "meanings": meanings,
        "chineseTranslation": "",
        "source": "offline"
    }

    # 4. Google 翻译：单词 + 所有释义 definition，拼接成一段一次性翻译
    texts_to_translate = [word]
    definition_positions = []

    for mi, m in enumerate(result["meanings"]):
        for di, d in enumerate(m["definitions"]):
            if d.get("definition", "").strip():
                texts_to_translate.append(d["definition"])
                definition_positions.append((mi, di))

    if len(texts_to_translate) > 1:
        combined_text = "\n".join(texts_to_translate)
        translated_combined = await google_translate_text(combined_text, "en", "zh-CN")

        if translated_combined:
            translated_lines = translated_combined.split("\n")
            if len(translated_lines) > 0:
                result["chineseTranslation"] = translated_lines[0].strip()
            for idx, (mi, di) in enumerate(definition_positions):
                line_idx = idx + 1
                if line_idx < len(translated_lines):
                    result["meanings"][mi]["definitions"][di]["definitionZh"] = translated_lines[line_idx].strip()
    else:
        result["chineseTranslation"] = await google_translate_text(word, "en", "zh-CN")

    if not result["meanings"] and result["chineseTranslation"]:
        result["source"] = "google"
    elif not result["meanings"]:
        result["source"] = "fallback"

    return result


@app.get("/dict")
async def dict_lookup_get(word: str):
    return await dict_lookup(DictLookupRequest(word=word))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
