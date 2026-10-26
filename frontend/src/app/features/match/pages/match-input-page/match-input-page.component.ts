import { Component } from '@angular/core';
import { MobileMatchAppComponent } from '../../mobile-match/mobile-match-app.component';

@Component({
  selector: 'app-match-input-page',
  standalone: true,
  imports: [MobileMatchAppComponent],
  templateUrl: './match-input-page.component.html',
  styleUrl: './match-input-page.component.css',
})
export class MatchInputPageComponent {}
