import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SearchFilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'ui-search-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-filter-bar.component.html',
  styleUrl: './search-filter-bar.component.css',
})
export class SearchFilterBarComponent {
  @Input() query = '';
  @Input() placeholder = '';
  @Input() searchLabel = '検索';
  @Input() filterOptions: ReadonlyArray<SearchFilterOption> = [];
  @Input() activeFilter = 'all';
  @Input() showFilters = true;
  @Input() toggleable = true;

  @Output() queryChange = new EventEmitter<string>();
  @Output() activeFilterChange = new EventEmitter<string>();
  @Output() showFiltersChange = new EventEmitter<boolean>();

  toggleFilters(): void {
    this.showFiltersChange.emit(!this.showFilters);
  }
}
