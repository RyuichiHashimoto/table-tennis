import { Component } from '@angular/core';
import { PreviewSetScoreChipComponent } from './set-score-chip/set-score-chip-preview.component';

@Component({
  selector: 'app-preview-chips',
  standalone: true,
  imports: [PreviewSetScoreChipComponent],
  templateUrl: './chips.component.html',
  styleUrl: './chips.component.css',
})
export class PreviewChipsComponent {}
