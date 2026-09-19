import { INITIAL_STATE, PROGRAMME_CONFIG } from '../src/config/load';
import type { LiftId, Position, State } from '../src/config/types';
import type { BarbellLog } from '../src/engine';

/** A date inside M1 (wave mode) after the initial state's as_of. */
export const M1_DATE = '2026-09-21';

export function stateWith(
  lift: LiftId,
  patch: { tm?: number; beta?: Partial<Record<'2' | '3', number | null>>; next_position?: Position; neg_streak?: number },
): State {
  const s = structuredClone(INITIAL_STATE);
  const ls = s.lifts[lift];
  if (patch.tm !== undefined) ls.tm = patch.tm;
  ls.beta = { '2': patch.beta?.['2'] ?? null, '3': patch.beta?.['3'] ?? null };
  if (patch.next_position !== undefined) ls.next_position = patch.next_position;
  if (patch.neg_streak !== undefined) ls.neg_streak = patch.neg_streak;
  return s;
}

export function waveLog(
  lift: LiftId,
  position: Position,
  set: { load: number; reps: number; rir: number; presc: number; missed?: boolean; sets?: number },
  extra: Partial<BarbellLog> = {},
): BarbellLog {
  return {
    lift,
    date: M1_DATE,
    mode: 'wave',
    position,
    prescribed: { load: set.load, reps: set.presc, sets: set.sets ?? PROGRAMME_CONFIG.wave.sets },
    last_set: { load: set.load, reps: set.reps, rir: set.rir },
    missed: set.missed ?? false,
    ...extra,
  };
}

export const closeTo = (actual: number, expected: number, tol: number): boolean =>
  Math.abs(actual - expected) <= tol + 1e-12;
