import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface FactorBarChartRow {
  label: string;
  count: number;
}

interface ComputedRow {
  label: string;
  count: number;
  barPercent: number;
  totalPercent: number;
}

@Component({
  selector: 'app-factor-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './factor-bar-chart.component.html',
  styleUrl: './factor-bar-chart.component.css',
})
export class FactorBarChartComponent {
  @Input() title = '';
  @Input() totalLabel = '合計得点';
  @Input() rows: FactorBarChartRow[] = [];

  get total(): number {
    return this.rows.reduce((sum, r) => sum + r.count, 0);
  }

  get computedRows(): ComputedRow[] {
    const { niceMax } = this.niceParams;
    const total = this.total;
    return this.rows.map(r => ({
      label: r.label,
      count: r.count,
      barPercent: niceMax > 0 ? (r.count / niceMax) * 100 : 0,
      totalPercent: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }));
  }

  get xAxisTicks(): number[] {
    const { niceMax, step } = this.niceParams;
    const tickCount = Math.round(niceMax / step) + 1;
    return Array.from({ length: tickCount }, (_, i) => i * step);
  }

  private get niceParams(): { niceMax: number; step: number } {
    const maxValue = this.rows.length > 0 ? Math.max(...this.rows.map(r => r.count)) : 0;
    return this.computeNiceMax(maxValue);
  }

  private computeNiceMax(maxValue: number): { niceMax: number; step: number } {
    if (maxValue === 0) return { niceMax: 10, step: 2 };
    const candidates = [1, 2, 5, 10, 15, 20, 25, 50, 100];
    for (const step of candidates) {
      const niceMax = Math.ceil(maxValue / step) * step;
      if (Math.round(niceMax / step) <= 5) {
        return { niceMax, step };
      }
    }
    const fallbackStep = Math.ceil(maxValue / 5);
    return {
      niceMax: Math.ceil(maxValue / fallbackStep) * fallbackStep,
      step: fallbackStep,
    };
  }
}
