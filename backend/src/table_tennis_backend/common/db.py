"""エンジン生成とセッションコンテキストマネージャー。"""

from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from table_tennis_backend.common.models import IndexBase, MatchBase, VideoBase

BASE_DIR = Path("data/matches")
INDEX_DB_PATH = BASE_DIR / "index.sqlite"
VIDEO_DB_PATH = Path("tt_analyzer.db")

_index_engine: Engine | None = None
_video_engine: Engine | None = None


def index_engine() -> Engine:
    global _index_engine
    if _index_engine is None:
        _index_engine = create_engine(
            f"sqlite:///{INDEX_DB_PATH}",
            connect_args={"check_same_thread": False},
        )
    return _index_engine


def video_engine() -> Engine:
    global _video_engine
    if _video_engine is None:
        _video_engine = create_engine(
            f"sqlite:///{VIDEO_DB_PATH}",
            connect_args={"check_same_thread": False},
        )
    return _video_engine


@lru_cache(maxsize=128)
def match_engine(match_uuid: str) -> Engine:
    path = BASE_DIR / f"{match_uuid}.sqlite"
    return create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False},
    )


@contextmanager
def index_session() -> Generator[Session, None, None]:
    session = Session(index_engine(), expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def match_session(match_uuid: str) -> Generator[Session, None, None]:
    session = Session(match_engine(match_uuid), expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def video_session() -> Generator[Session, None, None]:
    session = Session(video_engine(), expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# IndexBase / MatchBase / VideoBase を外部から参照できるよう再エクスポート
__all__ = [
    "BASE_DIR",
    "INDEX_DB_PATH",
    "VIDEO_DB_PATH",
    "index_engine",
    "video_engine",
    "match_engine",
    "index_session",
    "match_session",
    "video_session",
    "IndexBase",
    "MatchBase",
    "VideoBase",
]
