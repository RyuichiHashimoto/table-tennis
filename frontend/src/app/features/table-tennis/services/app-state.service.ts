import { Injectable } from '@angular/core';
import { runtimeConfig } from '../../../core/config/runtime-config';
import { Match, Rally, RallyResultTag, RallySegment, RallyTagDefinition, ScoringPatternSlice, Segment, Summary, TagPhase, TagPlayerSide, TagShotType } from '../models/models';

export interface MatchVideoState {
  youtubeUrl: string;
  videoSourceUrl: string;
  videoTitle: string;
  sourceKind: 'remote' | 'uploaded';
}

export interface MatchInputState extends MatchVideoState {
  form: {
    setNo: number;
    server: string;
    serveType: string;
    receiveType: string;
    rallyLenBucket: string;
    pointWinner: string;
    endReason: string;
    endSide: string;
    my3rd: string;
    my3rdResult: string;
    tStart: number;
    tEnd: number;
    note: string;
  };
  confirmedSegments: Segment[];
  manualStartSec: number;
  manualEndSec: number;
  clipScope: string;
}

interface LegacyStore {
  matches?: Array<Record<string, unknown>>;
  rallies?: Array<Record<string, unknown>>;
  selectedMatchUuid?: string;
  matchInputStates?: Record<string, MatchInputState>;
}

const LEGACY_STORE_KEY = 'tt_analyzer_frontend_store_v1';
const LEGACY_MIGRATED_KEY = 'tt_analyzer_frontend_store_v1_backend_migrated';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly apiBase = runtimeConfig.apiBase;
  private matches: Match[] = [];
  private ralliesByMatch = new Map<string, Rally[]>();
  private inputStates = new Map<string, MatchInputState>();
  private tagDefinitions: RallyTagDefinition[] = [];
  private selectedMatchUuid?: string;

  getMatches(): Match[] {
    return [...this.matches].sort((a, b) => b.id - a.id);
  }

  getMatchByUuid(matchUuid: string): Match | undefined {
    return this.matches.find((match) => match.uuid === matchUuid);
  }

  async loadMatches(): Promise<Match[]> {
    await this.migrateLegacyLocalStore();
    const rows = await this.requestJson<Array<Record<string, unknown>>>('/matches');
    this.matches = rows.map((row) => this.mapMatch(row));
    if (this.selectedMatchUuid && !this.getMatchByUuid(this.selectedMatchUuid)) {
      this.selectedMatchUuid = this.matches[0]?.uuid;
    }
    return this.getMatches();
  }

  async loadTagDefinitions(): Promise<RallyTagDefinition[]> {
    const rows = await this.requestJson<Array<Record<string, unknown>>>('/tag-definitions');
    this.tagDefinitions = rows.map((row) => this.mapTagDefinition(row));
    return [...this.tagDefinitions];
  }

  async getScoringPatterns(matchUuid: string, limit = 6): Promise<ScoringPatternSlice[]> {
    const response = await this.requestJson<{ patterns?: Array<Record<string, unknown>> }>(
      `/matches/${matchUuid}/analysis/scoring-patterns?limit=${limit}`,
    );
    return (response.patterns ?? []).map((row) => ({
      label: String(row['label'] ?? ''),
      count: Number(row['count'] ?? 0),
      ratio: Number(row['ratio'] ?? 0),
    }));
  }

  getTagDefinitions(): RallyTagDefinition[] {
    return [...this.tagDefinitions];
  }

  async createTagDefinition(input: {
    tag: string;
    playerSide: TagPlayerSide;
    phase: TagPhase;
    shotType: TagShotType;
  }): Promise<RallyTagDefinition> {
    const row = await this.requestJson<Record<string, unknown>>('/tag-definitions', {
      method: 'POST',
      body: JSON.stringify({
        tag: input.tag,
        player_side: input.playerSide,
        phase: input.phase,
        shot_type: input.shotType,
      }),
    });
    const tag = this.mapTagDefinition(row);
    this.tagDefinitions = [...this.tagDefinitions, tag].sort((a, b) => a.id - b.id);
    return tag;
  }

  async updateTagDefinition(
    tagId: number,
    input: {
      tag: string;
      playerSide: TagPlayerSide;
      phase: TagPhase;
      shotType: TagShotType;
    },
  ): Promise<RallyTagDefinition | undefined> {
    const row = await this.requestJson<Record<string, unknown>>(`/tag-definitions/${tagId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        tag: input.tag,
        player_side: input.playerSide,
        phase: input.phase,
        shot_type: input.shotType,
      }),
    });
    const tag = this.mapTagDefinition(row);
    this.tagDefinitions = this.tagDefinitions.map((existing) => (existing.id === tagId ? tag : existing)).sort((a, b) => a.id - b.id);
    return tag;
  }

  async deleteTagDefinition(tagId: number): Promise<boolean> {
    const result = await this.requestJson<{ ok: boolean }>(`/tag-definitions/${tagId}`, { method: 'DELETE' });
    if (result.ok) {
      this.tagDefinitions = this.tagDefinitions.filter((tag) => tag.id !== tagId);
    }
    return result.ok;
  }

  async loadMatch(matchUuid: string): Promise<Match | undefined> {
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${matchUuid}`);
    const match = this.mapMatch(row);
    const index = this.matches.findIndex((existing) => existing.uuid === match.uuid);
    if (index === -1) {
      this.matches = [match, ...this.matches];
    } else {
      this.matches[index] = match;
    }
    return match;
  }

  async createMatch(title: string): Promise<Match> {
    const row = await this.requestJson<Record<string, unknown>>('/matches', {
      method: 'POST',
      body: JSON.stringify({ title, initial_server: 'me' }),
    });
    const match = this.mapMatch(row);
    this.matches = [match, ...this.matches.filter((existing) => existing.uuid !== match.uuid)];
    this.selectedMatchUuid = match.uuid;
    return match;
  }

  async deleteMatch(matchUuid: string): Promise<boolean> {
    const result = await this.requestJson<{ ok: boolean }>(`/matches/${matchUuid}`, { method: 'DELETE' });
    if (result.ok) {
      this.matches = this.matches.filter((match) => match.uuid !== matchUuid);
      this.ralliesByMatch.delete(matchUuid);
      this.inputStates.delete(matchUuid);
      if (this.selectedMatchUuid === matchUuid) {
        this.selectedMatchUuid = this.matches[0]?.uuid;
      }
    }
    return result.ok;
  }

  async updateMatchInitialServer(matchUuid: string, initialServer: 'me' | 'op'): Promise<Match | undefined> {
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${matchUuid}`, {
      method: 'PATCH',
      body: JSON.stringify({ initial_server: initialServer }),
    });
    const match = this.mapMatch(row);
    const index = this.matches.findIndex((existing) => existing.uuid === match.uuid);
    if (index !== -1) {
      this.matches[index] = match;
    } else {
      this.matches = [match, ...this.matches];
    }
    await this.loadRallies(matchUuid);
    return match;
  }

  async updateMatchTitle(matchUuid: string, title: string): Promise<Match | undefined> {
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${matchUuid}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
    const match = this.mapMatch(row);
    const index = this.matches.findIndex((existing) => existing.uuid === match.uuid);
    if (index !== -1) {
      this.matches[index] = match;
    } else {
      this.matches = [match, ...this.matches];
    }
    return match;
  }

  async updateMatchPlayers(matchUuid: string, myPlayerName: string, opponentPlayerName: string): Promise<Match | undefined> {
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${matchUuid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        my_player_name: myPlayerName,
        opponent_player_name: opponentPlayerName,
      }),
    });
    const match = this.mapMatch(row);
    const index = this.matches.findIndex((existing) => existing.uuid === match.uuid);
    if (index !== -1) {
      this.matches[index] = match;
    } else {
      this.matches = [match, ...this.matches];
    }
    return match;
  }

  getSelectedMatchUuid(): string | undefined {
    return this.selectedMatchUuid;
  }

  setSelectedMatchUuid(matchUuid?: string): void {
    this.selectedMatchUuid = matchUuid;
  }

  async loadRallies(matchUuid: string): Promise<Rally[]> {
    const rows = await this.requestJson<Array<Record<string, unknown>>>(`/matches/${matchUuid}/rallies`);
    const rallies = rows.map((row) => this.mapRally(row));
    this.ralliesByMatch.set(matchUuid, rallies);
    return [...rallies];
  }

  getRallies(matchUuid: string): Rally[] {
    return [...(this.ralliesByMatch.get(matchUuid) ?? [])];
  }

  async addRally(input: Omit<Rally, 'id' | 'uuid' | 'createdAt'>, insertAfterRallyId?: number): Promise<Rally> {
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${input.matchUuid}/rallies`, {
      method: 'POST',
      body: JSON.stringify({
        set_no: input.setNo,
        server: input.server,
        serve_type: input.serveType ?? '',
        receive_type: input.receiveType,
        rally_len_bucket: input.rallyLenBucket,
        point_winner: input.pointWinner,
        end_reason: input.endReason,
        end_side: input.endSide,
        my_3rd: input.my3rd,
        my_3rd_result: input.my3rdResult,
        t_start: input.tStart ?? 0,
        t_end: input.tEnd ?? 0,
        note: input.note ?? '',
        insert_after_rally_id: insertAfterRallyId,
      }),
    });
    const rally = this.mapRally(row);
    const rallies = [...(this.ralliesByMatch.get(input.matchUuid) ?? []), rally].sort(this.compareRallies);
    this.ralliesByMatch.set(input.matchUuid, rallies);
    return rally;
  }

  async saveSortOrders(matchUuid: string, orders: { id: number; sort_order: number }[]): Promise<boolean> {
    const result = await this.requestJson<{ ok: boolean }>(`/matches/${matchUuid}/rallies/sort-orders`, {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    });
    return result.ok;
  }

  async deleteLastRally(matchUuid: string): Promise<boolean> {
    const result = await this.requestJson<{ ok: boolean }>(`/matches/${matchUuid}/rallies/last`, { method: 'DELETE' });
    if (result.ok) {
      await this.loadRallies(matchUuid);
    }
    return result.ok;
  }

  async deleteRally(rallyId: number): Promise<boolean> {
    const rally = this.findRally(rallyId);
    if (!rally) {
      return false;
    }
    const result = await this.requestJson<{ ok: boolean }>(`/matches/${rally.matchUuid}/rallies/${rallyId}`, { method: 'DELETE' });
    if (result.ok) {
      const rallies = (this.ralliesByMatch.get(rally.matchUuid) ?? []).filter((row) => row.id !== rallyId);
      this.ralliesByMatch.set(rally.matchUuid, rallies);
    }
    return result.ok;
  }

  async toggleRallyStar(rallyId: number): Promise<boolean> {
    const rally = this.findRally(rallyId);
    if (!rally) {
      return false;
    }
    const updated = await this.patchRally(rally.matchUuid, rallyId, { starred: !rally.starred });
    return !!updated;
  }

  async setRallyResultTags(rallyId: number, resultTags: RallyResultTag[]): Promise<boolean> {
    const rally = this.findRally(rallyId);
    if (!rally) {
      return false;
    }
    const updated = await this.patchRally(rally.matchUuid, rallyId, { result_tags: resultTags });
    return !!updated;
  }

  async updateRallyPointWinner(rallyId: number, pointWinner: 'me' | 'op'): Promise<boolean> {
    const rally = this.findRally(rallyId);
    if (!rally) {
      return false;
    }
    const updated = await this.patchRally(rally.matchUuid, rallyId, { point_winner: pointWinner, result_tags: [] });
    return !!updated;
  }

  async updateRallyFields(
    rallyId: number,
    fields: {
      pointWinner?: 'me' | 'op';
      server?: 'me' | 'op';
      resultTags?: RallyResultTag[] | null;
      note?: string | null;
      tStart?: number | null;
    },
  ): Promise<boolean> {
    const rally = this.findRally(rallyId);
    if (!rally) {
      return false;
    }
    const payload: Record<string, unknown> = {};
    if (fields.pointWinner !== undefined) payload['point_winner'] = fields.pointWinner;
    if (fields.server !== undefined) payload['server'] = fields.server;
    if ('resultTags' in fields) payload['result_tags'] = fields.resultTags ?? [];
    if ('note' in fields) payload['note'] = fields.note ?? null;
    if ('tStart' in fields) payload['t_start'] = fields.tStart ?? null;
    const updated = await this.patchRally(rally.matchUuid, rallyId, payload);
    return !!updated;
  }

  async getMatchInputState(matchUuid: string): Promise<MatchInputState | undefined> {
    if (this.inputStates.has(matchUuid)) {
      return this.inputStates.get(matchUuid);
    }
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${matchUuid}/input-state`);
    if (!Object.keys(row).length) {
      return undefined;
    }
    const state = this.mapMatchInputState(row);
    this.inputStates.set(matchUuid, state);
    return state;
  }

  async saveMatchInputState(matchUuid: string, state: MatchInputState): Promise<void> {
    await this.requestJson(`/matches/${matchUuid}/input-state`, {
      method: 'PUT',
      body: JSON.stringify(state),
    });
    this.inputStates.set(matchUuid, {
      ...state,
      form: { ...state.form },
      confirmedSegments: state.confirmedSegments.map((segment) => ({ ...segment })),
    });
  }

  summarize(rallies: Rally[]): Summary {
    const total = rallies.length;
    const win = rallies.filter((r) => r.pointWinner === 'me').length;
    const lose = total - win;
    const myServe = rallies.filter((r) => r.server === 'me');
    const opServe = rallies.filter((r) => r.server === 'op');
    return {
      total,
      win,
      lose,
      winRate: this.rate(win, total),
      myServePoints: myServe.length,
      myServeWinRate: this.rate(myServe.filter((r) => r.pointWinner === 'me').length, myServe.length),
      opServePoints: opServe.length,
      opServeWinRate: this.rate(opServe.filter((r) => r.pointWinner === 'me').length, opServe.length),
    };
  }

  buildRallySegments(rallies: Rally[], scope?: Segment): RallySegment[] {
    return rallies
      .filter((r) => r.tStart !== undefined && r.tEnd !== undefined && (r.tEnd ?? 0) > (r.tStart ?? 0))
      .filter((r) => !scope || ((r.tStart ?? 0) >= scope.startSec && (r.tEnd ?? 0) <= scope.endSec))
      .sort((a, b) => (a.tStart ?? 0) - (b.tStart ?? 0))
      .map((r) => ({
        rallyId: r.id,
        setNo: r.setNo,
        startSec: Number((r.tStart ?? 0).toFixed(2)),
        endSec: Number((r.tEnd ?? 0).toFixed(2)),
        durationSec: Number(((r.tEnd ?? 0) - (r.tStart ?? 0)).toFixed(2)),
      }));
  }

  buildSetSegmentsFromRallies(rallies: RallySegment[]): Segment[] {
    const map = new Map<number, { start: number; end: number }>();
    for (const r of rallies) {
      const row = map.get(r.setNo);
      if (!row) {
        map.set(r.setNo, { start: r.startSec, end: r.endSec });
      } else {
        row.start = Math.min(row.start, r.startSec);
        row.end = Math.max(row.end, r.endSec);
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        startSec: Number(v.start.toFixed(2)),
        endSec: Number(v.end.toFixed(2)),
        durationSec: Number((v.end - v.start).toFixed(2)),
      }))
      .filter((s) => s.durationSec > 0);
  }

  private async patchRally(matchUuid: string, rallyId: number, payload: Record<string, unknown>): Promise<Rally | undefined> {
    const row = await this.requestJson<Record<string, unknown>>(`/matches/${matchUuid}/rallies/${rallyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const rally = this.mapRally(row);
    const rallies = (this.ralliesByMatch.get(matchUuid) ?? []).map((existing) => (existing.id === rallyId ? rally : existing)).sort(this.compareRallies);
    this.ralliesByMatch.set(matchUuid, rallies);
    return rally;
  }

  private findRally(rallyId: number): Rally | undefined {
    for (const rallies of this.ralliesByMatch.values()) {
      const rally = rallies.find((row) => row.id === rallyId);
      if (rally) {
        return rally;
      }
    }
    return undefined;
  }

  private mapMatch(row: Record<string, unknown>): Match {
    return {
      id: Number(row['id']),
      uuid: String(row['uuid']),
      title: String(row['title']),
      initialServer: (row['initial_server'] ?? 'me') as 'me' | 'op',
      myPlayerName: String(row['my_player_name'] ?? '自分'),
      opponentPlayerName: String(row['opponent_player_name'] ?? '相手'),
      createdAt: String(row['created_at']),
    };
  }

  private mapRally(row: Record<string, unknown>): Rally {
    return {
      id: Number(row['id']),
      matchId: Number(row['match_id']),
      uuid: String(row['uuid']),
      matchUuid: String(row['match_uuid']),
      sortOrder: row['sort_order'] === null || row['sort_order'] === undefined ? undefined : Number(row['sort_order']),
      starred: Boolean(row['starred']),
      setNo: Number(row['set_no']),
      server: row['server'] as 'me' | 'op',
      serveType: this.optionalString(row['serve_type']),
      receiveType: String(row['receive_type']),
      rallyLenBucket: String(row['rally_len_bucket']),
      pointWinner: row['point_winner'] as 'me' | 'op',
      endReason: String(row['end_reason']),
      endSide: String(row['end_side']),
      my3rd: String(row['my_3rd'] ?? 'none'),
      my3rdResult: String(row['my_3rd_result'] ?? 'na'),
      resultTags: Array.isArray(row['result_tags']) ? (row['result_tags'] as RallyResultTag[]) : [],
      tStart: row['t_start'] === null || row['t_start'] === undefined ? undefined : Number(row['t_start']),
      tEnd: row['t_end'] === null || row['t_end'] === undefined ? undefined : Number(row['t_end']),
      note: this.optionalString(row['note']),
      createdAt: String(row['created_at']),
    };
  }

  private mapTagDefinition(row: Record<string, unknown>): RallyTagDefinition {
    return {
      id: Number(row['id']),
      tag: String(row['tag']),
      playerSide: (String(row['player_side'] ?? 'me')) as TagPlayerSide,
      phase: (String(row['phase'] ?? 'rally')) as TagPhase,
      shotType: (String(row['shot_type'] ?? 'miss')) as TagShotType,
      createdAt: String(row['created_at'] ?? ''),
      updatedAt: String(row['updated_at'] ?? ''),
    };
  }

  private mapMatchInputState(row: Record<string, unknown>): MatchInputState {
    const state = row as unknown as MatchInputState;
    return {
      youtubeUrl: state.youtubeUrl ?? '',
      videoSourceUrl: state.videoSourceUrl ?? '',
      videoTitle: state.videoTitle ?? '',
      sourceKind: state.sourceKind ?? 'remote',
      form: { ...state.form },
      confirmedSegments: (state.confirmedSegments ?? []).map((segment) => ({ ...segment })),
      manualStartSec: state.manualStartSec ?? 0,
      manualEndSec: state.manualEndSec ?? 5,
      clipScope: state.clipScope ?? '動画全体',
    };
  }

  private optionalString(value: unknown): string | undefined {
    return value === null || value === undefined || value === '' ? undefined : String(value);
  }

  private compareRallies = (a: Rally, b: Rally): number =>
    (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id) || a.id - b.id;

  private async requestJson<T = any>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail || 'request failed');
    }
    return (await response.json()) as T;
  }

  private rate(n: number, d: number): number {
    return d ? n / d : 0;
  }

  private async migrateLegacyLocalStore(): Promise<void> {
    if (typeof localStorage === 'undefined' || localStorage.getItem(LEGACY_MIGRATED_KEY) === '1') {
      return;
    }

    const raw = localStorage.getItem(LEGACY_STORE_KEY);
    if (!raw) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
      return;
    }

    let legacy: LegacyStore;
    try {
      legacy = JSON.parse(raw) as LegacyStore;
    } catch {
      localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
      return;
    }
    if (!legacy.matches?.length) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
      return;
    }

    const existingMatches = await this.requestJson<Array<Record<string, unknown>>>('/matches');
    const existingUuids = new Set(existingMatches.map((match) => String(match['uuid'])));

    for (const match of legacy.matches) {
      const matchUuid = String(match['uuid'] ?? '');
      if (!matchUuid || existingUuids.has(matchUuid)) {
        continue;
      }
      await this.requestJson('/matches', {
        method: 'POST',
        body: JSON.stringify({
          title: String(match['title'] ?? 'Imported Match'),
          uuid: matchUuid,
          created_at: String(match['createdAt'] ?? new Date().toISOString()),
        }),
      });
      existingUuids.add(matchUuid);

      const rallies = (legacy.rallies ?? [])
        .filter((rally) => String(rally['matchUuid'] ?? '') === matchUuid)
        .sort((a, b) => (Number(a['sortOrder'] ?? a['id'] ?? 0) - Number(b['sortOrder'] ?? b['id'] ?? 0)) || Number(a['id'] ?? 0) - Number(b['id'] ?? 0));

      for (const rally of rallies) {
        await this.requestJson(`/matches/${matchUuid}/rallies`, {
          method: 'POST',
          body: JSON.stringify({
            set_no: Number(rally['setNo'] ?? 1),
            server: String(rally['server'] ?? 'me'),
            serve_type: String(rally['serveType'] ?? ''),
            receive_type: String(rally['receiveType'] ?? 'short'),
            rally_len_bucket: String(rally['rallyLenBucket'] ?? '1-2'),
            point_winner: String(rally['pointWinner'] ?? 'me'),
            end_reason: String(rally['endReason'] ?? 'my_miss'),
            end_side: String(rally['endSide'] ?? 'my_fh'),
            my_3rd: String(rally['my3rd'] ?? 'none'),
            my_3rd_result: String(rally['my3rdResult'] ?? 'na'),
            t_start: rally['tStart'] ?? 0,
            t_end: rally['tEnd'] ?? 0,
            note: String(rally['note'] ?? ''),
            sort_order: rally['sortOrder'] ?? undefined,
            starred: Boolean(rally['starred']),
            result_tags: Array.isArray(rally['resultTags']) ? rally['resultTags'] : [],
            created_at: String(rally['createdAt'] ?? new Date().toISOString()),
          }),
        });
      }

      const inputState = legacy.matchInputStates?.[matchUuid];
      if (inputState) {
        await this.requestJson(`/matches/${matchUuid}/input-state`, {
          method: 'PUT',
          body: JSON.stringify(inputState),
        });
      }
    }

    if (legacy.selectedMatchUuid) {
      this.selectedMatchUuid = legacy.selectedMatchUuid;
    }
    localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
  }
}
