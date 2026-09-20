/**
 * Hand-written validators for the three spec/*.json files.
 *
 * Each `parse*` function takes `unknown`, checks structure and enumerated
 * values, and returns the typed value. The first failure throws a
 * ConfigError naming the JSON path, e.g. `slots.rdl.table[0][1]`.
 *
 * Structural only: nothing here checks that numbers make programme
 * sense. That is the engine's job against the vectors in phases 1-3.
 */
import type {
  AccessoryState,
  AccessoryVector,
  AuditRescaleVector,
  BarbellMode,
  BarbellVector,
  BarbellVectorExpect,
  BarbellVectorInput,
  ContactSpec,
  Contacts,
  CutGroup,
  DownwardTriggerVector,
  FlareSiteState,
  LiftId,
  LiftState,
  Mesocycle,
  MesocycleId,
  OverrideRecord,
  OverrideVector,
  Position,
  ProgrammeConfig,
  RdlTableRow,
  RdlVector,
  RoundingVector,
  SessionTemplate,
  SinglesVector,
  Site,
  Slot,
  SlotClass,
  SlotItem,
  State,
  Template,
  TemplateBlock,
  TemplateId,
  TemplateItem,
  TestVectors,
  WaveConfig,
  WavePosition,
} from './types';

export class ConfigError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ConfigError';
  }
}

// ---------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------

type Obj = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new ConfigError(path, message);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    fail(path, `expected object, got ${describe(v)}`);
  }
  return v as Obj;
}

function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    fail(path, `expected finite number, got ${describe(v)}`);
  }
  return v;
}

function int(v: unknown, path: string): number {
  const n = num(v, path);
  if (!Number.isInteger(n)) fail(path, `expected integer, got ${n}`);
  return n;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, `expected string, got ${describe(v)}`);
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, `expected boolean, got ${describe(v)}`);
  return v;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, `expected array, got ${describe(v)}`);
  return v;
}

function nullable<T>(v: unknown, path: string, inner: (v: unknown, p: string) => T): T | null {
  return v === null ? null : inner(v, path);
}

function optional<T>(
  o: Obj,
  key: string,
  path: string,
  inner: (v: unknown, p: string) => T,
): T | undefined {
  return key in o && o[key] !== undefined ? inner(o[key], `${path}.${key}`) : undefined;
}

function req<T>(o: Obj, key: string, path: string, inner: (v: unknown, p: string) => T): T {
  if (!(key in o)) fail(path, `missing required key "${key}"`);
  return inner(o[key], `${path}.${key}`);
}

function oneOf<const T extends readonly (string | number)[]>(
  allowed: T,
): (v: unknown, path: string) => T[number] {
  return (v, path) => {
    if (!allowed.includes(v as string | number)) {
      fail(path, `expected one of ${JSON.stringify(allowed)}, got ${JSON.stringify(v)}`);
    }
    return v as T[number];
  };
}

function listOf<T>(inner: (v: unknown, p: string) => T): (v: unknown, path: string) => T[] {
  return (v, path) => arr(v, path).map((x, i) => inner(x, `${path}[${i}]`));
}

function pair<T>(inner: (v: unknown, p: string) => T): (v: unknown, path: string) => [T, T] {
  return (v, path) => {
    const a = arr(v, path);
    if (a.length !== 2) fail(path, `expected pair, got length ${a.length}`);
    return [inner(a[0], `${path}[0]`), inner(a[1], `${path}[1]`)];
  };
}

function mapOf<T>(
  inner: (v: unknown, p: string) => T,
): (v: unknown, path: string) => Record<string, T> {
  return (v, path) => {
    const o = obj(v, path);
    const out: Record<string, T> = {};
    for (const k of Object.keys(o)) out[k] = inner(o[k], `${path}.${k}`);
    return out;
  };
}

/** Object whose keys must be exactly the given set. */
function exactKeys<K extends string, T>(
  keys: readonly K[],
  inner: (v: unknown, p: string) => T,
): (v: unknown, path: string) => Record<K, T> {
  return (v, path) => {
    const o = obj(v, path);
    const present = Object.keys(o);
    for (const k of keys) if (!present.includes(k)) fail(path, `missing key "${k}"`);
    for (const k of present) {
      if (!(keys as readonly string[]).includes(k)) fail(path, `unexpected key "${k}"`);
    }
    const out = {} as Record<K, T>;
    for (const k of keys) out[k] = inner(o[k], `${path}.${k}`);
    return out;
  };
}

const isoDate = (v: unknown, path: string): string => {
  const s = str(v, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    fail(path, `expected YYYY-MM-DD date, got ${JSON.stringify(s)}`);
  }
  return s;
};

// ---------------------------------------------------------------------
// enumerations shared across files
// ---------------------------------------------------------------------

export const SITES = ['patellar', 'gluteal'] as const satisfies readonly Site[];
export const SLOT_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'] as const satisfies readonly SlotClass[];
export const MESOCYCLE_IDS = ['M1', 'M2', 'M3', 'M4', 'TAPER', 'INTENSIVE'] as const satisfies readonly MesocycleId[];
export const TEMPLATE_IDS = ['M1', 'M2', 'M34', 'TAPER'] as const satisfies readonly TemplateId[];
export const BARBELL_MODES = ['wave', 'band_87_90', 'primer_2x2_90', 'single_1x2_90'] as const satisfies readonly BarbellMode[];
export const CUT_GROUPS = ['prehab', 'pull', 'accessory_hinge_or_single_leg'] as const satisfies readonly CutGroup[];
export const LIFT_IDS = ['front_squat', 'deadlift'] as const satisfies readonly LiftId[];
export const POSITIONS = [1, 2, 3] as const satisfies readonly Position[];

const site = oneOf(SITES);
const slotClass = oneOf(SLOT_CLASSES);
const mesocycleId = oneOf(MESOCYCLE_IDS);
const templateId = oneOf(TEMPLATE_IDS);
const barbellMode = oneOf(BARBELL_MODES);
const cutGroup = oneOf(CUT_GROUPS);
const position = oneOf(POSITIONS);

// ---------------------------------------------------------------------
// initial_state_v1.json
// ---------------------------------------------------------------------

function liftState(v: unknown, path: string): LiftState {
  const o = obj(v, path);
  const ls: LiftState = {
    tm: req(o, 'tm', path, num),
    beta: req(o, 'beta', path, exactKeys(['2', '3'] as const, (b, p) => nullable(b, p, num))),
    next_position: req(o, 'next_position', path, position),
    sessions_logged: req(o, 'sessions_logged', path, int),
    neg_streak: req(o, 'neg_streak', path, int),
    single_scheduled: req(o, 'single_scheduled', path, bool),
  };
  const lastLogged = optional(o, 'last_logged', path, isoDate);
  if (lastLogged !== undefined) ls.last_logged = lastLogged;
  const lastMeso = optional(o, 'last_mesocycle', path, mesocycleId);
  if (lastMeso !== undefined) ls.last_mesocycle = lastMeso;
  const band = optional(o, 'band', path, (x, p) => {
    const b = obj(x, p);
    return {
      pct: req(b, 'pct', p, oneOf([0.87, 0.9] as const)),
      high_rir_streak: req(b, 'high_rir_streak', p, int),
    };
  });
  if (band !== undefined) ls.band = band;
  const ff = optional(o, 'forced_failures', path, int);
  if (ff !== undefined) ls.forced_failures = ff;
  return ls;
}

function accessoryState(v: unknown, path: string): AccessoryState {
  const o = obj(v, path);
  const a: AccessoryState = {
    load: req(o, 'load', path, (x, p) => nullable(x, p, num)),
    streak_up: req(o, 'streak_up', path, int),
    streak_down: req(o, 'streak_down', path, int),
  };
  const pending = optional(o, 'pending', path, oneOf(['up', 'down'] as const));
  if (pending !== undefined) a.pending = pending;
  return a;
}

function overrideRecord(v: unknown, path: string): OverrideRecord {
  const o = obj(v, path);
  const kind = req(o, 'kind', path, oneOf(['tm', 'load'] as const));
  const date = req(o, 'date', path, isoDate);
  const from = req(o, 'from', path, num);
  const to = req(o, 'to', path, num);
  const note = optional(o, 'note', path, str);
  const rec: OverrideRecord =
    kind === 'tm'
      ? { kind, date, lift: req(o, 'lift', path, oneOf(LIFT_IDS)), from, to }
      : { kind, date, slot: req(o, 'slot', path, str), from, to };
  if (note !== undefined) rec.note = note;
  return rec;
}

const flareSite = (v: unknown, path: string): FlareSiteState => nullable(v, path, obj);

export function parseState(input: unknown, path = 'state'): State {
  const o = obj(input, path);
  const overrides = optional(o, 'overrides', path, listOf(overrideRecord));
  const state: State = {
    schema: req(o, 'schema', path, oneOf([1] as const)),
    as_of: req(o, 'as_of', path, isoDate),
    lifts: req(o, 'lifts', path, exactKeys(LIFT_IDS, liftState)),
    rdl: req(o, 'rdl', path, (v, p) => {
      const r = obj(v, p);
      return { load_kg: req(r, 'load_kg', p, num), sessions_logged: req(r, 'sessions_logged', p, int) };
    }),
    accessories: req(o, 'accessories', path, mapOf(accessoryState)),
    depth_jump: req(o, 'depth_jump', path, (v, p) => {
      const d = obj(v, p);
      const dj: State['depth_jump'] = { height_cm: req(d, 'height_cm', p, (x, q) => nullable(x, q, num)) };
      const due = optional(d, 'ladder_due', p, bool);
      if (due !== undefined) dj.ladder_due = due;
      return dj;
    }),
    trap_bar_jump: req(o, 'trap_bar_jump', path, (v, p) => {
      const t = obj(v, p);
      const out: State['trap_bar_jump'] = { load_kg: req(t, 'load_kg', p, num) };
      const heights = optional(t, 'heights', p, listOf(num));
      if (heights !== undefined) out.heights = heights;
      return out;
    }),
    cmj: req(o, 'cmj', path, (v, p) => {
      const c = obj(v, p);
      const out: State['cmj'] = { series: req(c, 'series', p, listOf(num)) };
      if ('baseline' in c) out.baseline = nullable(c.baseline, `${p}.baseline`, num);
      return out;
    }),
    log: req(o, 'log', path, arr),
  };
  const flare = optional(o, 'flare', path, exactKeys(SITES, flareSite));
  if (flare !== undefined) state.flare = flare;
  const precuts = optional(o, 'pending_precuts', path, arr);
  if (precuts !== undefined) state.pending_precuts = precuts;
  if (overrides !== undefined) state.overrides = overrides;
  return state;
}

// ---------------------------------------------------------------------
// programme_config_v1.json
// ---------------------------------------------------------------------

function mesocycle(v: unknown, path: string): Mesocycle {
  const o = obj(v, path);
  return {
    id: req(o, 'id', path, mesocycleId),
    weeks: req(o, 'weeks', path, pair(int)),
    start: req(o, 'start', path, isoDate),
    end: req(o, 'end', path, isoDate),
    template: req(o, 'template', path, (x, p) => nullable(x, p, templateId)),
    barbell_mode: req(o, 'barbell_mode', path, (x, p) => nullable(x, p, barbellMode)),
  };
}

function wavePosition(v: unknown, path: string): WavePosition {
  const o = obj(v, path);
  const out: WavePosition = {
    reps: req(o, 'reps', path, int),
    pct: req(o, 'pct', path, num),
    amrap: req(o, 'amrap', path, bool),
  };
  const par = optional(o, 'par', path, int);
  if (par !== undefined) out.par = par;
  return out;
}

function wave(v: unknown, path: string): WaveConfig {
  const o = obj(v, path);
  return {
    positions: req(o, 'positions', path, exactKeys(['1', '2', '3'] as const, wavePosition)),
    sets: req(o, 'sets', path, int),
    rir_cap: req(o, 'rir_cap', path, int),
    ramp: req(o, 'ramp', path, listOf(pair(num))),
  };
}

function contactSpec(v: unknown, path: string): ContactSpec {
  if (typeof v === 'number') return num(v, path);
  if (Array.isArray(v)) return pair(int)(v, path);
  return mapOf(int)(v, path);
}

function contacts(v: unknown, path: string): Contacts {
  if (typeof v === 'number') return num(v, path);
  const o = obj(v, path);
  const out: Partial<Record<MesocycleId, ContactSpec>> = {};
  for (const k of Object.keys(o)) {
    const id = mesocycleId(k, `${path}.${k}`);
    out[id] = contactSpec(o[k], `${path}.${k}`);
  }
  return out;
}

function rdlTableRow(v: unknown, path: string): RdlTableRow {
  const a = arr(v, path);
  if (a.length !== 2 && a.length !== 3) fail(path, `expected [reps, delta] or [reps, delta, note]`);
  const reps = int(a[0], `${path}[0]`);
  const delta = num(a[1], `${path}[1]`);
  return a.length === 3 ? [reps, delta, str(a[2], `${path}[2]`)] : [reps, delta];
}

function slot(v: unknown, path: string, expectedId: string): Slot {
  const o = obj(v, path);
  const s: Slot = {
    id: req(o, 'id', path, str),
    name: req(o, 'name', path, str),
    cls: req(o, 'cls', path, slotClass),
  };
  if (s.id !== expectedId) fail(`${path}.id`, `slot key "${expectedId}" does not match id "${s.id}"`);

  // Optional fields: assign only when present so the object matches the file.
  const opt = <K extends keyof Slot>(key: K, inner: (v: unknown, p: string) => NonNullable<Slot[K]>) => {
    const val = optional(o, key, path, inner);
    if (val !== undefined) s[key] = val;
  };
  opt('sites', listOf(site));
  opt('group', cutGroup);
  opt('alt', str);
  opt('swap', str);
  opt('progress', str);
  opt('regression', str);
  opt('never_zero', bool);
  opt('when', str);
  opt('note', str);
  opt('tm_seed', num);
  opt('cal_cap', num);
  opt('reps', int);
  opt('rir_cap', int);
  opt('up_at', int);
  opt('down_below', int);
  opt('streak', int);
  opt('increment', str);
  opt('start_hint_kg', num);
  opt('start_kg', num);
  opt('rep_range', pair(int));
  opt('table', listOf(rdlTableRow));
  opt('band_pct_fs_tm', pair(num));
  opt('ceiling_pct_est_1rm', num);
  opt('increment_kg', num);
  opt('start_pct_dl_tm', num);
  opt('contacts', contacts);
  opt('landings', pair(int));

  // Class A is the one class where the file is uniform enough to require fields.
  if (s.cls === 'A') {
    if (s.tm_seed === undefined) fail(path, 'class A slot needs tm_seed');
    if (s.cal_cap === undefined) fail(path, 'class A slot needs cal_cap');
  }

  const known = new Set<string>([
    'id', 'name', 'cls', 'sites', 'group', 'alt', 'swap', 'progress', 'regression', 'never_zero',
    'when', 'note', 'tm_seed', 'cal_cap', 'reps', 'rir_cap',
    'up_at', 'down_below', 'streak', 'increment', 'start_hint_kg', 'start_kg', 'rep_range', 'table',
    'band_pct_fs_tm', 'ceiling_pct_est_1rm', 'increment_kg', 'start_pct_dl_tm', 'contacts', 'landings',
  ]);
  for (const k of Object.keys(o)) if (!known.has(k)) fail(`${path}.${k}`, 'unknown slot field');
  return s;
}

function slotItem(v: unknown, path: string): SlotItem {
  const o = obj(v, path);
  const item: SlotItem = { slot: req(o, 'slot', path, str) };
  const opt = <K extends keyof SlotItem>(key: K, inner: (v: unknown, p: string) => NonNullable<SlotItem[K]>) => {
    const val = optional(o, key, path, inner);
    if (val !== undefined) item[key] = val;
  };
  opt('sets', int);
  opt('reps', int);
  opt('secs', int);
  opt('per_side', bool);
  opt('mode', barbellMode);
  opt('variant', str);
  opt('inside_rest', bool);
  opt('until_week', int);
  opt('contacts', int);
  opt('day', oneOf([1, 2] as const));
  const known = new Set(['slot', 'sets', 'reps', 'secs', 'per_side', 'mode', 'variant', 'inside_rest', 'until_week', 'contacts', 'day']);
  for (const k of Object.keys(o)) if (!known.has(k)) fail(`${path}.${k}`, 'unknown template item field');
  return item;
}

const templateItem = (v: unknown, path: string): TemplateItem =>
  typeof v === 'string' ? v : slotItem(v, path);

function templateBlock(v: unknown, path: string): TemplateBlock {
  const o = obj(v, path);
  const b: TemplateBlock = { items: req(o, 'items', path, listOf(templateItem)) };
  const min = optional(o, 'min', path, num);
  if (min !== undefined) b.min = min;
  const superset = optional(o, 'superset', path, bool);
  if (superset !== undefined) b.superset = superset;
  const contrast = optional(o, 'contrast', path, bool);
  if (contrast !== undefined) b.contrast = contrast;
  const rounds = optional(o, 'rounds', path, (x, p) => (typeof x === 'number' ? int(x, p) : pair(int)(x, p)));
  if (rounds !== undefined) b.rounds = rounds;
  return b;
}

function sessionTemplate(v: unknown, path: string): SessionTemplate {
  const o = obj(v, path);
  const t: SessionTemplate = {
    target_min: req(o, 'target_min', path, num),
    blocks: req(o, 'blocks', path, listOf(templateBlock)),
  };
  const pre = optional(o, 'pre', path, listOf(str));
  if (pre !== undefined) t.pre = pre;
  return t;
}

function template(v: unknown, path: string): Template {
  const o = obj(v, path);
  const hasDays = 'day1' in o || 'day2' in o;
  const hasBoth = 'both_days' in o;
  if (hasDays && hasBoth) fail(path, 'template has both day1/day2 and both_days');
  if (hasBoth) return { both_days: req(o, 'both_days', path, sessionTemplate) };
  return {
    day1: req(o, 'day1', path, sessionTemplate),
    day2: req(o, 'day2', path, sessionTemplate),
  };
}

export function parseProgrammeConfig(input: unknown, path = 'config'): ProgrammeConfig {
  const o = obj(input, path);
  const cfg: ProgrammeConfig = {
    version: req(o, 'version', path, str),
    date: req(o, 'date', path, isoDate),
    governs: req(o, 'governs', path, str),
    budget_min: req(o, 'budget_min', path, exactKeys(['normal', 'audit'] as const, num)),
    equipment: req(o, 'equipment', path, (v, p) => {
      const e = obj(v, p);
      return {
        barbell_round_kg: req(e, 'barbell_round_kg', p, num),
        trap_bar_kg: req(e, 'trap_bar_kg', p, num),
        trap_bar_kg_confirmed: req(e, 'trap_bar_kg_confirmed', p, bool),
        db_min_kg: req(e, 'db_min_kg', p, num),
        db_max_kg: req(e, 'db_max_kg', p, num),
        db_step_kg: req(e, 'db_step_kg', p, num),
      };
    }),
    instruments: req(o, 'instruments', path, mapOf(str)),
    athlete: req(o, 'athlete', path, exactKeys(['body_mass_kg'] as const, num)),
    mesocycles: req(o, 'mesocycles', path, listOf(mesocycle)),
    boundary_singles_on_entering: req(o, 'boundary_singles_on_entering', path, listOf(mesocycleId)),
    freeze: req(
      o,
      'freeze',
      path,
      exactKeys(['no_upward_steps_after_week', 'depth_jump_height_frozen_after_week'] as const, int),
    ),
    wave: req(o, 'wave', path, wave),
    slots: req(o, 'slots', path, (v, p) => {
      const s = obj(v, p);
      const out: Record<string, Slot> = {};
      for (const k of Object.keys(s)) out[k] = slot(s[k], `${p}.${k}`, k);
      return out;
    }),
    templates: req(o, 'templates', path, exactKeys(TEMPLATE_IDS, template)),
  };
  const scopeNote = optional(o, 'scope_note', path, str);
  if (scopeNote !== undefined) cfg.scope_note = scopeNote;

  // Referential checks inside the config file.
  for (const [i, m] of cfg.mesocycles.entries()) {
    if (m.template !== null && !(m.template in cfg.templates)) {
      fail(`${path}.mesocycles[${i}].template`, `unknown template "${m.template}"`);
    }
  }
  const mesoIds = new Set(cfg.mesocycles.map((m) => m.id));
  for (const [i, id] of cfg.boundary_singles_on_entering.entries()) {
    if (!mesoIds.has(id)) fail(`${path}.boundary_singles_on_entering[${i}]`, `unknown mesocycle "${id}"`);
  }
  for (const [tid, t] of Object.entries(cfg.templates)) {
    const sessions: [string, SessionTemplate][] = t.both_days
      ? [['both_days', t.both_days]]
      : [['day1', t.day1], ['day2', t.day2]];
    for (const [day, sess] of sessions) {
      sess.blocks.forEach((b, bi) => {
        b.items.forEach((it, ii) => {
          if (typeof it !== 'string' && !(it.slot in cfg.slots)) {
            fail(`${path}.templates.${tid}.${day}.blocks[${bi}].items[${ii}].slot`, `unknown slot "${it.slot}"`);
          }
        });
      });
    }
  }
  return cfg;
}

// ---------------------------------------------------------------------
// engine_test_vectors_v1.json
// ---------------------------------------------------------------------

function barbellInput(v: unknown, path: string): BarbellVectorInput {
  const o = obj(v, path);
  const out: BarbellVectorInput = {
    tm: req(o, 'tm', path, num),
    pos: req(o, 'pos', path, position),
    load: req(o, 'load', path, num),
    presc: req(o, 'presc', path, int),
    reps: req(o, 'reps', path, int),
    rir: req(o, 'rir', path, int),
  };
  const calibrating = optional(o, 'calibrating', path, bool);
  if (calibrating !== undefined) out.calibrating = calibrating;
  const calCap = optional(o, 'cal_cap', path, num);
  if (calCap !== undefined) out.cal_cap = calCap;
  const beta = optional(o, 'beta', path, num);
  if (beta !== undefined) out.beta = beta;
  const missed = optional(o, 'missed', path, bool);
  if (missed !== undefined) out.missed = missed;
  return out;
}

function barbellExpect(v: unknown, path: string): BarbellVectorExpect {
  const o = obj(v, path);
  const out: BarbellVectorExpect = {
    rule: req(o, 'rule', path, oneOf(['calibration', 'failure', 'position1', 'matched', 'biggap'] as const)),
    tm: req(o, 'tm', path, num),
    beta: req(o, 'beta', path, (x, p) => nullable(x, p, num)),
    single: req(o, 'single', path, bool),
  };
  for (const k of ['E', 'T', 'gap', 'step'] as const) {
    const val = optional(o, k, path, num);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

function barbellVector(v: unknown, path: string): BarbellVector {
  const o = obj(v, path);
  const out: BarbellVector = {
    name: req(o, 'name', path, str),
    input: req(o, 'input', path, barbellInput),
    expect: req(o, 'expect', path, barbellExpect),
    next_loads: req(o, 'next_loads', path, exactKeys(['1', '2', '3'] as const, num)),
  };
  if ('next_pos3_load' in o) out.next_pos3_load = nullable(o.next_pos3_load, `${path}.next_pos3_load`, num);
  return out;
}

const roundingVector = (v: unknown, path: string): RoundingVector => {
  const o = obj(v, path);
  return { raw: req(o, 'raw', path, num), expect: req(o, 'expect', path, num) };
};

const betas = exactKeys(['2', '3'] as const, num);

function auditRescale(v: unknown, path: string): AuditRescaleVector {
  const o = obj(v, path);
  return {
    tm_before: req(o, 'tm_before', path, num),
    single: req(o, 'single', path, num),
    betas_before: req(o, 'betas_before', path, betas),
    expect: req(o, 'expect', path, (x, p) => {
      const e = obj(x, p);
      return { tm: req(e, 'tm', p, num), betas: req(e, 'betas', p, betas) };
    }),
  };
}

const downwardTrigger = (v: unknown, path: string): DownwardTriggerVector => {
  const o = obj(v, path);
  return {
    cases: req(
      o,
      'cases',
      path,
      listOf((x, p) => {
        const c = obj(x, p);
        const out: DownwardTriggerVector['cases'][number] = { name: req(c, 'name', p, str), expect: req(c, 'expect', p, str) };
        const seq = optional(c, 'sequence', p, str);
        if (seq !== undefined) out.sequence = seq;
        return out;
      }),
    ),
  };
};

const rdlVector = (v: unknown, path: string): RdlVector => {
  const o = obj(v, path);
  return {
    session: req(o, 'session', path, int),
    reps: req(o, 'reps', path, int),
    expect_delta: req(o, 'expect_delta', path, num),
  };
};

function accessoryVector(v: unknown, path: string): AccessoryVector {
  const o = obj(v, path);
  const out: AccessoryVector = {
    slot: req(o, 'slot', path, str),
    history_last_set_reps: req(o, 'history_last_set_reps', path, listOf(int)),
    expect: req(o, 'expect', path, str),
  };
  const week = optional(o, 'programme_week', path, int);
  if (week !== undefined) out.programme_week = week;
  return out;
}

function singlesVector(v: unknown, path: string): SinglesVector {
  const o = obj(v, path);
  return {
    boundary: req(o, 'boundary', path, (x, p) => {
      const b = obj(x, p);
      return {
        fires_on_entering: req(b, 'fires_on_entering', p, listOf(mesocycleId)),
        never: req(b, 'never', p, listOf(str)),
        skippable: req(b, 'skippable', p, bool),
      };
    }),
    single_day_work_sets: req(o, 'single_day_work_sets', path, (x, p) => {
      const s = obj(x, p);
      return {
        input: req(s, 'input', p, (y, q) => {
          const i = obj(y, q);
          return {
            tm_before: req(i, 'tm_before', q, num),
            single: req(i, 'single', q, num),
            pos: req(i, 'pos', q, position),
            work_last_set: req(i, 'work_last_set', q, (z, r) => {
              const w = obj(z, r);
              return { load: req(w, 'load', r, num), reps: req(w, 'reps', r, int), rir: req(w, 'rir', r, int) };
            }),
          };
        }),
        expect: req(s, 'expect', p, (y, q) => {
          const e = obj(y, q);
          return { tm: req(e, 'tm', q, num), rule_for_work_sets: req(e, 'rule_for_work_sets', q, str) };
        }),
      };
    }),
    big_gap: req(o, 'big_gap', path, str),
  };
}

function overrideVector(v: unknown, path: string): OverrideVector {
  const o = obj(v, path);
  const name = req(o, 'name', path, oneOf(['load_override', 'tm_override'] as const));
  if (name === 'load_override') {
    return {
      name,
      prescribed_load: req(o, 'prescribed_load', path, num),
      athlete_changes_to: req(o, 'athlete_changes_to', path, num),
      log: req(o, 'log', path, (x, p) => {
        const l = obj(x, p);
        return { load: req(l, 'load', p, num), reps: req(l, 'reps', p, int), rir: req(l, 'rir', p, int) };
      }),
      expect: req(o, 'expect', path, str),
    };
  }
  return {
    name,
    lift: req(o, 'lift', path, oneOf(LIFT_IDS)),
    tm_before: req(o, 'tm_before', path, num),
    athlete_sets: req(o, 'athlete_sets', path, num),
    expect: req(o, 'expect', path, (x, p) => {
      const e = obj(x, p);
      return {
        tm: req(e, 'tm', p, num),
        betas: req(e, 'betas', p, str),
        next_loads: req(e, 'next_loads', p, exactKeys(['1', '2', '3'] as const, num)),
        export: req(e, 'export', p, str),
      };
    }),
  };
}

export function parseTestVectors(input: unknown, path = 'vectors'): TestVectors {
  const o = obj(input, path);
  return {
    version: req(o, 'version', path, str),
    date: req(o, 'date', path, isoDate),
    spec: req(o, 'spec', path, str),
    tolerance: req(o, 'tolerance', path, exactKeys(['tm', 'beta', 'load'] as const, num)),
    notes: req(o, 'notes', path, str),
    barbell: req(o, 'barbell', path, listOf(barbellVector)),
    rounding: req(o, 'rounding', path, listOf(roundingVector)),
    audit_rescale: req(o, 'audit_rescale', path, auditRescale),
    downward_trigger: req(o, 'downward_trigger', path, downwardTrigger),
    rdl: req(o, 'rdl', path, listOf(rdlVector)),
    accessory: req(o, 'accessory', path, listOf(accessoryVector)),
    golden_sessions: req(o, 'golden_sessions', path, str),
    singles: req(o, 'singles', path, singlesVector),
    override: req(o, 'override', path, listOf(overrideVector)),
  };
}

// ---------------------------------------------------------------------
// cross-file checks
// ---------------------------------------------------------------------

/**
 * Checks that hold between the state and the config. Vectors are not
 * cross-checked against the config: their accessory slot ids differ
 * from the config's (see SPEC_QUESTIONS.md Q1) and that is a phase 2
 * ruling, not a loader failure.
 */
export function crossCheck(state: State, config: ProgrammeConfig): void {
  for (const id of LIFT_IDS) {
    const s = config.slots[id];
    if (!s) fail(`config.slots.${id}`, 'lift missing from config slots');
    if (s.cls !== 'A') fail(`config.slots.${id}.cls`, `lift must be class A, got ${s.cls}`);
  }
  for (const id of Object.keys(state.accessories)) {
    if (!(id in config.slots)) fail(`state.accessories.${id}`, 'accessory not in config slots');
  }
  if (state.trap_bar_jump.load_kg !== config.equipment.trap_bar_kg) {
    fail('state.trap_bar_jump.load_kg', `differs from config.equipment.trap_bar_kg (${config.equipment.trap_bar_kg})`);
  }
}
