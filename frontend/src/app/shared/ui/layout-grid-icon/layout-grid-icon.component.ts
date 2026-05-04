import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-layout-grid-icon',
  standalone: true,
  imports: [],
  templateUrl: './layout-grid-icon.component.html',
  styleUrl: './layout-grid-icon.component.css',
})
export class LayoutGridIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
