import { Component } from '@angular/core';
import { SetScoreChipComponent } from '../../../../../../../shared/ui/set-score-chip/set-score-chip.component';

@Component({
  selector: 'app-preview-set-score-chip',
  standalone: true,
  imports: [SetScoreChipComponent],
  templateUrl: './set-score-chip-preview.component.html',
  styleUrl: './set-score-chip-preview.component.css',
})
export class PreviewSetScoreChipComponent {
  readonly samples = [
    { setNo: 1, myPoints: 11, opPoints: 7 },
    { setNo: 2, myPoints: 9, opPoints: 11 },
    { setNo: 3, myPoints: 11, opPoints: 5 },
  ];

  activeSetNo = 1;

  selectSet(setNo: number): void {
    this.activeSetNo = setNo;
  }
}
