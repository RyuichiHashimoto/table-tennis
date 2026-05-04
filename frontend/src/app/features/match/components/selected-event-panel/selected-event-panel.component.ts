import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Rally, RallyResultTag, Side } from '../../../table-tennis/models/models';

@Component({
  selector: 'app-selected-event-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './selected-event-panel.component.html',
  styleUrl: './selected-event-panel.component.css',
  host: {
    '[style.width]': 'panelWidth',
    '[style.height]': 'panelHeight',
  },
})
export class SelectedEventPanelComponent {
  @Input() panelWidth?: string;
  @Input() panelHeight?: string;

  @Input() selectedRally?: Rally;
  @Input() selectedRallyTags: RallyResultTag[] = [];
  @Input() score: { me: number; op: number } = { me: 0, op: 0 };

  @Output() seekToTime = new EventEmitter<number>();
  @Output() pointWinnerChange = new EventEmitter<Side>();
  @Output() tagToggle = new EventEmitter<RallyResultTag>();
  @Output() deleteRally = new EventEmitter<number>();
  @Output() duplicateRally = new EventEmitter<number>();
  @Output() save = new EventEmitter<void>();

  formatClock(seconds?: number): string {
    const totalSeconds = Math.max(0, Math.floor(seconds ?? 0));
    const minutes = Math.floor(totalSeconds / 60);
    const rest = totalSeconds % 60;
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
  }
}
