import { Routes } from '@angular/router';
import { AnalysisPageComponent } from './analysis/analysis-page.component';
import { DebugPageComponent } from './debug/debug-page.component';
import { MatchInputPageComponent } from './match-input-page.component';
import { MatchesListPageComponent } from './matches/matches-list-page.component';
import { SettingsPageComponent } from './settings/settings-page.component';
import { SettingsTagDefinitionsComponent } from './settings/settings-tag-definitions.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'matches' },
  { path: 'matches', component: MatchesListPageComponent },
  { path: 'analysis', component: AnalysisPageComponent },
  { path: 'debug', pathMatch: 'full', redirectTo: 'settings/debugs' },
  {
    path: 'settings',
    component: SettingsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tags' },
      { path: 'tags', component: SettingsTagDefinitionsComponent },
      { path: 'debugs', component: DebugPageComponent },
    ],
  },
  { path: 'match/:uuid', component: MatchInputPageComponent },
  { path: '**', redirectTo: 'matches' },
];
