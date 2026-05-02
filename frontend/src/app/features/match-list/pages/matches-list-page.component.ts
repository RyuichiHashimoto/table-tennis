import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from '../../table-tennis/services/app-state.service';
import { ConfirmModalComponent } from '../../../shared/ui/confirm-modal/confirm-modal.component';
import { MatchTitleModalComponent } from '../components/match-title-modal/match-title-modal.component';
import { TableShellComponent } from '../../../shared/ui/table-shell/table-shell.component';
import { Match } from '../../table-tennis/models/models';

@Component({
  selector: 'app-matches-list-page',
  standalone: true,
  imports: [CommonModule, ConfirmModalComponent, MatchTitleModalComponent, TableShellComponent],
  templateUrl: './matches-list-page.component.html',
  styleUrl: './matches-list-page.component.css',
})
export class MatchesListPageComponent implements OnInit {
  pendingDeleteMatch?: Match;
  pendingEditMatch?: Match;

  constructor(
    private readonly state: AppStateService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
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
    void this.router.navigate(['/match', matchUuid, 'summary']);
  }

  editMatch(matchUuid: string): void {
    const match = this.state.getMatchByUuid(matchUuid);
    if (!match) {
      return;
    }
    this.pendingEditMatch = match;
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

  cancelEdit(): void {
    this.pendingEditMatch = undefined;
  }

  async confirmEdit(title: string): Promise<void> {
    const matchUuid = this.pendingEditMatch?.uuid;
    if (!matchUuid || !title) {
      return;
    }
    await this.state.updateMatchTitle(matchUuid, title);
    this.pendingEditMatch = undefined;
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
