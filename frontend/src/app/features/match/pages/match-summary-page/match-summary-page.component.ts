import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppStateService } from '../../../table-tennis/services/app-state.service';
import { Match, Rally } from '../../../table-tennis/models/models';
import { NoticeChipComponent } from '../../../../shared/ui/notice-chip/notice-chip.component';
import {
  ScoreLineChartComponent,
  ScoreLinePoint,
  ScoreLineSegment,
} from '../../../../shared/ui/score-line-chart/score-line-chart.component';
import {
  FactorBarChartComponent,
  FactorBarChartRow,
} from '../../../../shared/ui/factor-bar-chart/factor-bar-chart.component';
import {
  SplitBarChartComponent,
  SplitBarChartRow,
} from '../../../../shared/ui/split-bar-chart/split-bar-chart.component';
import { MatchPageHeaderComponent } from '../../components/match-page-header/match-page-header.component';

interface SetSummary {
  setNo: number;
  myPoints: number;
  opPoints: number;
  rallyCount: number;
}

@Component({
  selector: 'app-match-summary-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NoticeChipComponent,
    ScoreLineChartComponent,
    FactorBarChartComponent,
    SplitBarChartComponent,
    MatchPageHeaderComponent,
  ],
  templateUrl: './match-summary-page.component.html',
  styleUrl: './match-summary-page.component.css',
})
export class MatchSummaryPageComponent implements OnInit {
  match?: Match;
  rallies: Rally[] = [];
  selectedSetNos = new Set<number>();
  isLoading = false;
  loadError = '';

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

  get setSummaries(): SetSummary[] {
    const setMap = new Map<number, SetSummary>();
    for (const rally of this.rallies) {
      const row = setMap.get(rally.setNo) ?? {
        setNo: rally.setNo,
        myPoints: 0,
        opPoints: 0,
        rallyCount: 0,
      };
      row.rallyCount += 1;
      if (rally.pointWinner === 'me') {
        row.myPoints += 1;
      } else {
        row.opPoints += 1;
      }
      setMap.set(rally.setNo, row);
    }
    return [...setMap.values()].sort((a, b) => a.setNo - b.setNo);
  }

  get totalRallies(): number {
    return this.rallies.length;
  }

  get filteredRallies(): Rally[] {
    if (this.selectedSetNos.size === 0) {
      return this.rallies;
    }
    return this.rallies.filter((r) => this.selectedSetNos.has(r.setNo));
  }

  toggleSetNo(setNo: number): void {
    const next = new Set(this.selectedSetNos);
    if (next.has(setNo)) {
      next.delete(setNo);
    } else {
      next.add(setNo);
    }
    this.selectedSetNos = next;
  }

  get myServePointRate(): number {
    const myServeRallies = this.filteredRallies.filter((rally) => rally.server === 'me');
    return this.pointRate(myServeRallies, 'me');
  }

  get opServePointRate(): number {
    const opServeRallies = this.filteredRallies.filter((rally) => rally.server === 'op');
    return this.pointRate(opServeRallies, 'me');
  }

  get mySetWins(): number {
    return this.setSummaries.filter((set) => set.myPoints > set.opPoints).length;
  }

  get opSetWins(): number {
    return this.setSummaries.filter((set) => set.myPoints < set.opPoints).length;
  }

  get matchResultLabel(): string {
    if (!this.setSummaries.length || this.mySetWins === this.opSetWins) {
      return '引き分け';
    }
    return this.mySetWins > this.opSetWins ? '勝利' : '敗北';
  }

  get matchResultClass(): 'win' | 'loss' | 'draw' {
    if (!this.setSummaries.length || this.mySetWins === this.opSetWins) {
      return 'draw';
    }
    return this.mySetWins > this.opSetWins ? 'win' : 'loss';
  }

  get matchSummaryText(): string {
    if (!this.setSummaries.length) {
      return '記録されたセットがありません。';
    }
    const setLabels = this.setSummaries.map((set) => `セット${set.setNo}は${set.myPoints}-${set.opPoints}`).join('、');
    return `${setLabels}でした。`;
  }

get scoreLinePoints(): ScoreLinePoint[] {
    const points: ScoreLinePoint[] = [];
    const scoreBySet = new Map<number, { myPoints: number; opPoints: number }>();
    let x = 0;
    this.rallies.forEach((rally, index) => {
      const previousRally = this.rallies[index - 1];
      const isSetStart = !previousRally || previousRally.setNo !== rally.setNo;
      if (isSetStart) {
        points.push({
          x,
          y: 0,
          setNo: rally.setNo,
          rallyNo: 0,
          myPoints: 0,
          opPoints: 0,
          breakBefore: true,
        });
      }

      const currentScore = scoreBySet.get(rally.setNo) ?? { myPoints: 0, opPoints: 0 };
      const nextScore =
        rally.pointWinner === 'me'
          ? { ...currentScore, myPoints: currentScore.myPoints + 1 }
          : { ...currentScore, opPoints: currentScore.opPoints + 1 };
      scoreBySet.set(rally.setNo, nextScore);
      x += 1;
      points.push({
        x,
        y: nextScore.myPoints - nextScore.opPoints,
        setNo: rally.setNo,
        rallyNo: nextScore.myPoints + nextScore.opPoints,
        myPoints: nextScore.myPoints,
        opPoints: nextScore.opPoints,
      });
    });
    return points;
  }

  get scoreLineSegments(): ScoreLineSegment[] {
    let cursor = 0;
    return this.setSummaries
      .filter((set) => set.rallyCount > 0)
      .map((set) => {
        const startX = cursor;
        const endX = cursor + set.rallyCount;
        cursor += set.rallyCount;
        return {
          label: `セット ${set.setNo}`,
          startX,
          endX,
        };
      });
  }

  get scoreFactorRows(): FactorBarChartRow[] {
    return this.buildFactorRows('me');
  }

  get lossFactorRows(): FactorBarChartRow[] {
    return this.buildFactorRows('op');
  }

  get serveReceiveRows(): SplitBarChartRow[] {
    return [
      { label: '自分サーブ時得点率', leftPercent: Math.round(this.myServePointRate * 100) },
      { label: '相手サーブ時の自分得点率', leftPercent: Math.round(this.opServePointRate * 100) },
    ];
  }

  get matchDateLabel(): string {
    if (!this.match?.createdAt) {
      return '-';
    }
    return this.match.createdAt.replace('T', ' ').slice(0, 16);
  }

  private buildFactorRows(pointWinner: Rally['pointWinner']): FactorBarChartRow[] {
    const filtered = this.filteredRallies.filter((r) => r.pointWinner === pointWinner);
    const counts = new Map<string, number>();
    for (const rally of filtered) {
      const tag = rally.resultTags?.[0] ?? 'タグ未設定';
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }

  private async openMatch(matchUuid: string): Promise<void> {
    this.isLoading = true;
    this.loadError = '';
    try {
      let match = this.state.getMatchByUuid(matchUuid);
      if (!match) {
        match = await this.state.loadMatch(matchUuid);
      }
      if (!match) {
        this.loadError = '試合が見つかりませんでした。';
        return;
      }
      this.match = match;
      this.state.setSelectedMatchUuid(match.uuid);
      this.rallies = await this.state.loadRallies(match.uuid);
      this.selectedSetNos = new Set(this.rallies.map((r) => r.setNo));
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : '試合情報の読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  private pointRate(rallies: Rally[], winner: Rally['pointWinner']): number {
    if (!rallies.length) {
      return 0;
    }
    return rallies.filter((rally) => rally.pointWinner === winner).length / rallies.length;
  }
}
