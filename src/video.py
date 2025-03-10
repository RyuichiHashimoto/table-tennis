from moviepy.editor import VideoFileClip, concatenate_videoclips

def clip_and_merge(input_file, intervals, output_file):
    """
    MP4動画ファイルから指定された複数の時間区間を切り抜き、それらを結合して新たなMP4ファイルとして出力する。

    Parameters:
        input_file (str): 入力MP4ファイルのパス。
        intervals (list of tuple): 切り抜く区間のリスト。各要素は(start, end)形式のタプルで、
                                   秒数（float/int）または"HH:MM:SS"形式の文字列で指定する。
                                   例：[("00:00:30", "00:01:00"), (90, 120)]
        output_file (str): 結合後の出力MP4ファイルのパス。

    Returns:
        None

    Raises:
        OSError: 入力ファイルが存在しない場合や読み込めない場合。
        ValueError: 指定した時間区間が動画の長さを超えている場合や、形式が不正の場合。

    Examples:
        >>> intervals = [("00:01:00", "00:02:00"), (180, 240)]
        >>> clip_and_merge("input.mp4", intervals, "output.mp4")
    """
    clips = []
    with VideoFileClip(input_file) as video:
        for start, end in intervals:
            clip = video.subclip(start, end)
            clips.append(clip)
        final_clip = concatenate_videoclips(clips)
        final_clip.write_videofile(output_file, codec='libx264', audio_codec='aac')


import cv2
import mediapipe as mp

def pose_estimation(video_path, output_text_path, output_video_path):
    """
    指定した動画ファイルに対して骨格推定を実行し、
    各フレームのランドマーク座標をテキストファイルに出力するとともに、
    骨格推定の結果をオーバーレイした動画を作成して保存する。

    Args:
        video_path (str): 入力動画ファイルのパス。
        output_text_path (str): 骨格ランドマーク座標を保存するテキストファイルのパス。
        output_video_path (str): 骨格推定結果をオーバーレイした動画の出力パス。
    """
    # 骨格検出モデルの準備（MediaPipe）
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(min_detection_confidence=0.5,
                        min_tracking_confidence=0.5)
    mp_draw = mp.solutions.drawing_utils

    # 動画の読み込み
    cap = cv2.VideoCapture(video_path)

    # 結果の書き出し準備
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (frame_width, frame_height))

    # 骨格データのファイル出力準備
    with open(output_text_path, 'w') as f:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(frame_rgb)

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                landmark_str = ','.join(
                    [f'{landmark.x:.4f},{landmark.y:.4f},{landmark.z:.4f}' for landmark in landmarks])
                f.write(landmark_str + '\n')

                mp_draw.draw_landmarks(
                    frame, results.pose_landmarks, mp.solutions.pose.POSE_CONNECTIONS)

            # 骨格オーバーレイしたフレームを動画に書き込み
            out.write(frame)

            cv2.imshow('Pose Estimation', frame)

            if cv2.waitKey(1) & 0xFF == 27:
                break

    cap.release()
    out.release()
    cv2.destroyAllWindows()

def extract_right_half(input_file: str, output_file: str) -> None:
    """
    指定した映像ファイルから映像の右半分のみを抽出し、新しいファイルとして保存する。

    Parameters:
        input_file (str): 入力となる映像ファイルのパス。
        output_file (str): 出力する映像ファイルのパス。

    Returns:
        None

    Example:
        extract_right_half('input.mp4', 'output.mp4')
    """
    cap = cv2.VideoCapture(input_file)

    if not cap.isOpened():
        raise ValueError(f"映像ファイル {input_file} を開けませんでした。");

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    right_width = width // 2

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_file, fourcc, fps, (right_width, height))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        right_half = frame[:, right_width:]
        out.write(right_half)

    cap.release()
    out.release()
    cv2.destroyAllWindows()