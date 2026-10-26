import { Component, Input } from '@angular/core';

export type MatchResult = 'win' | 'loss' | 'pending';

@Component({
  selector: 'app-match-result-badge',
  standalone: true,
  imports: [],
  templateUrl: './match-result-badge.component.html',
  styleUrl: './match-result-badge.component.css',
})
export class MatchResultBadgeComponent {
  @Input({ required: true }) result!: MatchResult;

  get label(): string {
    return {
      win: '勝利',
      loss: '敗北',
      pending: '未判定',
    }[this.result];
  }
}
