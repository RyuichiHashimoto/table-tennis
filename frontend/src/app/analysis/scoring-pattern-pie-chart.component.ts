import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ArcElement, Chart, Legend, PieController, Tooltip } from 'chart.js';
import { ScoringPatternSlice } from '../shared/models';

Chart.register(PieController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-scoring-pattern-pie-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scoring-pattern-pie-chart.component.html',
  styleUrl: './scoring-pattern-pie-chart.component.css',
})
export class ScoringPatternPieChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = '得点パターン';
  @Input() data: ScoringPatternSlice[] = [];
  @Input() emptyMessage = '得点データがありません。';

  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private viewInitialized = false;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['data'] || changes['title']) && this.viewInitialized) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  get hasData(): boolean {
    return this.data.some((slice) => slice.count > 0);
  }

  private renderChart(): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      return;
    }
    this.chart?.destroy();
    if (!this.hasData) {
      this.chart = undefined;
      return;
    }

    this.chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: this.data.map((slice) => slice.label),
        datasets: [
          {
            data: this.data.map((slice) => slice.count),
            backgroundColor: ['#167d57', '#22a06b', '#54c58f', '#8bddb5', '#c8efdb', '#f2c14e', '#d97b66'],
            borderColor: '#0a0a0a',
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              color: '#eaeaea',
              font: {
                size: 12,
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const slice = this.data[context.dataIndex];
                return `${slice.label}: ${slice.count}本 (${(slice.ratio * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
  }
}
