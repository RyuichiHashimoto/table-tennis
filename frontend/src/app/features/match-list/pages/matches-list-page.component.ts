import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  SearchFilterBarComponent,
  SearchFilterOption,
} from '../../../shared/ui/search-filter-bar/search-filter-bar.component';
import {
  MatchResult,
  MatchResultBadgeComponent,
} from '../../../shared/ui/match-result-badge/match-result-badge.component';
import { Match, Rally } from '../../table-tennis/models/models';
import { AppStateService } from '../../table-tennis/services/app-state.service';

type MatchCategory = 'all' | 'singles' | 'doubles';
type ResultFilter = 'all' | MatchResult;
type PeriodFilter = '3months' | '6months' | 'year' | 'all';

interface SetScore {
  setNo: number;
  me: number;
  opponent: number;
}

interface MatchRecord {
  match: Match;
  setScores: SetScore[];
  mySetWins: number;
  opponentSetWins: number;
  result: MatchResult;
}

interface MatchStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

@Component({
  selector: 'app-matches-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchFilterBarComponent, MatchResultBadgeComponent],
  templateUrl: './matches-list-page.component.html',
  styleUrl: './matches-list-page.component.css',
})
export class MatchesListPageComponent implements OnInit {
  loading = true;
  searchQuery = '';
  activeCategory: MatchCategory = 'singles';
  activeResultFilter: ResultFilter = 'all';
  summaryPeriod: PeriodFilter = '3months';
  listPeriod: PeriodFilter = 'all';
  sortOrder: 'newest' | 'oldest' = 'newest';
  visibleLimit = 3;
  records: MatchRecord[] = [];

  readonly resultFilterOptions: ReadonlyArray<SearchFilterOption> = [
    { label: 'すべて', value: 'all' },
    { label: '勝利', value: 'win' },
    { label: '敗北', value: 'loss' },
    { label: '未判定', value: 'pending' },
  ];

  constructor(
    private readonly state: AppStateService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const matches = await this.state.loadMatches();
      this.records = await Promise.all(
        matches.map(async (match) => {
          let rallies: Rally[] = [];
          try {
            rallies = await this.state.loadRallies(match.uuid);
          } catch {
            // ポイント詳細を取得できない試合も一覧には残す。
          }
          return this.buildRecord(match, rallies);
        }),
      );
    } finally {
      this.loading = false;
    }
  }

  get categoryRecords(): MatchRecord[] {
    return this.records.filter((record) => {
      if (this.activeCategory === 'all') return true;
      return this.isDoubles(record.match) === (this.activeCategory === 'doubles');
    });
  }

  get lifetimeStats(): MatchStats {
    return this.calculateStats(this.categoryRecords);
  }

  get periodStats(): MatchStats {
    return this.calculateStats(this.filterByPeriod(this.categoryRecords, this.summaryPeriod));
  }

  get filteredRecords(): MatchRecord[] {
    const query = this.normalize(this.searchQuery);
    const filtered = this.filterByPeriod(this.categoryRecords, this.listPeriod)
      .filter((record) => this.activeResultFilter === 'all' || record.result === this.activeResultFilter)
      .filter((record) => {
        if (!query) return true;
        const { match } = record;
        return this.normalize(`${match.title} ${match.myPlayerName} ${match.opponentPlayerName}`).includes(query);
      });

    return [...filtered].sort((left, right) => {
      const comparison = this.timestamp(left.match) - this.timestamp(right.match);
      return this.sortOrder === 'oldest' ? comparison : -comparison;
    });
  }

  get visibleRecords(): MatchRecord[] {
    return this.filteredRecords.slice(0, this.visibleLimit);
  }

  get canShowMore(): boolean {
    return this.visibleLimit < this.filteredRecords.length;
  }

  setCategory(category: MatchCategory): void {
    this.activeCategory = category;
    this.visibleLimit = 3;
  }

  setResultFilter(value: string): void {
    this.activeResultFilter = value as ResultFilter;
    this.visibleLimit = 3;
  }

  showMore(): void {
    this.visibleLimit += 5;
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'newest' ? 'oldest' : 'newest';
  }

  openMatch(matchUuid: string): void {
    this.state.setSelectedMatchUuid(matchUuid);
    void this.router.navigate(['/match', matchUuid, 'summary']);
  }

  trackMatch(_index: number, record: MatchRecord): string {
    return record.match.uuid;
  }

  private buildRecord(match: Match, rallies: Rally[]): MatchRecord {
    const scores = new Map<number, SetScore>();
    for (const rally of rallies) {
      const score = scores.get(rally.setNo) ?? { setNo: rally.setNo, me: 0, opponent: 0 };
      if (rally.pointWinner === 'me') score.me += 1;
      else score.opponent += 1;
      scores.set(rally.setNo, score);
    }

    const setScores = [...scores.values()].sort((left, right) => left.setNo - right.setNo);
    return this.recordFromScores(match, setScores);
  }

  private recordFromScores(match: Match, setScores: SetScore[]): MatchRecord {
    const completedScores = setScores.filter((score) => {
      const high = Math.max(score.me, score.opponent);
      const low = Math.min(score.me, score.opponent);
      return (high === 11 && low <= 9) || (high >= 12 && high - low === 2);
    });
    const mySetWins = completedScores.filter((score) => score.me > score.opponent).length;
    const opponentSetWins = completedScores.filter((score) => score.me < score.opponent).length;
    const winsRequired = match.bestOf === 7 ? 4 : 3;
    const isDecided = mySetWins >= winsRequired || opponentSetWins >= winsRequired;
    const result: MatchResult = mySetWins > opponentSetWins ? 'win' : 'loss';
    return { match, setScores, mySetWins, opponentSetWins, result: isDecided ? result : 'pending' };
  }

  private calculateStats(records: MatchRecord[]): MatchStats {
    const wins = records.filter((record) => record.result === 'win').length;
    const losses = records.filter((record) => record.result === 'loss').length;
    const decided = wins + losses;
    return {
      total: records.length,
      wins,
      losses,
      winRate: decided ? Math.round((wins / decided) * 100) : 0,
    };
  }

  private filterByPeriod(records: MatchRecord[], period: PeriodFilter): MatchRecord[] {
    const cutoff = this.periodCutoff(period);
    if (!cutoff) return records;
    return records.filter((record) => this.timestamp(record.match) >= cutoff.getTime());
  }

  private periodCutoff(period: PeriodFilter): Date | undefined {
    if (period === 'all') return undefined;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    if (period === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);
    else cutoff.setMonth(cutoff.getMonth() - (period === '6months' ? 6 : 3));
    return cutoff;
  }

  private isDoubles(match: Match): boolean {
    return this.normalize(`${match.eventType} ${match.title} ${match.myPlayerName} ${match.opponentPlayerName}`).includes('ダブル');
  }

  private timestamp(match: Match): number {
    const value = Date.parse(match.createdAt);
    return Number.isNaN(value) ? 0 : value;
  }

  private normalize(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase('ja-JP').trim();
  }
}
