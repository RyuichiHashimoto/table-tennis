import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-option-card',
  standalone: true,
  templateUrl: './option-card.component.html',
  styleUrl: './option-card.component.css',
})
export class OptionCardComponent {
  @Input() icon = '';
  @Input() label = '';
  @Input() description = '';
  @Input() selected = false;
  @Output() clicked = new EventEmitter<void>();
}
