import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ThemeService, AppTheme } from '../../../../core/services/theme.service';

@Component({
  selector: 'app-display-settings-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './display-settings-page.component.html',
  styleUrl: './display-settings-page.component.css',
})
export class DisplaySettingsPageComponent implements OnInit {
  selectedTheme: AppTheme = 'light';

  constructor(private readonly themeService: ThemeService) {}

  ngOnInit(): void {
    this.selectedTheme = this.themeService.getTheme();
  }

  setTheme(theme: AppTheme): void {
    this.selectedTheme = theme;
    this.themeService.setTheme(theme);
  }
}
