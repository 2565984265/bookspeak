FROM python:3.11

WORKDIR /app

# 安装 Python 依赖（完整版镜像已包含 gcc，无需额外安装）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
