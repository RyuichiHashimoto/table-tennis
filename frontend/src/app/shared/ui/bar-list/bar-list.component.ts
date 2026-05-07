import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface BarListRow {
  label: string;
  ratio: number;
  valueLabel: string;
  muted?: boolean;
}

@Component({
  selector: 'app-bar-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bar-list.component.html',
  styleUrl: './bar-list.component.css',
})
export class BarListComponent {
  @Input() rows: BarListRow[] = [];
  @Input() emptyMessage = 'データがありません';

  toPercent(ratio: number): number {
    return Math.max(0, Math.min(100, ratio * 100));
  }
}
