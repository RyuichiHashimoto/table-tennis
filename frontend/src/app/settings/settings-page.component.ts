import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SettingsTagDefinitionsComponent } from './settings-tag-definitions.component';

type SettingsSection = {
  id: 'tags';
  label: string;
  title: string;
  description: string;
  items: string[];
};

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, SettingsTagDefinitionsComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.css',
})
export class SettingsPageComponent {
  readonly sections: SettingsSection[] = [
    {
      id: 'tags',
      label: 'タグ設定',
      title: 'タグ設定',
      description: 'ラリーに付与するタグの管理や、候補の整理を行うための領域です。',
      items: ['タグ一覧', '表示順', '既定タグ候補'],
    },
  ];
  selectedSectionId: SettingsSection['id'] = this.sections[0].id;

  get selectedSection(): SettingsSection {
    return this.sections.find((section) => section.id === this.selectedSectionId) ?? this.sections[0];
  }

  selectSection(sectionId: SettingsSection['id']): void {
    this.selectedSectionId = sectionId;
  }
}
