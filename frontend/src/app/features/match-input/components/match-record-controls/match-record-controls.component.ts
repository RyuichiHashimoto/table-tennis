import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Rally, RallyResultTag, Side } from '../../../table-tennis/models/models';

@Component({
  selector: 'app-match-record-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-record-controls.component.html',
  styleUrl: './match-record-controls.component.css',
})
export class MatchRecordControlsComponent {
  @Input() initialServer: Side = 'me';
  @Input() inputSetNo = 1;
  @Input() insertAfterRally?: Rally;
  @Input() editingRally?: Rally;
  @Input() selectedRally?: Rally;
  @Input() selectedRallyTags: RallyResultTag[] = [];
  @Input() message = '';

  @Output() startMatch = new EventEmitter<void>();
  @Output() startRally = new EventEmitter<void>();
  @Output() scorePoint = new EventEmitter<Side>();
  @Output() initialServerChange = new EventEmitter<Side>();
  @Output() selectedRallyPointWinnerChange = new EventEmitter<Side>();
  @Output() selectedRallyTagToggle = new EventEmitter<RallyResultTag>();
}
