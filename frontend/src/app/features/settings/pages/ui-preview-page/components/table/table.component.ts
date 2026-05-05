import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ConfirmModalComponent } from '../../../../../../shared/ui/modal/confirm-modal/confirm-modal.component';
import { StandardTableComponent } from '../../../../../../shared/ui/table/standard-table/standard-table.component';
import { SortableTableComponent, SortableRow } from '../../../../../../shared/ui/table/sortable-table/sortable-table.component';

const INITIAL_ROWS: SortableRow[] = [
  { id: 1, score: '1-0',  server: '自分', pointWinner: '自分', tag: 'フォアドライブ' },
  { id: 2, score: '1-1',  server: '自分', pointWinner: '相手', tag: 'バックミス' },
  { id: 3, score: '2-1',  server: '相手', pointWinner: '自分', tag: 'サービスエース' },
  { id: 4, score: '2-2',  server: '相手', pointWinner: '相手', tag: 'スマッシュ' },
  { id: 5, score: '3-2',  server: '自分', pointWinner: '自分', tag: 'フォアドライブ' },
];

@Component({
  selector: 'app-preview-table',
  standalone: true,
  imports: [CommonModule, ConfirmModalComponent, StandardTableComponent, SortableTableComponent],
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
})
export class PreviewTableComponent {
  readonly sampleRows = [
    { name: 'ui-card', category: 'Card', state: 'ready' },
    { name: 'ui-panel', category: 'Panel', state: 'ready' },
    { name: 'ui-chip', category: 'Chip', state: 'ready' },
  ];

  sortableRows: SortableRow[] = INITIAL_ROWS.map(r => ({ ...r }));
  savedRows: SortableRow[] = INITIAL_ROWS.map(r => ({ ...r }));

  saveStatus: '' | 'saved' = '';
  showResetModal = false;

  get hasPendingChanges(): boolean {
    return this.sortableRows.some((r, i) => r.id !== this.savedRows[i]?.id);
  }

  onDrop(event: CdkDragDrop<SortableRow[]>): void {
    moveItemInArray(this.sortableRows, event.previousIndex, event.currentIndex);
  }

  onSave(): void {
    this.savedRows = this.sortableRows.map(r => ({ ...r }));
    this.saveStatus = 'saved';
    setTimeout(() => (this.saveStatus = ''), 2000);
  }

  onResetConfirm(): void {
    this.sortableRows = INITIAL_ROWS.map(r => ({ ...r }));
    this.savedRows = INITIAL_ROWS.map(r => ({ ...r }));
    this.showResetModal = false;
  }
}
