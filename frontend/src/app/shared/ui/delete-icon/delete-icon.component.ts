import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-delete-icon',
  standalone: true,
  imports: [],
  templateUrl: './delete-icon.component.html',
  styleUrl: './delete-icon.component.css',
})
export class DeleteIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
