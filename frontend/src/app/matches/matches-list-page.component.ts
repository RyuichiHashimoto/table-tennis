import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from '../shared/app-state.service';
import { ConfirmModalComponent } from '../shared/confirm-modal.component';
import { Match } from '../shared/models';

@Component({
  selector: 'app-matches-list-page',
  standalone: true,
  imports: [CommonModule, ConfirmModalComponent],
  templateUrl: './matches-list-page.component.html',
  styleUrl: './matches-list-page.component.css',
})
export class MatchesListPageComponent implements OnInit {
  pendingDeleteMatch?: Match;

  constructor(
    private readonly state: AppStateService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.state.ensureDefaultMatch('2026-03-04 vs practice');
    await this.state.loadMatches();
  }

  get matches(): Match[] {
    return this.state.getMatches();
  }

  async createMatch(): Promise<void> {
    const created = await this.state.createMatch(`新規試合 ${new Date().toISOString().slice(0, 10)}`);
    void this.router.navigate(['/match', created.uuid]);
  }

  openMatch(matchUuid: string): void {
    this.state.setSelectedMatchUuid(matchUuid);
    void this.router.navigate(['/match', matchUuid]);
  }

  deleteMatch(matchUuid: string): void {
    const match = this.state.getMatchByUuid(matchUuid);
    if (!match) {
      return;
    }
    this.pendingDeleteMatch = match;
  }

  cancelDelete(): void {
    this.pendingDeleteMatch = undefined;
  }

  async confirmDelete(): Promise<void> {
    const matchUuid = this.pendingDeleteMatch?.uuid;
    if (!matchUuid) {
      return;
    }
    await this.state.deleteMatch(matchUuid);
    this.pendingDeleteMatch = undefined;
  }
}
