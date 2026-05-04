import { Component } from '@angular/core';
import { PreviewSaveStatusIconComponent } from './save-status-icon/save-status-icon-preview.component';

@Component({
  selector: 'app-preview-icons',
  standalone: true,
  imports: [PreviewSaveStatusIconComponent],
  templateUrl: './icons.component.html',
  styleUrl: './icons.component.css',
})
export class PreviewIconsComponent {}
