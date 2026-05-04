import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-users-icon',
  standalone: true,
  imports: [],
  templateUrl: './users-icon.component.html',
  styleUrl: './users-icon.component.css',
})
export class UsersIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
