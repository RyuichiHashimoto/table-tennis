"""ダウンロード済み動画メタデータの SQLite ストア。"""

import json
from datetime import datetime

import pandas as pd

from table_tennis_backend.common.db import get_conn


def init_video_store() -> None:
    """動画メタデータ用テーブルを初期化する。"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS downloaded_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        title TEXT,
        source_url TEXT NOT NULL,
        local_path TEXT NOT NULL UNIQUE,
        uploader TEXT,
        duration INTEGER,
        downloaded_at TEXT NOT NULL
    )
    """
    )
    cur.execute("PRAGMA table_info(downloaded_videos)")
    downloaded_video_columns = {row[1] for row in cur.fetchall()}
    if "match_segments_json" not in downloaded_video_columns:
        cur.execute("ALTER TABLE downloaded_videos ADD COLUMN match_segments_json TEXT")
    if "match_segments_updated_at" not in downloaded_video_columns:
        cur.execute("ALTER TABLE downloaded_videos ADD COLUMN match_segments_updated_at TEXT")
    conn.commit()
    conn.close()


def upsert_downloaded_video(
    *,
    source_url: str,
    local_path: str,
    video_id: str | None = None,
    title: str | None = None,
    uploader: str | None = None,
    duration: int | None = None,
) -> None:
    """ダウンロード済み動画のメタデータを登録または更新する。

    Parameters
    ----------
    source_url : str
        元動画の URL。
    local_path : str
        ローカルに保存された動画パス。
    video_id : str | None
        動画サービス上の ID。
    title : str | None
        試合または動画のタイトル。
    uploader : str | None
        動画投稿者名。
    duration : int | None
        動画の長さ（秒）。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO downloaded_videos
            (video_id, title, source_url, local_path, uploader, duration, downloaded_at)
        VALUES
            (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(local_path) DO UPDATE SET
            video_id=excluded.video_id,
            title=excluded.title,
            source_url=excluded.source_url,
            uploader=excluded.uploader,
            duration=excluded.duration,
            downloaded_at=excluded.downloaded_at
        """,
        (
            video_id,
            title,
            source_url,
            local_path,
            uploader,
            duration,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )
    conn.commit()
    conn.close()


def fetch_downloaded_videos() -> pd.DataFrame:
    """ダウンロード済み動画の一覧を取得する。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = get_conn()
    df = pd.read_sql_query(
        """
        SELECT
            id,
            video_id,
            title,
            source_url,
            local_path,
            uploader,
            duration,
            downloaded_at,
            match_segments_json,
            match_segments_updated_at
        FROM downloaded_videos
        ORDER BY downloaded_at DESC, id DESC
        """,
        conn,
    )
    conn.close()
    return df


def fetch_downloaded_video_by_source_url(source_url: str) -> pd.DataFrame:
    """元 URL に対応するダウンロード済み動画を取得する。

    Parameters
    ----------
    source_url : str
        元動画の URL。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = get_conn()
    df = pd.read_sql_query(
        """
        SELECT
            id,
            video_id,
            title,
            source_url,
            local_path,
            uploader,
            duration,
            downloaded_at,
            match_segments_json,
            match_segments_updated_at
        FROM downloaded_videos
        WHERE source_url = ?
        ORDER BY downloaded_at DESC, id DESC
        LIMIT 1
        """,
        conn,
        params=(source_url,),
    )
    conn.close()
    return df


def update_downloaded_video_segments(local_path: str, segments: list[dict]) -> None:
    """動画に紐づく試合区間情報を保存する。

    Parameters
    ----------
    local_path : str
        ローカルに保存された動画パス。
    segments : list[dict]
        切り出し対象の区間リスト。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE downloaded_videos
        SET match_segments_json = ?, match_segments_updated_at = ?
        WHERE local_path = ?
        """,
        (
            json.dumps(segments, ensure_ascii=False),
            datetime.now().isoformat(timespec="seconds"),
            local_path,
        ),
    )
    conn.commit()
    conn.close()
