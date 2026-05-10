FROM python:3.11

WORKDIR /app

# 使用国内 pip 镜像源并增加超时时间
COPY requirements.txt .
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip config set global.timeout 120 \
    && pip install --no-cache-dir -r requirements.txt

# 下载 NLTK 数据（WordNet + OMW + tagger）
RUN python -m nltk.downloader wordnet omw-1.4 averaged_perceptron_tagger

# 下载 ECDICT 离线英汉词典数据并转换为 SQLite
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -L -o ecdict.csv "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv" \
    && python3 -c "
import sqlite3, csv
conn = sqlite3.connect('ecdict.db')
cursor = conn.cursor()
cursor.execute('''
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
''')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_word ON ecdict(word)')
with open('ecdict.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = []
    for row in reader:
        rows.append((
            row.get('word', ''), row.get('phonetic', ''), row.get('definition', ''),
            row.get('translation', ''), row.get('pos', ''), row.get('collins', ''),
            row.get('oxford', ''), row.get('tag', ''), row.get('bnc', ''),
            row.get('frq', ''), row.get('exchange', ''), row.get('detail', ''), row.get('audio', '')
        ))
    cursor.executemany('INSERT OR REPLACE INTO ecdict VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', rows)
conn.commit()
conn.close()
print(f'ECDICT loaded: {len(rows)} entries')
    " \
    && rm -f ecdict.csv \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# 复制应用代码
COPY main.py ecdict_db.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
