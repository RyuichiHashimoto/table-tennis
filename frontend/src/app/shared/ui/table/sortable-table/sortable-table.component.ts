import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TableBaseComponent } from '../table-base/table-base.component';

export interface SortableRow {
  id: number;
  score: string;
  server: '自分' | '相手';
  pointWinner: '自分' | '相手';
  tag: string;
}

@Component({
  selector: 'ui-sortable-table',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './sortable-table.component.html',
  styleUrls: ['../table-base/table-base.component.css', './sortable-table.component.css'],
})
export class SortableTableComponent extends TableBaseComponent {
  @Input() rows: SortableRow[] = [];
  @Output() dropped = new EventEmitter<CdkDragDrop<SortableRow[]>>();

  trackById(_: number, row: SortableRow): number {
    return row.id;
  }
}
