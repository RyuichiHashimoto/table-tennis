"""Web API のリクエストスキーマを定義する。"""

from typing import Any

from pydantic import BaseModel, Field


class MatchCreateRequest(BaseModel):
    title: str
    uuid: str | None = None
    created_at: str | None = None
    initial_server: str = "me"
    my_player_name: str = "自分"
    opponent_player_name: str = "相手"


class MatchUpdateRequest(BaseModel):
    title: str | None = None
    initial_server: str | None = None
    my_player_name: str | None = None
    opponent_player_name: str | None = None
    created_at: str | None = None
    venue: str | None = None
    event_type: str | None = None
    memo: str | None = None
    best_of: int | None = Field(default=None, ge=5, le=7)


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
    result_tags: list[str] = []
    created_at: str | None = None


class RallyUpdateRequest(BaseModel):
    set_no: int | None = Field(default=None, ge=1, le=7)
    starred: bool | None = None
    result_tags: list[str] | None = None
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


class SortOrderItem(BaseModel):
    id: int
    sort_order: float


class BulkSortOrderRequest(BaseModel):
    orders: list[SortOrderItem]


class PointMoveExpectedState(BaseModel):
    id: int
    set_no: int = Field(ge=1, le=7)
    sort_order: float
    updated_at: str


class PointMoveRequest(BaseModel):
    point_ids: list[int] = Field(min_length=1)
    target_set_no: int = Field(ge=1, le=7)
    insertion: str
    insert_after_point_id: int | None = None
    client_operation_id: str = Field(min_length=1, max_length=100)
    expected_points: list[PointMoveExpectedState]


class TagDefinitionCreateRequest(BaseModel):
    tag: str
    player_side: str = "me"
    phase: str = "rally"
    shot_type: str = "miss"


class TagDefinitionUpdateRequest(BaseModel):
    tag: str | None = None
    player_side: str | None = None
    phase: str | None = None
    shot_type: str | None = None
