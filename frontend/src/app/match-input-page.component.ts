import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppStateService, MatchInputState } from './shared/app-state.service';
import { Match, Rally, RallyResultTag, RallyTagDefinition, Segment } from './shared/models';
import { runtimeConfig } from './shared/runtime-config';
import { MatchTimelinePanelComponent } from './match-timeline-panel.component';
import { MatchVideoPanelComponent } from './match-video-panel.component';

@Component({
  selector: 'app-match-input-page',
  standalone: true,
  imports: [CommonModule, MatchVideoPanelComponent, MatchTimelinePanelComponent],
  templateUrl: './match-input-page.component.html',
  styleUrl: './match-input-page.component.css',
})
export class MatchInputPageComponent implements OnInit {
  @ViewChild(MatchVideoPanelComponent) videoPanel?: MatchVideoPanelComponent;

  readonly apiBase = runtimeConfig.apiBase;

  match?: Match;
  currentVideoTime = 0;
  matchStartTime?: number;
  rallyStartTime?: number;
  youtubeUrl = '';
  videoSourceUrl = '';
  videoTitle = '';
  isLoadingVideo = false;
  uploadedObjectUrl = '';
  videoSourceKind: 'remote' | 'uploaded' = 'remote';
  confirmedSegments: Segment[] = [];
  manualStartSec = 0;
  manualEndSec = 5;
  clipScope = '動画全体';
  selectedRallyId?: number;
  editingRallyId?: number;
  selectedSetNo = 1;
  insertAfterRallyId?: number;
  message = '';
  tagDefinitions: RallyTagDefinition[] = [];

  form = this.defaultForm();

  constructor(
    private readonly state: AppStateService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.state.ensureDefaultMatch('2026-03-04 vs practice');
    this.tagDefinitions = await this.state.loadTagDefinitions();
    this.route.paramMap.subscribe((params) => {
      const matchUuid = params.get('uuid');
      if (!matchUuid) {
        void this.router.navigate(['/matches']);
        return;
      }
      void this.openMatch(matchUuid);
    });
  }

  get rallies(): Rally[] {
    return this.match ? this.state.getRallies(this.match.uuid) : [];
  }

  get selectedRally(): Rally | undefined {
    return this.rallies.find((rally) => rally.id === this.selectedRallyId);
  }

  get editingRally(): Rally | undefined {
    return this.rallies.find((rally) => rally.id === this.editingRallyId);
  }

  get selectedRallyTags(): RallyResultTag[] {
    const rally = this.selectedRally;
    if (!rally) {
      return [];
    }
    return this.tagDefinitions
      .filter((tag) => this.matchesTagPointWinner(tag, rally.pointWinner))
      .map((tag) => tag.tag);
  }

  get initialServer(): 'me' | 'op' {
    return this.match?.initialServer ?? 'me';
  }

  private matchesTagPointWinner(tag: RallyTagDefinition, pointWinner: 'me' | 'op'): boolean {
    if (pointWinner === 'me') {
      return tag.winOnly || (!tag.winOnly && !tag.lossOnly);
    }
    return tag.lossOnly || (!tag.winOnly && !tag.lossOnly);
  }

  async loadYoutubeVideo(): Promise<void> {
    const url = this.youtubeUrl.trim();
    if (!this.isValidYoutubeUrl(url)) {
      this.message = 'YouTube URL の形式が不正です。';
      return;
    }

    this.isLoadingVideo = true;
    this.message = '動画情報を確認しています。';

    try {
      const infoRes = await fetch(`${this.apiBase}/videos/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!infoRes.ok) {
        throw new Error(await this.readError(infoRes, '動画情報の取得に失敗しました。'));
      }
      const info = await infoRes.json();

      this.message = '動画を準備しています。';
      const downloadRes = await fetch(`${this.apiBase}/videos/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!downloadRes.ok) {
        throw new Error(await this.readError(downloadRes, '動画の取得に失敗しました。'));
      }
      const payload = await downloadRes.json();
      this.videoSourceUrl = payload.public_url ? `${this.apiBase}${payload.public_url}` : '';
      this.videoTitle = payload.title || info.title || '';
      this.videoSourceKind = 'remote';
      this.message = payload.reused ? 'ダウンロード済み動画を読み込みました。' : 'YouTube から動画を取得して読み込みました。';
    } catch (error) {
      this.clearLoadedVideo();
      this.message = error instanceof Error ? error.message : '動画の読み込みに失敗しました。';
    } finally {
      this.isLoadingVideo = false;
    }
  }

  async onVideoFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.clearLoadedVideo();
    this.videoSourceUrl = await this.readFileAsDataUrl(file);
    this.videoTitle = file.name;
    this.videoSourceKind = 'uploaded';
    this.message = 'ローカル動画を読み込みました。';
    input.value = '';
  }

  async saveInputScreenState(): Promise<void> {
    if (!this.match) {
      this.message = '保存対象の試合がありません。';
      return;
    }
    const state: MatchInputState = {
      youtubeUrl: this.youtubeUrl.trim(),
      videoSourceUrl: this.videoSourceUrl,
      videoTitle: this.videoTitle,
      sourceKind: this.videoSourceKind,
      form: { ...this.form },
      confirmedSegments: this.confirmedSegments.map((segment) => ({ ...segment })),
      manualStartSec: this.manualStartSec,
      manualEndSec: this.manualEndSec,
      clipScope: this.clipScope,
    };
    await this.state.saveMatchInputState(this.match.uuid, state);
    this.message = '入力画面全体を保存しました。';
  }

  startMatch(): void {
    this.matchStartTime = Number(this.currentVideoTime.toFixed(2));
    this.message = `試合を開始しました。開始位置: ${this.matchStartTime}s`;
  }

  startRally(): void {
    this.rallyStartTime = Number(this.currentVideoTime.toFixed(2));
    this.form.tStart = this.rallyStartTime;
    this.message = `ラリーを開始しました。t_start: ${this.rallyStartTime}s`;
  }

  async scorePoint(winner: 'me' | 'op'): Promise<void> {
    if (!this.match) {
      return;
    }
    const tStart = this.rallyStartTime ?? Number(this.currentVideoTime.toFixed(2));
    const tEnd = Number(this.currentVideoTime.toFixed(2));
    const setNo = this.resolveInputSetNo();
    const server = this.resolveInputServer();
    this.form.tStart = tStart;
    this.form.tEnd = tEnd;
    this.form.setNo = setNo;
    this.form.server = server;
    this.form.pointWinner = winner;
    const rally = await this.state.addRally({
      matchId: this.match.id,
      matchUuid: this.match.uuid,
      setNo,
      server,
      serveType: this.form.serveType || undefined,
      receiveType: this.form.receiveType,
      rallyLenBucket: this.form.rallyLenBucket,
      pointWinner: winner,
      endReason: this.form.endReason,
      endSide: this.form.endSide,
      my3rd: this.form.my3rd,
      my3rdResult: this.form.my3rdResult,
      tStart,
      tEnd,
      note: this.form.note || undefined,
    }, this.insertAfterRallyId);
    const insertedAfterRallyId = this.insertAfterRallyId;
    const insertedSetNo = setNo;
    this.selectedRallyId = rally.id;
    this.selectedSetNo = rally.setNo;
    this.insertAfterRallyId = rally.id;
    this.rallyStartTime = undefined;
    this.message =
      `${winner === 'me' ? '得点' : '失点'}を記録しました。セット ${insertedSetNo} / t_start: ${tStart}s / t_end: ${tEnd}s` +
      (insertedAfterRallyId ? ` / ラリー #${insertedAfterRallyId} の後に挿入` : '');
  }

  async updateInitialServer(initialServer: 'me' | 'op'): Promise<void> {
    if (!this.match) {
      return;
    }
    const updated = await this.state.updateMatchInitialServer(this.match.uuid, initialServer);
    if (!updated) {
      this.message = '最初のサーバーを更新できませんでした。';
      return;
    }
    this.match = updated;
    this.message = `最初のサーバーを${initialServer === 'me' ? '自分' : '相手'}に更新しました。`;
  }

  onVideoCurrentTimeChange(seconds: number): void {
    this.currentVideoTime = Number(seconds.toFixed(2));
  }

  seekVideoTo(seconds: number): void {
    this.videoPanel?.seekToTime(seconds);
  }

  seekVideoAfterRally(seconds: number): void {
    this.videoPanel?.seekToTime(seconds);
  }

  async deleteRally(rallyId: number): Promise<void> {
    const deletedRally = this.rallies.find((row) => row.id === rallyId);
    const ok = await this.state.deleteRally(rallyId);
    if (ok && this.selectedRallyId === rallyId) {
      this.selectedRallyId = this.rallies[this.rallies.length - 1]?.id;
    }
    if (ok && this.editingRallyId === rallyId) {
      this.editingRallyId = undefined;
    }
    if (ok && this.insertAfterRallyId === rallyId) {
      this.insertAfterRallyId = undefined;
    }
    if (ok && deletedRally && !this.rallies.some((row) => row.setNo === deletedRally.setNo)) {
      this.selectedSetNo = Math.max(1, Math.min(5, deletedRally.setNo));
    }
    this.message = ok ? `ラリー #${rallyId} を削除しました。` : 'ラリーを削除できませんでした。';
  }

  async toggleRallyStar(rallyId: number): Promise<void> {
    const ok = await this.state.toggleRallyStar(rallyId);
    this.message = ok ? `ラリー #${rallyId} のスターを切り替えました。` : 'スターを切り替えできませんでした。';
  }

  async setRallyResultTag(rallyId: number, resultTag?: RallyResultTag): Promise<void> {
    const ok = await this.state.setRallyResultTag(rallyId, resultTag);
    if (!ok) {
      this.message = 'タグを更新できませんでした。';
      return;
    }
    this.message = resultTag ? `ラリー #${rallyId} に「${resultTag}」を設定しました。` : `ラリー #${rallyId} のタグを解除しました。`;
  }

  async updateSelectedRallyPointWinner(pointWinner: 'me' | 'op'): Promise<void> {
    const rally = this.editingRally;
    if (!rally) {
      this.message = '先にタイムラインの編集ボタンから対象ラリーを開いてください。';
      return;
    }
    const previousWinner = rally.pointWinner;
    const ok = await this.state.updateRallyPointWinner(rally.id, pointWinner);
    if (!ok) {
      this.message = '得失点を更新できませんでした。';
      return;
    }
    this.message =
      previousWinner === pointWinner
        ? `ラリー #${rally.id} はすでに${pointWinner === 'me' ? '得点' : '失点'}です。`
        : `ラリー #${rally.id} を${pointWinner === 'me' ? '得点' : '失点'}に更新しました。`;
  }

  selectRally(rallyId: number): void {
    const rally = this.rallies.find((row) => row.id === rallyId);
    if (!rally) {
      this.message = 'ラリーを選択できませんでした。';
      return;
    }
    this.selectedRallyId = rallyId;
    this.selectedSetNo = rally.setNo;
    this.message = `ラリー #${rallyId} を選択しました。`;
  }

  editRally(rallyId: number): void {
    this.selectRally(rallyId);
    this.editingRallyId = rallyId;
    if (this.editingRally) {
      this.message = `ラリー #${rallyId} を編集中です。得失点は解析コントロールで更新できます。`;
    }
  }

  chooseInsertAfterRally(rallyId: number): void {
    const rally = this.rallies.find((row) => row.id === rallyId);
    if (!rally) {
      this.message = '挿入位置を設定できませんでした。';
      return;
    }
    this.insertAfterRallyId = rallyId;
    this.selectedRallyId = rallyId;
    this.selectedSetNo = rally.setNo;
    this.message = `次のラリーは #${rallyId} の後に挿入されます。`;
  }

  clearInsertPosition(): void {
    this.insertAfterRallyId = undefined;
    this.message = `次のラリーはセット ${this.selectedSetNo} の末尾に追加されます。`;
  }

  get insertAfterRally(): Rally | undefined {
    return this.rallies.find((rally) => rally.id === this.insertAfterRallyId);
  }

  get inputSetNo(): number {
    return this.resolveInputSetNo();
  }

  get inputServerLabel(): string {
    return this.resolveInputServer() === 'me' ? '自分' : '相手';
  }

  selectSet(setNo: number): void {
    this.selectedSetNo = setNo;
    this.insertAfterRallyId = undefined;
    this.message = `入力先をセット ${setNo} に切り替えました。`;
  }

  async applyTagToSelectedRally(resultTag: RallyResultTag): Promise<void> {
    const rally = this.selectedRally;
    if (!rally) {
      this.message = '先にタグ付け対象のラリーを選択してください。';
      return;
    }
    const nextTag = rally.resultTag === resultTag ? undefined : resultTag;
    await this.setRallyResultTag(rally.id, nextTag);
  }

  async deleteLastRally(): Promise<void> {
    if (!this.match) {
      return;
    }
    const deletedRallyId = this.rallies[this.rallies.length - 1]?.id;
    const ok = await this.state.deleteLastRally(this.match.uuid);
    if (ok && this.selectedRallyId === deletedRallyId) {
      this.selectedRallyId = this.rallies[this.rallies.length - 1]?.id;
    }
    this.message = ok ? '直近ラリーを削除しました。' : '削除できるラリーがありません。';
  }

  addManualSegment(): void {
    if (this.manualEndSec <= this.manualStartSec) {
      this.message = '終了秒は開始秒より大きくしてください。';
      return;
    }
    this.confirmedSegments = [
      ...this.confirmedSegments,
      {
        startSec: Number(this.manualStartSec.toFixed(2)),
        endSec: Number(this.manualEndSec.toFixed(2)),
        durationSec: Number((this.manualEndSec - this.manualStartSec).toFixed(2)),
      },
    ];
    this.message = '区間を追加しました。';
  }

  private async restoreSavedInputState(): Promise<void> {
    this.clearLoadedVideo();
    const matchUuid = this.match?.uuid;
    if (!matchUuid) {
      this.youtubeUrl = '';
      this.resetFormState();
      return;
    }
    const state = await this.state.getMatchInputState(matchUuid);
    if (!state) {
      this.youtubeUrl = '';
      this.resetFormState();
      return;
    }
    this.youtubeUrl = state.youtubeUrl;
    this.videoSourceUrl = state.videoSourceUrl;
    this.videoTitle = state.videoTitle;
    this.videoSourceKind = state.sourceKind;
    this.form = { ...state.form };
    this.confirmedSegments = state.confirmedSegments.map((segment) => ({ ...segment }));
    this.manualStartSec = state.manualStartSec;
    this.manualEndSec = state.manualEndSec;
    this.clipScope = state.clipScope;
  }

  private clearLoadedVideo(): void {
    this.videoSourceUrl = '';
    this.videoTitle = '';
    this.videoSourceKind = 'remote';
    this.uploadedObjectUrl = '';
  }

  private async readError(response: Response, fallback: string): Promise<string> {
    try {
      const body = await response.json();
      return body.detail || fallback;
    } catch {
      return fallback;
    }
  }

  private isValidYoutubeUrl(url: string): boolean {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/.test(url);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('動画ファイルの読み込みに失敗しました。'));
      reader.readAsDataURL(file);
    });
  }

  private resetFormState(): void {
    this.form = this.defaultForm();
    this.confirmedSegments = [];
    this.manualStartSec = 0;
    this.manualEndSec = 5;
    this.clipScope = '動画全体';
  }

  private defaultForm() {
    return {
      setNo: 1,
      server: 'me',
      serveType: '',
      receiveType: 'short',
      rallyLenBucket: '1-2',
      pointWinner: 'me',
      endReason: 'my_miss',
      endSide: 'my_fh',
      my3rd: 'none',
      my3rdResult: 'na',
      tStart: 0,
      tEnd: 0,
      note: '',
    };
  }

  private resolveInputSetNo(): number {
    const insertAfterRally = this.insertAfterRally;
    if (insertAfterRally) {
      return insertAfterRally.setNo;
    }
    return this.selectedSetNo || this.form.setNo || 1;
  }

  private resolveInputServer(): 'me' | 'op' {
    const setNo = this.resolveInputSetNo();
    const setRallies = this.rallies.filter((rally) => rally.setNo === setNo);
    const insertAfterRally = this.insertAfterRally;
    const insertIndex = insertAfterRally
      ? setRallies.findIndex((rally) => rally.id === insertAfterRally.id) + 1
      : setRallies.length;
    const firstServer = setNo % 2 === 1 ? this.initialServer : this.initialServer === 'me' ? 'op' : 'me';
    if (Math.floor(insertIndex / 2) % 2 === 0) {
      return firstServer;
    }
    return firstServer === 'me' ? 'op' : 'me';
  }

  private async openMatch(matchUuid: string): Promise<void> {
    let match = this.state.getMatchByUuid(matchUuid);
    if (!match) {
      match = await this.state.loadMatch(matchUuid);
    }
    if (!match) {
      void this.router.navigate(['/matches']);
      return;
    }
    this.match = match;
    this.state.setSelectedMatchUuid(match.uuid);
    await this.state.loadRallies(match.uuid);
    await this.restoreSavedInputState();
    this.selectedRallyId = this.rallies[this.rallies.length - 1]?.id;
    this.selectedSetNo = this.rallies.at(-1)?.setNo ?? 1;
    this.message = `試合 #${match.id} を開きました。`;
  }
}
