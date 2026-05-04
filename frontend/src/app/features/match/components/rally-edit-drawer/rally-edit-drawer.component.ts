import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { Rally, RallyResultTag, RallyTagDefinition, Side } from '../../../table-tennis/models/models';

export interface RallyEditPayload {
  rallyId: number;
  pointWinner: Side;
  server: Side;
  resultTags: RallyResultTag[];
  note: string;
  tStart?: number | null;
}

@Component({
  selector: 'app-rally-edit-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rally-edit-drawer.component.html',
  styleUrl: './rally-edit-drawer.component.css',
})
export class RallyEditDrawerComponent implements OnChanges {
  @Input() rally?: Rally;
  @Input() isOpen = false;
  @Input() tagDefinitions: RallyTagDefinition[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<RallyEditPayload>();
  @Output() delete = new EventEmitter<number>();
  @Output() seekToTime = new EventEmitter<number>();

  localPointWinner: Side = 'me';
  localServer: Side = 'me';
  localTags: RallyResultTag[] = [];
  localNote = '';
  localTimeInput = '';

  ngOnChanges(): void {
    if (this.rally) {
      this.localPointWinner = this.rally.pointWinner;
      this.localServer = this.rally.server;
      this.localTags = [...(this.rally.resultTags ?? [])];
      this.localNote = this.rally.note ?? '';
      this.localTimeInput = this.formatClock(this.rally.tStart);
    }
  }

  get suggestedTags(): RallyResultTag[] {
    return this.tagDefinitions
      .filter((def) => {
        if (def.shotType === 'any') return true;
        if (this.localPointWinner === 'me') {
          return (def.playerSide === 'me' && def.shotType === 'point') ||
                 (def.playerSide === 'op' && def.shotType === 'miss');
        }
        return (def.playerSide === 'me' && def.shotType === 'miss') ||
               (def.playerSide === 'op' && def.shotType === 'point');
      })
      .map((def) => def.tag);
  }

  get allTags(): RallyResultTag[] {
    return this.tagDefinitions.map((def) => def.tag);
  }

  toggleTag(tag: RallyResultTag): void {
    this.localTags = this.localTags.includes(tag)
      ? this.localTags.filter((t) => t !== tag)
      : [...this.localTags, tag];
  }

  onSave(): void {
    if (!this.rally) return;
    this.save.emit({
      rallyId: this.rally.id,
      pointWinner: this.localPointWinner,
      server: this.localServer,
      resultTags: this.localTags,
      note: this.localNote,
      tStart: this.parseClock(this.localTimeInput),
    });
  }

  formatClock(seconds?: number): string {
    if (seconds === undefined) return '';
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private parseClock(value: string): number | null {
    if (!value) return null;
    const match = value.match(/^(\d+):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
}
