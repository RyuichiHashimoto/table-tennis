import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ScoringPatternPieChartComponent } from './scoring-pattern-pie-chart.component';
import { AppStateService } from '../shared/app-state.service';
import { Match, Rally, ScoringPatternSlice } from '../shared/models';

@Component({
  selector: 'app-analysis-page',
  standalone: true,
  imports: [CommonModule, ScoringPatternPieChartComponent],
  templateUrl: './analysis-page.component.html',
  styleUrl: './analysis-page.component.css',
})
export class AnalysisPageComponent implements OnInit {
  scoringPatterns: ScoringPatternSlice[] = [];

  constructor(private readonly state: AppStateService) {}

  async ngOnInit(): Promise<void> {
    const match = await this.state.ensureDefaultMatch('2026-03-04 vs practice');
    await this.state.loadRallies(match.uuid);
    this.scoringPatterns = await this.state.getScoringPatterns(match.uuid);
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
}
