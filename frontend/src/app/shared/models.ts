export type Side = 'me' | 'op';
export type RallyResultTag = string;

export interface Match {
  id: number;
  uuid: string;
  title: string;
  initialServer: Side;
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
  resultTag?: RallyResultTag;
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

export interface RallyTagDefinition {
  id: number;
  tag: RallyResultTag;
  myRallyOnly: boolean;
  opponentRallyOnly: boolean;
  lossOnly: boolean;
  winOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringPatternSlice {
  label: string;
  count: number;
  ratio: number;
}

export type InputModalFieldType = 'text' | 'textarea' | 'number' | 'select';

export interface InputModalOption {
  label: string;
  value: string;
}

export interface InputModalField {
  key: string;
  label: string;
  type: InputModalFieldType;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  value?: string | number;
  options?: InputModalOption[];
}
