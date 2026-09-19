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
export type BarbellMode = 'wave' | 'band_87_90' | 'primer_2x2_90' | 'single_1x2_90';
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
}

export interface RdlState {
  load_kg: number;
  sessions_logged: number;
}

export interface AccessoryState {
  load: number | null;
  streak_up: number;
  streak_down: number;
}

export interface DepthJumpState {
  height_cm: number | null;
  ladder_due: boolean;
}

export interface TrapBarJumpState {
  load_kg: number;
  heights: number[];
}

export interface CmjState {
  series: number[];
  baseline: number | null;
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
  flare: Record<Site, FlareSiteState>;
  /** Empty in the initial state; element shape is a phase 2 concern. */
  pending_precuts: unknown[];
  /** Empty in the initial state; element shape is a phase 3/4 concern. */
  log: unknown[];
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
  sites?: Site[];
  group?: CutGroup;
  alt?: SlotId | string;
  swap?: string;
  progress?: string;
  regression?: string;
  never_zero?: boolean;
  removed_by?: string[];
  cmj_flag?: string;
  when?: string;
  first_cut_on?: string[];

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
  start_pct_dl_tm?: number;

  // class E (plyometric)
  contacts?: Contacts;
  landings?: [number, number];
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
}

export interface SessionTemplate {
  target_min: number;
  /** Pre-session measurements, e.g. ["cmj"]. */
  pre?: string[];
  blocks: TemplateBlock[];
}

export type Template =
  | { day1: SessionTemplate; day2: SessionTemplate; both_days?: never }
  | { both_days: SessionTemplate; day1?: never; day2?: never };

export interface ProgrammeConfig {
  version: string;
  date: IsoDate;
  governs: string;
  budget_min: { normal: number; audit: number };
  cut_order: CutGroup[];
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
  boundary_events: string[];
  freeze: {
    no_upward_steps_after_week: number;
    depth_jump_height_frozen_after_week: number;
  };
  wave: WaveConfig;
  contact_caps: { session: number; week: Partial<Record<MesocycleId, number>> };
  sites: Record<Site, { cut_first: SlotId }>;
  slots: Record<SlotId, Slot>;
  templates: Record<TemplateId, Template>;
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

export interface DownwardTriggerVector {
  steps: number[];
  expect: string;
}

export interface RdlVector {
  session: number;
  reps: number;
  expect_delta: number;
}

export interface AccessoryVector {
  slot: string;
  history_last_set_reps: number[];
  site_flag_last_48h?: boolean;
  expect: string;
}

export interface TrapBarJumpVector {
  fs_tm: number;
  bar_kg: number;
  est_1rm: number;
  expect_load: number;
  why: string;
}

export interface CmjVector {
  series: number[];
  mean: number;
  te: number;
  drop: number;
  threshold: number;
  rule: string;
  cases: { value: number; expect_flag: boolean }[];
}

export interface FlareLadderVector {
  site: Site;
  cut_first_slot: SlotId;
  pre_flare_kg: number;
  cut: number;
  load_by_clear_site_exposures_since_flag: Record<string, number>;
  plyometrics: string;
  second_consecutive_flag_or_over_5_or_night_pain: string;
}

export interface GapVector {
  days: number;
  expect: string;
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
  trap_bar_jump: TrapBarJumpVector[];
  cmj: CmjVector;
  flare_ladder: FlareLadderVector;
  gap: GapVector[];
  golden_sessions: string;
}
