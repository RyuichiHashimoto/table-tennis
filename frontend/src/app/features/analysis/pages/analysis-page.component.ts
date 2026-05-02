import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AppStateService } from '../../table-tennis/services/app-state.service';
import { Match, Rally, ScoringPatternSlice } from '../../table-tennis/models/models';
import { ScoringPatternPieChartComponent } from '../components/scoring-pattern-pie-chart/scoring-pattern-pie-chart.component';

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
