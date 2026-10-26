import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { runtimeConfig } from '../../../core/config/runtime-config';
import { SearchFilterBarComponent } from '../../../shared/ui/search-filter-bar/search-filter-bar.component';

interface ScheduledMatch {
  id: number;
  title: string;
  starts_at: string;
  venue: string;
  competition: string;
  source_url: string;
  fetched_at: string;
}

type ScheduleFilter = 'all' | 'singles' | 'doubles' | 'team';

interface ScheduleGroup {
  key: string;
  label: string;
  matches: ScheduledMatch[];
}

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchFilterBarComponent],
  templateUrl: './schedule-page.component.html',
  styleUrl: './schedule-page.component.css',
})
export class SchedulePageComponent implements OnInit {
  matches: ScheduledMatch[] = [];
  loading = false;
  error = '';
  searchQuery = '';
  showFilters = true;
  activeFilter: ScheduleFilter = 'all';

  readonly filterOptions: ReadonlyArray<{ label: string; value: ScheduleFilter }> = [
    { label: 'すべて', value: 'all' },
    { label: 'シングル', value: 'singles' },
    { label: 'ダブルス', value: 'doubles' },
    { label: '団体', value: 'team' },
  ];

  get groupedMatches(): ScheduleGroup[] {
    const query = this.normalize(this.searchQuery);
    const filtered = this.matches.filter((match) => {
      const searchable = this.normalize(`${match.title} ${match.competition} ${match.venue}`);
      return (!query || searchable.includes(query)) && this.matchesFilter(searchable);
    });

    const groups = new Map<string, ScheduledMatch[]>();
    for (const match of filtered) {
      const key = this.formatDateKey(match.starts_at);
      const existing = groups.get(key) ?? [];
      existing.push(match);
      groups.set(key, existing);
    }

    return Array.from(groups, ([key, matches]) => ({
      key,
      label: this.formatDateLabel(matches[0].starts_at),
      matches,
    }));
  }

  async ngOnInit(): Promise<void> { await this.load(); }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  }

  private formatDateKey(value: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private formatDateLabel(value: string): string {
    const parts = new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('month')}月${part('day')}日（${part('weekday')}）`;
  }

  private matchesFilter(searchable: string): boolean {
    switch (this.activeFilter) {
      case 'singles': return searchable.includes('シングル');
      case 'doubles': return searchable.includes('ダブル');
      case 'team': return searchable.includes('団体');
      default: return true;
    }
  }

  private normalize(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase('ja-JP').trim();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.matches = await this.request<ScheduledMatch[]>('/schedule');
    } catch (error) {
      this.error = error instanceof Error ? error.message : '日程を読み込めませんでした。';
    } finally {
      this.loading = false;
    }
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${runtimeConfig.apiBase}${path}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `API error (${response.status})`);
    }
    return response.json() as Promise<T>;
  }
}
