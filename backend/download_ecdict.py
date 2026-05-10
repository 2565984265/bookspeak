#!/usr/bin/env python3
"""
下载 ECDICT 离线英汉词典数据并转换为 SQLite。
本地开发时运行一次即可：python download_ecdict.py
"""

import os
import sqlite3
import csv
import urllib.request

ECDICT_CSV_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
ECDICT_CSV_PATH = "ecdict.csv"
ECDICT_DB_PATH = "ecdict.db"


def download():
    print(f"Downloading ECDICT from {ECDICT_CSV_URL} ...")
    urllib.request.urlretrieve(ECDICT_CSV_URL, ECDICT_CSV_PATH)
    size_mb = os.path.getsize(ECDICT_CSV_PATH) / 1024 / 1024
    print(f"Downloaded: {ECDICT_CSV_PATH} ({size_mb:.1f} MB)")


def convert():
    print("Converting CSV to SQLite ...")
    conn = sqlite3.connect(ECDICT_DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS ecdict (
            word TEXT PRIMARY KEY,
            phonetic TEXT,
            definition TEXT,
            translation TEXT,
            pos TEXT,
            collins TEXT,
            oxford TEXT,
            tag TEXT,
            bnc TEXT,
            frq TEXT,
            exchange TEXT,
            detail TEXT,
            audio TEXT
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_word ON ecdict(word)")

    with open(ECDICT_CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append(
                (
                    row.get("word", ""),
                    row.get("phonetic", ""),
                    row.get("definition", ""),
                    row.get("translation", ""),
                    row.get("pos", ""),
                    row.get("collins", ""),
                    row.get("oxford", ""),
                    row.get("tag", ""),
                    row.get("bnc", ""),
                    row.get("frq", ""),
                    row.get("exchange", ""),
                    row.get("detail", ""),
                    row.get("audio", ""),
                )
            )
        cursor.executemany(
            "INSERT OR REPLACE INTO ecdict VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows
        )
        print(f"Inserted {len(rows)} entries")

    conn.commit()
    conn.close()
    db_size_mb = os.path.getsize(ECDICT_DB_PATH) / 1024 / 1024
    print(f"SQLite created: {ECDICT_DB_PATH} ({db_size_mb:.1f} MB)")


def cleanup():
    if os.path.exists(ECDICT_CSV_PATH):
        os.remove(ECDICT_CSV_PATH)
        print(f"Removed: {ECDICT_CSV_PATH}")


if __name__ == "__main__":
    if os.path.exists(ECDICT_DB_PATH):
        print(f"{ECDICT_DB_PATH} already exists. Skip download.")
        print("Run 'rm ecdict.db' to force re-download.")
    else:
        download()
        convert()
        cleanup()
        print("Done! ECDICT is ready for offline use.")
