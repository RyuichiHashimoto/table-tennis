import { Routes } from '@angular/router';
import { AnalysisPageComponent } from './analysis/analysis-page.component';
import { MatchInputPageComponent } from './match-input-page.component';
import { MatchesListPageComponent } from './matches/matches-list-page.component';
import { SettingsPageComponent } from './settings/settings-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'matches' },
  { path: 'matches', component: MatchesListPageComponent },
  { path: 'analysis', component: AnalysisPageComponent },
  { path: 'settings', component: SettingsPageComponent },
  { path: 'match/:uuid', component: MatchInputPageComponent },
  { path: '**', redirectTo: 'matches' },
];
