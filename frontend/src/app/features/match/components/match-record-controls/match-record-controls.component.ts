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
  @Input() selectedRally?: Rally;
  @Input() selectedRallyTags: RallyResultTag[] = [];

  @Output() startRally = new EventEmitter<void>();
  @Output() initialServerChange = new EventEmitter<Side>();
  @Output() selectedRallyTagToggle = new EventEmitter<RallyResultTag>();
  @Output() registerRally = new EventEmitter<{ winner: Side; note: string }>();

  selectedResult: Side | null = null;
  localNote = '';

  onRegister(): void {
    if (!this.selectedResult) return;
    this.registerRally.emit({ winner: this.selectedResult, note: this.localNote });
    this.selectedResult = null;
    this.localNote = '';
  }
}
