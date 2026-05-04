import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-match-video-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './match-video-panel.component.html',
  styleUrl: './match-video-panel.component.css',
  host: {
    '[style.width]': 'panelWidth',
    '[style.height]': 'panelHeight',
  },
})
export class MatchVideoPanelComponent {
  @ViewChild('videoPlayer') videoPlayer?: ElementRef<HTMLVideoElement>;

  @Input() panelWidth?: string;
  @Input() panelHeight?: string;

  @Input() videoSourceUrl = '';
  @Input() videoTitle = '';
  @Input() youtubeUrl = '';
  @Input() isLoadingVideo = false;

  @Output() youtubeUrlChange = new EventEmitter<string>();
  @Output() loadYoutube = new EventEmitter<void>();
  @Output() selectVideoFile = new EventEmitter<Event>();
  @Output() currentTimeChange = new EventEmitter<number>();

  onYoutubeUrlChange(value: string): void {
    this.youtubeUrl = value;
    this.youtubeUrlChange.emit(value);
  }

  onLoadYoutube(): void {
    this.loadYoutube.emit();
  }

  onSelectVideoFile(event: Event): void {
    this.selectVideoFile.emit(event);
  }

  onVideoTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement | null;
    this.currentTimeChange.emit(video?.currentTime ?? 0);
  }

  seekToTime(seconds: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video || Number.isNaN(seconds)) {
      return;
    }
    video.currentTime = Math.max(0, seconds);
    this.currentTimeChange.emit(video.currentTime);
  }
}
