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
COPY init_ecdict.py .
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -L -o ecdict.csv "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv" \
    && python3 init_ecdict.py \
    && rm -f ecdict.csv init_ecdict.py \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# 复制应用代码
COPY main.py ecdict_db.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
