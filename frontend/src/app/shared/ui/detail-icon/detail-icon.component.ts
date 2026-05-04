import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-detail-icon',
  standalone: true,
  imports: [],
  templateUrl: './detail-icon.component.html',
  styleUrl: './detail-icon.component.css',
})
export class DetailIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
