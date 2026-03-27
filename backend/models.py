from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Optional


@dataclass
class RallyInput:
    set_no: int
    server: str
    serve_type: Optional[str]
    receive_type: str
    rally_len_bucket: str
    point_winner: str
    end_reason: str
    end_side: str
    my_3rd: Optional[str]
    my_3rd_result: Optional[str]
    t_start: Optional[float]
    t_end: Optional[float]
    note: Optional[str]
    created_at: str

    def to_record(self) -> dict:
        payload = asdict(self)
        if payload["my_3rd"] == "none":
            payload["my_3rd_result"] = "na"
        return payload


def build_rally_input(
    set_no: int,
    server: str,
    serve_type: str,
    receive_type: str,
    rally_len_bucket: str,
    point_winner: str,
    end_reason: str,
    end_side: str,
    my_3rd: str,
    my_3rd_result: str,
    t_start: float,
    t_end: float,
    note: str,
) -> RallyInput:
    return RallyInput(
        set_no=int(set_no),
        server=server,
        serve_type=serve_type if serve_type else None,
        receive_type=receive_type,
        rally_len_bucket=rally_len_bucket,
        point_winner=point_winner,
        end_reason=end_reason,
        end_side=end_side,
        my_3rd=my_3rd if my_3rd else None,
        my_3rd_result=my_3rd_result if my_3rd_result else None,
        t_start=float(t_start) if t_start else None,
        t_end=float(t_end) if t_end else None,
        note=note if note else None,
        created_at=datetime.now().isoformat(timespec="seconds"),
    )
