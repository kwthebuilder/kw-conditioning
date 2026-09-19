/**
 * Engine-only types. Config and state types live in src/config/types.
 */
import type { BarbellMode, IsoDate, LiftId, Position, State } from '../config/types';

/** What the athlete logged for one barbell lift in one session. */
export interface BarbellLog {
  lift: LiftId;
  date: IsoDate;
  /** Mode the session was prescribed in. */
  mode: BarbellMode;
  /** Wave position, wave mode only. */
  position?: Position;
  /** Ramp single at RIR 2, when the session opened with one (2.8). */
  single?: { load: number; rir: number };
  prescribed: { load: number; reps: number; sets: number };
  last_set: { load: number; reps: number; rir: number };
  /** §11 toggle: an earlier set fell short of the prescribed reps. */
  missed: boolean;
}

export type SingleReason = 'boundary' | 'gap' | 'big_gap';

export interface RampSet {
  load: number;
  reps: number;
}

export interface LiftPrescription {
  kind: 'lift';
  lift: LiftId;
  mode: BarbellMode;
  /** Unrounded TM the loads were computed from. */
  tm: number;
  /** The session opens with a ramp single at RIR 2 (A.8). */
  single?: { reason: SingleReason; rir: 2 };
  /** Wave mode only. */
  position?: Position;
  pct: number;
  /** Rounded display load. */
  load: number;
  sets: number;
  reps: number;
  amrap: boolean;
  /** Reps at RIR 2 at which the raw estimate equals the TM (2.2). */
  par?: number;
  ramp: RampSet[];
  notes: string[];
}

/** A.13: anything the engine cannot compute is shown as "refer to project". */
export interface ReferPrescription {
  kind: 'refer';
  lift: LiftId;
  reason: string;
}

export type BarbellPrescription = LiftPrescription | ReferPrescription;

export type BarbellRule =
  | 'single'
  | 'failure'
  | 'position1'
  | 'calibration'
  | 'biggap'
  | 'matched'
  | 'hold';

/** Machine-readable outcome; the vectors assert against this. */
export interface BarbellOutcome {
  rule: BarbellRule;
  E?: number;
  T?: number;
  gap?: number;
  /** Change in TM from the work sets. Excludes any single's reset. */
  step: number;
  tm_before: number;
  tm_after: number;
  /** The logged position's β after the update; null if unset or not a wave position. */
  beta: number | null;
  single_scheduled: boolean;
  /** M2 band after the update. */
  band_pct?: number;
}

export interface ExplanationStep {
  rule: string;
  text: string;
  numbers: Record<string, number | boolean | null>;
}

export interface Explanation {
  summary: string;
  steps: ExplanationStep[];
}

export interface UpdateResult {
  state: State;
  outcome: BarbellOutcome;
  explanation: Explanation;
}
