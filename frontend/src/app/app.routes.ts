import { Routes } from '@angular/router';
import { AnalysisPageComponent } from './features/analysis/pages/analysis-page.component';
import { MatchInputPageComponent } from './features/match-input/pages/match-input-page.component';
import { MatchesListPageComponent } from './features/match-list/pages/matches-list-page.component';
import { MatchSummaryPageComponent } from './features/match-summary/pages/match-summary-page/match-summary-page.component';
import { DisplaySettingsPageComponent } from './features/settings/pages/display-settings-page/display-settings-page.component';
import { SettingsPageComponent } from './features/settings/pages/settings-page/settings-page.component';
import { TagDefinitionsPageComponent } from './features/settings/pages/tag-definitions-page/tag-definitions-page.component';
import { UiPreviewPageComponent } from './features/settings/pages/ui-preview-page/ui-preview-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'matches' },
  { path: 'matches', component: MatchesListPageComponent },
  { path: 'analysis', component: AnalysisPageComponent },
  { path: 'debug', pathMatch: 'full', redirectTo: 'settings/ui-preview' },
  {
    path: 'settings',
    component: SettingsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tags' },
      { path: 'tags', component: TagDefinitionsPageComponent },
      { path: 'display', component: DisplaySettingsPageComponent },
      { path: 'ui-preview', component: UiPreviewPageComponent },
      { path: 'debugs', pathMatch: 'full', redirectTo: 'ui-preview' },
    ],
  },
  { path: 'match/:uuid/summary', component: MatchSummaryPageComponent },
  { path: 'match/:uuid', component: MatchInputPageComponent },
  { path: '**', redirectTo: 'matches' },
];
