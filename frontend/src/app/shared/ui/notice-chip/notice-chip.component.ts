import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-notice-chip',
  standalone: true,
  imports: [],
  templateUrl: './notice-chip.component.html',
  styleUrl: './notice-chip.component.css',
})
export class NoticeChipComponent {
  @Input() tone: 'success' | 'danger' = 'success';
}
