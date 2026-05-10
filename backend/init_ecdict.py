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
