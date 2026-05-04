import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaveStatusIconComponent, SaveStatus } from '../../../../../../../shared/ui/save-status-icon/save-status-icon.component';

@Component({
  selector: 'app-preview-save-status-icon',
  standalone: true,
  imports: [CommonModule, SaveStatusIconComponent],
  templateUrl: './save-status-icon-preview.component.html',
  styleUrl: './save-status-icon-preview.component.css',
})
export class PreviewSaveStatusIconComponent {
  readonly statuses: { label: string; value: SaveStatus }[] = [
    { label: '未保存 (before)', value: 'before' },
    { label: '保存中 (saving)', value: 'saving' },
    { label: '保存済み (saved)', value: 'saved' },
  ];

  demoStatus: SaveStatus = 'before';

  onDemoClick(): void {
    if (this.demoStatus === 'before') {
      this.demoStatus = 'saving';
      setTimeout(() => {
        this.demoStatus = 'saved';
      }, 1500);
    } else if (this.demoStatus === 'saved') {
      this.demoStatus = 'before';
    }
  }

  get demoLabel(): string {
    return { before: '未保存', saving: '保存中…', saved: '保存済み' }[this.demoStatus];
  }
}
