import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TableBaseComponent } from '../table-base/table-base.component';

@Component({
  selector: 'ui-standard-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: '../table-base/table-base.component.html',
  styleUrl: '../table-base/table-base.component.css',
})
export class StandardTableComponent extends TableBaseComponent {}
