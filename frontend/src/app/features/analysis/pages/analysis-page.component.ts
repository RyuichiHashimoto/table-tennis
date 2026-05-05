import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AppStateService } from '../../table-tennis/services/app-state.service';
import { Match, Rally, ScoringPatternSlice } from '../../table-tennis/models/models';
import { ScoringPatternPieChartComponent } from '../components/scoring-pattern-pie-chart/scoring-pattern-pie-chart.component';
import { ConfirmModalComponent } from '../../../shared/ui/modal/confirm-modal/confirm-modal.component';
import { IconButtonComponent } from '../../../shared/ui/icon-button/icon-button/icon-button.component';

@Component({
  selector: 'app-analysis-page',
  standalone: true,
  imports: [CommonModule, DragDropModule, ScoringPatternPieChartComponent, ConfirmModalComponent, IconButtonComponent],
  templateUrl: './analysis-page.component.html',
  styleUrl: './analysis-page.component.css',
})
export class AnalysisPageComponent implements OnInit {
  scoringPatterns: ScoringPatternSlice[] = [];
  displayRallies: Rally[] = [];
  isDirty = false;
  isSaving = false;
  showResetConfirm = false;

  constructor(private readonly state: AppStateService) {}

  async ngOnInit(): Promise<void> {
    const matches = await this.state.loadMatches();
    const selectedMatchUuid = this.state.getSelectedMatchUuid();
    const match = (selectedMatchUuid ? this.state.getMatchByUuid(selectedMatchUuid) : undefined) ?? matches[0];
    if (!match) {
      this.scoringPatterns = [];
      return;
    }
    this.state.setSelectedMatchUuid(match.uuid);
    await this.state.loadRallies(match.uuid);
    this.scoringPatterns = await this.state.getScoringPatterns(match.uuid);
    this.displayRallies = [...this.state.getRallies(match.uuid)];
  }

  get match(): Match | undefined {
    const selected = this.state.getSelectedMatchUuid();
    return selected ? this.state.getMatchByUuid(selected) : undefined;
  }

  get rallies(): Rally[] {
    return this.match ? this.state.getRallies(this.match.uuid) : [];
  }

  get summary() {
    return this.state.summarize(this.rallies);
  }

  /** ラリー一覧から累積スコア（自分/相手）を計算する */
  get scores(): { me: number; op: number }[] {
    let me = 0;
    let op = 0;
    return this.displayRallies.map((r) => {
      if (r.pointWinner === 'me') me++;
      else op++;
      return { me, op };
    });
  }

  onDrop(event: CdkDragDrop<Rally[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.displayRallies, event.previousIndex, event.currentIndex);
    this.isDirty = true;
  }

  async saveSortOrders(): Promise<void> {
    if (!this.match || !this.isDirty) return;
    this.isSaving = true;
    try {
      const orders = this.displayRallies.map((r, i) => ({ id: r.id, sort_order: i + 1 }));
      await this.state.saveSortOrders(this.match.uuid, orders);
      this.isDirty = false;
    } finally {
      this.isSaving = false;
    }
  }

  openResetConfirm(): void {
    this.showResetConfirm = true;
  }

  async onResetConfirmed(): Promise<void> {
    this.showResetConfirm = false;
    if (!this.match) return;
    await this.state.loadRallies(this.match.uuid);
    this.displayRallies = [...this.state.getRallies(this.match.uuid)];
    this.isDirty = false;
  }

  onResetCancelled(): void {
    this.showResetConfirm = false;
  }

  trackByRallyId(_: number, r: Rally): number {
    return r.id;
  }
}
