import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match } from '../../../table-tennis/models/models';
import { EditIconComponent } from '../../../../shared/ui/icon-button/edit-icon/edit-icon.component';
import { DetailIconComponent } from '../../../../shared/ui/icon-button/detail-icon/detail-icon.component';

@Component({
  selector: 'app-match-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink, EditIconComponent, DetailIconComponent],
  templateUrl: './match-page-header.component.html',
  styleUrl: './match-page-header.component.css',
})
export class MatchPageHeaderComponent {
  @Input() match?: Match;
  @Input() activeView: 'edit' | 'summary' = 'edit';
}
