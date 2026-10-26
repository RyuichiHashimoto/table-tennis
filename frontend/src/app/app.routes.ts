import { Routes } from '@angular/router';
import { AnalysisPageComponent } from './features/analysis/pages/analysis-page.component';
import { MatchInputPageComponent } from './features/match/pages/match-input-page/match-input-page.component';
import { MatchesListPageComponent } from './features/match-list/pages/matches-list-page.component';
import { MatchSummaryPageComponent } from './features/match/pages/match-summary-page/match-summary-page.component';
import { DisplaySettingsPageComponent } from './features/settings/pages/display-settings-page/display-settings-page.component';
import { SettingsPageComponent } from './features/settings/pages/settings-page/settings-page.component';
import { TagDefinitionsPageComponent } from './features/settings/pages/tag-definitions-page/tag-definitions-page.component';
import { UiPreviewPageComponent } from './features/settings/pages/ui-preview-page/ui-preview-page.component';
import { SchedulePageComponent } from './features/schedule/pages/schedule-page.component';
import { TournamentSettingsPageComponent } from './features/settings/pages/tournament-settings-page/tournament-settings-page.component';
import { MobileMatchPreviewPageComponent } from './features/match/pages/mobile-match-preview-page/mobile-match-preview-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'matches' },
  { path: 'matches', component: MatchesListPageComponent },
  { path: 'schedule', component: SchedulePageComponent },
  { path: 'analysis', component: AnalysisPageComponent },
  { path: 'developer', component: UiPreviewPageComponent },
  { path: 'debug', pathMatch: 'full', redirectTo: 'developer' },
  { path: 'settings/ui-preview', pathMatch: 'full', redirectTo: 'developer' },
  { path: 'settings/debugs', pathMatch: 'full', redirectTo: 'developer' },
  {
    path: 'settings',
    component: SettingsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tags' },
      { path: 'tags', component: TagDefinitionsPageComponent },
      { path: 'tournaments', component: TournamentSettingsPageComponent },
      { path: 'display', component: DisplaySettingsPageComponent },
    ],
  },
  { path: 'match/:uuid/summary', component: MatchSummaryPageComponent },
  { path: 'match/:uuid/edit', component: MatchInputPageComponent },
  { path: 'match/:uuid/mobile-preview', component: MobileMatchPreviewPageComponent },
  { path: '**', redirectTo: 'matches' },
];
