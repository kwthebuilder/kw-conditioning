/**
 * Engine-only types. Config and state types live in src/config/types.
 */
import type { BarbellMode, IsoDate, LiftId, MesocycleId, Position, SlotClass, SlotId, State, TemplateId } from '../config/types';

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
  /** Echo of a load override on the prescription, recorded into state.overrides. */
  override?: LoadOverride;
}

/** A.15: a big-gap flag, or entering M2, M3 or M4. */
export type SingleReason = 'boundary' | 'big_gap';

export interface RampSet {
  load: number;
  reps: number;
}

/** A manual load override applied to a prescription, echoed on the log (phase 2). */
export interface LoadOverride {
  from: number;
  note?: string;
}

export interface LiftPrescription {
  kind: 'lift';
  lift: LiftId;
  mode: BarbellMode;
  /** Unrounded TM the loads were computed from. */
  tm: number;
  /**
   * A ramp single at RIR 2 is suggested (2.8), never forced. `taken` is
   * true when the prescription was recomputed from a logged single.
   */
  single_suggested?: { reason: SingleReason; rir: 2; taken: boolean };
  /** Set when the athlete overrode the load. */
  override?: LoadOverride;
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

// ---------------------------------------------------------------------
// Phase 2: classes B and C (progression slots)
// ---------------------------------------------------------------------

/** How a slot steps: a kg figure, or text such as "one plate" shown to the athlete. */
export type Increment = { kind: 'kg'; kg: number; per_hand: boolean } | { kind: 'text'; text: string };

/** What the athlete logs on a class B or C slot. */
export interface SlotLog {
  slot: SlotId;
  date: IsoDate;
  /** Load as lifted: kg, or kg per hand on dumbbell slots. */
  load: number;
  sets_done: number;
  last_set: { reps: number; rir: number; tempo_break?: boolean };
  override?: LoadOverride;
}

export interface SlotPrescription {
  kind: 'slot';
  slot: SlotId;
  cls: 'B' | 'C';
  name: string;
  /** null on the first session: the athlete sets it (A.11). */
  load: number | null;
  start_hint_kg?: number;
  reps: number;
  rir_cap: number;
  increment: Increment;
  /** A text-increment step is owed: "go up one plate" until a heavier load is logged. */
  pending?: 'up' | 'down';
  notes: string[];
  override?: LoadOverride;
}

export type SlotDirection = 'set' | 'up' | 'down' | 'hold';

export interface SlotOutcome {
  direction: SlotDirection;
  load_before: number | null;
  load_after: number | null;
  /** Numeric step applied this session, if any. */
  delta_kg?: number;
  increment: Increment;
  streak_up: number;
  streak_down: number;
  pending?: 'up' | 'down';
  /** An earned upward step was withheld by the week-22 freeze. */
  withheld?: 'freeze';
}

export interface SlotUpdateResult {
  state: State;
  outcome: SlotOutcome;
  explanation: Explanation;
}

// ---------------------------------------------------------------------
// Phase 2: RDL (class B table)
// ---------------------------------------------------------------------

export interface RdlLog {
  slot: 'rdl';
  date: IsoDate;
  load: number;
  sets_done: number;
  last_set: { reps: number; rir: number; tempo_break?: boolean };
  override?: LoadOverride;
}

export interface RdlPrescription {
  kind: 'rdl';
  slot: 'rdl';
  name: string;
  load: number;
  rep_range: [number, number];
  rir_cap: number;
  /** Last set to RIR 2 or tempo break, always. */
  amrap: true;
  /** 1-based number of the session about to be logged. */
  session_number: number;
  /** The +10 kg row is still available (L10: first three sessions). */
  wide_window: boolean;
  notes: string[];
  override?: LoadOverride;
}

export interface RdlOutcome {
  delta_kg: number;
  load_before: number;
  load_after: number;
  session_number: number;
  /** Table row that fired: [reps_at_or_above, delta, note?]. */
  row: (number | string)[] | null;
  withheld?: 'freeze';
}

export interface RdlUpdateResult {
  state: State;
  outcome: RdlOutcome;
  explanation: Explanation;
}

// ---------------------------------------------------------------------
// Phase 2: classes D, E, F (fixed prescriptions, no logic)
// ---------------------------------------------------------------------

export interface FixedPrescription {
  kind: 'fixed';
  slot: SlotId;
  cls: 'D' | 'E' | 'F';
  name: string;
  /** What to do, read from the config. */
  text: string;
  /** Trap-bar jump: the bar. */
  load_kg?: number;
  /** Class E: contacts for this mesocycle and week. */
  contacts?: number;
  notes: string[];
}

export interface FixedLog {
  slot: SlotId;
  date: IsoDate;
  done: boolean;
  /** Optional reading: height, reps, distance. Stored, not interpreted. */
  value?: number;
  note?: string;
}

// ---------------------------------------------------------------------
// Phase 2: CMJ, stored only
// ---------------------------------------------------------------------

export interface CmjSummary {
  count: number;
  last: number | null;
  mean: number | null;
}

// ---------------------------------------------------------------------
// Phase 3: session and the one-door update
// ---------------------------------------------------------------------

export type SessionDay = 1 | 2;

/** A ramp single logged on its own before the work sets (A.23). */
export interface SingleLog {
  lift: LiftId;
  date: IsoDate;
  load: number;
  rir: number;
}

/** How a session item is logged. */
export type LogKind = 'barbell' | 'rdl' | 'slot' | 'fixed';

/** Fields carried from the template item; the engine's own numbers live on the prescription. */
export interface SessionTemplateFields {
  sets?: number;
  reps?: number;
  secs?: number;
  per_side?: boolean;
  variant?: string;
  contacts?: number;
  inside_rest?: boolean;
}

export interface SessionSlotItem {
  kind: 'slot';
  slot: SlotId;
  cls: SlotClass;
  name: string;
  log_kind: LogKind;
  template: SessionTemplateFields;
  prescription: BarbellPrescription | RdlPrescription | SlotPrescription | FixedPrescription;
}

export interface SessionWarmupItem {
  kind: 'warmup';
  name: string;
}

export type SessionItem = SessionSlotItem | SessionWarmupItem;

export interface SessionBlock {
  min?: number;
  superset?: boolean;
  contrast?: boolean;
  rounds?: number | [number, number];
  items: SessionItem[];
}

export interface Session {
  kind: 'session';
  date: IsoDate;
  mesocycle: MesocycleId;
  programme_week: number;
  day: SessionDay;
  template: TemplateId;
  target_min: number;
  /** Pre-session measurements from the template, e.g. ["cmj"]. */
  pre: string[];
  blocks: SessionBlock[];
  /** Lifts whose prescription carries an untaken single suggestion. */
  singles_suggested: { lift: LiftId; reason: SingleReason }[];
  /** A.21: the rsi_ladder item stands in for the reactive item today. */
  ladder_day: boolean;
  notes: string[];
}

export interface SessionRefer {
  kind: 'refer';
  date: IsoDate;
  reason: string;
}

export type SessionResult = Session | SessionRefer;

/** A.23: every change to state comes through update() as one of these. */
export type AnyLog =
  | ({ kind: 'barbell' } & BarbellLog)
  | ({ kind: 'single' } & SingleLog)
  | { kind: 'single_skipped'; date: IsoDate; lift: LiftId }
  | ({ kind: 'rdl' } & RdlLog)
  | ({ kind: 'slot' } & SlotLog)
  | ({ kind: 'fixed' } & FixedLog)
  | { kind: 'cmj'; date: IsoDate; value: number }
  | { kind: 'depth_jump_height'; date: IsoDate; height_cm: number }
  | { kind: 'tm_override'; date: IsoDate; lift: LiftId; tm: number; note?: string }
  | { kind: 'session_end'; date: IsoDate; day: SessionDay; minutes?: number; note?: string };

/** What update() appends to state.log. */
export interface LogEntry {
  kind: AnyLog['kind'];
  date: IsoDate;
  summary: string;
  log: AnyLog;
}

export interface EngineUpdateResult {
  state: State;
  explanation: Explanation;
  outcome: BarbellOutcome | RdlOutcome | SlotOutcome | null;
}
