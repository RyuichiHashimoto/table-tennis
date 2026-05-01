import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputModalField } from './models';

@Component({
  selector: 'app-input-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './input-modal.component.html',
  styleUrl: './input-modal.component.css',
})
export class InputModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = '入力';
  @Input() message = '';
  @Input() confirmLabel = '保存';
  @Input() cancelLabel = 'キャンセル';
  @Input() fields: InputModalField[] = [];

  @Output() submitted = new EventEmitter<Record<string, string | number>>();
  @Output() cancelled = new EventEmitter<void>();

  values: Record<string, string | number> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || changes['fields']) {
      this.values = this.fields.reduce<Record<string, string | number>>((acc, field) => {
        acc[field.key] = field.value ?? '';
        return acc;
      }, {});
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }

  canSubmit(): boolean {
    return this.fields.every((field) => {
      if (!field.required) {
        return true;
      }
      const value = this.values[field.key];
      return typeof value === 'number' ? !Number.isNaN(value) : `${value ?? ''}`.trim().length > 0;
    });
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.submitted.emit({ ...this.values });
  }
}
