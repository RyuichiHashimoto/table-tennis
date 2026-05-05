import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../table-tennis/services/app-state.service';
import { ConfirmModalComponent } from '../../../../shared/ui/modal/confirm-modal/confirm-modal.component';
import { AddIconComponent } from '../../../../shared/ui/icon-button/add-icon/add-icon.component';
import { EditIconComponent } from '../../../../shared/ui/icon-button/edit-icon/edit-icon.component';
import { DeleteIconComponent } from '../../../../shared/ui/icon-button/delete-icon/delete-icon.component';
import { RallyTagDefinition, TagPhase, TagPlayerSide, TagShotType } from '../../../table-tennis/models/models';
import { StandardTableComponent } from '../../../../shared/ui/table/standard-table/standard-table.component';

@Component({
  selector: 'app-tag-definitions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, AddIconComponent, EditIconComponent, DeleteIconComponent, StandardTableComponent],
  templateUrl: './tag-definitions-page.component.html',
  styleUrl: './tag-definitions-page.component.css',
})
export class TagDefinitionsPageComponent implements OnInit {
  tagDefinitions: RallyTagDefinition[] = [];
  editingTag?: RallyTagDefinition;
  isCreatingTag = false;
  pendingDeleteTag?: RallyTagDefinition;
  editForm = this.createEditForm();

  readonly playerSideOptions: { value: TagPlayerSide; label: string }[] = [
    { value: 'me', label: '自分' },
    { value: 'op', label: '相手' },
    { value: 'both', label: '両方' },
  ];

  readonly phaseOptions: { value: TagPhase; label: string }[] = [
    { value: 'serve', label: 'サーブ' },
    { value: 'receive', label: 'レシーブ' },
    { value: 'rally', label: 'ラリー中' },
  ];

  readonly shotTypeOptions: { value: TagShotType; label: string }[] = [
    { value: 'point', label: '得点' },
    { value: 'miss', label: 'ミス' },
    { value: 'any', label: 'どちらでも' },
  ];

  constructor(private readonly state: AppStateService) {}

  async ngOnInit(): Promise<void> {
    this.tagDefinitions = await this.state.loadTagDefinitions();
  }

  get editModalOpen(): boolean {
    return !!this.editingTag || this.isCreatingTag;
  }

  openEditModal(tag: RallyTagDefinition): void {
    this.isCreatingTag = false;
    this.editingTag = tag;
    this.editForm = {
      tag: tag.tag,
      playerSide: tag.playerSide,
      phase: tag.phase,
      shotType: tag.shotType,
    };
  }

  openCreateModal(): void {
    this.pendingDeleteTag = undefined;
    this.editingTag = undefined;
    this.isCreatingTag = true;
    this.editForm = this.createEditForm();
  }

  closeEditModal(): void {
    this.editingTag = undefined;
    this.isCreatingTag = false;
    this.editForm = this.createEditForm();
  }

  async saveEdit(): Promise<void> {
    if (!this.editingTag && !this.isCreatingTag) return;
    const tagName = this.editForm.tag.trim();
    if (!tagName) return;

    const payload = {
      tag: tagName,
      playerSide: this.editForm.playerSide,
      phase: this.editForm.phase,
      shotType: this.editForm.shotType,
    };
    if (this.isCreatingTag) {
      await this.state.createTagDefinition(payload);
    } else if (this.editingTag) {
      await this.state.updateTagDefinition(this.editingTag.id, payload);
    }
    this.tagDefinitions = this.state.getTagDefinitions();
    this.closeEditModal();
  }

  deleteTag(tag: RallyTagDefinition): void {
    this.pendingDeleteTag = tag;
  }

  cancelDeleteTag(): void {
    this.pendingDeleteTag = undefined;
  }

  async confirmDeleteTag(): Promise<void> {
    const tag = this.pendingDeleteTag;
    if (!tag) return;
    if (this.editingTag === tag) this.closeEditModal();
    await this.state.deleteTagDefinition(tag.id);
    this.tagDefinitions = this.state.getTagDefinitions();
    this.pendingDeleteTag = undefined;
  }

  playerSideLabel(side: TagPlayerSide): string {
    return this.playerSideOptions.find((o) => o.value === side)?.label ?? side;
  }

  phaseLabel(phase: TagPhase): string {
    return this.phaseOptions.find((o) => o.value === phase)?.label ?? phase;
  }

  shotTypeLabel(shotType: TagShotType): string {
    return this.shotTypeOptions.find((o) => o.value === shotType)?.label ?? shotType;
  }

  pointWinnerLabel(tag: RallyTagDefinition): string {
    if (tag.shotType === 'any') return 'どちらでも';
    if (tag.playerSide === 'me' && tag.shotType === 'miss') return '相手の得点';
    if (tag.playerSide === 'me' && tag.shotType === 'point') return '自分の得点';
    if (tag.playerSide === 'op' && tag.shotType === 'miss') return '自分の得点';
    if (tag.playerSide === 'op' && tag.shotType === 'point') return '相手の得点';
    return 'どちらでも';
  }

  private createEditForm(): { tag: string; playerSide: TagPlayerSide; phase: TagPhase; shotType: TagShotType } {
    return { tag: '', playerSide: 'me', phase: 'rally', shotType: 'miss' };
  }
}
