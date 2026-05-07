import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Match } from '../../../table-tennis/models/models';
import { OptionCardComponent } from '../../../../shared/ui/option-card/option-card.component';
import { ClipboardListIconComponent } from '../../../../shared/ui/icon-button/clipboard-list-icon/clipboard-list-icon.component';
import { SettingsIconComponent } from '../../../../shared/ui/icon-button/settings-icon/settings-icon.component';

export type InputMode = 'post' | 'realtime';

@Component({
  selector: 'app-match-info-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OptionCardComponent,
    ClipboardListIconComponent,
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

  @Output() youtubeUrlChange = new EventEmitter<string>();
  @Output() loadYoutube = new EventEmitter<void>();
  @Output() selectVideoFile = new EventEmitter<Event>();
  @Output() currentTimeChange = new EventEmitter<number>();
  @Output() matchTitleChange = new EventEmitter<string>();
  @Output() playerNamesChange = new EventEmitter<{ myPlayerName: string; opponentPlayerName: string }>();

  inputMode: InputMode = 'post';
  showSettings = false;
  isEditingBasicInfo = false;
  editingTitle = '';
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

  get matchTitle(): string {
    return this.match?.title || '';
  }

  startEditBasicInfo(): void {
    this.editingTitle = this.matchTitle;
    this.editingOpponentPlayerName = this.opponentPlayerName;
    this.isEditingBasicInfo = true;
  }

  cancelEditBasicInfo(): void {
    this.isEditingBasicInfo = false;
    this.editingTitle = '';
    this.editingOpponentPlayerName = '';
  }

  saveBasicInfo(): void {
    const title = this.editingTitle.trim();
    if (title) {
      this.matchTitleChange.emit(title);
    }
    const opponentPlayerName = this.editingOpponentPlayerName.trim() || '相手';
    this.playerNamesChange.emit({ myPlayerName: this.myPlayerName, opponentPlayerName });
    this.isEditingBasicInfo = false;
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
