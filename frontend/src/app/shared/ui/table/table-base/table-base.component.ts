import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-table-base',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-base.component.html',
  styleUrl: './table-base.component.css',
})
export class TableBaseComponent {
  @Input() empty = false;
  @Input() emptyMessage = 'データがありません。';
}
