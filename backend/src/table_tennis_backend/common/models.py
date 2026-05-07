"""SQLAlchemy ORM モデル定義。3 つの DB に対応した DeclarativeBase を持つ。"""

from sqlalchemy import Float, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class IndexBase(DeclarativeBase):
    """index.sqlite 用ベースクラス。"""


class MatchBase(DeclarativeBase):
    """試合別 {uuid}.sqlite 用ベースクラス。"""


class VideoBase(DeclarativeBase):
    """tt_analyzer.db 用ベースクラス。"""


class Match(IndexBase):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    initial_server: Mapped[str] = mapped_column(Text, nullable=False, server_default="me")
    my_player_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="自分")
    opponent_player_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="相手")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class TagDefinition(IndexBase):
    __tablename__ = "tag_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tag: Mapped[str] = mapped_column(Text, nullable=False)
    player_side: Mapped[str] = mapped_column(Text, nullable=False, server_default="me")
    phase: Mapped[str] = mapped_column(Text, nullable=False, server_default="rally")
    shot_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="miss")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class MatchMeta(MatchBase):
    __tablename__ = "match_meta"

    uuid: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    initial_server: Mapped[str] = mapped_column(Text, nullable=False, server_default="me")
    my_player_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="自分")
    opponent_player_name: Mapped[str] = mapped_column(Text, nullable=False, server_default="相手")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class Rally(MatchBase):
    __tablename__ = "rallies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    sort_order: Mapped[float] = mapped_column(Float, nullable=False)
    starred: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    set_no: Mapped[int] = mapped_column(Integer, nullable=False)
    server: Mapped[str] = mapped_column(Text, nullable=False)
    serve_type: Mapped[str | None] = mapped_column(Text)
    receive_type: Mapped[str] = mapped_column(Text, nullable=False)
    rally_len_bucket: Mapped[str] = mapped_column(Text, nullable=False)
    point_winner: Mapped[str] = mapped_column(Text, nullable=False)
    end_reason: Mapped[str] = mapped_column(Text, nullable=False)
    end_side: Mapped[str] = mapped_column(Text, nullable=False)
    my_3rd: Mapped[str | None] = mapped_column(Text)
    my_3rd_result: Mapped[str | None] = mapped_column(Text)
    result_tag: Mapped[str | None] = mapped_column(Text)
    t_start: Mapped[float | None] = mapped_column(Float)
    t_end: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class InputState(MatchBase):
    __tablename__ = "input_state"

    match_uuid: Mapped[str] = mapped_column(Text, primary_key=True)
    state_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class DownloadedVideo(VideoBase):
    __tablename__ = "downloaded_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_id: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    local_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    uploader: Mapped[str | None] = mapped_column(Text)
    duration: Mapped[int | None] = mapped_column(Integer)
    downloaded_at: Mapped[str] = mapped_column(Text, nullable=False)
    match_segments_json: Mapped[str | None] = mapped_column(Text)
    match_segments_updated_at: Mapped[str | None] = mapped_column(Text)
