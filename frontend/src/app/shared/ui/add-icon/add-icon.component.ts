import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-add-icon',
  standalone: true,
  imports: [],
  templateUrl: './add-icon.component.html',
  styleUrl: './add-icon.component.css',
})
export class AddIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
