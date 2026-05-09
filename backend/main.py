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
from deep_translator import GoogleTranslator
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
    查词接口：调用免费词典 API + Google 翻译（单词+释义）
    返回合并后的单词信息
    """
    word = req.word.lower().strip()

    # 1. 免费词典 API
    dict_data = None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}")
            if resp.status_code == 200:
                dict_data = resp.json()
    except Exception:
        pass

    # 2. 组装英文释义结构
    result = {
        "word": word,
        "phonetic": "",
        "audio": "",
        "meanings": [],
        "chineseTranslation": "",
        "source": "dict"
    }

    if dict_data and len(dict_data) > 0:
        entry = dict_data[0]
        result["word"] = entry.get("word", word)
        result["phonetic"] = entry.get("phonetic", "")
        if not result["phonetic"] and entry.get("phonetics"):
            for p in entry["phonetics"]:
                if p.get("text"):
                    result["phonetic"] = p["text"]
                    break
        if entry.get("phonetics"):
            for p in entry["phonetics"]:
                if p.get("audio"):
                    result["audio"] = p["audio"]
                    break
        if entry.get("meanings"):
            result["meanings"] = [
                {
                    "partOfSpeech": m.get("partOfSpeech", ""),
                    "definitions": [
                        {"definition": d.get("definition", ""), "example": d.get("example", ""), "definitionZh": ""}
                        for d in m.get("definitions", [])[:3]
                    ]
                }
                for m in entry["meanings"]
            ]

    # 3. Google 翻译：单词 + 所有释义 definition，拼接成一段一次性翻译
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
