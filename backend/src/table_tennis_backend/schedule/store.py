from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.sql import func

from table_tennis_backend.common.postgresqldb import Base, get_engine


class ScheduledMatch(Base):
    __tablename__ = "scheduled_matches"
    __table_args__ = (UniqueConstraint("provider_url", "external_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_url: Mapped[str] = mapped_column(Text, nullable=False)
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    venue: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    competition: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def init_schedule_store() -> None:
    Base.metadata.create_all(get_engine(), tables=[ScheduledMatch.__table__])


def fetch_scheduled_matches() -> list[dict[str, Any]]:
    with Session(get_engine()) as session:
        rows = session.query(ScheduledMatch).order_by(ScheduledMatch.starts_at.asc()).all()
        return [_serialize(row) for row in rows]


def upsert_scheduled_matches(provider_url: str, events: list[dict[str, Any]]) -> int:
    with Session(get_engine()) as session:
        for event in events:
            values = {**event, "provider_url": provider_url, "fetched_at": func.now()}
            statement = insert(ScheduledMatch).values(**values).on_conflict_do_update(
                constraint="scheduled_matches_provider_url_external_id_key",
                set_={key: values[key] for key in ("title", "starts_at", "venue", "competition", "source_url", "fetched_at")},
            )
            session.execute(statement)
        session.commit()
    return len(events)


def _serialize(row: ScheduledMatch) -> dict[str, Any]:
    return {"id": row.id, "external_id": row.external_id, "title": row.title,
            "starts_at": row.starts_at.isoformat(), "venue": row.venue,
            "competition": row.competition, "source_url": row.source_url,
            "fetched_at": row.fetched_at.isoformat()}
