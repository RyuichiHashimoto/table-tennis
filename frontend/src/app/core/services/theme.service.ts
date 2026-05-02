import { Injectable } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'tt_analyzer_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private currentTheme: AppTheme = 'light';

  init(): AppTheme {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    this.currentTheme = savedTheme === 'dark' ? 'dark' : 'light';
    this.applyTheme();
    return this.currentTheme;
  }

  getTheme(): AppTheme {
    return this.currentTheme;
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.currentTheme;
    window.dispatchEvent(new CustomEvent('themechange'));
  }
}
