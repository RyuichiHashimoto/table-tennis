export type Side = 'me' | 'op';
export type RallyResultTag = string;

export interface Match {
  id: number;
  uuid: string;
  title: string;
  initialServer: Side;
  myPlayerName: string;
  opponentPlayerName: string;
  createdAt: string;
}

export interface Rally {
  id: number;
  matchId: number;
  uuid: string;
  matchUuid: string;
  sortOrder?: number;
  starred?: boolean;
  setNo: number;
  server: Side;
  serveType?: string;
  receiveType: string;
  rallyLenBucket: string;
  pointWinner: Side;
  endReason: string;
  endSide: string;
  my3rd: string;
  my3rdResult: string;
  resultTags: RallyResultTag[];
  tStart?: number;
  tEnd?: number;
  note?: string;
  createdAt: string;
}

export interface Segment {
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface RallySegment extends Segment {
  rallyId: number;
  setNo: number;
}

export interface Summary {
  total: number;
  win: number;
  lose: number;
  winRate: number;
  myServePoints: number;
  myServeWinRate: number;
  opServePoints: number;
  opServeWinRate: number;
}

export type TagPlayerSide = 'me' | 'op' | 'both';
export type TagPhase = 'serve' | 'receive' | 'rally';
export type TagShotType = 'miss' | 'point' | 'any';

export interface RallyTagDefinition {
  id: number;
  tag: RallyResultTag;
  playerSide: TagPlayerSide;
  phase: TagPhase;
  shotType: TagShotType;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringPatternSlice {
  label: string;
  count: number;
  ratio: number;
}
