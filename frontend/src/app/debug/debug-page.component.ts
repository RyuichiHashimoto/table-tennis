import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmModalComponent } from '../shared/confirm-modal.component';
import { InputModalComponent } from '../shared/input-modal.component';
import { InputModalField } from '../shared/models';

@Component({
  selector: 'app-debug-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, InputModalComponent],
  templateUrl: './debug-page.component.html',
  styleUrl: './debug-page.component.css',
})
export class DebugPageComponent {
  sampleText = 'サンプルテキスト';
  selectedMode = 'default';
  isDefaultModalOpen = false;
  isDangerModalOpen = false;
  isInputModalOpen = false;

  readonly sampleRows = [
    { name: 'ui-card', category: 'Card', state: 'ready' },
    { name: 'ui-panel', category: 'Panel', state: 'ready' },
    { name: 'ui-chip', category: 'Chip', state: 'ready' },
  ];

  readonly sampleInputFields: InputModalField[] = [
    {
      key: 'title',
      label: 'タイトル',
      type: 'text',
      placeholder: '例: 新しいカード',
      required: true,
      value: 'UI Preview',
    },
    {
      key: 'category',
      label: 'カテゴリ',
      type: 'select',
      value: 'panel',
      options: [
        { label: 'Panel', value: 'panel' },
        { label: 'Card', value: 'card' },
        { label: 'Modal', value: 'modal' },
      ],
    },
    {
      key: 'priority',
      label: '優先度',
      type: 'number',
      value: 1,
    },
    {
      key: 'note',
      label: 'メモ',
      type: 'textarea',
      rows: 5,
      placeholder: '複数行メモを入力できます',
      value: '複数の入力欄やテキストエリアを同じモーダルに並べられます。',
    },
  ];

  openModal(tone: 'default' | 'danger'): void {
    if (tone === 'danger') {
      this.isDangerModalOpen = true;
      return;
    }
    this.isDefaultModalOpen = true;
  }

  closeModal(tone: 'default' | 'danger'): void {
    if (tone === 'danger') {
      this.isDangerModalOpen = false;
      return;
    }
    this.isDefaultModalOpen = false;
  }

  openInputModal(): void {
    this.isInputModalOpen = true;
  }

  closeInputModal(): void {
    this.isInputModalOpen = false;
  }

  submitInputModal(): void {
    this.isInputModalOpen = false;
  }
}
