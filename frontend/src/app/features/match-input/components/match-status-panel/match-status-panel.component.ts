import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-match-status-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-status-panel.component.html',
  styleUrl: './match-status-panel.component.css',
})
export class MatchStatusPanelComponent {
  @Input() selectedSetNo = 1;
  @Input() score: { me: number; op: number } = { me: 0, op: 0 };
  @Input() serverLabel = '自分';
  @Input() statusLabel = '試合前';
  @Input() nextActionMessage = '';
}
