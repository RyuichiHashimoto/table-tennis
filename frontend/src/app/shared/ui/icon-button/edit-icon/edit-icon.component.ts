import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-edit-icon',
  standalone: true,
  imports: [],
  templateUrl: './edit-icon.component.html',
  styleUrl: './edit-icon.component.css',
})
export class EditIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
