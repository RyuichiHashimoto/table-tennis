import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.analytics import summarize
from backend.clip_utils import (
    build_rally_clip_segments,
    build_set_segments_from_boundaries,
    build_set_segments_from_rallies,
)
from backend.db import (
    fetch_downloaded_video_by_source_url,
    fetch_downloaded_videos,
    init_db,
    update_downloaded_video_segments,
    upsert_downloaded_video,
)
from backend.match_store import (
    create_match,
    create_tag_definition,
    delete_last_rally,
    delete_match,
    delete_rally,
    delete_tag_definition,
    fetch_match,
    fetch_match_input_state,
    fetch_matches,
    fetch_rallies,
    fetch_tag_definition,
    fetch_tag_definitions,
    init_match_store,
    insert_rally,
    save_match_input_state,
    update_tag_definition,
    update_match,
    update_rally_fields,
)
from backend.models import build_rally_input
from backend.video_analysis import (
    detect_set_boundaries_auto,
    download_video,
    export_video_segments,
    extract_match_segments,
    fetch_video_info,
    get_video_duration_sec,
)


class MatchCreateRequest(BaseModel):
    title: str
    uuid: str | None = None
    created_at: str | None = None
    initial_server: str = "me"


class MatchUpdateRequest(BaseModel):
    title: str | None = None
    initial_server: str | None = None


class MatchInputStateRequest(BaseModel):
    youtubeUrl: str
    videoSourceUrl: str
    videoTitle: str
    sourceKind: str
    form: dict[str, Any]
    confirmedSegments: list[dict[str, Any]]
    manualStartSec: float
    manualEndSec: float
    clipScope: str


class RallyCreateRequest(BaseModel):
    set_no: int = Field(ge=1, le=7)
    server: str
    serve_type: str = ""
    receive_type: str
    rally_len_bucket: str
    point_winner: str
    end_reason: str
    end_side: str
    my_3rd: str = "none"
    my_3rd_result: str = "na"
    t_start: float | None = None
    t_end: float | None = None
    note: str = ""
    insert_after_rally_id: int | None = None
    sort_order: float | None = None
    starred: bool = False
    result_tag: str | None = None
    created_at: str | None = None


class RallyUpdateRequest(BaseModel):
    set_no: int | None = Field(default=None, ge=1, le=7)
    starred: bool | None = None
    result_tag: str | None = None
    point_winner: str | None = None
    sort_order: float | None = None
    server: str | None = None
    serve_type: str | None = None
    receive_type: str | None = None
    rally_len_bucket: str | None = None
    end_reason: str | None = None
    end_side: str | None = None
    my_3rd: str | None = None
    my_3rd_result: str | None = None
    t_start: float | None = None
    t_end: float | None = None
    note: str | None = None


class TagDefinitionCreateRequest(BaseModel):
    tag: str
    my_rally_only: bool = False
    opponent_rally_only: bool = False
    loss_only: bool = False
    win_only: bool = False


class TagDefinitionUpdateRequest(BaseModel):
    tag: str | None = None
    my_rally_only: bool | None = None
    opponent_rally_only: bool | None = None
    loss_only: bool | None = None
    win_only: bool | None = None


class VideoInfoRequest(BaseModel):
    url: str


class VideoDownloadRequest(BaseModel):
    url: str
    out_dir: str = "/app/data/videos"


class MatchSegmentExtractRequest(BaseModel):
    video_path: str
    sample_every_sec: float = 0.5
    table_ratio_threshold: float = 0.12
    motion_threshold: float = 0.015
    min_segment_sec: float = 5.0
    bridge_gap_sec: float = 2.0


class BoundaryDetectRequest(BaseModel):
    video_path: str
    sample_every_sec: float = 1.0
    min_break_sec: float = 20.0
    base_motion_threshold: float = 0.008
    edge_margin_sec: float = 10.0


class SegmentsSaveRequest(BaseModel):
    video_path: str
    segments: list[dict]


class ExportSegmentsRequest(BaseModel):
    video_path: str
    segments: list[dict]
    out_dir: str | None = None


class ExportRalliesRequest(BaseModel):
    match_id: int
    video_path: str
    scope_start_sec: float | None = None
    scope_end_sec: float | None = None
    out_dir: str | None = None


class ExportSetsFromRalliesRequest(BaseModel):
    match_id: int
    video_path: str
    scope_start_sec: float | None = None
    scope_end_sec: float | None = None
    out_dir: str | None = None


class ExportSingleRallyRequest(BaseModel):
    match_id: int
    rally_id: int
    video_path: str
    out_dir: str | None = None


class ExportSetsFromBoundariesRequest(BaseModel):
    clip_path: str
    boundaries_sec: list[float]
    out_dir: str | None = None


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

init_db()
init_match_store()
VIDEO_ROOT = Path("/app/data/videos").resolve()


def _safe_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    return df.where(pd.notnull(df), None).to_dict(orient="records")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/matches")
def list_matches() -> list[dict[str, Any]]:
    return _safe_records(fetch_matches())


@app.get("/tag-definitions")
def list_tag_definitions() -> list[dict[str, Any]]:
    return _safe_records(fetch_tag_definitions())


@app.post("/tag-definitions")
def create_tag_definition_api(req: TagDefinitionCreateRequest) -> dict[str, Any]:
    tag = req.tag.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="tag is required")
    try:
        created = create_tag_definition({**req.model_dump(), "tag": tag})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return created


@app.patch("/tag-definitions/{tag_id}")
def update_tag_definition_api(tag_id: int, req: TagDefinitionUpdateRequest) -> dict[str, Any]:
    payload = req.model_dump(exclude_unset=True)
    if "tag" in payload:
        payload["tag"] = str(payload["tag"]).strip()
        if not payload["tag"]:
            raise HTTPException(status_code=400, detail="tag is required")
    try:
        updated = update_tag_definition(tag_id, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="tag definition not found")
    return updated


@app.delete("/tag-definitions/{tag_id}")
def delete_tag_definition_api(tag_id: int) -> dict[str, Any]:
    return {"ok": delete_tag_definition(tag_id)}


@app.post("/matches")
def create_match_api(req: MatchCreateRequest) -> dict:
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    match_id = create_match(title, match_uuid=req.uuid, created_at=req.created_at, initial_server=req.initial_server)
    match = fetch_match(match_id)
    if not match:
        raise HTTPException(status_code=500, detail="failed to create match")
    return match


@app.get("/matches/{match_uuid}")
def get_match_api(match_uuid: str) -> dict[str, Any]:
    match = fetch_match(match_uuid)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    return match


@app.patch("/matches/{match_uuid}")
def update_match_api(match_uuid: str, req: MatchUpdateRequest) -> dict[str, Any]:
    match = update_match(match_uuid, title=req.title, initial_server=req.initial_server)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    return match


@app.delete("/matches/{match_uuid}")
def delete_match_api(match_uuid: str) -> dict:
    return {"ok": delete_match(match_uuid)}


@app.get("/matches/{match_uuid}/input-state")
def get_match_input_state_api(match_uuid: str) -> dict[str, Any]:
    state = fetch_match_input_state(match_uuid)
    return state or {}


@app.put("/matches/{match_uuid}/input-state")
def save_match_input_state_api(match_uuid: str, req: MatchInputStateRequest) -> dict:
    match = fetch_match(match_uuid)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    save_match_input_state(match_uuid, req.model_dump())
    return {"ok": True}


@app.get("/matches/{match_uuid}/rallies")
def list_rallies(match_uuid: str) -> list[dict[str, Any]]:
    return _safe_records(fetch_rallies(match_uuid))


@app.post("/matches/{match_uuid}/rallies")
def create_rally_api(match_uuid: str, req: RallyCreateRequest) -> dict:
    payload = build_rally_input(
        set_no=req.set_no,
        server=req.server,
        serve_type=req.serve_type,
        receive_type=req.receive_type,
        rally_len_bucket=req.rally_len_bucket,
        point_winner=req.point_winner,
        end_reason=req.end_reason,
        end_side=req.end_side,
        my_3rd=req.my_3rd,
        my_3rd_result=req.my_3rd_result,
        t_start=req.t_start or 0.0,
        t_end=req.t_end or 0.0,
        note=req.note,
    ).to_record()
    payload["starred"] = req.starred
    payload["result_tag"] = req.result_tag
    if req.created_at:
        payload["created_at"] = req.created_at
    try:
        rally = insert_rally(
            match_uuid,
            payload,
            insert_after_rally_id=req.insert_after_rally_id,
            sort_order=req.sort_order,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return rally


@app.delete("/matches/{match_uuid}/rallies/last")
def delete_last_rally_api(match_uuid: str) -> dict:
    return {"ok": delete_last_rally(match_uuid)}


@app.patch("/matches/{match_uuid}/rallies/{rally_id}")
def update_rally_api(match_uuid: str, rally_id: int, req: RallyUpdateRequest) -> dict:
    rally = update_rally_fields(match_uuid, rally_id, req.model_dump(exclude_unset=True))
    if not rally:
        raise HTTPException(status_code=404, detail="rally not found")
    return rally


@app.delete("/matches/{match_uuid}/rallies/{rally_id}")
def delete_rally_api(match_uuid: str, rally_id: int) -> dict:
    return {"ok": delete_rally(match_uuid, rally_id)}


@app.get("/matches/{match_uuid}/summary")
def summary_api(match_uuid: str) -> dict:
    df = fetch_rallies(match_uuid)
    if df.empty:
        return {"total": 0, "win": 0, "lose": 0, "win_rate": 0.0}

    data = summarize(df)
    by_len = data.get("by_len")
    by_reason = data.get("by_reason")
    data["by_len"] = by_len.to_dict(orient="records") if isinstance(by_len, pd.DataFrame) else []
    data["by_reason"] = by_reason.to_dict(orient="records") if isinstance(by_reason, pd.DataFrame) else []
    return data


@app.get("/videos")
def list_videos() -> list[dict[str, Any]]:
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
    if not local_path:
        return None
    try:
        path = Path(local_path).resolve()
        path.relative_to(VIDEO_ROOT)
    except Exception:
        return None
    return f"/videos/content/{path.name}"


@app.post("/videos/info")
def video_info(req: VideoInfoRequest) -> dict:
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


@app.post("/videos/download")
def video_download(req: VideoDownloadRequest) -> dict:
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


@app.get("/videos/content/{filename}")
def video_content(filename: str) -> FileResponse:
    path = (VIDEO_ROOT / filename).resolve()
    try:
        path.relative_to(VIDEO_ROOT)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid path") from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="video not found")
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@app.post("/videos/segments/save")
def save_segments(req: SegmentsSaveRequest) -> dict:
    update_downloaded_video_segments(req.video_path, req.segments)
    return {"ok": True}


@app.post("/analysis/extract-match-segments")
def extract_segments(req: MatchSegmentExtractRequest) -> dict:
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


@app.post("/analysis/detect-set-boundaries")
def detect_boundaries(req: BoundaryDetectRequest) -> dict:
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


@app.post("/clips/export-segments")
def export_segments_api(req: ExportSegmentsRequest) -> dict:
    try:
        return export_video_segments(req.video_path, req.segments, req.out_dir)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/clips/export-rallies")
def export_rallies(req: ExportRalliesRequest) -> dict:
    df = fetch_rallies(req.match_id)
    segments = build_rally_clip_segments(
        df,
        scope_start_sec=req.scope_start_sec,
        scope_end_sec=req.scope_end_sec,
    )
    if not segments:
        raise HTTPException(status_code=400, detail="No valid rally segments from t_start/t_end")
    return export_video_segments(req.video_path, segments, req.out_dir)


@app.post("/clips/export-sets-from-rallies")
def export_sets_from_rallies(req: ExportSetsFromRalliesRequest) -> dict:
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


@app.post("/clips/export-rally")
def export_single_rally(req: ExportSingleRallyRequest) -> dict:
    df = fetch_rallies(req.match_id)
    one = df[df["id"] == req.rally_id] if not df.empty else df
    segments = build_rally_clip_segments(one)
    if not segments:
        raise HTTPException(status_code=404, detail="Rally not found or invalid t_start/t_end")
    return export_video_segments(req.video_path, [segments[0]], req.out_dir)


@app.post("/clips/export-sets-from-boundaries")
def export_sets_from_boundaries(req: ExportSetsFromBoundariesRequest) -> dict:
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
