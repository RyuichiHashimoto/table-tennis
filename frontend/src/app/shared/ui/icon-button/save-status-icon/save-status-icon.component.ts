import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SaveStatus = 'before' | 'saving' | 'saved';

@Component({
  selector: 'app-save-status-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './save-status-icon.component.html',
  styleUrl: './save-status-icon.component.css',
})
export class SaveStatusIconComponent {
  @Input() status: SaveStatus = 'before';
  @Input() compact = false;
  /** CSS color 値を指定するとその色で描画される。省略時は currentColor を継承 */
  @Input() color = '';
}
