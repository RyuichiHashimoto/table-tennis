import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmModalComponent } from '../../../../../../shared/ui/modal/confirm-modal/confirm-modal.component';
import { IconButtonComponent } from '../../../../../../shared/ui/icon-button/icon-button/icon-button.component';
import { ModalComponent } from '../../../../../../shared/ui/modal/modal/modal.component';

@Component({
  selector: 'app-preview-buttons',
  standalone: true,
  imports: [FormsModule, ConfirmModalComponent, IconButtonComponent, ModalComponent],
  templateUrl: './buttons.component.html',
  styleUrl: './buttons.component.css',
})
export class PreviewButtonsComponent {
  isDefaultModalOpen = false;
  isDangerModalOpen = false;
  isFormModalOpen = false;
  sampleModalTitle = 'UI Preview';
  sampleModalCategory = 'panel';
  sampleModalPriority = 1;
  sampleModalNote = '複数の入力欄やテキストエリアを同じモーダルに並べられます。';

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
