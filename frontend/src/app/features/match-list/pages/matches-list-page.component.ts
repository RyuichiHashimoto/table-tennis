import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from '../../table-tennis/services/app-state.service';
import { ConfirmModalComponent } from '../../../shared/ui/confirm-modal/confirm-modal.component';
import { MatchTitleModalComponent } from '../components/match-title-modal/match-title-modal.component';
import { TableShellComponent } from '../../../shared/ui/table-shell/table-shell.component';
import { IconButtonComponent } from '../../../shared/ui/icon-button/icon-button.component';
import { Match } from '../../table-tennis/models/models';

@Component({
  selector: 'app-matches-list-page',
  standalone: true,
  imports: [CommonModule, ConfirmModalComponent, MatchTitleModalComponent, TableShellComponent, IconButtonComponent],
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
    const now = new Date();
    const date = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const time = now.toTimeString().slice(0, 5);
    const created = await this.state.createMatch(`新規試合 ${date} ${time}`);
    void this.router.navigate(['/match', created.uuid, 'edit']);
  }

  openMatch(matchUuid: string): void {
    this.state.setSelectedMatchUuid(matchUuid);
    void this.router.navigate(['/match', matchUuid, 'summary']);
  }

  editMatch(matchUuid: string): void {
    void this.router.navigate(['/match', matchUuid, 'edit']);
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
