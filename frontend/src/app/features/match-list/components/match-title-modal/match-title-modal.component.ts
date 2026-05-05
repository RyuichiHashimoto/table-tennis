import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/ui/modal/modal/modal.component';

@Component({
  selector: 'app-match-title-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './match-title-modal.component.html',
  styleUrl: './match-title-modal.component.css',
})
export class MatchTitleModalComponent implements OnChanges {
  @Input() open = false;
  @Input() currentTitle = '';

  @Output() saved = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  title = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || changes['currentTitle']) {
      this.title = this.currentTitle;
    }
  }

  get canSave(): boolean {
    return this.title.trim().length > 0;
  }

  save(): void {
    if (!this.canSave) {
      return;
    }
    this.saved.emit(this.title.trim());
  }
}
