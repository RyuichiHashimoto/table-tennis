import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-set-score-tab',
  standalone: true,
  imports: [],
  templateUrl: './set-score-tab.component.html',
  styleUrl: './set-score-tab.component.css',
})
export class SetScoreTabComponent {
  @Input() setNo = 1;
  @Input() myPoints = 0;
  @Input() opPoints = 0;
  @Input() active = false;

  get resultClass(): 'win' | 'loss' | 'draw' {
    if (this.myPoints > this.opPoints) {
      return 'win';
    }
    if (this.myPoints < this.opPoints) {
      return 'loss';
    }
    return 'draw';
  }
}
