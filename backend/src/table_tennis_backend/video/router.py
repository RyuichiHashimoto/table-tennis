"""動画取得、解析、クリップ書き出しの Web API ルートを定義する。"""

import json
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from table_tennis_backend.video.store import (
    fetch_downloaded_video_by_source_url,
    fetch_downloaded_videos,
    update_downloaded_video_segments,
    upsert_downloaded_video,
)
from table_tennis_backend.match.models import fetch_rallies
from table_tennis_backend.video.schemas import (
    BoundaryDetectRequest,
    ExportRalliesRequest,
    ExportSegmentsRequest,
    ExportSetsFromBoundariesRequest,
    ExportSetsFromRalliesRequest,
    ExportSingleRallyRequest,
    MatchSegmentExtractRequest,
    SegmentsSaveRequest,
    VideoDownloadRequest,
    VideoInfoRequest,
)
from table_tennis_backend.video.clip_utils import (
    build_rally_clip_segments,
    build_set_segments_from_boundaries,
    build_set_segments_from_rallies,
)
from table_tennis_backend.video.video_analysis import (
    detect_set_boundaries_auto,
    download_video,
    export_video_segments,
    extract_match_segments,
    fetch_video_info,
    get_video_duration_sec,
)

router = APIRouter()
VIDEO_ROOT = Path("/app/data/videos").resolve()


def _safe_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame を JSON 応答向けのレコードリストへ変換する。

    Parameters
    ----------
    df : pd.DataFrame
        変換対象の DataFrame。

    Returns
    -------
    list[dict[str, Any]]
        API 応答用の辞書リスト。
    """
    if df.empty:
        return []
    return df.where(pd.notnull(df), None).to_dict(orient="records")


@router.get("/videos")
def list_videos() -> list[dict[str, Any]]:
    """ダウンロード済み動画一覧を API 応答として返す。

    Returns
    -------
    list[dict[str, Any]]
        API 応答用の辞書リスト。
    """
    rows = _safe_records(fetch_downloaded_videos())
    for row in rows:
        raw = row.get("match_segments_json")
        if raw:
            try:
                row["match_segments"] = json.loads(raw)
            except Exception:
                row["match_segments"] = []
        else:
            row["match_segments"] = []
        local_path = row.get("local_path")
        row["public_url"] = _build_public_video_url(local_path) if local_path else None
    return rows


def _build_public_video_url(local_path: str | None) -> str | None:
    """保存済み動画の公開用 URL を作成する。

    Parameters
    ----------
    local_path : str | None
        ローカルに保存された動画パス。

    Returns
    -------
    str | None
        公開用 URL。公開対象外の場合は None。
    """
    if not local_path:
        return None
    try:
        path = Path(local_path).resolve()
        path.relative_to(VIDEO_ROOT)
    except Exception:
        return None
    return f"/videos/content/{path.name}"


@router.post("/videos/info")
def video_info(req: VideoInfoRequest) -> dict:
    """動画 URL のメタデータを取得する API ハンドラ。

    Parameters
    ----------
    req : VideoInfoRequest
        リクエストボディ。

    Returns
    -------
    dict
        動画メタデータ。
    """
    try:
        info = fetch_video_info(req.url.strip())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="yt-dlp not found") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "id": info.get("id"),
        "title": info.get("title"),
        "uploader": info.get("uploader"),
        "duration": info.get("duration"),
        "view_count": info.get("view_count"),
        "webpage_url": info.get("webpage_url"),
    }


@router.post("/videos/download")
def video_download(req: VideoDownloadRequest) -> dict:
    """動画をダウンロードまたは再利用する API ハンドラ。

    Parameters
    ----------
    req : VideoDownloadRequest
        リクエストボディ。

    Returns
    -------
    dict
        ダウンロード結果。
    """
    existing = fetch_downloaded_video_by_source_url(req.url.strip())
    if not existing.empty:
        row = _safe_records(existing)[0]
        local_path = row.get("local_path")
        if local_path and Path(local_path).exists():
            return {
                "video_path": local_path,
                "public_url": _build_public_video_url(local_path),
                "reused": True,
                "title": row.get("title"),
            }

    try:
        info = fetch_video_info(req.url.strip())
        video_path = download_video(req.url.strip(), req.out_dir.strip())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="yt-dlp not found") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    upsert_downloaded_video(
        source_url=req.url.strip(),
        local_path=video_path,
        video_id=info.get("id"),
        title=info.get("title"),
        uploader=info.get("uploader"),
        duration=info.get("duration"),
    )
    return {
        "video_path": video_path,
        "public_url": _build_public_video_url(video_path),
        "reused": False,
        "title": info.get("title"),
    }


@router.get("/videos/content/{filename}")
def video_content(filename: str) -> FileResponse:
    """保存済み動画ファイルを配信する API ハンドラ。

    Parameters
    ----------
    filename : str
        配信する動画ファイル名。

    Returns
    -------
    FileResponse
        動画ファイルのレスポンス。
    """
    path = (VIDEO_ROOT / filename).resolve()
    try:
        path.relative_to(VIDEO_ROOT)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid path") from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="video not found")
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@router.post("/videos/segments/save")
def save_segments(req: SegmentsSaveRequest) -> dict:
    """動画の試合区間情報を保存する API ハンドラ。

    Parameters
    ----------
    req : SegmentsSaveRequest
        リクエストボディ。

    Returns
    -------
    dict
        処理結果。
    """
    update_downloaded_video_segments(req.video_path, req.segments)
    return {"ok": True}


@router.post("/analysis/extract-match-segments")
def extract_segments(req: MatchSegmentExtractRequest) -> dict:
    """動画から試合区間を抽出する API ハンドラ。

    Parameters
    ----------
    req : MatchSegmentExtractRequest
        リクエストボディ。

    Returns
    -------
    dict
        抽出結果。
    """
    try:
        return extract_match_segments(
            video_path=req.video_path,
            sample_every_sec=req.sample_every_sec,
            table_ratio_threshold=req.table_ratio_threshold,
            motion_threshold=req.motion_threshold,
            min_segment_sec=req.min_segment_sec,
            bridge_gap_sec=req.bridge_gap_sec,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/analysis/detect-set-boundaries")
def detect_boundaries(req: BoundaryDetectRequest) -> dict:
    """動画からセット境界を検出する API ハンドラ。

    Parameters
    ----------
    req : BoundaryDetectRequest
        リクエストボディ。

    Returns
    -------
    dict
        境界検出結果。
    """
    try:
        return detect_set_boundaries_auto(
            video_path=req.video_path,
            sample_every_sec=req.sample_every_sec,
            min_break_sec=req.min_break_sec,
            base_motion_threshold=req.base_motion_threshold,
            edge_margin_sec=req.edge_margin_sec,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/clips/export-segments")
def export_segments_api(req: ExportSegmentsRequest) -> dict:
    """指定区間のクリップを書き出す API ハンドラ。

    Parameters
    ----------
    req : ExportSegmentsRequest
        リクエストボディ。

    Returns
    -------
    dict
        書き出し結果。
    """
    try:
        return export_video_segments(req.video_path, req.segments, req.out_dir)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/clips/export-rallies")
def export_rallies(req: ExportRalliesRequest) -> dict:
    """ラリー単位のクリップを書き出す API ハンドラ。

    Parameters
    ----------
    req : ExportRalliesRequest
        リクエストボディ。

    Returns
    -------
    dict
        書き出し結果。
    """
    df = fetch_rallies(req.match_id)
    segments = build_rally_clip_segments(
        df,
        scope_start_sec=req.scope_start_sec,
        scope_end_sec=req.scope_end_sec,
    )
    if not segments:
        raise HTTPException(status_code=400, detail="No valid rally segments from t_start/t_end")
    return export_video_segments(req.video_path, segments, req.out_dir)


@router.post("/clips/export-sets-from-rallies")
def export_sets_from_rallies(req: ExportSetsFromRalliesRequest) -> dict:
    """ラリー時刻をもとにセット単位のクリップを書き出す API ハンドラ。

    Parameters
    ----------
    req : ExportSetsFromRalliesRequest
        リクエストボディ。

    Returns
    -------
    dict
        書き出し結果。
    """
    df = fetch_rallies(req.match_id)
    rally_segments = build_rally_clip_segments(
        df,
        scope_start_sec=req.scope_start_sec,
        scope_end_sec=req.scope_end_sec,
    )
    segments = build_set_segments_from_rallies(rally_segments)
    if not segments:
        raise HTTPException(status_code=400, detail="No valid set segments from rallies")
    return export_video_segments(req.video_path, segments, req.out_dir)


@router.post("/clips/export-rally")
def export_single_rally(req: ExportSingleRallyRequest) -> dict:
    """単一ラリーのクリップを書き出す API ハンドラ。

    Parameters
    ----------
    req : ExportSingleRallyRequest
        リクエストボディ。

    Returns
    -------
    dict
        書き出し結果。
    """
    df = fetch_rallies(req.match_id)
    one = df[df["id"] == req.rally_id] if not df.empty else df
    segments = build_rally_clip_segments(one)
    if not segments:
        raise HTTPException(status_code=404, detail="Rally not found or invalid t_start/t_end")
    return export_video_segments(req.video_path, [segments[0]], req.out_dir)


@router.post("/clips/export-sets-from-boundaries")
def export_sets_from_boundaries(req: ExportSetsFromBoundariesRequest) -> dict:
    """境界時刻をもとにセット単位のクリップを書き出す API ハンドラ。

    Parameters
    ----------
    req : ExportSetsFromBoundariesRequest
        リクエストボディ。

    Returns
    -------
    dict
        書き出し結果。
    """
    clip_path = req.clip_path
    if not Path(clip_path).exists():
        raise HTTPException(status_code=404, detail=f"clip_path not found: {clip_path}")

    try:
        duration_sec = get_video_duration_sec(clip_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read clip duration: {exc}") from exc

    segments = build_set_segments_from_boundaries(duration_sec, req.boundaries_sec)
    if not segments:
        raise HTTPException(status_code=400, detail="No set segments from boundaries")

    return export_video_segments(clip_path, segments, req.out_dir)
