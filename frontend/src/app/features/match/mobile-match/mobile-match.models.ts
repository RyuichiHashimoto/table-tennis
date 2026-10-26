export type PlayerSide = 'me' | 'op';
export type MobileScreen = 'record' | 'points' | 'analysis' | 'info';
export type CandidateStatus = 'unconfirmed' | 'confirmed' | 'review';

export interface MobilePoint {
  id: string;
  setNo: number;
  winner: PlayerSide;
  startTime: number;
  endTime: number;
  starred: boolean;
  sourceCandidateId?: number;
}

export interface AnalysisCandidate {
  id: number;
  setNo: number;
  winner: PlayerSide;
  detectedWinner: PlayerSide;
  time: number;
  confidence: number;
  status: CandidateStatus;
  linkedPointId?: string;
}

export interface MobileMatchInfo {
  myPlayerName: string;
  opponentPlayerName: string;
  matchDate: string;
  initialServer: PlayerSide;
  setScores: Array<{ me: number; op: number }>;
  videoName: string;
}

export interface MobileMatchState {
  version: 1;
  match: MobileMatchInfo;
  points: MobilePoint[];
  candidates: AnalysisCandidate[];
  selectedSet: number;
}

export interface ScoreSnapshot {
  me: number;
  op: number;
}
