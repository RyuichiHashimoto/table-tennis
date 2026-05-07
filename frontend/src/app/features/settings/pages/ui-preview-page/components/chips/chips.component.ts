import { Component } from '@angular/core';
import { NoticeChipComponent } from '../../../../../../shared/ui/notice-chip/notice-chip.component';
import { PreviewSetScoreChipComponent } from './set-score-chip/set-score-chip-preview.component';

@Component({
  selector: 'app-preview-chips',
  standalone: true,
  imports: [NoticeChipComponent, PreviewSetScoreChipComponent],
  templateUrl: './chips.component.html',
  styleUrl: './chips.component.css',
})
export class PreviewChipsComponent {}
