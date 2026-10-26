import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Flag, Info, LucideAngularModule, Minus, Play, Plus, SkipBack, Undo2 } from 'lucide-angular';
import { Match, PointInsertion, PointMoveHistory, Rally, Side } from '../../table-tennis/models/models';
import { AppStateService, MatchInputState } from '../../table-tennis/services/app-state.service';
import { nextServer } from './mobile-match.logic';
import { MobileScreen } from './mobile-match.models';

type RecordingState = 'idle' | 'recording' | 'editing' | 'saving';
type CorrectionMode = 'boundary' | 'points';
type RallyReason =
  | 'own_attack_success'
  | 'serve_point'
  | 'receive_point'
  | 'opponent_error'
  | 'own_attack_error'
  | 'serve_error'
  | 'receive_error'
  | 'opponent_attack_success'
  | 'other';

interface ReasonOption {
  value: RallyReason;
  label: string;
  icon: string;
}

interface PointRow extends Rally {
  myScore: number;
  opponentScore: number;
  rallyNumber: number;
}

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  cueVideoById(videoId: string): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubeApi {
  Player: new (
    elementId: string,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
const PLAYER_ELEMENT_ID = 'match-youtube-player';
const PLAYER_ENDED = 0;
const PLAYER_PLAYING = 1;
const PLAYER_PAUSED = 2;
const DEFAULT_SEGMENT_SECONDS = 5;


@Component({
  selector: 'app-mobile-match-app',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './mobile-match-app.component.html',
  styleUrl: './mobile-match-app.component.css',
})
export class MobileMatchAppComponent implements OnInit, OnDestroy {
  readonly FlagIcon = Flag;
  readonly PlayIcon = Play;
  readonly PlusIcon = Plus;
  readonly MinusIcon = Minus;
  readonly Undo2Icon = Undo2;
  readonly SkipBackIcon = SkipBack;
  readonly InfoIcon = Info;

  @Input() fixedScreen?: MobileScreen;
  @Input() preview = false;
  @Output() screenChange = new EventEmitter<MobileScreen>();

  activeScreen: MobileScreen = 'record';
  match?: Match;
  rallies: Rally[] = [];
  selectedSet = 1;
  recordingState: RecordingState = 'idle';
  rallyStartTime?: number;
  rallyEndTime?: number;
  pendingWinner: Side = 'me';
  selectedReason?: RallyReason;
  note = '';
  currentTime = 0;
  isPlayerReady = false;
  videoEnded = false;
  youtubeUrl = '';
  youtubeDraft = '';
  youtubeVideoId = '';
  isLoading = true;
  isSavingVideo = false;
  loadError = '';
  formError = '';
  toast = '';
  isCorrectionMode = false;
  correctionMode: CorrectionMode = 'boundary';
  selectedPointIds = new Set<number>();
  selectionAnchorId?: number;
  targetSet = 2;
  insertion: PointInsertion = 'end';
  insertAfterPointId?: number;
  isMovePreviewOpen = false;
  isSavingCorrection = false;
  correctionError = '';
  latestMove?: PointMoveHistory;
  private correctionOperationId = '';

  readonly scoreReasons: ReasonOption[] = [
    { value: 'own_attack_success', label: '自分の攻撃成功', icon: '⚡' },
    { value: 'serve_point', label: 'サーブで得点', icon: '◉' },
    { value: 'receive_point', label: 'レシーブで得点', icon: '↶' },
    { value: 'opponent_error', label: '相手のミス', icon: '▲' },
    { value: 'other', label: 'その他', icon: '…' },
  ];
  readonly lossReasons: ReasonOption[] = [
    { value: 'own_attack_error', label: '自分の攻撃ミス', icon: '⚠' },
    { value: 'serve_error', label: 'サーブミス', icon: '◉' },
    { value: 'receive_error', label: 'レシーブミス', icon: '↶' },
    { value: 'opponent_attack_success', label: '相手の攻撃成功', icon: '⚡' },
    { value: 'other', label: 'その他', icon: '…' },
  ];

  private matchUuid = '';
  private player?: YouTubePlayer;
  private inputState: MatchInputState = this.emptyInputState();
  private timeTimer?: ReturnType<typeof setInterval>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private playerInitToken = 0;

  constructor(
    private readonly state: AppStateService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const matchUuid = params.get('uuid');
      if (!matchUuid) {
        void this.router.navigate(['/matches']);
        return;
      }
      void this.loadMatch(matchUuid);
    });
  }

  ngOnDestroy(): void {
    this.destroyPlayer();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  get screen(): MobileScreen {
    return this.fixedScreen ?? this.activeScreen;
  }

  get matchTitle(): string {
    if (!this.match) return '試合を読み込み中';
    return `${this.match.myPlayerName || '自分'} vs ${this.match.opponentPlayerName || '相手'}`;
  }

  get availableSets(): number[] {
    return Array.from({ length: this.match?.bestOf ?? 5 }, (_, index) => index + 1);
  }

  get currentRallies(): Rally[] {
    return this.rallies.filter((rally) => rally.setNo === this.selectedSet);
  }

  get pointRows(): PointRow[] {
    let myScore = 0;
    let opponentScore = 0;
    return this.currentRallies.map((rally, index) => {
      if (rally.pointWinner === 'me') myScore += 1;
      else opponentScore += 1;
      return { ...rally, myScore, opponentScore, rallyNumber: index + 1 };
    });
  }

  get selectedPoints(): Rally[] {
    return this.rallies.filter((rally) => this.selectedPointIds.has(rally.id));
  }

  get targetSetPoints(): Rally[] {
    return this.rallies.filter((rally) => rally.setNo === this.targetSet && !this.selectedPointIds.has(rally.id));
  }

  get canPreviewCorrection(): boolean {
    return this.selectedPointIds.size > 0
      && this.targetSet !== this.selectedSet
      && (this.insertion !== 'after' || this.insertAfterPointId !== undefined)
      && !this.isSavingCorrection;
  }

  get previewSourceRows(): Rally[] {
    return this.rallies.filter((rally) => rally.setNo === this.selectedSet && !this.selectedPointIds.has(rally.id));
  }

  get previewTargetRows(): Rally[] {
    const target = [...this.targetSetPoints];
    const moved = [...this.selectedPoints];
    let index = target.length;
    if (this.insertion === 'start') index = 0;
    if (this.insertion === 'after') {
      const anchorIndex = target.findIndex((rally) => rally.id === this.insertAfterPointId);
      index = anchorIndex >= 0 ? anchorIndex + 1 : target.length;
    }
    target.splice(index, 0, ...moved);
    return target;
  }

  get movedPointRangeLabel(): string {
    const rows = this.pointRows.filter((row) => this.selectedPointIds.has(row.id));
    if (!rows.length) return '未選択';
    if (rows.length === 1) return `#${rows[0].rallyNumber}`;
    const numbers = rows.map((row) => row.rallyNumber);
    const continuous = numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);
    return continuous ? `#${numbers[0]}〜#${numbers.at(-1)}` : numbers.map((value) => `#${value}`).join('、');
  }

  get score(): { me: number; op: number } {
    const last = this.pointRows.at(-1);
    return { me: last?.myScore ?? 0, op: last?.opponentScore ?? 0 };
  }

  get server(): Side {
    return nextServer(this.score, this.match?.initialServer ?? 'me');
  }

  get rallyNumber(): number {
    return this.currentRallies.length + 1;
  }

  get lastRally(): Rally | undefined {
    return this.rallies.at(-1);
  }

  get reasons(): ReasonOption[] {
    return this.pendingWinner === 'me' ? this.scoreReasons : this.lossReasons;
  }

  get rallyDuration(): number {
    if (this.rallyStartTime === undefined || this.rallyEndTime === undefined) return 0;
    return Math.max(0, this.rallyEndTime - this.rallyStartTime);
  }

  get hasPendingRally(): boolean {
    return this.recordingState !== 'idle';
  }

  navigate(screen: MobileScreen): void {
    if (this.fixedScreen && this.preview) return;
    if (screen !== 'record' && this.hasPendingRally) {
      this.showToast('入力中のラリーを完了またはリセットしてください');
      return;
    }
    this.activeScreen = screen;
    this.screenChange.emit(screen);
  }

  goBack(): void {
    void this.router.navigate(['/matches']);
  }

  openSettings(): void {
    if (!this.matchUuid) return;
    void this.router.navigate(['/match', this.matchUuid, 'summary']);
  }

  selectSet(setNo: number): void {
    if (setNo === this.selectedSet) return;
    if (this.hasPendingRally) {
      this.showToast('入力中のラリーを完了またはリセットしてください');
      return;
    }
    this.selectedSet = setNo;
    if (this.isCorrectionMode) {
      this.selectedPointIds.clear();
      this.selectionAnchorId = undefined;
      this.targetSet = this.availableSets.find((value) => value !== setNo) ?? setNo;
      this.insertion = 'end';
      this.insertAfterPointId = undefined;
      this.correctionError = '';
    }
    this.inputState = { ...this.inputState, form: { ...this.inputState.form, setNo } };
    void this.state.saveMatchInputState(this.matchUuid, this.inputState).catch((error: unknown) => {
      this.showToast(this.errorMessage(error, 'ゲーム選択を保存できませんでした'));
    });
  }

  startCorrection(): void {
    if (this.hasPendingRally) {
      this.showToast('入力中のラリーを完了またはリセットしてください');
      return;
    }
    this.isCorrectionMode = true;
    this.correctionMode = 'boundary';
    this.selectedPointIds.clear();
    this.selectionAnchorId = undefined;
    this.targetSet = this.availableSets.find((setNo) => setNo > this.selectedSet)
      ?? this.availableSets.find((setNo) => setNo !== this.selectedSet)
      ?? this.selectedSet;
    this.insertion = 'end';
    this.insertAfterPointId = undefined;
    this.correctionError = '';
  }

  cancelCorrection(): void {
    if (this.isSavingCorrection) return;
    this.isCorrectionMode = false;
    this.isMovePreviewOpen = false;
    this.selectedPointIds.clear();
    this.selectionAnchorId = undefined;
    this.correctionOperationId = '';
    this.correctionError = '';
  }

  setCorrectionMode(mode: CorrectionMode): void {
    if (this.correctionMode === mode) return;
    this.correctionMode = mode;
    this.selectedPointIds.clear();
    this.selectionAnchorId = undefined;
    this.correctionError = '';
  }

  selectCorrectionPoint(row: PointRow, event?: MouseEvent): void {
    if (!this.isCorrectionMode) return;
    if (this.correctionMode === 'boundary') {
      const startIndex = this.pointRows.findIndex((point) => point.id === row.id);
      this.selectedPointIds = new Set(this.pointRows.slice(startIndex).map((point) => point.id));
      this.selectionAnchorId = row.id;
    } else if (event?.shiftKey && this.selectionAnchorId !== undefined) {
      this.selectPointRange(row.id);
    } else {
      const next = new Set(this.selectedPointIds);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      this.selectedPointIds = next;
      this.selectionAnchorId = row.id;
    }
    this.chooseNaturalInsertion();
    this.correctionError = '';
  }

  selectPointRange(pointId: number): void {
    const anchorIndex = this.pointRows.findIndex((row) => row.id === this.selectionAnchorId);
    const targetIndex = this.pointRows.findIndex((row) => row.id === pointId);
    if (anchorIndex < 0 || targetIndex < 0) return;
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    const next = new Set(this.selectedPointIds);
    this.pointRows.slice(start, end + 1).forEach((row) => next.add(row.id));
    this.selectedPointIds = next;
    this.chooseNaturalInsertion();
  }

  selectAllPoints(): void {
    this.selectedPointIds = new Set(this.pointRows.map((row) => row.id));
    this.selectionAnchorId = this.pointRows[0]?.id;
    this.chooseNaturalInsertion();
  }

  clearPointSelection(): void {
    this.selectedPointIds.clear();
    this.selectionAnchorId = undefined;
  }

  changeTargetSet(setNo: number): void {
    this.targetSet = setNo;
    this.chooseNaturalInsertion();
  }

  changeInsertion(insertion: PointInsertion): void {
    this.insertion = insertion;
    if (insertion !== 'after') this.insertAfterPointId = undefined;
    else this.insertAfterPointId = this.targetSetPoints.at(-1)?.id;
  }

  scoreOf(rows: Rally[]): { me: number; op: number } {
    return {
      me: rows.filter((row) => row.pointWinner === 'me').length,
      op: rows.filter((row) => row.pointWinner === 'op').length,
    };
  }

  openMovePreview(): void {
    if (!this.canPreviewCorrection) return;
    this.correctionOperationId = this.createOperationId();
    this.isMovePreviewOpen = true;
    this.correctionError = '';
  }

  closeMovePreview(): void {
    if (this.isSavingCorrection) return;
    this.isMovePreviewOpen = false;
    this.correctionOperationId = '';
    this.correctionError = '';
  }

  async savePointMove(): Promise<void> {
    if (!this.canPreviewCorrection || !this.correctionOperationId) return;
    this.isSavingCorrection = true;
    this.correctionError = '';
    try {
      this.latestMove = await this.state.moveRallies(this.matchUuid, {
        pointIds: this.selectedPoints.map((point) => point.id),
        targetSetNo: this.targetSet,
        insertion: this.insertion,
        insertAfterPointId: this.insertAfterPointId,
        clientOperationId: this.correctionOperationId,
        expectedPoints: this.rallies,
      });
      this.rallies = this.state.getRallies(this.matchUuid);
      this.isSavingCorrection = false;
      this.cancelCorrection();
      this.showToast(`${this.latestMove.pointIds.length}件の所属ゲームを修正しました`);
    } catch (error) {
      this.correctionError = this.errorMessage(error, '修正を保存できませんでした。再読み込みしてお試しください。');
    } finally {
      this.isSavingCorrection = false;
    }
  }

  async undoLatestMove(): Promise<void> {
    if (!this.latestMove || this.latestMove.undoneAt || this.isSavingCorrection) return;
    if (!window.confirm(`第${this.latestMove.sourceSetNo}ゲームから第${this.latestMove.targetSetNo}ゲームへの修正を元に戻しますか？`)) return;
    this.isSavingCorrection = true;
    try {
      this.latestMove = await this.state.undoPointMove(this.matchUuid, this.latestMove.operationId);
      this.rallies = this.state.getRallies(this.matchUuid);
      this.showToast('セット修正を元に戻しました');
    } catch (error) {
      this.showToast(this.errorMessage(error, 'その後に変更があるため元に戻せませんでした'));
    } finally {
      this.isSavingCorrection = false;
    }
  }

  seekVideo(seconds: number): void {
    const safeTime = Math.max(0, seconds);
    if (!this.youtubeVideoId) {
      this.showToast('先にYouTube動画を設定してください');
      return;
    }
    if (!this.ensurePlayerReady()) return;
    this.player?.seekTo(safeTime, true);
    this.currentTime = safeTime;
    this.videoEnded = false;
    this.navigate('record');
  }

  startRally(): void {
    if (this.recordingState !== 'idle') {
      this.showToast('すでにラリーを記録中です');
      return;
    }
    const time = this.readPlayerTime();
    if (time === undefined) return;
    this.rallyStartTime = time;
    this.rallyEndTime = undefined;
    this.selectedReason = undefined;
    this.note = '';
    this.recordingState = 'recording';
    this.showToast('ラリーの記録を開始しました');
  }

  resetRally(): void {
    if (this.recordingState === 'saving') return;
    this.recordingState = 'idle';
    this.clearRallyDraft();
  }

  private clearRallyDraft(): void {
    this.rallyStartTime = undefined;
    this.rallyEndTime = undefined;
    this.selectedReason = undefined;
    this.note = '';
    this.formError = '';
  }

  openResultPanel(winner: Side): void {
    if (this.recordingState !== 'recording') return;
    const time = this.readPlayerTime();
    if (time === undefined) return;
    this.rallyEndTime = Math.max(time, this.rallyStartTime ?? time);
    this.pendingWinner = winner;
    this.selectedReason = undefined;
    this.formError = '';
    this.player?.pauseVideo();
    this.recordingState = 'editing';
  }

  changeWinner(winner: Side): void {
    if (this.pendingWinner === winner) return;
    this.pendingWinner = winner;
    this.selectedReason = undefined;
  }

  closeResultPanel(): void {
    if (this.recordingState === 'saving') return;
    this.recordingState = 'recording';
    this.rallyEndTime = undefined;
    this.formError = '';
  }

  async saveRally(): Promise<void> {
    if (this.recordingState !== 'editing' || this.rallyStartTime === undefined || this.rallyEndTime === undefined) return;
    if (!this.selectedReason) {
      this.formError = '得失点理由を1つ選択してください。';
      return;
    }
    this.recordingState = 'saving';
    this.formError = '';
    try {
      await this.state.addRally({
        matchId: this.match?.id ?? 0,
        matchUuid: this.matchUuid,
        setNo: this.selectedSet,
        server: this.server,
        serveType: '',
        receiveType: '',
        rallyLenBucket: '',
        pointWinner: this.pendingWinner,
        endReason: this.selectedReason,
        endSide: '',
        my3rd: 'none',
        my3rdResult: 'na',
        resultTags: [this.selectedReason],
        tStart: this.roundTime(this.rallyStartTime),
        tEnd: this.roundTime(this.rallyEndTime),
        note: this.note.trim(),
      });
      this.rallies = this.state.getRallies(this.matchUuid);
      const winnerLabel = this.pendingWinner === 'me' ? '得点' : '失点';
      this.recordingState = 'idle';
      this.clearRallyDraft();
      this.player?.playVideo();
      this.videoEnded = false;
      this.showToast(`${winnerLabel}を記録しました`);
    } catch (error) {
      this.recordingState = 'editing';
      this.formError = this.errorMessage(error, '記録を保存できませんでした。入力内容は保持されています。');
    }
  }

  async undo(): Promise<void> {
    if (!this.rallies.length || this.hasPendingRally) return;
    const last = this.rallies.at(-1);
    if (!last || !window.confirm(`直前の記録（第${last.setNo}ゲーム）を取り消しますか？`)) return;
    try {
      const deleted = await this.state.deleteLastRally(this.matchUuid);
      if (!deleted) throw new Error('取り消せる記録がありません。');
      this.rallies = this.state.getRallies(this.matchUuid);
      this.showToast('直前の記録を取り消しました');
    } catch (error) {
      this.showToast(this.errorMessage(error, '記録を取り消せませんでした'));
    }
  }

  returnToLastRally(): void {
    const rally = this.lastRally;
    if (!rally || rally.tEnd === undefined) {
      this.showToast('終了時刻が記録されたラリーがありません');
      return;
    }
    if (!this.ensurePlayerReady()) return;
    if (rally.setNo !== this.selectedSet) this.selectSet(rally.setNo);
    // seekTo() keeps the current play/pause state. Calling playVideo() or
    // pauseVideo() again makes YouTube reopen its full control overlay.
    this.player?.seekTo(rally.tEnd, true);
    this.currentTime = rally.tEnd;
    this.videoEnded = false;
  }

  async saveYoutubeUrl(): Promise<void> {
    const videoId = this.extractYoutubeVideoId(this.youtubeDraft);
    if (!videoId) {
      this.formError = '正しいYouTube URLまたは動画IDを入力してください。';
      return;
    }
    this.isSavingVideo = true;
    this.formError = '';
    try {
      this.youtubeUrl = this.youtubeDraft.trim();
      this.inputState = { ...this.inputState, youtubeUrl: this.youtubeUrl, videoSourceUrl: '' };
      await this.state.saveMatchInputState(this.matchUuid, this.inputState);
      this.youtubeVideoId = videoId;
      if (this.player && this.isPlayerReady) {
        this.player.cueVideoById(videoId);
        this.currentTime = 0;
        this.videoEnded = false;
      } else {
        this.playerInitToken += 1;
        const token = this.playerInitToken;
        setTimeout(() => {
          if (token === this.playerInitToken) void this.initializePlayer();
        });
      }
      this.showToast('YouTube動画を保存しました');
    } catch (error) {
      this.formError = this.errorMessage(error, 'YouTube動画を保存できませんでした。');
    } finally {
      this.isSavingVideo = false;
    }
  }

  reasonLabel(rally: Rally): string {
    const reason = rally.resultTags?.[0] ?? rally.endReason;
    return [...this.scoreReasons, ...this.lossReasons].find((option) => option.value === reason)?.label
      ?? reason
      ?? '理由未設定';
  }

  winnerLabel(winner: Side): string {
    return winner === 'me' ? '自分の得点' : '自分の失点';
  }

  formatTime(seconds: number | undefined, tenths = false): string {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const wholeSeconds = Math.floor(value % 60);
    const fraction = tenths ? `.${Math.floor((value % 1) * 10)}` : '';
    return `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}${fraction}`;
  }

  trackRally(_: number, row: PointRow): number {
    return row.id;
  }

  handleDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.closeResultPanel();
  }

  private async loadMatch(matchUuid: string): Promise<void> {
    this.destroyPlayer();
    this.matchUuid = matchUuid;
    this.isLoading = true;
    this.loadError = '';
    try {
      const [match, rallies, inputState] = await Promise.all([
        this.state.loadMatch(matchUuid),
        this.state.loadRallies(matchUuid),
        this.state.getMatchInputState(matchUuid),
      ]);
      if (!match) throw new Error('試合が見つかりませんでした。');
      this.match = match;
      this.rallies = rallies;
      this.inputState = inputState ?? this.emptyInputState();
      const savedSet = Number(this.inputState.form.setNo);
      this.selectedSet = Number.isInteger(savedSet) && savedSet >= 1 && savedSet <= match.bestOf ? savedSet : 1;
      this.youtubeUrl = this.inputState.youtubeUrl || this.inputState.videoSourceUrl;
      this.youtubeDraft = this.youtubeUrl;
      this.youtubeVideoId = this.extractYoutubeVideoId(this.youtubeUrl) ?? '';
      this.state.setSelectedMatchUuid(matchUuid);
      try {
        const history = await this.state.loadPointMoveHistory(matchUuid, 1);
        this.latestMove = history.find((item) => !item.undoneAt);
      } catch (error) {
        this.showToast(this.errorMessage(error, '修正履歴を読み込めませんでした'));
      }
      if (this.youtubeVideoId) setTimeout(() => void this.initializePlayer());
    } catch (error) {
      this.loadError = this.errorMessage(error, '試合情報を読み込めませんでした。');
    } finally {
      this.isLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  private async initializePlayer(): Promise<void> {
    if (!this.youtubeVideoId || typeof document === 'undefined') return;
    try {
      const youtube = await this.loadYoutubeApi();
      if (!document.getElementById(PLAYER_ELEMENT_ID)) return;
      this.player = new youtube.Player(PLAYER_ELEMENT_ID, {
        width: '100%',
        height: '100%',
        videoId: this.youtubeVideoId,
        playerVars: { playsinline: 1, rel: 0, enablejsapi: 1 },
        events: {
          onReady: (event) => this.zone.run(() => {
            this.player = event.target;
            this.isPlayerReady = true;
            if (this.currentTime > 0) event.target.seekTo(this.currentTime, true);
            else this.currentTime = event.target.getCurrentTime() || 0;
          }),
          onStateChange: (event) => this.zone.run(() => this.onPlayerStateChange(event)),
          onError: () => this.zone.run(() => {
            this.isPlayerReady = false;
            this.showToast('YouTube動画を再生できませんでした');
          }),
        },
      });
    } catch (error) {
      this.showToast(this.errorMessage(error, 'YouTubeプレイヤーを読み込めませんでした'));
    }
  }

  private loadYoutubeApi(): Promise<YouTubeApi> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    return new Promise<YouTubeApi>((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube APIの初期化に失敗しました'));
      };
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_API_URL}"]`);
      if (existing) return;
      const script = document.createElement('script');
      script.src = YOUTUBE_API_URL;
      script.async = true;
      script.onerror = () => reject(new Error('YouTube APIを読み込めませんでした'));
      document.head.appendChild(script);
    });
  }

  private onPlayerStateChange(event: YouTubePlayerEvent): void {
    this.videoEnded = event.data === PLAYER_ENDED;
    if (event.data === PLAYER_PLAYING) this.startTimePolling();
    if (event.data === PLAYER_PAUSED || event.data === PLAYER_ENDED) {
      this.updateCurrentTime();
      this.stopTimePolling();
    }
  }

  private startTimePolling(): void {
    this.stopTimePolling();
    this.timeTimer = setInterval(() => this.zone.run(() => this.updateCurrentTime()), 250);
  }

  private stopTimePolling(): void {
    if (this.timeTimer) clearInterval(this.timeTimer);
    this.timeTimer = undefined;
  }

  private updateCurrentTime(): void {
    const time = this.player?.getCurrentTime();
    if (time !== undefined && Number.isFinite(time)) this.currentTime = time;
  }

  private readPlayerTime(): number | undefined {
    if (!this.ensurePlayerReady()) return undefined;
    const time = this.player?.getCurrentTime();
    if (time === undefined || !Number.isFinite(time) || time < 0) {
      this.showToast('動画の再生位置を取得できませんでした');
      return undefined;
    }
    this.currentTime = time;
    return time;
  }

  private ensurePlayerReady(): boolean {
    if (this.isPlayerReady && this.player) return true;
    this.showToast('動画の準備が完了してから操作してください');
    return false;
  }

  private extractYoutubeVideoId(value: string): string | undefined {
    const trimmed = value.trim();
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0]?.slice(0, 11);
      if (url.hostname.endsWith('youtube.com')) {
        const id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1];
        return id && /^[\w-]{11}$/.test(id) ? id : undefined;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private destroyPlayer(): void {
    this.stopTimePolling();
    this.player?.destroy();
    this.player = undefined;
    this.isPlayerReady = false;
  }

  private roundTime(seconds: number): number {
    return Math.round(seconds * 1000) / 1000;
  }

  private chooseNaturalInsertion(): void {
    const movedTimes = this.selectedPoints
      .map((point) => point.tStart)
      .filter((time): time is number => time !== undefined);
    const target = this.targetSetPoints;
    if (!target.length || !movedTimes.length) {
      this.insertion = 'end';
      this.insertAfterPointId = undefined;
      return;
    }
    const firstMovedTime = Math.min(...movedTimes);
    const prior = target.filter((point) => point.tStart !== undefined && point.tStart <= firstMovedTime).at(-1);
    if (!prior) {
      this.insertion = 'start';
      this.insertAfterPointId = undefined;
      return;
    }
    this.insertion = 'after';
    this.insertAfterPointId = prior.id;
  }

  private createOperationId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private emptyInputState(): MatchInputState {
    return {
      youtubeUrl: '', videoSourceUrl: '', videoTitle: '', sourceKind: 'remote',
      form: {
        setNo: 1, server: 'me', serveType: '', receiveType: '', rallyLenBucket: '',
        pointWinner: 'me', endReason: '', endSide: '', my3rd: 'none', my3rdResult: 'na',
        tStart: 0, tEnd: 0, note: '',
      },
      confirmedSegments: [], manualStartSec: 0, manualEndSec: DEFAULT_SEGMENT_SECONDS, clipScope: '動画全体',
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private showToast(message: string): void {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 2800);
  }
}
