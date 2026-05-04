import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppStateService } from '../../../table-tennis/services/app-state.service';
import { Match, Rally } from '../../../table-tennis/models/models';
import { SetScoreChipComponent } from '../../../../shared/ui/set-score-chip/set-score-chip.component';
import { EditIconComponent } from '../../../../shared/ui/edit-icon/edit-icon.component';

interface SetSummary {
  setNo: number;
  myPoints: number;
  opPoints: number;
  rallyCount: number;
}

interface TagSummary {
  tag: string;
  count: number;
  ratio: number;
}

@Component({
  selector: 'app-match-summary-page',
  standalone: true,
  imports: [CommonModule, RouterLink, SetScoreChipComponent, EditIconComponent],
  templateUrl: './match-summary-page.component.html',
  styleUrl: './match-summary-page.component.css',
})
export class MatchSummaryPageComponent implements OnInit {
  match?: Match;
  rallies: Rally[] = [];

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

  get myPoints(): number {
    return this.rallies.filter((rally) => rally.pointWinner === 'me').length;
  }

  get opPoints(): number {
    return this.rallies.filter((rally) => rally.pointWinner === 'op').length;
  }

  get winnerCount(): number {
    return this.rallies.filter((rally) => rally.endReason === 'winner' || rally.my3rdResult === 'point').length;
  }

  get missCount(): number {
    return this.rallies.filter((rally) => rally.endReason.includes('miss') || rally.my3rdResult === 'miss').length;
  }

  get serviceAceCount(): number {
    return this.rallies.filter((rally) => rally.endReason === 'ace').length;
  }

  get myServePointRate(): number {
    const myServeRallies = this.rallies.filter((rally) => rally.server === 'me');
    return this.pointRate(myServeRallies, 'me');
  }

  get opServePointRate(): number {
    const opServeRallies = this.rallies.filter((rally) => rally.server === 'op');
    return this.pointRate(opServeRallies, 'me');
  }

  get longestRallySeconds(): number {
    const durations = this.rallies.map((rally) => Math.max(0, (rally.tEnd ?? 0) - (rally.tStart ?? 0)));
    return Math.round(Math.max(0, ...durations));
  }

  get recentRallies(): Rally[] {
    return [...this.rallies].sort((a, b) => (b.tStart ?? b.id) - (a.tStart ?? a.id)).slice(0, 5);
  }

  get topTags(): TagSummary[] {
    const counts = new Map<string, number>();
    for (const rally of this.rallies) {
      const tag = rally.resultTags?.length ? rally.resultTags.join(', ') : 'タグ未設定';
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({
        tag,
        count,
        ratio: this.totalRallies ? count / this.totalRallies : 0,
      }));
  }

  get matchDurationLabel(): string {
    const startTimes = this.rallies.map((rally) => rally.tStart ?? 0).filter((time) => time > 0);
    const endTimes = this.rallies.map((rally) => rally.tEnd ?? 0).filter((time) => time > 0);
    const firstStart = startTimes.length ? Math.min(...startTimes) : 0;
    const duration = Math.max(0, ...endTimes) - firstStart;
    return this.formatClock(duration || Math.max(0, ...endTimes));
  }

  get matchDateLabel(): string {
    if (!this.match?.createdAt) {
      return '-';
    }
    return this.match.createdAt.replace('T', ' ').slice(0, 16);
  }

  get setScoreLabel(): string {
    return this.setSummaries.map((set) => `${set.myPoints}-${set.opPoints}`).join(' / ') || '-';
  }

  formatClock(seconds?: number): string {
    const totalSeconds = Math.max(0, Math.floor(seconds ?? 0));
    const minutes = Math.floor(totalSeconds / 60);
    const rest = totalSeconds % 60;
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
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
    this.rallies = await this.state.loadRallies(match.uuid);
  }

  private pointRate(rallies: Rally[], winner: Rally['pointWinner']): number {
    if (!rallies.length) {
      return 0;
    }
    return rallies.filter((rally) => rally.pointWinner === winner).length / rallies.length;
  }
}
