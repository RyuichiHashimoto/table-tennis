import { Injectable, signal } from '@angular/core';
import { AnalysisCandidate, CandidateStatus, MobileMatchState, MobilePoint, PlayerSide } from './mobile-match.models';
import { initialMobileMatchState, upsertCandidatePoint } from './mobile-match.logic';

@Injectable({ providedIn: 'root' })
export class MobileMatchStore {
  private readonly storageKey = 'tt-analyzer.mobile-match.v1';
  readonly state = signal<MobileMatchState>(this.load());
  readonly saved = signal(true);

  update(mutator: (state: MobileMatchState) => MobileMatchState): boolean {
    const next = mutator(this.state());
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(next));
      this.state.set(next);
      this.saved.set(true);
      return true;
    } catch {
      this.saved.set(false);
      return false;
    }
  }

  addPoint(point: MobilePoint): boolean {
    return this.update((state) => ({ ...state, points: [...state.points, point] }));
  }

  undoLastPoint(setNo: number): boolean {
    const state = this.state();
    let index = -1;
    for (let pointIndex = state.points.length - 1; pointIndex >= 0; pointIndex -= 1) {
      if (state.points[pointIndex].setNo === setNo) {
        index = pointIndex;
        break;
      }
    }
    if (index < 0) return false;
    return this.update((current) => ({
      ...current,
      points: current.points.filter((_, pointIndex) => pointIndex !== index),
    }));
  }

  updatePoint(pointId: string, winner: PlayerSide, time: number): boolean {
    return this.update((state) => ({
      ...state,
      points: state.points.map((point) =>
        point.id === pointId ? { ...point, winner, startTime: time } : point,
      ),
    }));
  }

  deletePoint(pointId: string): boolean {
    return this.update((state) => ({
      ...state,
      points: state.points.filter((point) => point.id !== pointId),
      candidates: state.candidates.map((candidate) =>
        candidate.linkedPointId === pointId ? { ...candidate, linkedPointId: undefined } : candidate,
      ),
    }));
  }

  toggleStar(pointId: string): boolean {
    return this.update((state) => ({
      ...state,
      points: state.points.map((point) =>
        point.id === pointId ? { ...point, starred: !point.starred } : point,
      ),
    }));
  }

  selectSet(setNo: number): boolean {
    return this.update((state) => ({ ...state, selectedSet: setNo }));
  }

  updateMatch(patch: Partial<MobileMatchState['match']>): boolean {
    return this.update((state) => ({ ...state, match: { ...state.match, ...patch } }));
  }

  updateCandidate(candidateId: number, patch: Partial<AnalysisCandidate>): boolean {
    return this.update((state) => ({
      ...state,
      candidates: state.candidates.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, ...patch } : candidate,
      ),
    }));
  }

  confirmCandidate(candidateId: number, winner?: PlayerSide, time?: number): boolean {
    return this.update((state) => {
      const candidate = state.candidates.find((item) => item.id === candidateId);
      if (!candidate) return state;
      const confirmed: AnalysisCandidate = {
        ...candidate,
        winner: winner ?? candidate.winner,
        time: time ?? candidate.time,
        status: 'confirmed',
      };
      const result = upsertCandidatePoint(state.points, confirmed);
      return {
        ...state,
        points: result.points,
        candidates: state.candidates.map((item) =>
          item.id === candidateId ? { ...confirmed, linkedPointId: result.pointId } : item,
        ),
      };
    });
  }

  deleteCandidate(candidateId: number): boolean {
    return this.update((state) => ({
      ...state,
      candidates: state.candidates.filter((candidate) => candidate.id !== candidateId),
    }));
  }

  candidatesFor(status: CandidateStatus): AnalysisCandidate[] {
    return this.state().candidates.filter((candidate) => candidate.status === status);
  }

  reset(): void {
    const next = initialMobileMatchState();
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(next));
      this.state.set(next);
      this.saved.set(true);
    } catch {
      this.saved.set(false);
    }
  }

  private load(): MobileMatchState {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return initialMobileMatchState();
      const parsed = JSON.parse(raw) as MobileMatchState;
      if (parsed.version !== 1 || !Array.isArray(parsed.points) || !Array.isArray(parsed.candidates)) {
        return initialMobileMatchState();
      }
      return parsed;
    } catch {
      return initialMobileMatchState();
    }
  }
}
