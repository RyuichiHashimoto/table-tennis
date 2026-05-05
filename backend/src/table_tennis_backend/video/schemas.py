"""動画 API のリクエストスキーマを定義する。"""

from pydantic import BaseModel


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
