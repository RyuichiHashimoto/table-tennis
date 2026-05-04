# syntax=docker/dockerfile:1.6
FROM python:3.12-slim

# 基本設定
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STREAMLIT_SERVER_ADDRESS=0.0.0.0 \
    STREAMLIT_SERVER_PORT=8501

WORKDIR /app

# 必要最低限のOSパッケージ
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# uv をインストール（公式インストーラ）
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# 依存関係ファイルを先にコピー（キャッシュ効かせる）
COPY pyproject.toml uv.lock* ./

# 依存インストール（uv.lockが無い場合も動く）
# 新しいuvでは --system は非対応のため、.venv を作って利用する
RUN uv sync

# アプリ本体
# COPY . .

EXPOSE 8501

ENV PATH="/app/.venv/bin:/root/.local/bin:${PATH}"

CMD ["streamlit", "run", "backend/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
