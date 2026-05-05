import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-user-filled-icon',
  standalone: true,
  imports: [],
  templateUrl: './user-filled-icon.component.html',
  styleUrl: './user-filled-icon.component.css',
})
export class UserFilledIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
