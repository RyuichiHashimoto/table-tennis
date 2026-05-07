import { Component } from '@angular/core';
import {
  FactorBarChartComponent,
  FactorBarChartRow,
} from '../../../../../../shared/ui/factor-bar-chart/factor-bar-chart.component';
import {
  ScoreLineChartComponent,
  ScoreLinePoint,
  ScoreLineSegment,
} from '../../../../../../shared/ui/score-line-chart/score-line-chart.component';
import {
  SplitBarChartComponent,
  SplitBarChartRow,
} from '../../../../../../shared/ui/split-bar-chart/split-bar-chart.component';

@Component({
  selector: 'app-preview-charts',
  standalone: true,
  imports: [ScoreLineChartComponent, FactorBarChartComponent, SplitBarChartComponent],
  templateUrl: './charts.component.html',
  styleUrl: './charts.component.css',
})
export class PreviewChartsComponent {
  readonly serveReceiveRows: SplitBarChartRow[] = [
    { label: '自分サーブ時得点率', leftPercent: 62 },
    { label: '相手サーブ時の自分得点率', leftPercent: 39 },
  ];

  readonly factorRows: FactorBarChartRow[] = [
    { label: 'ラリー得点', count: 18 },
    { label: '相手ミス', count: 10 },
    { label: 'レシーブ得点', count: 6 },
    { label: 'サーブ得点', count: 4 },
  ];
  readonly scorePoints: ScoreLinePoint[] = [
    { x: 1, y: 0 },
    { x: 2, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 3 },
    { x: 5, y: 2 },
    { x: 6, y: 4 },
    { x: 7, y: 5 },
    { x: 8, y: 4.5 },
    { x: 9, y: 5.4 },
    { x: 10, y: 5.2 },
    { x: 11, y: 5.6 },
    { x: 12, y: 6.7 },
    { x: 13, y: 5.9 },
    { x: 14, y: 6.9 },
    { x: 15, y: 6.4 },
    { x: 16, y: 5.5 },
    { x: 17, y: 5.8 },
    { x: 18, y: 4.8 },
    { x: 19, y: 4.3 },
    { x: 20, y: 3.9 },
    { x: 21, y: 0 },
    { x: 22, y: 1.5 },
    { x: 23, y: 1.2 },
    { x: 24, y: 0 },
    { x: 25, y: -1.3 },
    { x: 26, y: -2.8 },
    { x: 27, y: -2.4 },
    { x: 28, y: -3.2 },
    { x: 29, y: -3.7 },
    { x: 30, y: -4.8 },
    { x: 31, y: -4.4 },
    { x: 32, y: -5.6 },
    { x: 33, y: -6.2 },
    { x: 34, y: -7.4 },
    { x: 35, y: -6.6 },
    { x: 36, y: -5.7 },
    { x: 37, y: -6.2 },
    { x: 38, y: -4 },
  ];

  readonly scoreSegments: ScoreLineSegment[] = [
    { label: 'セット 1（13-7）', startX: 1, endX: 20 },
    { label: 'セット 2（6-12）', startX: 20, endX: 38 },
  ];
}
