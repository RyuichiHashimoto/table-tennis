import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-icon-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.css',
})
export class IconButtonComponent {
  @Input({ required: true }) src = '';
  @Input() alt = '';
  @Input() ariaLabel = '';
  @Input() danger = false;
  @Input() showBorder = true;
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}
