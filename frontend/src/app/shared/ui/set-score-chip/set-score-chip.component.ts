import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-set-score-chip',
  standalone: true,
  imports: [],
  templateUrl: './set-score-chip.component.html',
  styleUrl: './set-score-chip.component.css',
})
export class SetScoreChipComponent {
  @Input() setNo = 1;
  @Input() myPoints = 0;
  @Input() opPoints = 0;
  @Input() active = false;
}
