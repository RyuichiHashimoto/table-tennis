import { Component } from '@angular/core';
import { PreviewButtonsComponent } from './components/buttons/buttons.component';
import { PreviewCardsComponent } from './components/cards/cards.component';
import { PreviewChartsComponent } from './components/charts/charts.component';
import { PreviewTableComponent } from './components/table/table.component';
import { PreviewTextInputComponent } from './components/text-input/text-input.component';
import { PreviewIconsComponent } from './components/icons/icons.component';
import { PreviewChipsComponent } from './components/chips/chips.component';

@Component({
  selector: 'app-ui-preview-page',
  standalone: true,
  imports: [
    PreviewCardsComponent,
    PreviewButtonsComponent,
    PreviewTextInputComponent,
    PreviewTableComponent,
    PreviewIconsComponent,
    PreviewChipsComponent,
    PreviewChartsComponent,
  ],
  templateUrl: './ui-preview-page.component.html',
  styleUrl: './ui-preview-page.component.css',
})
export class UiPreviewPageComponent {}
