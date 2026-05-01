import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';

type SettingsSection = {
  id: 'tags' | 'debugs';
  path: string;
  label: string;
  title: string;
  description: string;
  items: string[];
};

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.css',
})
export class SettingsPageComponent {
  readonly sections: SettingsSection[] = [
    {
      id: 'tags',
      path: '/settings/tags',
      label: 'タグ設定',
      title: 'タグ設定',
      description: 'ラリーに付与するタグの管理や、候補の整理を行うための領域です。',
      items: ['タグ一覧', '表示順', '既定タグ候補'],
    },
    {
      id: 'debugs',
      path: '/settings/debugs',
      label: 'デバッグ',
      title: 'デバッグ',
      description: '共通UI部品やテーマの見た目を確認するためのプレビュー領域です。',
      items: ['カード', 'パネル', 'テーブル'],
    },
  ];

  selectedSection = this.sections[0];

  constructor(private readonly router: Router) {
    this.syncSectionFromUrl(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncSectionFromUrl(event.urlAfterRedirects));
  }

  private syncSectionFromUrl(url: string): void {
    this.selectedSection = this.sections.find((section) => url.startsWith(section.path)) ?? this.sections[0];
  }
}
