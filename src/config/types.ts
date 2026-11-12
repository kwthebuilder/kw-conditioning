/**
 * Types for the three spec/*.json files, derived by reading the files
 * themselves (phase 0). Nothing here interprets a rule: where a field's
 * meaning is a phase 1 or 2 concern, the type records only its shape.
 *
 * This module has no imports so that engine, storage and UI can all
 * depend on it without pulling each other in.
 */

/** ISO calendar date, YYYY-MM-DD. */
export type IsoDate = string;

export type Position = 1 | 2 | 3;
export type Site = 'patellar' | 'gluteal';
export type SlotClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type MesocycleId = 'M1' | 'M2' | 'M3' | 'M4' | 'TAPER' | 'INTENSIVE';
export type TemplateId = 'M1' | 'M2' | 'M34' | 'TAPER';
export type BarbellMode = 'wave' | 'band_87_90' | 'primer_2x2_90' | 'single_1x2_90' | 'heavy_doubles';
export type CutGroup = 'prehab' | 'pull' | 'accessory_hinge_or_single_leg';
export type LiftId = 'front_squat' | 'deadlift';
/** Slot ids are open strings; the loader cross-checks references. */
export type SlotId = string;

// ---------------------------------------------------------------------
// initial_state_v1.json
// ---------------------------------------------------------------------

export interface LiftState {
  /** Unrounded training max in kg (CLAUDE.md rule 5). */
  tm: number;
  /** Per-position scale factor; null until calibrated. Position 1 has none. */
  beta: { '2': number | null; '3': number | null };
  next_position: Position;
  sessions_logged: number;
  neg_streak: number;
  single_scheduled: boolean;
  // Phase 1 additions. All optional so initial_state_v1.json parses unchanged;
  // absent means: never logged, mesocycle M1, band 87%, no forced failures.
  /** Date of the last logged session on this lift (audit-after-gap, 2.8). */
  last_logged?: IsoDate;
  /** Mesocycle of the last logged session (boundary audit, 2.8). Absent = M1. */
  last_mesocycle?: MesocycleId;
  /** M2 contrast band (2.9). Absent = 87%, streak 0. */
  band?: { pct: 0.87 | 0.9; high_rir_streak: number };
  /** Failure signals on consecutive forced position-1 sessions (2.7, Q2 ruling). */
  forced_failures?: number;
  /** A.23: a single was logged on this date; the day's work sets are straight sets (A.16). */
  single_taken?: { date: IsoDate; reason: 'boundary' | 'big_gap' };
  /**
   * A.34 (v1.9): the date of this lift's first logged session (work sets or
   * a single) in last_mesocycle. Set only by logs dated in a block after
   * Block 1, so no log made before v1.9 sets it. Absent until then.
   */
  entered_on?: IsoDate;
}

export interface RdlState {
  load_kg: number;
  sessions_logged: number;
}

/** A.24: one explosive slot's carried load. Absent until the first log sets it. */
export interface ExplosiveState {
  /** kg on the bar (jump shrug), on the sleeve (landmine) or per hand (DB), as logged. */
  load: number;
  /** Consecutive sessions at this load with no stop-rule cut. */
  clean_streak: number;
}

export interface AccessoryState {
  /** kg, or kg per hand for dumbbell slots; null until the first log sets it (A.11). */
  load: number | null;
  streak_up: number;
  streak_down: number;
  /**
   * Phase 2: a step earned on a slot whose increment is text ("one plate").
   * The prescription says "go up one plate" until a heavier load is logged.
   */
  pending?: 'up' | 'down';
}

/** Phase 2: a manual override, carried in the export. */
export type OverrideRecord =
  | { kind: 'tm'; date: IsoDate; lift: LiftId; from: number; to: number; note?: string }
  | { kind: 'load'; date: IsoDate; slot: SlotId; from: number; to: number; note?: string };

export interface DepthJumpState {
  height_cm: number | null;
  /** v1 only; dropped in initial_state_v1_1 with the ladder logic. */
  ladder_due?: boolean;
}

export interface TrapBarJumpState {
  load_kg: number;
  /** v1 only; dropped in v1.1 with the height progression. */
  heights?: number[];
}

export interface CmjState {
  series: number[];
  /** v1 only; dropped in v1.1 with the CMJ rule. */
  baseline?: number | null;
}

/**
 * The initial state file holds only null per site. The populated shape
 * is a phase 2 concern (flare ladder); until then it is an opaque object.
 */
export type FlareSiteState = Record<string, unknown> | null;

export interface State {
  schema: 1;
  as_of: IsoDate;
  lifts: Record<LiftId, LiftState>;
  rdl: RdlState;
  accessories: Record<SlotId, AccessoryState>;
  depth_jump: DepthJumpState;
  trap_bar_jump: TrapBarJumpState;
  cmj: CmjState;
  /** v1 only; dropped in v1.1 with the flare ladder. */
  flare?: Record<Site, FlareSiteState>;
  /** v1 only; dropped in v1.1 with the time pre-cuts. */
  pending_precuts?: unknown[];
  /** Empty in the initial state; element shape is a phase 3/4 concern. */
  log: unknown[];
  /** Phase 2: manual overrides of loads and training maxes. Absent = none. */
  overrides?: OverrideRecord[];
  /** A.24: explosive slot loads. Absent = none logged yet. */
  explosive?: Record<SlotId, ExplosiveState>;
  /**
   * A.32 (v1.9): the date of the latest swap logged on each primary lift.
   * Read only by day selection (A.22); last_logged is not touched by a
   * swap. Absent = no primary lift has been swapped.
   */
  swapped_main?: Partial<Record<LiftId, IsoDate>>;
}

// ---------------------------------------------------------------------
// programme_config_v1.json
// ---------------------------------------------------------------------

export interface Mesocycle {
  id: MesocycleId;
  /** Inclusive [first, last] programme week. */
  weeks: [number, number];
  start: IsoDate;
  end: IsoDate;
  /** null for INTENSIVE, which the engine does not programme. */
  template: TemplateId | null;
  barbell_mode: BarbellMode | null;
}

export interface WavePosition {
  reps: number;
  pct: number;
  amrap: boolean;
  /** Present only on rep-out positions 2 and 3. */
  par?: number;
}

export interface WaveConfig {
  positions: Record<'1' | '2' | '3', WavePosition>;
  sets: number;
  rir_cap: number;
  /** Ramp singles as [fraction of top load, reps]. */
  ramp: [number, number][];
}

/** A contact count: a number, an inclusive range, or a map by week span ("20-22"). */
export type ContactSpec = number | [number, number] | Record<string, number>;
/** Either one number for every mesocycle or a per-mesocycle map. */
export type Contacts = number | Partial<Record<MesocycleId, ContactSpec>>;

/** RDL step table row: [reps_at_or_above, delta_kg, note?]. */
export type RdlTableRow = [number, number] | [number, number, string];

/**
 * One slot. `cls` is the class from engine_spec_v1_3.md; the remaining
 * fields are the union of everything the file carries, all optional
 * except id/name/cls. Class-specific requirements are enforced in
 * validate.ts where the file is consistent enough to justify it.
 */
export interface Slot {
  id: SlotId;
  name: string;
  cls: SlotClass;
  /** Descriptive only in v1.1 (config scope_note). */
  sites?: Site[];
  group?: CutGroup;
  alt?: SlotId | string;
  swap?: string;
  progress?: string;
  regression?: string;
  never_zero?: boolean;
  when?: string;
  note?: string;

  // class A (barbell)
  tm_seed?: number;
  cal_cap?: number;

  // class B (tempo) and C (accessory)
  reps?: number;
  rir_cap?: number;
  up_at?: number;
  down_below?: number;
  streak?: number;
  increment?: string;
  start_hint_kg?: number;
  // rdl only
  start_kg?: number;
  rep_range?: [number, number];
  table?: RdlTableRow[];

  // class D (ballistic)
  band_pct_fs_tm?: [number, number];
  ceiling_pct_est_1rm?: number;
  increment_kg?: number;
  /** Withdrawn in config v1.3 (spec v1.6); still parsed so older configs import. */
  start_pct_dl_tm?: number;
  /** A.24: the slot carries a load set by the athlete's first log. */
  load_rule?: 'carry';

  // class E (plyometric)
  contacts?: Contacts;
  landings?: [number, number];

  // v1.6, display only for the engine (A.39): what the athlete reads on the
  // item, and the exercises the item may be swapped to (A.32).
  cue?: string;
  swaps?: string[];
}

export interface SlotItem {
  slot: SlotId;
  sets?: number;
  reps?: number;
  secs?: number;
  per_side?: boolean;
  mode?: BarbellMode;
  variant?: string;
  inside_rest?: boolean;
  until_week?: number;
  contacts?: number;
  /** TAPER only: which day of the shared template this item belongs to. */
  day?: 1 | 2;
  /** v1.6: a line shown on the item, display only. */
  note?: string;
  /** v1.6: reps by programme-week span ("20-22"), overriding `reps` in those weeks. */
  reps_by_week?: Record<string, number>;
}

/** A string item is a named warm-up block; an object item is a slot. */
export type TemplateItem = string | SlotItem;

export interface TemplateBlock {
  /** Minutes; absent on TAPER blocks. */
  min?: number;
  items: TemplateItem[];
  superset?: boolean;
  contrast?: boolean;
  rounds?: number | [number, number];
  /** v1.6: an upper-body block; the last one is trimmed on audit days (A.34). */
  upper?: boolean;
}

export interface SessionTemplate {
  target_min: number;
  /** Pre-session measurements, e.g. ["cmj"]. */
  pre?: string[];
  /** v1.7 (A.41): on a both_days template, the days `pre` applies to; absent means every day. */
  pre_days?: (1 | 2)[];
  blocks: TemplateBlock[];
}

export type Template =
  | { day1: SessionTemplate; day2: SessionTemplate; both_days?: never }
  | { both_days: SessionTemplate; day1?: never; day2?: never };

export interface ProgrammeConfig {
  version: string;
  date: IsoDate;
  governs: string;
  scope_note?: string;
  budget_min: { normal: number; audit: number };
  equipment: {
    barbell_round_kg: number;
    trap_bar_kg: number;
    trap_bar_kg_confirmed: boolean;
    db_min_kg: number;
    db_max_kg: number;
    db_step_kg: number;
  };
  instruments: Record<string, string>;
  athlete: { body_mass_kg: number };
  mesocycles: Mesocycle[];
  /** A.15: boundary singles are suggested only on entering these. */
  boundary_singles_on_entering: MesocycleId[];
  /** A.21: ladder days. Fixed text; the rsi_ladder item replaces the first named slot, the rest are dropped. */
  ladder?: { weeks: number[]; day: 1 | 2; slot: SlotId; replaces: SlotId[]; note?: string };
  freeze: {
    no_upward_steps_after_week: number;
    depth_jump_height_frozen_after_week: number;
  };
  wave: WaveConfig;
  slots: Record<SlotId, Slot>;
  templates: Record<TemplateId, Template>;
  /** v1.6, display only (A.39): words shown on screen. */
  text?: Record<string, string>;
  /** v1.6 (A.36): the session-start tissue question. Record only. */
  tissue_check?: { when: 'session_start'; prompt: string; note?: string };
  /** v1.6 (A.35): the record-only phase-start test on the first Day 1 of these blocks. */
  phase_tests?: { slot: SlotId; mesocycles: MesocycleId[]; day: 1 | 2; before_slot: SlotId; note?: string };
  /** v1.6 (A.34): set caps on a session that opens with a boundary test single. */
  audit_trims?: { max_sets: number; slots_by_day: Partial<Record<'1' | '2', SlotId[]>>; final_upper_block: boolean; note?: string };
  /** v1.6 (A.37): templates for sessions dated before `date`. */
  templates_before?: { date: IsoDate; from_config: string; templates: Partial<Record<TemplateId, Template>>; note?: string };
  /** v1.7 (A.40): reaching the rep target with at least min_rir in reserve also counts towards a step up, for logs dated on or after `from`. */
  rir_step?: { min_rir: number; from: IsoDate; note?: string };
}

// ---------------------------------------------------------------------
// engine_test_vectors_v1.json
// ---------------------------------------------------------------------

export interface BarbellVectorInput {
  tm: number;
  pos: Position;
  load: number;
  presc: number;
  reps: number;
  rir: number;
  calibrating?: boolean;
  cal_cap?: number;
  beta?: number;
  missed?: boolean;
}

export interface BarbellVectorExpect {
  rule: 'calibration' | 'failure' | 'position1' | 'matched' | 'biggap';
  E?: number;
  T?: number;
  gap?: number;
  step?: number;
  tm: number;
  beta: number | null;
  single: boolean;
}

export interface BarbellVector {
  name: string;
  input: BarbellVectorInput;
  expect: BarbellVectorExpect;
  next_pos3_load?: number | null;
  next_loads: Record<'1' | '2' | '3', number>;
}

export interface RoundingVector {
  raw: number;
  expect: number;
}

export interface AuditRescaleVector {
  tm_before: number;
  single: number;
  betas_before: { '2': number; '3': number };
  expect: { tm: number; betas: { '2': number; '3': number } };
}

export interface DownwardTriggerCase {
  name: string;
  sequence?: string;
  expect: string;
}

export interface DownwardTriggerVector {
  cases: DownwardTriggerCase[];
}

export interface RdlVector {
  session: number;
  reps: number;
  expect_delta: number;
}

export interface AccessoryVector {
  slot: SlotId;
  history_last_set_reps: number[];
  /** Programme week the last session falls in; absent = M1. */
  programme_week?: number;
  expect: string;
}

export interface SinglesVector {
  boundary: { fires_on_entering: MesocycleId[]; never: string[]; skippable: boolean };
  single_day_work_sets: {
    input: { tm_before: number; single: number; pos: Position; work_last_set: { load: number; reps: number; rir: number } };
    expect: { tm: number; rule_for_work_sets: string };
  };
  big_gap: string;
}

export type OverrideVector =
  | { name: 'load_override'; prescribed_load: number; athlete_changes_to: number; log: { load: number; reps: number; rir: number }; expect: string }
  | {
      name: 'tm_override';
      lift: LiftId;
      tm_before: number;
      athlete_sets: number;
      expect: { tm: number; betas: string; next_loads: Record<'1' | '2' | '3', number>; export: string };
    };

export interface RampVector {
  day_load: number;
  expect: [number, number][];
  note?: string;
}

export interface SessionVector {
  ladder: { date: IsoDate; day: 1 | 2; expect: string }[];
  day_default: { state: string; explicit_day?: 1 | 2; expect_day: 1 | 2; note?: string }[];
}

export interface ExplosiveVector {
  name: string;
  slot: SlotId;
  date: IsoDate;
  sessions: { load: number; cut: boolean }[];
  expect_load: number;
  expect_streak: number;
}

export interface RoundsVector {
  date: IsoDate;
  day: 1 | 2;
  slot: SlotId;
  expect_sets: number;
  expect_sets_max: number | null;
}

/** v1.4 `skip` and `amend` vectors: expected derived values after the steps. */
export interface VectorExpect {
  tm?: Record<string, number>;
  next_position?: Record<string, number>;
  sessions_logged?: Record<string, number>;
  /** v1.6 */
  last_logged?: Record<string, string>;
  /** v1.6: the day A.22 gives after the steps. */
  day?: 1 | 2;
  /** v1.6: the explanation summary of the step at identical_at, or of the last step. */
  explanation?: string;
  /** v1.6: an empty object means no lift has been swapped. */
  swapped_main?: Record<string, string>;
  /** v1.6: accessory slots with no load on record (absent or null). */
  accessory_unset?: string[];
  /** v1.6: the step (index into logs) whose state must equal the state before it, apart from the log and identical_apart_from. */
  identical_at?: number;
  identical_apart_from?: string[];
  beta?: Record<string, Record<string, number>>;
  rdl_load?: number;
  rdl_sessions?: number;
  accessory?: Record<string, { load: number; streak_up: number }>;
  effective_length?: number;
  effective_dates?: string[];
}

/** A log object as written in the vectors file; the engine types it (AnyLog). */
export type VectorLog = Record<string, unknown> & { kind: string; date: string };

export interface SkipVector {
  name: string;
  steps: VectorLog[];
  expect: VectorExpect;
}

export interface AmendVector {
  name: string;
  logs: VectorLog[];
  before?: VectorExpect;
  /** Each inner list is one correction's actions. */
  corrections: Record<string, unknown>[][];
  expect: VectorExpect;
}

export interface TestVectors {
  version: string;
  date: IsoDate;
  spec: string;
  tolerance: { tm: number; beta: number; load: number };
  notes: string;
  barbell: BarbellVector[];
  rounding: RoundingVector[];
  audit_rescale: AuditRescaleVector;
  downward_trigger: DownwardTriggerVector;
  rdl: RdlVector[];
  accessory: AccessoryVector[];
  golden_sessions: string;
  singles: SinglesVector;
  override: OverrideVector[];
  ramp: RampVector[];
  session: SessionVector;
  explosive: ExplosiveVector[];
  rounds: RoundsVector[];
  /** v1.4 */
  skip: SkipVector[];
  /** v1.4 */
  amend: AmendVector[];
  /** v1.6: which config each template-dependent block is read against. */
  pinned?: Record<string, string>;
  /** v1.6 (A.32): swaps. Steps through update(), corrections through amend(). */
  swap?: AmendVector[];
  /** v1.6 (A.33) */
  rep_override?: RepOverrideVector[];
  /** v1.6: the first logged session sets the load on the new slots. */
  first_load?: FirstLoadVector[];
  /** v1.6 (A.34) */
  audit_trims?: SessionCaseVector[];
  /** v1.6 (A.35) */
  phase_tests?: SessionCaseVector[];
  /** v1.6 (A.29, A.35, A.36): entries that change nothing but the log. */
  record_only?: { name: string; log: VectorLog }[];
  /** v1.6: what each block's sessions hold, in order. */
  templates?: TemplateVector[];
  /** v1.6: slots that leave every template but stay defined. */
  removed_slots?: { slots: string[]; note?: string };
  /** v1.7 (A.40): the target reached with enough reps in reserve counts towards a step up. */
  rir_step?: RirStepVector[];
  /** v1.7 (A.41): pre-session items by day on a both_days template. */
  taper_pre?: { name: string; date: IsoDate; day: 1 | 2; pre: string[] }[];
  /** v1.10 (A.43): heavy doubles, prescribed and updated. */
  heavy_doubles?: { prescribe: DoublesPrescribeVector[]; update: LogSequenceVector[] };
  /** v1.10 (A.44): a test single read by its reps left. */
  single_rir?: LogSequenceVector[];
}

/** v1.10: logs passed to update() in order from a patched initial state. */
export interface LogSequenceVector {
  name: string;
  state_patch?: StatePatch;
  /** AnyLog objects; the engine, not the loader, checks them. */
  logs: unknown[];
  expect: { lift: LiftId; tm?: number; rule?: string; single_scheduled?: boolean; refused?: boolean };
}

export interface DoublesPrescribeVector {
  name: string;
  state_patch?: StatePatch;
  date: IsoDate;
  day: 1 | 2;
  lift: LiftId;
  expect: { mode: BarbellMode; load: number; sets: number; sets_max: number | null; reps: number; single: boolean };
}

export interface RirStepVector {
  name: string;
  slot: SlotId;
  seed_load: number;
  logs: { date: IsoDate; reps: number; rir: number; target_reps?: number }[];
  expect: { load: number; streak_up?: number; pending?: 'up' | 'down' };
}

/** A state patch deep-merged into initial_state_v1_1.json. */
export type StatePatch = Record<string, unknown>;

export interface RepOverrideVector {
  name: string;
  slot: SlotId;
  date: IsoDate;
  day: 1 | 2;
  seed_load: number;
  expect_prescribed: { reps: number; target_reps: number | null };
  rule: { reps: number; up_at: number; down_below: number };
  history_last_set_reps: number[];
  /** "+2 kg/hand", "-2 kg/hand", "hold", or "prompt 'go down one stack plate'". */
  expect: string;
  /** Log without target_reps even where the prescription has one. */
  omit_target?: boolean;
}

export interface FirstLoadVector {
  name: string;
  slot: SlotId;
  date: IsoDate;
  day: 1 | 2;
  state_patch?: StatePatch;
  load: number;
  reps: number;
  expect_load: number;
}

export interface SessionCaseVector {
  name: string;
  date: IsoDate;
  day: 1 | 2;
  state_patch?: StatePatch;
  /** audit_trims: whether the caps apply on this session. */
  audit?: boolean;
  /** Expected template sets per slot (audit_trims). */
  expect_sets?: Record<SlotId, number>;
  expect_sets_max?: Record<SlotId, number | null>;
  /** phase_tests: "present" or "absent". */
  expect?: 'present' | 'absent';
  /** phase_tests: the slot the test sits just before. */
  expect_before?: SlotId;
}

export interface TemplateVector {
  name: string;
  date: IsoDate;
  day: 1 | 2;
  state_patch?: StatePatch;
  target_min: number;
  pre: string[];
  /** Items in order; warm-ups by their template name. */
  order: string[];
  /** Displayed dose per slot: sets, sets_max, reps, secs, per_side, contacts, variant, mode, note. */
  items: Record<SlotId, Record<string, number | string | boolean | null>>;
}
