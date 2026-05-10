"""
ECDICT 离线英汉词典查询模块
数据来源: https://github.com/skywind3000/ECDICT (MIT License)
"""

import os
import re
import sqlite3
from typing import Optional, List, Dict, Any

# ECDICT SQLite 数据库路径（支持开发和 Docker 环境）
_ECDICT_PATHS = [
    os.path.join(os.path.dirname(__file__), "ecdict.db"),
    "/usr/local/share/ecdict.db",
    "/usr/share/ecdict.db",
]

_ecdict_conn: Optional[sqlite3.Connection] = None


def _find_db_path() -> Optional[str]:
    for p in _ECDICT_PATHS:
        if os.path.exists(p):
            return p
    return None


def get_ecdict_conn() -> Optional[sqlite3.Connection]:
    """获取 ECDICT 数据库连接（懒加载）"""
    global _ecdict_conn
    if _ecdict_conn is None:
        db_path = _find_db_path()
        if db_path:
            _ecdict_conn = sqlite3.connect(db_path, check_same_thread=False)
            _ecdict_conn.row_factory = sqlite3.Row
    return _ecdict_conn


def is_ecdict_available() -> bool:
    return get_ecdict_conn() is not None


def _parse_pos(pos_str: str) -> List[Dict[str, Any]]:
    """
    解析 pos 字段，如 'v:86/n:14' -> [{'pos': 'v', 'ratio': 86}, ...]
    """
    if not pos_str:
        return []
    parts = []
    for part in pos_str.split("/"):
        if ":" in part:
            p, ratio = part.split(":", 1)
            try:
                parts.append({"pos": p.strip(), "ratio": int(ratio)})
            except ValueError:
                parts.append({"pos": p.strip(), "ratio": 0})
        else:
            parts.append({"pos": part.strip(), "ratio": 0})
    # 按比例降序
    parts.sort(key=lambda x: x["ratio"], reverse=True)
    return parts


_POS_MAP = {
    "n": "noun",
    "v": "verb",
    "a": "adjective",
    "r": "adverb",
    "s": "adjective",
    "j": "adjective",
    "d": "adverb",
    "u": "auxiliary",
    "c": "conjunction",
    "p": "preposition",
    "i": "interjection",
    "m": "numeral",
    "x": "other",
}


def _map_pos(pos_code: str) -> str:
    return _POS_MAP.get(pos_code.lower(), pos_code.lower())


def _parse_translation(translation: str) -> List[Dict[str, Any]]:
    """
    解析 ECDICT 的 translation 字段：
    "vt. 放弃, 抛弃, 遗弃, 使屈从, 沉溺, 放纵\nn. 放任, 狂热"
    -> [{"partOfSpeech": "verb", "definitions": [{"definitionZh": "放弃, 抛弃..."}]}]
    """
    if not translation:
        return []

    result = []
    # 按行分割，每行是一个词性的释义
    for line in translation.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        # 尝试匹配词性前缀，如 "vt.", "n.", "adj.", "adv.", "vi.", "prep.", "conj." 等
        m = re.match(r"^(\w+\.)\s*(.+)$", line)
        if m:
            pos_abbr = m.group(1).rstrip(".")  # "vt" -> "v"
            defs = m.group(2).strip()
            # 简化词性代码
            pos_code = pos_abbr[:1].lower()
            result.append({
                "partOfSpeech": _map_pos(pos_code),
                "definitions": [{"definition": "", "example": "", "definitionZh": defs}],
            })
        else:
            # 没有词性前缀，直接作为释义
            result.append({
                "partOfSpeech": "definition",
                "definitions": [{"definition": "", "example": "", "definitionZh": line}],
            })
    return result


def lookup(word: str) -> Optional[Dict[str, Any]]:
    """
    查询 ECDICT 词典。
    返回: {"word": ..., "phonetic": ..., "meanings": [...], "translation": ..., "source": "ecdict"}
    """
    conn = get_ecdict_conn()
    if not conn:
        return None

    word_lower = word.lower().strip()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT word, phonetic, definition, translation, pos FROM ecdict WHERE word = ?",
        (word_lower,),
    )
    row = cursor.fetchone()
    if not row:
        return None

    # 构建音标（ECDICT 已经是 IPA，加斜杠）
    phonetic = row["phonetic"] or ""
    if phonetic and not phonetic.startswith("/"):
        phonetic = "/" + phonetic + "/"

    # 解析中文释义
    meanings = _parse_translation(row["translation"] or "")

    return {
        "word": row["word"],
        "phonetic": phonetic,
        "audio": "",
        "meanings": meanings,
        "chineseTranslation": row["translation"] or "",
        "source": "ecdict",
    }


def lookup_fuzzy(word: str) -> Optional[Dict[str, Any]]:
    """
    模糊查询：先精确匹配，再尝试词形还原（去掉复数/过去式等）
    """
    result = lookup(word)
    if result:
        return result

    # 尝试一些简单的词形变化
    variants = []
    w = word.lower().strip()

    # 复数 -> 单数
    if w.endswith("ies"):
        variants.append(w[:-3] + "y")
    elif w.endswith("es"):
        variants.append(w[:-2])
        variants.append(w[:-1])
    elif w.endswith("s"):
        variants.append(w[:-1])

    # 过去式/过去分词 -> 原形
    if w.endswith("ied"):
        variants.append(w[:-3] + "y")
    elif w.endswith("ed"):
        variants.append(w[:-2])
        variants.append(w[:-1])

    # 现在分词 -> 原形
    if w.endswith("ying"):
        variants.append(w[:-3] + "ie")
    elif w.endswith("ing"):
        variants.append(w[:-3])
        variants.append(w[:-3] + "e")

    for v in variants:
        result = lookup(v)
        if result:
            return result

    return None
