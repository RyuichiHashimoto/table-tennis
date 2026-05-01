import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Rally } from './shared/models';

interface TimelineRow {
  rally: Rally;
  rallyIndex: number;
  setNo: number;
  mySets: number;
  opSets: number;
  myPoints: number;
  opPoints: number;
}

interface TimelineSetGroup {
  setNo: number;
  rows: TimelineRow[];
  myPoints: number;
  opPoints: number;
}

@Component({
  selector: 'app-match-timeline-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-timeline-panel.component.html',
  styleUrl: './match-timeline-panel.component.css',
})
export class MatchTimelinePanelComponent {
  @Input() rallies: Rally[] = [];
  @Input() selectedRallyId?: number;
  @Input() selectedSetNo = 1;
  @Output() seekToTime = new EventEmitter<number>();
  @Output() seekAfterRally = new EventEmitter<number>();
  @Output() deleteRally = new EventEmitter<number>();
  @Output() toggleStar = new EventEmitter<number>();
  @Output() selectRally = new EventEmitter<number>();
  @Output() editRally = new EventEmitter<number>();
  @Output() insertAfterRally = new EventEmitter<number>();
  @Output() selectedSetChange = new EventEmitter<number>();

  get timelineRows(): TimelineRow[] {
    return this.setGroups.flatMap((group) => group.rows);
  }

  get setGroups(): TimelineSetGroup[] {
    const ralliesBySet = new Map<number, Array<{ rally: Rally; rallyIndex: number }>>();
    this.rallies.forEach((rally, rallyIndex) => {
      const rows = ralliesBySet.get(rally.setNo) ?? [];
      rows.push({ rally, rallyIndex });
      ralliesBySet.set(rally.setNo, rows);
    });

    let mySets = 0;
    let opSets = 0;

    return Array.from({ length: 5 }, (_, index) => index + 1).map((setNo) => {
      const entries = ralliesBySet.get(setNo) ?? [];
        let myPoints = 0;
        let opPoints = 0;

        const rows = entries.map(({ rally, rallyIndex }) => {
          const row: TimelineRow = {
            rally,
            rallyIndex,
            setNo,
            mySets,
            opSets,
            myPoints,
            opPoints,
          };

          if (rally.pointWinner === 'me') {
            myPoints += 1;
          } else {
            opPoints += 1;
          }

          return row;
        });

        if (this.isCompletedSet(myPoints, opPoints)) {
          if (myPoints > opPoints) {
            mySets += 1;
          } else {
            opSets += 1;
          }
        }

      return { setNo, rows, myPoints, opPoints };
    });
  }

  private isCompletedSet(myPoints: number, opPoints: number): boolean {
    return (myPoints >= 11 || opPoints >= 11) && Math.abs(myPoints - opPoints) >= 2;
  }

  get activeSetNo(): number | undefined {
    return this.selectedSetNo;
  }

  get activeRows(): TimelineRow[] {
    const activeSetNo = this.activeSetNo;
    if (activeSetNo === undefined) {
      return [];
    }
    return this.setGroups.find((group) => group.setNo === activeSetNo)?.rows ?? [];
  }

  selectSet(setNo: number): void {
    this.selectedSetChange.emit(setNo);
  }

  trackBySetNo(_index: number, group: TimelineSetGroup): number {
    return group.setNo;
  }

  trackByRallyId(_index: number, row: TimelineRow): number {
    return row.rally.id;
  }

  onSeek(rally: Rally): void {
    this.selectRally.emit(rally.id);
    this.seekToTime.emit(rally.tStart ?? 0);
  }

  onSeekAfter(rallyIndex: number): void {
    const rally = this.rallies[rallyIndex];
    this.seekAfterRally.emit(rally?.tEnd ?? rally?.tStart ?? 0);
  }

  onDelete(rally: Rally): void {
    this.deleteRally.emit(rally.id);
  }

  onToggleStar(rally: Rally): void {
    this.toggleStar.emit(rally.id);
  }

  onSelectRally(rally: Rally): void {
    this.selectRally.emit(rally.id);
  }

  onEditRally(rally: Rally): void {
    this.editRally.emit(rally.id);
  }

  onInsertAfter(rally: Rally): void {
    this.insertAfterRally.emit(rally.id);
  }
}
