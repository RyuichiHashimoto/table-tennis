import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-table-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-shell.component.html',
  styleUrl: './table-shell.component.css',
})
export class TableShellComponent {
  @Input() empty = false;
  @Input() emptyMessage = 'データがありません。';
}
