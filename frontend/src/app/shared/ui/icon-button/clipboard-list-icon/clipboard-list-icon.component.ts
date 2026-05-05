import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-clipboard-list-icon',
  standalone: true,
  imports: [],
  templateUrl: './clipboard-list-icon.component.html',
  styleUrl: './clipboard-list-icon.component.css',
})
export class ClipboardListIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
