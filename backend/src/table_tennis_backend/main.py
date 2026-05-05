"""FastAPI アプリケーションと Web API エンドポイントを定義する。"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from table_tennis_backend.match.router import router as match_router
from table_tennis_backend.match.store import init_match_store
from table_tennis_backend.video.router import router as video_router
from table_tennis_backend.video.store import init_video_store


app = FastAPI(title="TT Analyzer API", version="0.1.0")

origins_env = os.getenv("CORS_ALLOW_ORIGINS", "*")
origins = [x.strip() for x in origins_env.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_match_store()
init_video_store()
app.include_router(match_router)
app.include_router(video_router)


@app.get("/health")
def health() -> dict:
    """ヘルスチェック結果を返す。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    """API の簡易ステータスを返す。

    Returns
    -------
    dict[str, str]
        ステータス情報を表す辞書。
    """
    return {"status": "success"}
