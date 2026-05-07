import json
import uuid as uuid_lib
from datetime import datetime
from typing import Any

import pandas as pd
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.sql import func

from table_tennis_backend.common.postgresqldb import Base, get_engine
from table_tennis_backend.match.point_input import PointInput, build_point_input, build_rally_input  # noqa: F401


class TagDefinition(Base):
    __tablename__ = "tag_definitions"

    id = Column(Integer, primary_key=True, comment="タグ定義の内部ID。")
    tag = Column(Text, nullable=False, comment="画面に表示するタグ名。例: サーブミス。")
    player_side = Column(Text, nullable=False, comment="タグの対象選手。me/op/both。")
    phase = Column(Text, nullable=False, comment="タグが属する局面。serve/receive/rally。")
    shot_type = Column(Text, nullable=False, comment="タグの結果種別。miss/point/any。")
    is_deleted = Column(Boolean, nullable=False, default=False, comment="論理削除済みかどうか。")
    deleted_at = Column(DateTime(timezone=True), nullable=True, comment="論理削除した日時。未削除ならNULL。")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="作成日時。")
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="最終更新日時。",
    )


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="試合の内部ID。")
    uuid: Mapped[str] = mapped_column(Text, unique=True, nullable=False, comment="外部参照用の試合UUID。")
    title: Mapped[str] = mapped_column(Text, nullable=False, comment="試合タイトル。")
    initial_server: Mapped[str] = mapped_column(Text, nullable=False, server_default="me", comment="第1セット開始時のサーバー。me/op。")
    my_player_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="自分", comment="自分側の選手名。")
    opponent_player_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="相手", comment="相手側の選手名。")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="作成日時。")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="最終更新日時。",
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", comment="論理削除済みかどうか。")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="論理削除した日時。未削除ならNULL。")


class Point(Base):
    __tablename__ = "points"

    # 識別番号
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="ポイント記録の内部ID。")
    uuid: Mapped[str] = mapped_column(Text, unique=True, nullable=False, comment="外部参照用のポイントUUID。")
    
    # 所属情報
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True, comment="所属する試合ID。")
    set_no: Mapped[int] = mapped_column(Integer, nullable=False, comment="セット番号")

    # ポイント基本情報
    server: Mapped[str] = mapped_column(Text, nullable=False, comment="このポイントのサーバー。me/op。")
    point_winner: Mapped[str] = mapped_column(Text, nullable=False, comment="得点者。me/op。")

    # 表示・管理情報
    sort_order: Mapped[float] = mapped_column(Float, nullable=False, comment="試合内での表示順。並び替えに使う。")
    starred: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", comment="重要ポイントとして星付きかどうか。")

    # 分析タグ
    result_tag: Mapped[str | None] = mapped_column(Text, comment="結果タグ。複数タグはJSON文字列で保持。")

    # ポイント付随情報
    t_start: Mapped[float | None] = mapped_column(Float, comment="動画内のポイント開始秒。")
    t_end: Mapped[float | None] = mapped_column(Float, comment="動画内のポイント終了秒。")        

    # プレー内容
    serve_type: Mapped[str | None] = mapped_column(Text, comment="サーブ種別。未入力ならNULL。")
    receive_type: Mapped[str] = mapped_column(Text, nullable=False, comment="レシーブ種別。")
    my_3rd: Mapped[str | None] = mapped_column(Text, comment="自分の3球目の内容。該当なしならNULL。")
    my_3rd_result: Mapped[str | None] = mapped_column(Text, comment="自分の3球目の結果。該当なしならNULL。")
    rally_len_bucket: Mapped[str] = mapped_column(Text, nullable=False, comment="ラリー長の区分。")        

    # ポイント終了情報
    end_reason: Mapped[str] = mapped_column(Text, nullable=False, comment="ポイント終了理由。")
    end_side: Mapped[str] = mapped_column(Text, nullable=False, comment="ポイント終了時の打球側または終了位置。")

    # メモ
    note: Mapped[str | None] = mapped_column(Text, comment="任意メモ。")

    # 監査情報
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="作成日時。")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="最終更新日時。")

    # 論理削除
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", comment="論理削除済みかどうか。")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="論理削除した日時。未削除ならNULL。")


class InputState(Base):
    __tablename__ = "input_state"

    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), primary_key=True, comment="入力状態を保存する対象試合ID。")
    state_json: Mapped[str] = mapped_column(Text, nullable=False, comment="試合入力画面の状態をJSON文字列として保存したもの。")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="最終保存日時。",
    )


def init_match_store() -> None:
    """PostgreSQL に試合、ポイント、入力状態テーブルを作成する。"""
    Base.metadata.create_all(get_engine(), tables=[Match.__table__, Point.__table__, InputState.__table__])


def init_tag_definition_store() -> None:
    """PostgreSQL にタグ定義テーブルを作成する。"""
    Base.metadata.create_all(get_engine(), tables=[TagDefinition.__table__])


def fetch_tag_definitions() -> list[dict[str, Any]]:
    """タグ定義一覧を取得する。"""
    init_tag_definition_store()
    with Session(get_engine()) as session:
        tags = (
            session.query(TagDefinition)
            .filter(TagDefinition.is_deleted.is_(False))
            .order_by(TagDefinition.id.asc())
            .all()
        )
        return [_serialize_tag_definition(tag) for tag in tags]


def fetch_tag_definition(tag_id: int) -> dict[str, Any] | None:
    """タグ定義を 1 件取得する。"""
    init_tag_definition_store()
    with Session(get_engine()) as session:
        tag = session.get(TagDefinition, tag_id)
        if not tag or tag.is_deleted:
            return None
        return _serialize_tag_definition(tag)


def create_tag_definition(data: dict[str, Any]) -> dict[str, Any]:
    """タグ定義を作成する。"""
    init_tag_definition_store()
    tag_def = TagDefinition(
        tag=str(data["tag"]).strip(),
        player_side=str(data.get("player_side", "me")),
        phase=str(data.get("phase", "rally")),
        shot_type=str(data.get("shot_type", "miss")),
    )
    with Session(get_engine()) as session:
        session.add(tag_def)
        try:
            session.commit()
            session.refresh(tag_def)
        except IntegrityError as exc:
            session.rollback()
            raise ValueError("tag definition already exists") from exc
        return _serialize_tag_definition(tag_def)


def update_tag_definition(tag_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    """タグ定義の指定フィールドを更新する。"""
    init_tag_definition_store()
    allowed = {"tag", "player_side", "phase", "shot_type"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "tag" in updates:
        updates["tag"] = str(updates["tag"]).strip()
    with Session(get_engine()) as session:
        tag_def = session.get(TagDefinition, tag_id)
        if not tag_def or tag_def.is_deleted:
            return None
        for key, value in updates.items():
            setattr(tag_def, key, value)
        try:
            session.commit()
            session.refresh(tag_def)
        except IntegrityError as exc:
            session.rollback()
            raise ValueError("tag definition already exists") from exc
        return _serialize_tag_definition(tag_def)


def delete_tag_definition(tag_id: int) -> bool:
    """タグ定義を論理削除する。"""
    init_tag_definition_store()
    with Session(get_engine()) as session:
        tag_def = session.get(TagDefinition, tag_id)
        if not tag_def or tag_def.is_deleted:
            return False
        tag_def.is_deleted = True
        tag_def.deleted_at = func.now()
        session.commit()
        return True


def fetch_matches() -> list[dict[str, Any]]:
    """保存済みの試合一覧を取得する。"""
    init_match_store()
    with Session(get_engine()) as session:
        matches = (
            session.query(Match)
            .filter(Match.is_deleted.is_(False))
            .order_by(Match.id.desc())
            .all()
        )
        return [_serialize_match(match) for match in matches]


def fetch_match(match_ref: int | str) -> dict[str, Any] | None:
    """指定した試合情報を取得する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        return _serialize_match(match) if match else None


def create_match(
    title: str,
    match_uuid: str | None = None,
    created_at: str | None = None,
    initial_server: str = "me",
    my_player_name: str = "自分",
    opponent_player_name: str = "相手",
) -> int:
    """新しい試合を作成し、識別子を返す。"""
    init_match_store()
    match = Match(
        uuid=match_uuid or str(uuid_lib.uuid4()),
        title=title,
        initial_server=initial_server,
        my_player_name=my_player_name,
        opponent_player_name=opponent_player_name,
    )
    if created_at is not None:
        match.created_at = _parse_datetime(created_at)
    with Session(get_engine()) as session:
        session.add(match)
        try:
            session.commit()
            session.refresh(match)
        except IntegrityError as exc:
            session.rollback()
            raise ValueError("match already exists") from exc
        return int(match.id)


def update_match(
    match_ref: int | str,
    *,
    title: str | None = None,
    initial_server: str | None = None,
    my_player_name: str | None = None,
    opponent_player_name: str | None = None,
) -> dict[str, Any] | None:
    """試合のタイトル、初期サーバー、選手名を更新する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return None
        if title is not None:
            match.title = title
        if initial_server is not None:
            match.initial_server = initial_server
        if my_player_name is not None:
            match.my_player_name = my_player_name
        if opponent_player_name is not None:
            match.opponent_player_name = opponent_player_name
        session.commit()
        session.refresh(match)
        serialized = _serialize_match(match)
    if initial_server is not None:
        _normalize_servers(serialized["uuid"])
    return fetch_match(serialized["uuid"])


def delete_match(match_ref: int | str) -> bool:
    """指定した試合を論理削除する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return False
        match.is_deleted = True
        match.deleted_at = func.now()
        session.commit()
        return True


def fetch_points(match_ref: int | str) -> pd.DataFrame:
    """指定した試合のポイント一覧を取得する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return pd.DataFrame()
        points = _list_points_raw(session, match.id)
        records = [_serialize_point(point, match) for point in points]
    return pd.DataFrame(records)


def fetch_point(match_ref: int | str, point_id: int) -> dict[str, Any] | None:
    """指定したポイントを 1 件取得する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return None
        point = _fetch_point_row(session, match.id, point_id)
        return _serialize_point(point, match) if point else None


def insert_point(
    match_ref: int | str,
    data: dict[str, Any],
    insert_after_point_id: int | None = None,
    sort_order: float | None = None,
) -> dict[str, Any]:
    """指定した試合にポイント記録を追加する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            raise ValueError("match not found")
        next_order = sort_order if sort_order is not None else _next_sort_order(session, match.id, insert_after_point_id)
        point = Point(
            match_id=match.id,
            uuid=str(uuid_lib.uuid4()),
            sort_order=next_order,
            starred=bool(data.get("starred", False)),
            set_no=data["set_no"],
            server=data["server"],
            serve_type=data.get("serve_type"),
            receive_type=data["receive_type"],
            rally_len_bucket=data["rally_len_bucket"],
            point_winner=data["point_winner"],
            end_reason=data["end_reason"],
            end_side=data["end_side"],
            my_3rd=data.get("my_3rd"),
            my_3rd_result=data.get("my_3rd_result"),
            result_tag=data.get("result_tag"),
            t_start=data.get("t_start"),
            t_end=data.get("t_end"),
            note=data.get("note"),
        )
        if data.get("created_at") is not None:
            point.created_at = _parse_datetime(data["created_at"])
        session.add(point)
        session.commit()
        session.refresh(point)
        point_id = int(point.id)
        set_no = int(data["set_no"])
    _normalize_servers(match_ref, {set_no})
    result = fetch_point(match_ref, point_id)
    if result is None:
        raise ValueError("failed to create point")
    return result


def delete_last_point(match_ref: int | str) -> bool:
    """指定した試合の直近ポイントを削除する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return False
        points = _list_points_raw(session, match.id)
        if not points:
            return False
        last_id = sorted(points, key=_sort_key)[-1].id
    return delete_point(match_ref, int(last_id))


def delete_point(match_ref: int | str, point_id: int) -> bool:
    """指定したポイントを論理削除する。"""
    init_match_store()
    affected_set_no: int | None = None
    deleted = False
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return False
        point = _fetch_point_row(session, match.id, point_id)
        if not point:
            return False
        affected_set_no = int(point.set_no)
        point.is_deleted = True
        point.deleted_at = func.now()
        session.commit()
        deleted = True
    if deleted and affected_set_no is not None:
        _normalize_servers(match_ref, {affected_set_no})
    return deleted


def update_point_fields(match_ref: int | str, point_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    """ポイントの指定フィールドを更新する。"""
    init_match_store()
    if not fields:
        return fetch_point(match_ref, point_id)
    allowed = {
        "set_no",
        "result_tag",
        "result_tags",
        "point_winner",
        "sort_order",
        "starred",
        "server",
        "serve_type",
        "receive_type",
        "rally_len_bucket",
        "end_reason",
        "end_side",
        "my_3rd",
        "my_3rd_result",
        "t_start",
        "t_end",
        "note",
    }
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "starred" in updates:
        updates["starred"] = bool(updates["starred"])
    if "result_tags" in updates:
        tags = updates.pop("result_tags")
        updates["result_tag"] = json.dumps(tags) if tags else None
    if not updates:
        return fetch_point(match_ref, point_id)

    affected_set_nos: set[int] = set()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return None
        point = _fetch_point_row(session, match.id, point_id)
        if not point:
            return None
        affected_set_nos.add(int(point.set_no))
        for key, value in updates.items():
            setattr(point, key, value)
        if "set_no" in updates and updates["set_no"] is not None:
            affected_set_nos.add(int(updates["set_no"]))
        session.commit()
    if affected_set_nos:
        _normalize_servers(match_ref, affected_set_nos)
    return fetch_point(match_ref, point_id)


def bulk_update_sort_orders(match_ref: int | str, orders: list[dict[str, Any]]) -> None:
    """複数ポイントの sort_order を一括更新する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            raise ValueError("match not found")
        for item in orders:
            point = _fetch_point_row(session, match.id, int(item["id"]))
            if point:
                point.sort_order = float(item["sort_order"])
        session.commit()


def fetch_match_input_state(match_ref: int | str) -> dict[str, Any] | None:
    """試合入力画面の保存状態を取得する。"""
    init_match_store()
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return None
        row = session.get(InputState, match.id)
        if not row:
            return None
        return json.loads(row.state_json)


def save_match_input_state(match_ref: int | str, state: dict[str, Any]) -> None:
    """試合入力画面の状態を保存する。"""
    init_match_store()
    state_json = json.dumps(state, ensure_ascii=False)
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            raise ValueError("match not found")
        stmt = pg_insert(InputState).values(
            match_id=match.id,
            state_json=state_json,
        ).on_conflict_do_update(
            index_elements=["match_id"],
            set_={"state_json": state_json, "updated_at": func.now()},
        )
        session.execute(stmt)
        session.commit()


def _fetch_match_row(session: Session, match_ref: int | str) -> Match | None:
    if isinstance(match_ref, int):
        return (
            session.query(Match)
            .filter(Match.id == match_ref, Match.is_deleted.is_(False))
            .one_or_none()
        )
    return (
        session.query(Match)
        .filter(Match.uuid == str(match_ref), Match.is_deleted.is_(False))
        .one_or_none()
    )


def _fetch_point_row(session: Session, match_id: int, point_id: int) -> Point | None:
    return (
        session.query(Point)
        .filter(Point.id == point_id, Point.match_id == match_id, Point.is_deleted.is_(False))
        .one_or_none()
    )


def _list_points_raw(session: Session, match_id: int) -> list[Point]:
    return (
        session.query(Point)
        .filter(Point.match_id == match_id, Point.is_deleted.is_(False))
        .order_by(Point.sort_order.asc(), Point.id.asc())
        .all()
    )


def _sort_key(row: Point) -> tuple[float, int]:
    return (float(row.sort_order or row.id or 0), int(row.id or 0))


def _first_server_for_set(set_no: int, initial_server: str) -> str:
    if set_no % 2 == 1:
        return initial_server
    return "op" if initial_server == "me" else "me"


def _expected_server_for_index(index: int, set_no: int, initial_server: str) -> str:
    first_server = _first_server_for_set(set_no, initial_server)
    if (index // 2) % 2 == 0:
        return first_server
    return "op" if first_server == "me" else "me"


def _normalize_servers(match_ref: int | str, set_nos: set[int] | None = None) -> None:
    with Session(get_engine()) as session:
        match = _fetch_match_row(session, match_ref)
        if not match:
            return
        initial_server = str(match.initial_server or "me")
        points = _list_points_raw(session, match.id)
        grouped: dict[int, list[Point]] = {}
        for point in points:
            grouped.setdefault(int(point.set_no), []).append(point)
        for set_no, set_points in grouped.items():
            if set_nos is not None and set_no not in set_nos:
                continue
            set_points.sort(key=_sort_key)
            for index, point in enumerate(set_points):
                expected_server = _expected_server_for_index(index, set_no, initial_server)
                if point.server != expected_server:
                    point.server = expected_server
        session.commit()


def _next_sort_order(session: Session, match_id: int, insert_after_point_id: int | None = None) -> float:
    points = _list_points_raw(session, match_id)
    if not points:
        return 1.0
    if insert_after_point_id is None:
        last = points[-1]
        return float(last.sort_order or last.id) + 1.0

    anchor_index = next((idx for idx, row in enumerate(points) if row.id == insert_after_point_id), -1)
    if anchor_index == -1:
        last = points[-1]
        return float(last.sort_order or last.id) + 1.0

    current_order = float(points[anchor_index].sort_order or points[anchor_index].id)
    next_row = points[anchor_index + 1] if anchor_index + 1 < len(points) else None
    if not next_row:
        return current_order + 1.0
    next_order = float(next_row.sort_order or next_row.id)
    candidate = current_order + (next_order - current_order) / 2.0
    if candidate == current_order or candidate == next_order:
        _rebalance_sort_orders(session, match_id)
        return _next_sort_order(session, match_id, insert_after_point_id)
    return candidate


def _rebalance_sort_orders(session: Session, match_id: int) -> None:
    for index, point in enumerate(_list_points_raw(session, match_id), start=1):
        if float(point.sort_order or 0) != float(index):
            point.sort_order = float(index)
    session.flush()


def _parse_result_tags(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(tag) for tag in parsed if tag]
        return [str(parsed)] if parsed else []
    except (json.JSONDecodeError, ValueError):
        return [value]


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    return datetime.fromisoformat(text)


def _serialize_tag_definition(tag_def: TagDefinition) -> dict[str, Any]:
    return {
        "id": int(tag_def.id),
        "tag": str(tag_def.tag),
        "player_side": str(tag_def.player_side),
        "phase": str(tag_def.phase),
        "shot_type": str(tag_def.shot_type),
        "created_at": tag_def.created_at,
        "updated_at": tag_def.updated_at,
    }


def _serialize_match(match: Match) -> dict[str, Any]:
    return {
        "id": int(match.id),
        "uuid": str(match.uuid),
        "title": str(match.title),
        "initial_server": str(match.initial_server),
        "my_player_name": str(match.my_player_name),
        "opponent_player_name": str(match.opponent_player_name),
        "created_at": match.created_at,
        "updated_at": match.updated_at,
        "is_deleted": bool(match.is_deleted),
        "deleted_at": match.deleted_at,
    }


def _serialize_point(point: Point, match: Match) -> dict[str, Any]:
    return {
        "id": int(point.id),
        "uuid": str(point.uuid),
        "match_id": int(match.id),
        "match_uuid": str(match.uuid),
        "sort_order": point.sort_order,
        "starred": bool(point.starred),
        "set_no": point.set_no,
        "server": point.server,
        "serve_type": point.serve_type,
        "receive_type": point.receive_type,
        "rally_len_bucket": point.rally_len_bucket,
        "point_winner": point.point_winner,
        "end_reason": point.end_reason,
        "end_side": point.end_side,
        "my_3rd": point.my_3rd,
        "my_3rd_result": point.my_3rd_result,
        "result_tag": point.result_tag,
        "result_tags": _parse_result_tags(point.result_tag),
        "t_start": point.t_start,
        "t_end": point.t_end,
        "note": point.note,
        "created_at": point.created_at,
        "updated_at": point.updated_at,
    }


def fetch_rallies(match_ref: int | str) -> pd.DataFrame:
    """旧 API 互換: ポイント一覧を取得する。"""
    return fetch_points(match_ref)


def fetch_rally(match_ref: int | str, rally_id: int) -> dict[str, Any] | None:
    """旧 API 互換: ポイントを 1 件取得する。"""
    return fetch_point(match_ref, rally_id)


def insert_rally(
    match_ref: int | str,
    data: dict[str, Any],
    insert_after_rally_id: int | None = None,
    sort_order: float | None = None,
) -> dict[str, Any]:
    """旧 API 互換: ポイント記録を追加する。"""
    return insert_point(
        match_ref,
        data,
        insert_after_point_id=insert_after_rally_id,
        sort_order=sort_order,
    )


def delete_last_rally(match_ref: int | str) -> bool:
    """旧 API 互換: 直近ポイントを削除する。"""
    return delete_last_point(match_ref)


def delete_rally(match_ref: int | str, rally_id: int) -> bool:
    """旧 API 互換: ポイントを削除する。"""
    return delete_point(match_ref, rally_id)


def update_rally_fields(match_ref: int | str, rally_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    """旧 API 互換: ポイントの指定フィールドを更新する。"""
    return update_point_fields(match_ref, rally_id, fields)
