import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { runtimeConfig } from '../../../../core/config/runtime-config';
import { AppStateService, MatchInputState } from '../../../table-tennis/services/app-state.service';
import { Match, Rally, RallyResultTag, RallyTagDefinition, Segment } from '../../../table-tennis/models/models';
import { MatchTimelinePanelComponent } from '../../components/match-timeline-panel/match-timeline-panel.component';
import { MatchInfoPanelComponent } from '../../components/match-info-panel/match-info-panel.component';
import { MatchRecordControlsComponent } from '../../components/match-record-controls/match-record-controls.component';
import { RallyEditDrawerComponent, RallyEditPayload } from '../../components/rally-edit-drawer/rally-edit-drawer.component';
import { DetailIconComponent } from '../../../../shared/ui/detail-icon/detail-icon.component';

@Component({
  selector: 'app-match-input-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatchInfoPanelComponent,
    MatchRecordControlsComponent,
    MatchTimelinePanelComponent,
    RallyEditDrawerComponent,
    DetailIconComponent,
  ],
  templateUrl: './match-input-page.component.html',
  styleUrl: './match-input-page.component.css',
})
export class MatchInputPageComponent implements OnInit {
  @ViewChild(MatchInfoPanelComponent) infoPanel?: MatchInfoPanelComponent;

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
  isDrawerOpen = false;
  selectedRallyId?: number;
  editingRallyId?: number;
  selectedSetNo = 1;
  insertAfterRallyId?: number;
  message = '';
  tagDefinitions: RallyTagDefinition[] = [];
  isEditingTitle = false;
  editingTitle = '';

  form = this.defaultForm();

  constructor(
    private readonly state: AppStateService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
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

  get currentSetScore(): { me: number; op: number } {
    return this.rallies
      .filter((rally) => rally.setNo === this.selectedSetNo)
      .reduce(
        (score, rally) => {
          if (rally.pointWinner === 'me') {
            score.me += 1;
          } else {
            score.op += 1;
          }
          return score;
        },
        { me: 0, op: 0 },
      );
  }

  get mySetCount(): number {
    return this.computeSetCounts().me;
  }

  get opSetCount(): number {
    return this.computeSetCounts().op;
  }

  get nextServer(): 'me' | 'op' {
    return this.resolveInputServer();
  }

  get nextActionMessage(): string {
    if (this.matchStartTime === undefined) {
      return '試合を開始してください';
    }
    if (this.rallyStartTime === undefined) {
      return 'ラリー開始を押してください';
    }
    return '得点または失点を記録してください';
  }

  get statusLabel(): string {
    return this.matchStartTime === undefined ? '試合前' : '記録中';
  }

  formatClock(seconds?: number): string {
    const totalSeconds = Math.max(0, Math.floor(seconds ?? 0));
    const minutes = Math.floor(totalSeconds / 60);
    const rest = totalSeconds % 60;
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
  }

  private computeSetCounts(): { me: number; op: number } {
    let me = 0;
    let op = 0;
    for (let setNo = 1; setNo <= 5; setNo++) {
      const setRallies = this.rallies.filter((r) => r.setNo === setNo);
      const myPts = setRallies.filter((r) => r.pointWinner === 'me').length;
      const opPts = setRallies.filter((r) => r.pointWinner === 'op').length;
      if ((myPts >= 11 || opPts >= 11) && Math.abs(myPts - opPts) >= 2) {
        if (myPts > opPts) me++;
        else op++;
      }
    }
    return { me, op };
  }

  private matchesTagPointWinner(tag: RallyTagDefinition, pointWinner: 'me' | 'op'): boolean {
    if (tag.shotType === 'any') return true;
    if (pointWinner === 'me') {
      return (tag.playerSide === 'me' && tag.shotType === 'point') ||
             (tag.playerSide === 'op' && tag.shotType === 'miss');
    }
    return (tag.playerSide === 'me' && tag.shotType === 'miss') ||
           (tag.playerSide === 'op' && tag.shotType === 'point');
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

  async onRegisterRally(event: { winner: 'me' | 'op'; note: string }): Promise<void> {
    this.form.note = event.note;
    await this.scorePoint(event.winner);
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
    try {
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
        resultTags: [],
      }, this.insertAfterRallyId);
      await this.state.loadRallies(this.match.uuid);
      const insertedAfterRallyId = this.insertAfterRallyId;
      const insertedSetNo = setNo;
      this.selectedRallyId = rally.id;
      this.selectedSetNo = rally.setNo;
      this.insertAfterRallyId = rally.id;
      this.rallyStartTime = undefined;
      this.message =
        `${winner === 'me' ? '得点' : '失点'}を記録しました。セット ${insertedSetNo} / t_start: ${tStart}s / t_end: ${tEnd}s` +
        (insertedAfterRallyId ? ` / ラリー #${insertedAfterRallyId} の後に挿入` : '');
    } catch {
      this.message = 'ラリーの記録に失敗しました。再度お試しください。';
    }
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

  async updatePlayerNames(names: { myPlayerName: string; opponentPlayerName: string }): Promise<void> {
    if (!this.match) {
      return;
    }
    const updated = await this.state.updateMatchPlayers(this.match.uuid, names.myPlayerName, names.opponentPlayerName);
    if (!updated) {
      this.message = '対戦カードを更新できませんでした。';
      return;
    }
    this.match = updated;
    this.message = '対戦カードを更新しました。';
  }

  onVideoCurrentTimeChange(seconds: number): void {
    this.currentVideoTime = Number(seconds.toFixed(2));
  }

  seekVideoTo(seconds: number): void {
    this.infoPanel?.seekToTime(seconds);
  }

  seekVideoAfterRally(seconds: number): void {
    this.infoPanel?.seekToTime(seconds);
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

  async setRallyResultTags(rallyId: number, resultTags: RallyResultTag[]): Promise<void> {
    const ok = await this.state.setRallyResultTags(rallyId, resultTags);
    if (!ok) {
      this.message = 'タグを更新できませんでした。';
      return;
    }
    this.message = resultTags.length ? `ラリー #${rallyId} にタグを設定しました。` : `ラリー #${rallyId} のタグを解除しました。`;
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
    this.isDrawerOpen = true;
    this.message = `ラリー #${rallyId} を選択しました。`;
  }

  editRally(rallyId: number): void {
    this.selectRally(rallyId);
    this.editingRallyId = rallyId;
    if (this.editingRally) {
      this.message = `ラリー #${rallyId} を編集中です。`;
    }
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
  }

  async onSaveRallyEdit(payload: RallyEditPayload): Promise<void> {
    const ok = await this.state.updateRallyFields(payload.rallyId, {
      pointWinner: payload.pointWinner,
      server: payload.server,
      resultTags: payload.resultTags,
      note: payload.note || null,
      tStart: payload.tStart,
    });
    if (ok) {
      this.message = `ラリー #${payload.rallyId} を保存しました。`;
      this.isDrawerOpen = false;
    } else {
      this.message = 'ラリーの保存に失敗しました。';
    }
  }

  async onDeleteRallyFromDrawer(rallyId: number): Promise<void> {
    await this.deleteRally(rallyId);
    this.isDrawerOpen = false;
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

  startEditTitle(): void {
    this.editingTitle = this.match?.title ?? '';
    this.isEditingTitle = true;
  }

  cancelEditTitle(): void {
    this.isEditingTitle = false;
    this.editingTitle = '';
  }

  async saveTitle(): Promise<void> {
    if (!this.match || !this.editingTitle.trim()) return;
    const updated = await this.state.updateMatchTitle(this.match.uuid, this.editingTitle.trim());
    if (updated) {
      this.match = updated;
    }
    this.isEditingTitle = false;
    this.editingTitle = '';
  }

  async applyTagToSelectedRally(resultTag: RallyResultTag): Promise<void> {
    const rally = this.selectedRally;
    if (!rally) {
      this.message = '先にタグ付け対象のラリーを選択してください。';
      return;
    }
    const current = rally.resultTags ?? [];
    const nextTags = current.includes(resultTag)
      ? current.filter((t) => t !== resultTag)
      : [...current, resultTag];
    await this.setRallyResultTags(rally.id, nextTags);
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
