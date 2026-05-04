import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-trophy-icon',
  standalone: true,
  imports: [],
  templateUrl: './trophy-icon.component.html',
  styleUrl: './trophy-icon.component.css',
})
export class TrophyIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
