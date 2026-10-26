import { candidateCounts, initialMobileMatchState, nextServer, pointRows, scorePoints, upsertCandidatePoint } from './mobile-match.logic';

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

const state = initialMobileMatchState();
const score = scorePoints(state.points, 1);
equal(score.me, 5, 'sample score: me');
equal(score.op, 3, 'sample score: opponent');
equal(pointRows(state.points, 1).at(-1)?.me, 5, 'row score recalculation');

equal(nextServer({ me: 0, op: 0 }, 'me'), 'me', 'opening server');
equal(nextServer({ me: 1, op: 0 }, 'me'), 'me', 'server before two points');
equal(nextServer({ me: 1, op: 1 }, 'me'), 'op', 'server after two points');
equal(nextServer({ me: 10, op: 10 }, 'me'), 'me', 'deuce opening server');
equal(nextServer({ me: 11, op: 10 }, 'me'), 'op', 'server alternates after deuce');
equal(nextServer({ me: 11, op: 11 }, 'me'), 'me', 'server alternates back after deuce');

const counts = candidateCounts(state.candidates);
equal(counts.confirmed, 38, 'confirmed candidates');
equal(counts.unconfirmed, 5, 'unconfirmed candidates');
equal(counts.review, 2, 'review candidates');

const candidate = state.candidates.find((item) => item.id === 39);
if (!candidate) throw new Error('candidate 39 missing');
const firstUpsert = upsertCandidatePoint(state.points, candidate);
const secondUpsert = upsertCandidatePoint(firstUpsert.points, { ...candidate, linkedPointId: firstUpsert.pointId });
equal(firstUpsert.points.length, 8, 'linked candidate does not duplicate sample point');
equal(secondUpsert.points.length, 8, 'repeated approval does not duplicate point');

console.log('mobile match logic: 15 checks passed');
