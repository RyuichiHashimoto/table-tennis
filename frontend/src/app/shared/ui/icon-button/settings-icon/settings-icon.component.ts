import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-settings-icon',
  standalone: true,
  imports: [],
  templateUrl: './settings-icon.component.html',
  styleUrl: './settings-icon.component.css',
})
export class SettingsIconComponent {
  @Input() size = 18;
  @Input() color = '';
}
