FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（编译相关）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY main.py .

EXPOSE 8000

# 生产环境用 gunicorn + uvicorn workers，开发直接用 uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
