import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-ui-preview-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, ModalComponent],
  templateUrl: './ui-preview-page.component.html',
  styleUrl: './ui-preview-page.component.css',
})
export class UiPreviewPageComponent {
  sampleText = 'サンプルテキスト';
  selectedMode = 'default';
  isDefaultModalOpen = false;
  isDangerModalOpen = false;
  isFormModalOpen = false;
  sampleModalTitle = 'UI Preview';
  sampleModalCategory = 'panel';
  sampleModalPriority = 1;
  sampleModalNote = '複数の入力欄やテキストエリアを同じモーダルに並べられます。';

  readonly sampleRows = [
    { name: 'ui-card', category: 'Card', state: 'ready' },
    { name: 'ui-panel', category: 'Panel', state: 'ready' },
    { name: 'ui-chip', category: 'Chip', state: 'ready' },
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

  openFormModal(): void {
    this.isFormModalOpen = true;
  }

  closeFormModal(): void {
    this.isFormModalOpen = false;
  }

  submitFormModal(): void {
    this.isFormModalOpen = false;
  }
}
