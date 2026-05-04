import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-preview-text-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './text-input.component.html',
  styleUrl: './text-input.component.css',
})
export class PreviewTextInputComponent {
  sampleText = 'サンプルテキスト';
  selectedMode = 'default';
}
