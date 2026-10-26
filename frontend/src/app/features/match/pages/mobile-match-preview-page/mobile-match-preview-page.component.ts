import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MobileMatchAppComponent } from '../../mobile-match/mobile-match-app.component';
import { MobileScreen } from '../../mobile-match/mobile-match.models';

@Component({
  selector: 'app-mobile-match-preview-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MobileMatchAppComponent],
  templateUrl: './mobile-match-preview-page.component.html',
  styleUrl: './mobile-match-preview-page.component.css',
})
export class MobileMatchPreviewPageComponent {
  readonly screens: Array<{ label: string; screen: MobileScreen }> = [
    { label: '01 記録', screen: 'record' },
    { label: '02 ポイント一覧', screen: 'points' },
    { label: '03 試合情報', screen: 'info' },
  ];
}
