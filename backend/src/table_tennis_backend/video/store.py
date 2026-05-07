"""ダウンロード済み動画メタデータの SQLite ストア。"""

import json
from datetime import datetime

import pandas as pd
from sqlalchemy import text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from table_tennis_backend.common.db import video_engine, video_session
from table_tennis_backend.common.models import DownloadedVideo, VideoBase


def init_video_store() -> None:
    """動画メタデータ用テーブルを初期化する。"""
    VideoBase.metadata.create_all(video_engine())
    with video_engine().begin() as conn:
        result = conn.execute(text("PRAGMA table_info(downloaded_videos)"))
        columns = {row[1] for row in result.fetchall()}
        if "match_segments_json" not in columns:
            conn.execute(text("ALTER TABLE downloaded_videos ADD COLUMN match_segments_json TEXT"))
        if "match_segments_updated_at" not in columns:
            conn.execute(text("ALTER TABLE downloaded_videos ADD COLUMN match_segments_updated_at TEXT"))


def upsert_downloaded_video(
    *,
    source_url: str,
    local_path: str,
    video_id: str | None = None,
    title: str | None = None,
    uploader: str | None = None,
    duration: int | None = None,
) -> None:
    """ダウンロード済み動画のメタデータを登録または更新する。"""
    now = datetime.now().isoformat(timespec="seconds")
    stmt = sqlite_insert(DownloadedVideo).values(
        video_id=video_id,
        title=title,
        source_url=source_url,
        local_path=local_path,
        uploader=uploader,
        duration=duration,
        downloaded_at=now,
    ).on_conflict_do_update(
        index_elements=["local_path"],
        set_={
            "video_id": video_id,
            "title": title,
            "source_url": source_url,
            "uploader": uploader,
            "duration": duration,
            "downloaded_at": now,
        },
    )
    with video_session() as session:
        session.execute(stmt)


def fetch_downloaded_videos() -> pd.DataFrame:
    """ダウンロード済み動画の一覧を取得する。"""
    with video_session() as session:
        videos = (
            session.query(DownloadedVideo)
            .order_by(DownloadedVideo.downloaded_at.desc(), DownloadedVideo.id.desc())
            .all()
        )
    records = [
        {
            "id": v.id,
            "video_id": v.video_id,
            "title": v.title,
            "source_url": v.source_url,
            "local_path": v.local_path,
            "uploader": v.uploader,
            "duration": v.duration,
            "downloaded_at": v.downloaded_at,
            "match_segments_json": v.match_segments_json,
            "match_segments_updated_at": v.match_segments_updated_at,
        }
        for v in videos
    ]
    return pd.DataFrame(records)


def fetch_downloaded_video_by_source_url(source_url: str) -> pd.DataFrame:
    """元 URL に対応するダウンロード済み動画を取得する。"""
    with video_session() as session:
        videos = (
            session.query(DownloadedVideo)
            .filter_by(source_url=source_url)
            .order_by(DownloadedVideo.downloaded_at.desc(), DownloadedVideo.id.desc())
            .limit(1)
            .all()
        )
    records = [
        {
            "id": v.id,
            "video_id": v.video_id,
            "title": v.title,
            "source_url": v.source_url,
            "local_path": v.local_path,
            "uploader": v.uploader,
            "duration": v.duration,
            "downloaded_at": v.downloaded_at,
            "match_segments_json": v.match_segments_json,
            "match_segments_updated_at": v.match_segments_updated_at,
        }
        for v in videos
    ]
    return pd.DataFrame(records)


def update_downloaded_video_segments(local_path: str, segments: list[dict]) -> None:
    """動画に紐づく試合区間情報を保存する。"""
    now = datetime.now().isoformat(timespec="seconds")
    with video_session() as session:
        obj = session.query(DownloadedVideo).filter_by(local_path=local_path).one_or_none()
        if obj:
            obj.match_segments_json = json.dumps(segments, ensure_ascii=False)
            obj.match_segments_updated_at = now
