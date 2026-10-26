import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  MatchResult,
  MatchResultBadgeComponent,
} from '../../../../shared/ui/match-result-badge/match-result-badge.component';
import { NoticeChipComponent } from '../../../../shared/ui/notice-chip/notice-chip.component';
import { Match, Rally, SetScore } from '../../../table-tennis/models/models';
import { AppStateService } from '../../../table-tennis/services/app-state.service';

type DetailTab = 'analysis' | 'memo';

interface MatchEditForm {
  title: string;
  myPlayerName: string;
  opponentPlayerName: string;
  createdAt: string;
  venue: string;
  eventType: string;
  bestOf: 5 | 7;
}

interface AnalysisFactor {
  label: string;
  count: number;
  percent: number;
}

const RESULT_TAG_LABELS: Readonly<Record<string, string>> = {
  own_attack_success: '自分の攻撃',
  serve_point: 'サービス得点',
  receive_point: 'レシーブ得点',
  opponent_error: '相手のミス',
  own_attack_error: '攻撃ミス',
  serve_error: 'サーブミス',
  receive_error: 'レシーブミス',
  opponent_attack_success: '相手の攻撃',
  other: 'その他',
};

@Component({
  selector: 'app-match-summary-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatchResultBadgeComponent, NoticeChipComponent],
  templateUrl: './match-summary-page.component.html',
  styleUrl: './match-summary-page.component.css',
})
export class MatchSummaryPageComponent implements OnInit {
  match?: Match;
  rallies: Rally[] = [];
  activeTab: DetailTab = 'analysis';
  isDetailsExpanded = false;
  isLoading = false;
  isSaving = false;
  isEditing = false;
  loadError = '';
  saveMessage = '';
  formError = '';
  memoDraft = '';
  editForm: MatchEditForm = this.emptyForm();

  constructor(
    private readonly state: AppStateService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe((params) => {
      const matchUuid = params.get('uuid');
      if (!matchUuid) {
        void this.router.navigate(['/matches']);
        return;
      }
      void this.openMatch(matchUuid);
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  preventAccidentalClose(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) event.preventDefault();
  }

  get displayScores(): SetScore[] {
    const scoreMap = new Map<number, SetScore>();
    for (const rally of this.rallies) {
      const score = scoreMap.get(rally.setNo) ?? { myPoints: 0, opponentPoints: 0 };
      if (rally.pointWinner === 'me') score.myPoints += 1;
      else score.opponentPoints += 1;
      scoreMap.set(rally.setNo, score);
    }
    return [...scoreMap.entries()].sort(([left], [right]) => left - right).map(([, score]) => score);
  }

  get mySetWins(): number {
    return this.displayScores.filter((score) => this.isCompleteGame(score) && score.myPoints > score.opponentPoints).length;
  }

  get opponentSetWins(): number {
    return this.displayScores.filter((score) => this.isCompleteGame(score) && score.myPoints < score.opponentPoints).length;
  }

  get matchResult(): MatchResult {
    const required = (this.match?.bestOf ?? 5) === 7 ? 4 : 3;
    if (this.mySetWins >= required) return 'win';
    if (this.opponentSetWins >= required) return 'loss';
    return 'pending';
  }

  get formattedDate(): string {
    if (!this.match?.createdAt) return '未設定';
    const date = new Date(this.match.createdAt);
    if (Number.isNaN(date.getTime())) return '未設定';
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  get hasUnsavedChanges(): boolean {
    if (!this.match) return false;
    return this.isEditing ? JSON.stringify(this.editForm) !== JSON.stringify(this.formFromMatch(this.match)) : this.memoDraft !== this.match.memo;
  }

  get pointsWon(): number {
    return this.rallies.filter((rally) => rally.pointWinner === 'me').length;
  }

  get pointsLost(): number {
    return this.rallies.length - this.pointsWon;
  }

  get myServePointRate(): number {
    return this.rateForServer('me');
  }

  get receivePointRate(): number {
    return this.rateForServer('op');
  }

  get scoreFactorRows(): AnalysisFactor[] {
    return this.buildFactorRows('me');
  }

  get lossFactorRows(): AnalysisFactor[] {
    return this.buildFactorRows('op');
  }

  setTab(tab: DetailTab): void {
    this.activeTab = tab;
    this.saveMessage = '';
  }

  toggleDetails(): void {
    this.isDetailsExpanded = !this.isDetailsExpanded;
  }

  openEdit(): void {
    if (!this.match) return;
    const restored = this.restoreDraft(this.match);
    this.editForm = restored ?? this.formFromMatch(this.match);
    this.formError = '';
    this.isEditing = true;
  }

  closeEdit(): void {
    if (this.hasUnsavedChanges && !window.confirm('入力途中の変更を破棄しますか？')) return;
    this.clearDraft();
    this.isEditing = false;
    this.formError = '';
  }

  onFormChange(): void {
    if (!this.match || typeof localStorage === 'undefined') return;
    queueMicrotask(() => {
      if (this.match) localStorage.setItem(this.draftKey(this.match.uuid), JSON.stringify(this.editForm));
    });
  }

  onMemoChange(): void {
    if (!this.match || typeof localStorage === 'undefined') return;
    localStorage.setItem(this.memoDraftKey(this.match.uuid), this.memoDraft);
  }

  isMySetWinner(score: SetScore): boolean {
    return this.isCompleteGame(score) && score.myPoints > score.opponentPoints;
  }

  isOpponentSetWinner(score: SetScore): boolean {
    return this.isCompleteGame(score) && score.opponentPoints > score.myPoints;
  }

  async saveDetails(): Promise<void> {
    if (!this.match) return;
    const error = this.validateForm(this.editForm);
    if (error) {
      this.formError = error;
      return;
    }
    this.isSaving = true;
    this.formError = '';
    try {
      this.match = await this.state.updateMatchDetails(this.match.uuid, {
        ...this.editForm,
        createdAt: new Date(this.editForm.createdAt).toISOString(),
        memo: this.match.memo,
      });
      this.clearDraft();
      this.isEditing = false;
      this.saveMessage = '試合情報を保存しました。';
    } catch (error) {
      this.formError = error instanceof Error ? error.message : '試合情報を保存できませんでした。';
    } finally {
      this.isSaving = false;
    }
  }

  async saveMemo(): Promise<void> {
    if (!this.match || this.memoDraft === this.match.memo) return;
    this.isSaving = true;
    this.saveMessage = '';
    try {
      const currentForm = this.formFromMatch(this.match);
      this.match = await this.state.updateMatchDetails(this.match.uuid, {
        ...currentForm,
        memo: this.memoDraft,
        createdAt: this.match.createdAt,
      });
      this.memoDraft = this.match.memo;
      this.clearMemoDraft();
      this.saveMessage = 'メモを保存しました。';
    } catch (error) {
      this.saveMessage = error instanceof Error ? error.message : 'メモを保存できませんでした。';
    } finally {
      this.isSaving = false;
    }
  }

  private async openMatch(matchUuid: string): Promise<void> {
    this.isLoading = true;
    this.loadError = '';
    try {
      this.match = this.state.getMatchByUuid(matchUuid) ?? await this.state.loadMatch(matchUuid);
      if (!this.match) {
        this.loadError = '試合が見つかりませんでした。';
        return;
      }
      this.state.setSelectedMatchUuid(this.match.uuid);
      this.rallies = await this.state.loadRallies(this.match.uuid);
      this.memoDraft = this.restoreMemoDraft(this.match) ?? this.match.memo;
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : '試合情報の読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  private validateForm(form: MatchEditForm): string {
    if (!form.title.trim()) return '大会名を入力してください。';
    if (!form.createdAt || Number.isNaN(new Date(form.createdAt).getTime())) return '正しい試合日時を入力してください。';
    if (form.bestOf !== 5 && form.bestOf !== 7) return '試合形式を選択してください。';
    return '';
  }

  private isCompleteGame(score: SetScore): boolean {
    const high = Math.max(score.myPoints, score.opponentPoints);
    const low = Math.min(score.myPoints, score.opponentPoints);
    return (high === 11 && low <= 9) || (high >= 12 && high - low === 2);
  }

  private formFromMatch(match: Match): MatchEditForm {
    const date = new Date(match.createdAt);
    const timezoneOffset = date.getTimezoneOffset() * 60_000;
    return {
      title: match.title,
      myPlayerName: match.myPlayerName,
      opponentPlayerName: match.opponentPlayerName,
      createdAt: Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16),
      venue: match.venue,
      eventType: match.eventType,
      bestOf: match.bestOf,
    };
  }

  private emptyForm(): MatchEditForm {
    return { title: '', myPlayerName: '', opponentPlayerName: '', createdAt: '', venue: '', eventType: 'シングルス', bestOf: 5 };
  }

  private restoreDraft(match: Match): MatchEditForm | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(this.draftKey(match.uuid));
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as Partial<MatchEditForm>;
      const fallback = this.formFromMatch(match);
      return {
        title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
        myPlayerName: typeof parsed.myPlayerName === 'string' ? parsed.myPlayerName : fallback.myPlayerName,
        opponentPlayerName: typeof parsed.opponentPlayerName === 'string' ? parsed.opponentPlayerName : fallback.opponentPlayerName,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : fallback.createdAt,
        venue: typeof parsed.venue === 'string' ? parsed.venue : fallback.venue,
        eventType: typeof parsed.eventType === 'string' ? parsed.eventType : fallback.eventType,
        bestOf: parsed.bestOf === 5 || parsed.bestOf === 7 ? parsed.bestOf : fallback.bestOf,
      };
    } catch {
      localStorage.removeItem(this.draftKey(match.uuid));
      return undefined;
    }
  }

  private clearDraft(): void {
    if (this.match && typeof localStorage !== 'undefined') localStorage.removeItem(this.draftKey(this.match.uuid));
  }

  private draftKey(matchUuid: string): string {
    return `ytc-match-detail-draft-${matchUuid}`;
  }

  private memoDraftKey(matchUuid: string): string {
    return `ytc-match-memo-draft-${matchUuid}`;
  }

  private restoreMemoDraft(match: Match): string | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(this.memoDraftKey(match.uuid)) ?? undefined;
  }

  private clearMemoDraft(): void {
    if (this.match && typeof localStorage !== 'undefined') localStorage.removeItem(this.memoDraftKey(this.match.uuid));
  }

  private buildFactorRows(winner: Rally['pointWinner']): AnalysisFactor[] {
    const counts = new Map<string, number>();
    for (const rally of this.rallies.filter((item) => item.pointWinner === winner)) {
      const tag = rally.resultTags?.[0] ?? 'タグ未設定';
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([tag, count]) => ({
        label: RESULT_TAG_LABELS[tag] ?? tag,
        count,
        percent: total ? (count / total) * 100 : 0,
      }));
  }

  private rateForServer(server: Rally['server']): number {
    const scopedRallies = this.rallies.filter((rally) => rally.server === server);
    return Math.round(this.pointRate(scopedRallies, 'me') * 100);
  }

  private pointRate(rallies: Rally[], winner: Rally['pointWinner']): number {
    return rallies.length ? rallies.filter((rally) => rally.pointWinner === winner).length / rallies.length : 0;
  }
}
