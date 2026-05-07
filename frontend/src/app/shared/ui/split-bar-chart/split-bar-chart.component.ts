import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface SplitBarChartRow {
  label: string;
  leftPercent: number; // 0〜100。右側は 100 - leftPercent で算出
}

@Component({
  selector: 'app-split-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './split-bar-chart.component.html',
  styleUrl: './split-bar-chart.component.css',
})
export class SplitBarChartComponent {
  @Input() title = '';
  @Input() leftLabel = '';
  @Input() rightLabel = '';
  @Input() rows: SplitBarChartRow[] = [];

  rightPercent(row: SplitBarChartRow): number {
    return 100 - row.leftPercent;
  }
}
