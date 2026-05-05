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
        """ラリー入力データを保存用の辞書へ変換する。

        Returns
        -------
        dict
            処理結果を表す辞書。
        """
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
    """フォーム入力値からラリー入力データを構築する。

    Parameters
    ----------
    set_no : int
        セット番号。
    server : str
        サーバーを表す値。
    serve_type : str
        サーブ種別。
    receive_type : str
        レシーブ種別。
    rally_len_bucket : str
        ラリー長の区分。
    point_winner : str
        得点者を表す値。
    end_reason : str
        ラリー終了理由。
    end_side : str
        ラリー終了位置。
    my_3rd : str
        自分の 3 球目の内容。
    my_3rd_result : str
        自分の 3 球目の結果。
    t_start : float
        ラリー開始時刻（秒）。
    t_end : float
        ラリー終了時刻（秒）。
    note : str
        任意メモ。

    Returns
    -------
    RallyInput
        構築したラリー入力データ。
    """
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
