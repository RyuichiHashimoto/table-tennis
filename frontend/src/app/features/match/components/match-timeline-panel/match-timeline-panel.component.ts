import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Rally } from '../../../table-tennis/models/models';
import { AppStateService } from '../../../table-tennis/services/app-state.service';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { IconButtonComponent } from '../../../../shared/ui/icon-button/icon-button.component';
import { SaveStatusIconComponent, SaveStatus } from '../../../../shared/ui/save-status-icon/save-status-icon.component';
import { SetScoreChipComponent } from '../../../../shared/ui/set-score-chip/set-score-chip.component';

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
  imports: [CommonModule, DragDropModule, ConfirmModalComponent, IconButtonComponent, SaveStatusIconComponent, SetScoreChipComponent],
  templateUrl: './match-timeline-panel.component.html',
  styleUrl: './match-timeline-panel.component.css',
})
export class MatchTimelinePanelComponent implements OnChanges {
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

  localRallies: Rally[] = [];
  saveStatus: SaveStatus = 'saved';
  showResetConfirm = false;
  get isDirty(): boolean { return this.saveStatus === 'before'; }

  constructor(private readonly state: AppStateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rallies'] && !this.isDirty) {
      this.localRallies = [...this.rallies];
    }
  }

  get setGroups(): TimelineSetGroup[] {
    const ralliesBySet = new Map<number, Array<{ rally: Rally; rallyIndex: number }>>();
    this.localRallies.forEach((rally, rallyIndex) => {
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
        if (rally.pointWinner === 'me') myPoints += 1;
        else opPoints += 1;

        const row: TimelineRow = {
          rally,
          rallyIndex,
          setNo,
          mySets,
          opSets,
          myPoints,
          opPoints,
        };
        return row;
      });

      if (this.isCompletedSet(myPoints, opPoints)) {
        if (myPoints > opPoints) mySets += 1;
        else opSets += 1;
      }

      return { setNo, rows, myPoints, opPoints };
    });
  }

  private isCompletedSet(myPoints: number, opPoints: number): boolean {
    return (myPoints >= 11 || opPoints >= 11) && Math.abs(myPoints - opPoints) >= 2;
  }

  get activeSetNo(): number {
    return this.selectedSetNo;
  }

  get activeRows(): TimelineRow[] {
    return this.setGroups.find((group) => group.setNo === this.activeSetNo)?.rows ?? [];
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

  onSelectRally(rally: Rally): void {
    this.selectRally.emit(rally.id);
  }

  onToggleStar(rally: Rally): void {
    this.toggleStar.emit(rally.id);
  }

  onDrop(event: CdkDragDrop<TimelineRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const currentSetNo = this.activeSetNo;
    const setRallies = this.localRallies.filter((r) => r.setNo === currentSetNo);
    moveItemInArray(setRallies, event.previousIndex, event.currentIndex);
    let setIdx = 0;
    this.localRallies = this.localRallies.map((r) =>
      r.setNo === currentSetNo ? setRallies[setIdx++] : r,
    );
    this.saveStatus = 'before';
  }

  async saveSortOrders(): Promise<void> {
    const matchUuid = this.localRallies[0]?.matchUuid;
    if (!matchUuid || !this.isDirty) return;
    this.saveStatus = 'saving';
    try {
      const orders = this.localRallies.map((r, i) => ({ id: r.id, sort_order: i + 1 }));
      await this.state.saveSortOrders(matchUuid, orders);
      this.saveStatus = 'saved';
    } catch {
      this.saveStatus = 'before';
    }
  }

  openResetConfirm(): void {
    this.showResetConfirm = true;
  }

  async onResetConfirmed(): Promise<void> {
    this.showResetConfirm = false;
    const matchUuid = this.localRallies[0]?.matchUuid;
    if (!matchUuid) return;
    const rallies = await this.state.loadRallies(matchUuid);
    this.localRallies = [...rallies];
    this.saveStatus = 'saved';
  }

  onResetCancelled(): void {
    this.showResetConfirm = false;
  }
}
