import {
  AnalysisCandidate,
  CandidateStatus,
  MobileMatchState,
  MobilePoint,
  PlayerSide,
  ScoreSnapshot,
} from './mobile-match.models';

const sampleTimes = [32, 58, 86, 114, 141, 168, 186, 204];
const sampleWinners: PlayerSide[] = ['me', 'op', 'me', 'me', 'op', 'me', 'op', 'me'];

export function initialMobileMatchState(): MobileMatchState {
  const points: MobilePoint[] = sampleTimes.map((time, index) => ({
    id: `sample-${index + 1}`,
    setNo: 1,
    winner: sampleWinners[index],
    startTime: time,
    endTime: time + 8,
    starred: index === 7,
    sourceCandidateId: index === 7 ? 39 : undefined,
  }));

  const candidates: AnalysisCandidate[] = Array.from({ length: 45 }, (_, index) => {
    const id = index + 1;
    const status: CandidateStatus = id <= 38 ? 'confirmed' : id <= 43 ? 'unconfirmed' : 'review';
    const winner: PlayerSide = id % 3 === 0 ? 'op' : 'me';
    return {
      id,
      setNo: Math.min(3, Math.floor(index / 15) + 1),
      winner: id === 39 ? 'me' : winner,
      detectedWinner: id === 39 ? 'me' : winner,
      time: id === 39 ? 204 : 18 + index * 13,
      confidence: id === 39 ? 92 : 72 + (id * 7) % 27,
      status,
      linkedPointId: id === 39 ? 'sample-8' : undefined,
    };
  });

  return {
    version: 1,
    match: {
      myPlayerName: '橋本',
      opponentPlayerName: '清水',
      matchDate: '2026-10-22',
      initialServer: 'me',
      setScores: [
        { me: 11, op: 5 },
        { me: 11, op: 5 },
        { me: 11, op: 2 },
      ],
      videoName: '',
    },
    points,
    candidates,
    selectedSet: 1,
  };
}

export function scorePoints(points: MobilePoint[], setNo: number): ScoreSnapshot {
  return points
    .filter((point) => point.setNo === setNo)
    .reduce<ScoreSnapshot>(
      (score, point) => ({
        me: score.me + (point.winner === 'me' ? 1 : 0),
        op: score.op + (point.winner === 'op' ? 1 : 0),
      }),
      { me: 0, op: 0 },
    );
}

export function pointRows(points: MobilePoint[], setNo: number): Array<MobilePoint & ScoreSnapshot> {
  let me = 0;
  let op = 0;
  return points
    .filter((point) => point.setNo === setNo)
    .map((point) => {
      if (point.winner === 'me') me += 1;
      else op += 1;
      return { ...point, me, op };
    });
}

export function nextServer(score: ScoreSnapshot, initialServer: PlayerSide): PlayerSide {
  const total = score.me + score.op;
  const changes = score.me >= 10 && score.op >= 10 ? total - 20 : Math.floor(total / 2);
  return changes % 2 === 0 ? initialServer : initialServer === 'me' ? 'op' : 'me';
}

export function candidateCounts(candidates: AnalysisCandidate[]): Record<CandidateStatus, number> {
  return candidates.reduce(
    (counts, candidate) => ({ ...counts, [candidate.status]: counts[candidate.status] + 1 }),
    { unconfirmed: 0, confirmed: 0, review: 0 },
  );
}

export function upsertCandidatePoint(
  points: MobilePoint[],
  candidate: AnalysisCandidate,
): { points: MobilePoint[]; pointId: string } {
  const linkedIndex = points.findIndex(
    (point) => point.id === candidate.linkedPointId || point.sourceCandidateId === candidate.id,
  );
  if (linkedIndex >= 0) {
    const existing = points[linkedIndex];
    const next = [...points];
    next[linkedIndex] = {
      ...existing,
      setNo: candidate.setNo,
      winner: candidate.winner,
      startTime: candidate.time,
      sourceCandidateId: candidate.id,
    };
    return { points: next, pointId: existing.id };
  }

  const pointId = `candidate-${candidate.id}`;
  return {
    points: [
      ...points,
      {
        id: pointId,
        setNo: candidate.setNo,
        winner: candidate.winner,
        startTime: candidate.time,
        endTime: candidate.time,
        starred: false,
        sourceCandidateId: candidate.id,
      },
    ],
    pointId,
  };
}
