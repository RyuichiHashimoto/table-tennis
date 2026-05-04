import json
import os
import subprocess
from pathlib import Path


def ensure_dir(path: str) -> Path:
    """指定されたディレクトリを作成して Path として返す。

    Parameters
    ----------
    path : str
        対象のパス。

    Returns
    -------
    Path
        作成または解決された Path。
    """
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def fetch_video_info(url: str) -> dict:
    """yt-dlp を使って動画メタデータを取得する。

    Parameters
    ----------
    url : str
        対象動画の URL。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def download_video(url: str, out_dir: str) -> str:
    """yt-dlp を使って動画をダウンロードする。

    Parameters
    ----------
    url : str
        対象動画の URL。
    out_dir : str
        出力先ディレクトリ。

    Returns
    -------
    str
        処理結果。
    """
    ensure_dir(out_dir)
    out_tpl = os.path.join(out_dir, "%(title).120B [%(id)s].%(ext)s")
    cmd = [
        "yt-dlp",
        "--merge-output-format",
        "mp4",
        "-o",
        out_tpl,
        "--print",
        "after_move:filepath",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    if not lines:
        raise RuntimeError("yt-dlp did not return output filepath.")
    return lines[-1]


def export_video_segments(video_path: str, segments: list[dict], out_dir: str | None = None) -> dict:
    """指定された動画区間を個別のクリップとして書き出す。

    Parameters
    ----------
    video_path : str
        対象動画ファイルのパス。
    segments : list[dict]
        切り出し対象の区間リスト。
    out_dir : str | None
        出力先ディレクトリ。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    input_path = Path(video_path)
    if not input_path.exists():
        raise RuntimeError(f"Video file does not exist: {video_path}")

    base_out_dir = Path(out_dir) if out_dir else (input_path.parent / "clips" / input_path.stem)
    ensure_dir(str(base_out_dir))

    clip_paths: list[str] = []
    for i, seg in enumerate(segments, start=1):
        start_sec = float(seg.get("start_sec", 0.0))
        end_sec = float(seg.get("end_sec", 0.0))
        duration_sec = end_sec - start_sec
        if duration_sec <= 0:
            continue

        clip_name = f"{input_path.stem}_seg{i:02d}_{start_sec:.2f}-{end_sec:.2f}.mp4"
        output_path = base_out_dir / clip_name
        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_sec:.3f}",
            "-i",
            str(input_path),
            "-t",
            f"{duration_sec:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        clip_paths.append(str(output_path))

    return {
        "source_path": str(input_path),
        "output_dir": str(base_out_dir),
        "num_clips": len(clip_paths),
        "clip_paths": clip_paths,
    }


def get_video_duration_sec(video_path: str) -> float:
    """ffprobe を使って動画の長さを秒単位で取得する。

    Parameters
    ----------
    video_path : str
        対象動画ファイルのパス。

    Returns
    -------
    float
        計算された数値。
    """
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    text = (proc.stdout or "").strip()
    return float(text) if text else 0.0


def detect_set_boundaries_auto(
    video_path: str,
    sample_every_sec: float = 1.0,
    min_break_sec: float = 20.0,
    base_motion_threshold: float = 0.008,
    edge_margin_sec: float = 10.0,
) -> dict:
    """低モーション区間を手がかりにセット境界を自動検出する。

    Parameters
    ----------
    video_path : str
        対象動画ファイルのパス。
    sample_every_sec : float
        動画をサンプリングする間隔（秒）。
    min_break_sec : float
        境界候補とみなす最小停止時間（秒）。
    base_motion_threshold : float
        動き量の下限しきい値。
    edge_margin_sec : float
        動画端を境界候補から除外する余白（秒）。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise RuntimeError("OpenCV (cv2) is not installed.") from exc

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = (frame_count / fps) if fps else 0.0
    interval_frames = int(max(fps * sample_every_sec, 1)) if fps else 1

    prev_gray = None
    idx = 0
    points: list[dict] = []
    motions: list[float] = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if idx % interval_frames != 0:
            idx += 1
            continue

        t = (idx / fps) if fps else 0.0
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is None:
            motion_score = 0.0
        else:
            diff = cv2.absdiff(gray, prev_gray)
            motion_score = float(diff.mean()) / 255.0
        prev_gray = gray

        motions.append(motion_score)
        points.append({"time_sec": t, "motion_score": motion_score})
        idx += 1

    cap.release()

    if not points:
        return {
            "path": video_path,
            "duration_sec": round(duration_sec, 2),
            "num_boundaries": 0,
            "boundaries_sec": [],
            "thresholds": {
                "sample_every_sec": sample_every_sec,
                "min_break_sec": min_break_sec,
                "base_motion_threshold": base_motion_threshold,
                "adaptive_motion_threshold": base_motion_threshold,
                "edge_margin_sec": edge_margin_sec,
            },
        }

    sorted_motions = sorted(motions)
    p30_idx = min(int(len(sorted_motions) * 0.30), len(sorted_motions) - 1)
    adaptive_motion_threshold = max(base_motion_threshold, sorted_motions[p30_idx])

    low_motion_ranges: list[tuple[float, float]] = []
    run_start = None
    run_last = None
    for p in points:
        t = float(p["time_sec"])
        is_low_motion = float(p["motion_score"]) <= adaptive_motion_threshold
        if is_low_motion:
            if run_start is None:
                run_start = t
            run_last = t
        else:
            if run_start is not None and run_last is not None:
                low_motion_ranges.append((run_start, run_last + sample_every_sec))
            run_start = None
            run_last = None
    if run_start is not None and run_last is not None:
        low_motion_ranges.append((run_start, run_last + sample_every_sec))

    boundaries_sec: list[float] = []
    for start, end in low_motion_ranges:
        break_len = end - start
        if break_len < min_break_sec:
            continue
        candidate = start + break_len / 2.0
        if candidate <= edge_margin_sec:
            continue
        if duration_sec > 0 and candidate >= max(duration_sec - edge_margin_sec, 0.0):
            continue
        boundaries_sec.append(round(candidate, 2))

    boundaries_sec = sorted(set(boundaries_sec))
    return {
        "path": video_path,
        "duration_sec": round(duration_sec, 2),
        "num_boundaries": len(boundaries_sec),
        "boundaries_sec": boundaries_sec,
        "thresholds": {
            "sample_every_sec": sample_every_sec,
            "min_break_sec": min_break_sec,
            "base_motion_threshold": base_motion_threshold,
            "adaptive_motion_threshold": round(adaptive_motion_threshold, 6),
            "edge_margin_sec": edge_margin_sec,
        },
    }


def analyze_video_basic(video_path: str, sample_every_sec: float = 1.0, max_samples: int = 300) -> dict:
    """動画の基本情報と簡易的な明るさ指標を取得する。

    Parameters
    ----------
    video_path : str
        対象動画ファイルのパス。
    sample_every_sec : float
        動画をサンプリングする間隔（秒）。
    max_samples : int
        取得する最大サンプル数。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise RuntimeError("OpenCV (cv2) is not installed.") from exc

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_sec = (frame_count / fps) if fps else 0.0

    interval_frames = int(max(fps * sample_every_sec, 1)) if fps else 1
    brightness_total = 0.0
    sampled = 0
    idx = 0

    while sampled < max_samples:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % interval_frames == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness_total += float(gray.mean())
            sampled += 1
        idx += 1

    cap.release()
    avg_brightness = (brightness_total / sampled) if sampled else 0.0

    return {
        "path": video_path,
        "duration_sec": round(duration_sec, 2),
        "fps": round(float(fps), 3),
        "frame_count": frame_count,
        "width": width,
        "height": height,
        "sampled_frames": sampled,
        "avg_brightness": round(avg_brightness, 3),
    }


def _merge_segments(segments: list[tuple[float, float]], bridge_gap_sec: float) -> list[tuple[float, float]]:
    """近接する動画区間を結合する。

    Parameters
    ----------
    segments : list[tuple[float, float]]
        切り出し対象の区間リスト。
    bridge_gap_sec : float
        結合する区間間隔の上限（秒）。

    Returns
    -------
    list[tuple[float, float]]
        開始時刻と終了時刻のタプルリスト。
    """
    if not segments:
        return []
    merged = [segments[0]]
    for start, end in segments[1:]:
        prev_start, prev_end = merged[-1]
        if start - prev_end <= bridge_gap_sec:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def extract_match_segments(
    video_path: str,
    sample_every_sec: float = 0.5,
    table_ratio_threshold: float = 0.12,
    motion_threshold: float = 0.015,
    min_segment_sec: float = 5.0,
    bridge_gap_sec: float = 2.0,
) -> dict:
    """卓球台らしさと動き量から試合区間を抽出する。

    Parameters
    ----------
    video_path : str
        対象動画ファイルのパス。
    sample_every_sec : float
        動画をサンプリングする間隔（秒）。
    table_ratio_threshold : float
        卓球台らしさのしきい値。
    motion_threshold : float
        動き量のしきい値。
    min_segment_sec : float
        採用する最小区間長（秒）。
    bridge_gap_sec : float
        結合する区間間隔の上限（秒）。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise RuntimeError("OpenCV (cv2) is not installed.") from exc

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = (frame_count / fps) if fps else 0.0
    interval_frames = int(max(fps * sample_every_sec, 1)) if fps else 1

    prev_gray = None
    idx = 0
    sampled_points = []
    raw_segments: list[tuple[float, float]] = []
    current_start = None
    current_end = None

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if idx % interval_frames != 0:
            idx += 1
            continue

        t = (idx / fps) if fps else 0.0
        h, w = frame.shape[:2]

        # Table likely exists around center-lower area for fixed-camera personal recordings.
        y1, y2 = int(h * 0.35), int(h * 0.90)
        x1, x2 = int(w * 0.10), int(w * 0.90)
        roi = frame[y1:y2, x1:x2]
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        # Blue/green-ish mask for typical table colors.
        mask1 = cv2.inRange(hsv, (70, 30, 30), (140, 255, 255))
        table_ratio = float(mask1.mean()) / 255.0

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is None:
            motion_score = 0.0
        else:
            diff = cv2.absdiff(gray, prev_gray)
            motion_score = float(diff.mean()) / 255.0
        prev_gray = gray

        is_match_frame = (table_ratio >= table_ratio_threshold) and (motion_score >= motion_threshold)
        sampled_points.append(
            {
                "time_sec": round(t, 2),
                "table_ratio": round(table_ratio, 4),
                "motion_score": round(motion_score, 4),
                "is_match_frame": is_match_frame,
            }
        )

        if is_match_frame:
            if current_start is None:
                current_start = t
            current_end = t + sample_every_sec
        else:
            if current_start is not None and current_end is not None:
                raw_segments.append((current_start, current_end))
            current_start = None
            current_end = None

        idx += 1

    if current_start is not None and current_end is not None:
        raw_segments.append((current_start, current_end))

    cap.release()

    merged = _merge_segments(raw_segments, bridge_gap_sec=bridge_gap_sec)
    segments = []
    for start, end in merged:
        duration = end - start
        if duration >= min_segment_sec:
            segments.append(
                {
                    "start_sec": round(start, 2),
                    "end_sec": round(end, 2),
                    "duration_sec": round(duration, 2),
                }
            )

    return {
        "path": video_path,
        "duration_sec": round(duration_sec, 2),
        "sample_every_sec": sample_every_sec,
        "thresholds": {
            "table_ratio_threshold": table_ratio_threshold,
            "motion_threshold": motion_threshold,
            "min_segment_sec": min_segment_sec,
            "bridge_gap_sec": bridge_gap_sec,
        },
        "num_segments": len(segments),
        "segments": segments,
        "sampled_points": sampled_points,
    }
