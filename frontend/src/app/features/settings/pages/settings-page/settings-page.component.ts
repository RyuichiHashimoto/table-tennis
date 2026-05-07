import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';

type SettingsSection = {
  id: 'tags' | 'display' | 'ui-preview';
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
      description: 'ラリーに付与するタグの追加、削除、編集を行います。',
      items: ['タグ一覧', '表示順', '既定タグ候補'],
    },
    {
      id: 'display',
      path: '/settings/display',
      label: '表示設定',
      title: '表示設定',
      description: 'テーマや画面表示に関する設定を行います。',
      items: ['テーマ'],
    },
    {
      id: 'ui-preview',
      path: '/settings/ui-preview',
      label: 'UIプレビュー',
      title: 'UIプレビュー',
      description: '共通UI部品やテーマの見た目を確認します。',
      items: ['ボタン', '入力欄', 'テーブル'],
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
