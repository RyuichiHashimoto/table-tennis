import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-rotate-clockwise-icon',
  standalone: true,
  imports: [],
  templateUrl: './rotate-clockwise-icon.component.html',
  styleUrl: './rotate-clockwise-icon.component.css',
})
export class RotateClockwiseIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
