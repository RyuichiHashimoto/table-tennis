import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../table-tennis/services/app-state.service';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { RallyTagDefinition } from '../../../table-tennis/models/models';

@Component({
  selector: 'app-tag-definitions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './tag-definitions-page.component.html',
  styleUrl: './tag-definitions-page.component.css',
})
export class TagDefinitionsPageComponent implements OnInit {
  tagDefinitions: RallyTagDefinition[] = [];
  editingTag?: RallyTagDefinition;
  isCreatingTag = false;
  pendingDeleteTag?: RallyTagDefinition;
  editForm = this.createEditForm();

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
      myRallyEnabled: tag.myRallyOnly || (!tag.myRallyOnly && !tag.opponentRallyOnly),
      opponentRallyEnabled: tag.opponentRallyOnly || (!tag.myRallyOnly && !tag.opponentRallyOnly),
      lossEnabled: tag.lossOnly || (!tag.lossOnly && !tag.winOnly),
      winEnabled: tag.winOnly || (!tag.lossOnly && !tag.winOnly),
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
    if (!this.editingTag && !this.isCreatingTag) {
      return;
    }
    const tagName = this.editForm.tag.trim();
    if (!tagName) {
      return;
    }
    const rallyScope = this.normalizeCheckboxScope(this.editForm.myRallyEnabled, this.editForm.opponentRallyEnabled);
    const pointScope = this.normalizeCheckboxScope(this.editForm.lossEnabled, this.editForm.winEnabled);
    const nextTag = {
      tag: tagName,
      myRallyOnly: rallyScope === 'first-only',
      opponentRallyOnly: rallyScope === 'second-only',
      lossOnly: pointScope === 'first-only',
      winOnly: pointScope === 'second-only',
    };
    if (this.isCreatingTag) {
      await this.state.createTagDefinition(nextTag);
    } else if (this.editingTag) {
      await this.state.updateTagDefinition(this.editingTag.id, nextTag);
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
    if (!tag) {
      return;
    }
    if (this.editingTag === tag) {
      this.closeEditModal();
    }
    await this.state.deleteTagDefinition(tag.id);
    this.tagDefinitions = this.state.getTagDefinitions();
    this.pendingDeleteTag = undefined;
  }

  getRallyScopeLabels(tag: RallyTagDefinition): string[] {
    if (tag.myRallyOnly) {
      return ['自ラリー'];
    }
    if (tag.opponentRallyOnly) {
      return ['相手ラリー'];
    }
    return ['自ラリー', '相手ラリー'];
  }

  getPointScopeLabels(tag: RallyTagDefinition): string[] {
    if (tag.lossOnly) {
      return ['失点時'];
    }
    if (tag.winOnly) {
      return ['得点時'];
    }
    return ['失点時', '得点時'];
  }

  private createEditForm(): {
    tag: string;
    myRallyEnabled: boolean;
    opponentRallyEnabled: boolean;
    lossEnabled: boolean;
    winEnabled: boolean;
  } {
    return {
      tag: '',
      myRallyEnabled: true,
      opponentRallyEnabled: true,
      lossEnabled: true,
      winEnabled: true,
    };
  }

  private normalizeCheckboxScope(
    firstEnabled: boolean,
    secondEnabled: boolean,
  ): 'first-only' | 'second-only' | 'both' {
    if (firstEnabled && !secondEnabled) {
      return 'first-only';
    }
    if (!firstEnabled && secondEnabled) {
      return 'second-only';
    }
    return 'both';
  }
}
