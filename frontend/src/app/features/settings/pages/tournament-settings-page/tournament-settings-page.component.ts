import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddIconComponent } from '../../../../shared/ui/icon-button/add-icon/add-icon.component';
import { DeleteIconComponent } from '../../../../shared/ui/icon-button/delete-icon/delete-icon.component';
import { EditIconComponent } from '../../../../shared/ui/icon-button/edit-icon/edit-icon.component';
import { ConfirmModalComponent } from '../../../../shared/ui/modal/confirm-modal/confirm-modal.component';
import { StandardTableComponent } from '../../../../shared/ui/table/standard-table/standard-table.component';

type FetchStatus = '正常' | '取得失敗' | '未取得';

interface ReferenceSite {
  id: number;
  name: string;
  url: string;
  sport: string;
  region: string;
  enabled: boolean;
  memo: string;
  frequency: string;
  tournamentSelector: string;
  eventDateSelector: string;
  deadlineSelector: string;
  detailUrlMethod: string;
  lastFetchedAt: string;
  status: FetchStatus;
}

interface DisplayConditions {
  period: string;
  showClosed: boolean;
  showUnknownDeadline: boolean;
  region: string;
  tournamentType: string;
  deduplicate: boolean;
  sortOrder: string;
}

@Component({
  selector: 'app-tournament-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AddIconComponent, EditIconComponent, DeleteIconComponent, ConfirmModalComponent, StandardTableComponent],
  templateUrl: './tournament-settings-page.component.html',
  styleUrl: './tournament-settings-page.component.css',
})
export class TournamentSettingsPageComponent {
  private readonly sitesKey = 'tt-tournament-reference-sites';
  private readonly conditionsKey = 'tt-tournament-display-conditions';

  sites: ReferenceSite[] = this.readSites();
  conditions: DisplayConditions = this.readConditions();
  editingId?: number;
  pendingDelete?: ReferenceSite;
  modalOpen = false;
  showAdvanced = false;
  testState: 'idle' | 'running' | 'done' = 'idle';
  form = this.emptySite();

  openCreate(): void {
    this.editingId = undefined;
    this.form = this.emptySite();
    this.showAdvanced = false;
    this.testState = 'idle';
    this.modalOpen = true;
  }

  openEdit(site: ReferenceSite): void {
    this.editingId = site.id;
    this.form = { ...site };
    this.showAdvanced = false;
    this.testState = 'idle';
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.testState = 'idle';
  }

  saveSite(): void {
    if (!this.form.name.trim() || !this.form.url.trim()) return;
    const site = { ...this.form, name: this.form.name.trim(), url: this.form.url.trim() };
    if (this.editingId === undefined) {
      site.id = Date.now();
      this.sites = [...this.sites, site];
    } else {
      this.sites = this.sites.map((item) => item.id === this.editingId ? site : item);
    }
    this.persistSites();
    this.closeModal();
  }

  toggleEnabled(site: ReferenceSite): void {
    site.enabled = !site.enabled;
    this.persistSites();
  }

  updateNow(site: ReferenceSite): void {
    site.lastFetchedAt = this.formatDate(new Date());
    site.status = '正常';
    this.persistSites();
  }

  runFetchTest(): void {
    this.testState = 'running';
    window.setTimeout(() => this.testState = 'done', 450);
  }

  confirmDelete(): void {
    if (!this.pendingDelete) return;
    this.sites = this.sites.filter((site) => site.id !== this.pendingDelete?.id);
    this.pendingDelete = undefined;
    this.persistSites();
  }

  saveConditions(): void {
    localStorage.setItem(this.conditionsKey, JSON.stringify(this.conditions));
  }

  statusClass(status: FetchStatus): string {
    return status === '正常' ? 'status-ok' : status === '取得失敗' ? 'status-error' : 'status-idle';
  }

  private emptySite(): ReferenceSite {
    return {
      id: 0, name: '', url: '', sport: '卓球', region: '全国', enabled: true, memo: '',
      frequency: '毎日', tournamentSelector: '', eventDateSelector: '', deadlineSelector: '',
      detailUrlMethod: '一覧ページのリンクを使用', lastFetchedAt: '—', status: '未取得',
    };
  }

  private readSites(): ReferenceSite[] {
    try { return JSON.parse(localStorage.getItem(this.sitesKey) ?? '[]'); } catch { return []; }
  }

  private readConditions(): DisplayConditions {
    const defaults: DisplayConditions = {
      period: '3か月', showClosed: false, showUnknownDeadline: true, region: 'すべて',
      tournamentType: 'すべて', deduplicate: true, sortOrder: '申込締切が近い順',
    };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(this.conditionsKey) ?? '{}') }; } catch { return defaults; }
  }

  private persistSites(): void {
    localStorage.setItem(this.sitesKey, JSON.stringify(this.sites));
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
}
