"""試合、ラリー、タグ定義、集計の Web API ルートを定義する。"""

import json
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from table_tennis_backend.match.models import (
    build_rally_input,
    bulk_update_sort_orders,
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
    fetch_tag_definitions,
    insert_rally,
    save_match_input_state,
    update_match,
    update_rally_fields,
    update_tag_definition,
)

from table_tennis_backend.match.analytics import scoring_patterns, summarize
from table_tennis_backend.match.schemas import (
    BulkSortOrderRequest,
    MatchCreateRequest,
    MatchInputStateRequest,
    MatchUpdateRequest,
    RallyCreateRequest,
    RallyUpdateRequest,
    TagDefinitionCreateRequest,
    TagDefinitionUpdateRequest,
)

router = APIRouter()


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


@router.get("/matches")
def list_matches() -> list[dict[str, Any]]:
    """試合一覧を API 応答として返す。

    Returns
    -------
    list[dict[str, Any]]
        API 応答用の辞書リスト。
    """
    return fetch_matches()


@router.get("/tag-definitions")
def list_tag_definitions() -> list[dict[str, Any]]:
    """タグ定義一覧を API 応答として返す。

    Returns
    -------
    list[dict[str, Any]]
        API 応答用の辞書リスト。
    """
    return fetch_tag_definitions()


@router.post("/tag-definitions")
def create_tag_definition_api(req: TagDefinitionCreateRequest) -> dict[str, Any]:
    """タグ定義を作成する API ハンドラ。

    Parameters
    ----------
    req : TagDefinitionCreateRequest
        リクエストボディ。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    tag = req.tag.strip()
    if not tag:
        raise HTTPException(status_code=400, detail="tag is required")
    try:
        created = create_tag_definition({**req.model_dump(), "tag": tag})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return created


@router.patch("/tag-definitions/{tag_id}")
def update_tag_definition_api(tag_id: int, req: TagDefinitionUpdateRequest) -> dict[str, Any]:
    """タグ定義を更新する API ハンドラ。

    Parameters
    ----------
    tag_id : int
        対象タグ定義の ID。
    req : TagDefinitionUpdateRequest
        リクエストボディ。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
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


@router.delete("/tag-definitions/{tag_id}")
def delete_tag_definition_api(tag_id: int) -> dict[str, Any]:
    """タグ定義を削除する API ハンドラ。

    Parameters
    ----------
    tag_id : int
        対象タグ定義の ID。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    return {"ok": delete_tag_definition(tag_id)}


@router.post("/matches")
def create_match_api(req: MatchCreateRequest) -> dict:
    """試合を作成する API ハンドラ。

    Parameters
    ----------
    req : MatchCreateRequest
        リクエストボディ。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    match_id = create_match(
        title,
        match_uuid=req.uuid,
        created_at=req.created_at,
        initial_server=req.initial_server,
        my_player_name=req.my_player_name.strip() or "自分",
        opponent_player_name=req.opponent_player_name.strip() or "相手",
    )
    match = fetch_match(match_id)
    if not match:
        raise HTTPException(status_code=500, detail="failed to create match")
    return match


@router.get("/matches/{match_uuid}")
def get_match_api(match_uuid: str) -> dict[str, Any]:
    """指定した試合を取得する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    match = fetch_match(match_uuid)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    return match


@router.patch("/matches/{match_uuid}")
def update_match_api(match_uuid: str, req: MatchUpdateRequest) -> dict[str, Any]:
    """試合情報を更新する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    req : MatchUpdateRequest
        リクエストボディ。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    match = update_match(
        match_uuid,
        title=req.title,
        initial_server=req.initial_server,
        my_player_name=req.my_player_name.strip() if req.my_player_name is not None else None,
        opponent_player_name=req.opponent_player_name.strip() if req.opponent_player_name is not None else None,
    )
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    return match


@router.delete("/matches/{match_uuid}")
def delete_match_api(match_uuid: str) -> dict:
    """試合を削除する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    return {"ok": delete_match(match_uuid)}


@router.get("/matches/{match_uuid}/input-state")
def get_match_input_state_api(match_uuid: str) -> dict[str, Any]:
    """試合入力画面の保存状態を取得する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    state = fetch_match_input_state(match_uuid)
    return state or {}


@router.put("/matches/{match_uuid}/input-state")
def save_match_input_state_api(match_uuid: str, req: MatchInputStateRequest) -> dict:
    """試合入力画面の状態を保存する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    req : MatchInputStateRequest
        リクエストボディ。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    match = fetch_match(match_uuid)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    save_match_input_state(match_uuid, req.model_dump())
    return {"ok": True}


@router.get("/matches/{match_uuid}/rallies")
def list_rallies(match_uuid: str) -> list[dict[str, Any]]:
    """指定した試合のラリー一覧を API 応答として返す。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    list[dict[str, Any]]
        API 応答用の辞書リスト。
    """
    return _safe_records(fetch_rallies(match_uuid))


@router.post("/matches/{match_uuid}/rallies")
def create_rally_api(match_uuid: str, req: RallyCreateRequest) -> dict:
    """ラリーを作成する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    req : RallyCreateRequest
        リクエストボディ。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
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
    payload["result_tag"] = json.dumps(req.result_tags) if req.result_tags else None
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


@router.delete("/matches/{match_uuid}/rallies/last")
def delete_last_rally_api(match_uuid: str) -> dict:
    """直近ラリーを削除する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    return {"ok": delete_last_rally(match_uuid)}


@router.patch("/matches/{match_uuid}/rallies/{rally_id}")
def update_rally_api(match_uuid: str, rally_id: int, req: RallyUpdateRequest) -> dict:
    """ラリー情報を更新する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    rally_id : int
        対象ラリーの ID。
    req : RallyUpdateRequest
        リクエストボディ。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    rally = update_rally_fields(match_uuid, rally_id, req.model_dump(exclude_unset=True))
    if not rally:
        raise HTTPException(status_code=404, detail="rally not found")
    return rally


@router.put("/matches/{match_uuid}/rallies/sort-orders")
def bulk_update_sort_orders_api(match_uuid: str, req: BulkSortOrderRequest) -> dict:
    """複数ラリーの並び順を一括更新する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    req : BulkSortOrderRequest
        リクエストボディ。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    bulk_update_sort_orders(match_uuid, [item.model_dump() for item in req.orders])
    return {"ok": True}


@router.delete("/matches/{match_uuid}/rallies/{rally_id}")
def delete_rally_api(match_uuid: str, rally_id: int) -> dict:
    """ラリーを削除する API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    rally_id : int
        対象ラリーの ID。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    return {"ok": delete_rally(match_uuid, rally_id)}


@router.get("/matches/{match_uuid}/summary")
def summary_api(match_uuid: str) -> dict:
    """指定した試合の集計結果を返す API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    df = fetch_rallies(match_uuid)
    if df.empty:
        return {"total": 0, "win": 0, "lose": 0, "win_rate": 0.0}

    data = summarize(df)
    by_len = data.get("by_len")
    by_reason = data.get("by_reason")
    data["by_len"] = by_len.to_dict(orient="records") if isinstance(by_len, pd.DataFrame) else []
    data["by_reason"] = by_reason.to_dict(orient="records") if isinstance(by_reason, pd.DataFrame) else []
    return data


@router.get("/matches/{match_uuid}/analysis/scoring-patterns")
def scoring_patterns_api(match_uuid: str, limit: int = Query(default=6, ge=1, le=12)) -> dict[str, Any]:
    """指定した試合の得点パターン分析を返す API ハンドラ。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    limit : int
        返す上位件数。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    match = fetch_match(match_uuid)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    df = fetch_rallies(match_uuid)
    patterns = scoring_patterns(df, limit=limit)
    total_points = int((df["point_winner"] == "me").sum()) if not df.empty else 0
    return {
        "match_uuid": match_uuid,
        "total_points": total_points,
        "patterns": patterns,
    }
