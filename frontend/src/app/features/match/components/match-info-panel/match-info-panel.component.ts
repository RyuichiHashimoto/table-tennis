import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Match } from '../../../table-tennis/models/models';
import { OptionCardComponent } from '../../../../shared/ui/option-card/option-card.component';
import { ClipboardListIconComponent } from '../../../../shared/ui/clipboard-list-icon/clipboard-list-icon.component';
import { UsersIconComponent } from '../../../../shared/ui/users-icon/users-icon.component';
import { UserFilledIconComponent } from '../../../../shared/ui/user-filled-icon/user-filled-icon.component';
import { LayoutGridIconComponent } from '../../../../shared/ui/layout-grid-icon/layout-grid-icon.component';
import { TrophyIconComponent } from '../../../../shared/ui/trophy-icon/trophy-icon.component';
import { RotateClockwiseIconComponent } from '../../../../shared/ui/rotate-clockwise-icon/rotate-clockwise-icon.component';
import { SettingsIconComponent } from '../../../../shared/ui/settings-icon/settings-icon.component';

export type InputMode = 'post' | 'realtime';

@Component({
  selector: 'app-match-info-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OptionCardComponent,
    ClipboardListIconComponent,
    UsersIconComponent,
    UserFilledIconComponent,
    LayoutGridIconComponent,
    TrophyIconComponent,
    RotateClockwiseIconComponent,
    SettingsIconComponent,
  ],
  templateUrl: './match-info-panel.component.html',
  styleUrl: './match-info-panel.component.css',
})
export class MatchInfoPanelComponent {
  @ViewChild('videoPlayer') videoPlayerRef?: ElementRef<HTMLVideoElement>;

  @Input() match?: Match;
  @Input() videoSourceUrl = '';
  @Input() videoTitle = '';
  @Input() youtubeUrl = '';
  @Input() isLoadingVideo = false;
  @Input() currentSetNo = 1;
  @Input() mySetCount = 0;
  @Input() opSetCount = 0;
  @Input() currentScore: { me: number; op: number } = { me: 0, op: 0 };
  @Input() nextServer: 'me' | 'op' = 'me';

  @Output() youtubeUrlChange = new EventEmitter<string>();
  @Output() loadYoutube = new EventEmitter<void>();
  @Output() selectVideoFile = new EventEmitter<Event>();
  @Output() currentTimeChange = new EventEmitter<number>();
  @Output() playerNamesChange = new EventEmitter<{ myPlayerName: string; opponentPlayerName: string }>();

  inputMode: InputMode = 'post';
  showSettings = false;
  isEditingPlayers = false;
  editingMyPlayerName = '';
  editingOpponentPlayerName = '';

  get matchDate(): string {
    if (!this.match?.createdAt) return '';
    return this.match.createdAt.slice(0, 10);
  }

  get myPlayerName(): string {
    return this.match?.myPlayerName || '自分';
  }

  get opponentPlayerName(): string {
    return this.match?.opponentPlayerName || '相手';
  }

  startEditPlayers(): void {
    this.editingMyPlayerName = this.myPlayerName;
    this.editingOpponentPlayerName = this.opponentPlayerName;
    this.isEditingPlayers = true;
  }

  cancelEditPlayers(): void {
    this.isEditingPlayers = false;
    this.editingMyPlayerName = '';
    this.editingOpponentPlayerName = '';
  }

  savePlayers(): void {
    const myPlayerName = this.editingMyPlayerName.trim() || '自分';
    const opponentPlayerName = this.editingOpponentPlayerName.trim() || '相手';
    this.playerNamesChange.emit({ myPlayerName, opponentPlayerName });
    this.isEditingPlayers = false;
  }

  seekToTime(seconds: number): void {
    const video = this.videoPlayerRef?.nativeElement;
    if (!video || Number.isNaN(seconds)) return;
    video.currentTime = Math.max(0, seconds);
    this.currentTimeChange.emit(video.currentTime);
  }

  onVideoTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement | null;
    this.currentTimeChange.emit(video?.currentTime ?? 0);
  }

  onSelectVideoFile(event: Event): void {
    this.selectVideoFile.emit(event);
  }
}
