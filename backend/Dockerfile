FROM python:3.11

WORKDIR /app

# 使用国内 pip 镜像源并增加超时时间
COPY requirements.txt .
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip config set global.timeout 120 \
    && pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
