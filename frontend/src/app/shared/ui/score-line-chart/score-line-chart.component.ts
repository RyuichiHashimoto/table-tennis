import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface ScoreLinePoint {
  x: number;
  y: number;
  setNo?: number;
  rallyNo?: number;
  myPoints?: number;
  opPoints?: number;
  breakBefore?: boolean;
}

export interface ScoreLineSegment {
  label: string;
  startX: number;
  endX: number;
}

@Component({
  selector: 'app-score-line-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score-line-chart.component.html',
  styleUrl: './score-line-chart.component.css',
})
export class ScoreLineChartComponent {
  @Input() title = '点差推移';
  @Input() points: ScoreLinePoint[] = [];
  @Input() segments: ScoreLineSegment[] = [];
  @Input() yMin = -12;
  @Input() yMax = 12;
  @Input() yTickStep = 4;
  @Input() xAxisLabel = 'ラリー進行';
  @Input() yAxisLabel = '点差（自分 − 相手）';

  readonly width = 1120;
  readonly height = 220;
  readonly plot = { left: 50, top: 34, right: 24, bottom: 32 };
  readonly tooltip = { width: 126, height: 58, offset: 12 };
  hoveredPoint?: ScoreLinePoint;

  get plotWidth(): number {
    return this.width - this.plot.left - this.plot.right;
  }

  get plotHeight(): number {
    return this.height - this.plot.top - this.plot.bottom;
  }

  get xMin(): number {
    return Math.min(...this.points.map((point) => point.x), 1);
  }

  get xMax(): number {
    return Math.max(...this.points.map((point) => point.x), this.xMin + 1);
  }

  get zeroY(): number {
    return this.yToSvg(0);
  }

  get linePath(): string {
    return this.points
      .map((point, index) => `${index === 0 || point.breakBefore ? 'M' : 'L'} ${this.xToSvg(point.x).toFixed(2)} ${this.yToSvg(point.y).toFixed(2)}`)
      .join(' ');
  }

  get yTicks(): number[] {
    const ticks: number[] = [];
    for (let value = this.yMax; value >= this.yMin; value -= this.yTickStep) {
      ticks.push(value);
    }
    return ticks;
  }

  get xTicks(): number[] {
    const ticks = [this.xMin, 10, 20, 30, this.xMax];
    return [...new Set(ticks.filter((tick) => tick >= this.xMin && tick <= this.xMax))];
  }

  get tooltipX(): number {
    if (!this.hoveredPoint) {
      return 0;
    }
    const preferredX = this.xToSvg(this.hoveredPoint.x) + this.tooltip.offset;
    const maxX = this.plot.left + this.plotWidth - this.tooltip.width;
    return Math.max(this.plot.left, Math.min(maxX, preferredX));
  }

  get tooltipY(): number {
    if (!this.hoveredPoint) {
      return 0;
    }
    const preferredY = this.yToSvg(this.hoveredPoint.y) - this.tooltip.height - this.tooltip.offset;
    const maxY = this.plot.top + this.plotHeight - this.tooltip.height;
    return Math.max(this.plot.top, Math.min(maxY, preferredY));
  }

  get hoveredScoreLabel(): string {
    if (!this.hoveredPoint) {
      return '';
    }
    const myPoints = this.hoveredPoint.myPoints ?? 0;
    const opPoints = this.hoveredPoint.opPoints ?? 0;
    return `${myPoints} - ${opPoints}`;
  }

  get hoveredPointLabel(): string {
    if (!this.hoveredPoint) {
      return '';
    }
    const rallyNo = this.hoveredPoint.rallyNo ?? this.hoveredPoint.x;
    return rallyNo === 0 ? '開始' : `ラリー ${rallyNo}`;
  }

  xToSvg(x: number): number {
    const ratio = (x - this.xMin) / (this.xMax - this.xMin || 1);
    return this.plot.left + ratio * this.plotWidth;
  }

  yToSvg(y: number): number {
    const clamped = Math.max(this.yMin, Math.min(this.yMax, y));
    const ratio = (this.yMax - clamped) / (this.yMax - this.yMin || 1);
    return this.plot.top + ratio * this.plotHeight;
  }

  showPoint(point: ScoreLinePoint): void {
    this.hoveredPoint = point;
  }

  showNearestPoint(event: MouseEvent): void {
    const path = event.currentTarget as SVGGraphicsElement | null;
    const svg = path?.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix || !this.points.length) {
      return;
    }

    const cursor = svg.createSVGPoint();
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    const svgCursor = cursor.matrixTransform(matrix.inverse());
    this.hoveredPoint = this.points.reduce((nearest, point) => {
      const nearestDistance = Math.abs(this.xToSvg(nearest.x) - svgCursor.x);
      const pointDistance = Math.abs(this.xToSvg(point.x) - svgCursor.x);
      return pointDistance < nearestDistance ? point : nearest;
    }, this.points[0]);
  }

  hidePoint(point: ScoreLinePoint): void {
    if (this.hoveredPoint === point) {
      this.hoveredPoint = undefined;
    }
  }

  hideTooltip(): void {
    this.hoveredPoint = undefined;
  }

  segmentX(segment: ScoreLineSegment): number {
    return this.xToSvg((segment.startX + segment.endX) / 2);
  }

  segmentWidth(segment: ScoreLineSegment): number {
    return Math.max(0, this.xToSvg(segment.endX) - this.xToSvg(segment.startX));
  }

  segmentStartX(segment: ScoreLineSegment): number {
    return this.xToSvg(segment.startX);
  }
}
