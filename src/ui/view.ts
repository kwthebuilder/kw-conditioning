/**
 * The screens (ui_spec_v1_0.md). Four modes decided by the date: live
 * (today's session), record (a past date, read-only), edit (corrections,
 * previewed before saving) and preview (a future date).
 *
 * Builds DOM only. Every change goes back through ctx: live logging
 * through update(), corrections through amend() (engine A.23, A.28).
 */
import type { BarbellMode, IsoDate, LiftId, Position, ProgrammeConfig, State } from '../config/types';
import { isCarrySlot, mesocycleOn, planSnapshot, programmeWeek, slotOfLog } from '../engine';
import type {
  AnyLog,
  CorrectionAction,
  PlanItem,
  RampSet,
  ReplayStep,
  Session,
  SessionBlock,
  SessionDay,
  SessionResult,
  SessionSlotItem,
  SingleReason,
  SkipReason,
} from '../engine';
import type { SyncSettings } from '../storage/sync';
import { DEFAULT_OWNER, DEFAULT_REPO } from './backup';
import { calculator, checkbox, choices, h, stepper, type Child } from './dom';
import {
  BLOCK_LABEL,
  contextFor,
  didText,
  displayName,
  kg,
  lastLogged,
  leftText,
  loadStep,
  nextFor,
  outcomeLine,
  plannedText,
  POSITION_LABEL,
  POSITION_PCT,
  prettyDate,
  recordFor,
  SKIP_LABEL,
  type History,
  type RecordRow,
  type RecordView,
} from './model';

// ---------------------------------------------------------------------
// app state shared with main.ts
// ---------------------------------------------------------------------

export type Mode = 'live' | 'record' | 'edit' | 'preview';

/** Values typed into one item's form; kept across renders (ui_spec §5.7). */
export interface FormValues {
  load?: number | null;
  reps?: number | null;
  rir?: number | null;
  missed?: boolean;
  tempo?: boolean;
  value?: number | null;
  sets?: number | null;
  cut?: boolean;
  single?: number | null;
}

/** One pending change in edit mode, per item. */
export interface Draft {
  slot: string;
  actions: CorrectionAction[];
  /** What the item will read as once saved. */
  after: AnyLog | null;
}

export type Sheet =
  | { kind: 'preview'; changes: string[]; effects: string[]; error?: string }
  | { kind: 'tm'; lift: LiftId };

export interface App {
  state: State;
  /** The date on screen. */
  date: IsoDate;
  /** Chosen day for the date, while nothing is logged on it. */
  day?: SessionDay;
  /** Today's date, or an open session's date (ui_spec §9). */
  live: IsoDate;
  /** The phone's local date. */
  today: IsoDate;
  editing: { date: IsoDate; day?: SessionDay; drafts: Draft[] } | null;
  /** Keys of expanded explanations and open forms. */
  open: Set<string>;
  forms: Map<string, FormValues>;
  /** Key of the item whose skip reasons are showing. */
  skipOpen: string | null;
  /** Key of the item asking "0 reps?" */
  zeroAsk: string | null;
  /** Inline validation message per item key. */
  errors: Map<string, string>;
  sheet: Sheet | null;
  offlineReady: boolean;
  banner: string | null;
  showExport: boolean;
  lastExport: string | null;
  backup: { settings: SyncSettings | null; status: string };
}

export interface Ctx {
  config: ProgrammeConfig;
  base: State;
  history: History;
  mode: Mode;
  /** The live or preview session for the date (undefined in record and edit). */
  session?: SessionResult;
  record?: RecordView;
  setDate: (date: string) => void;
  setDay: (day: SessionDay) => void;
  rerender: () => void;
  logLive: (logs: AnyLog[], label: string) => void;
  previewCorrection: (on: IsoDate, actions: CorrectionAction[]) => void;
  saveCorrection: (note: string) => void;
  closeSheet: () => void;
  startEdit: () => void;
  cancelEdit: () => void;
  setDraft: (draft: Draft) => void;
  dropDraft: (slot: string) => void;
  reviewEdit: () => void;
  openTm: (lift: LiftId) => void;
  saveTm: (lift: LiftId, tm: number, note: string) => void;
  finish: () => void;
  openExport: () => void;
  closeExport: () => void;
  exportNow: () => void;
  importFile: (file: File) => void;
  saveBackup: (settings: SyncSettings) => void;
  backupNow: () => void;
  restoreFromGitHub: () => void;
  forgetBackup: () => void;
}

// ---------------------------------------------------------------------
// item specs: what an item's form needs, from a live prescription or a saved plan
// ---------------------------------------------------------------------

type SpecType = 'barbell' | 'rdl' | 'slot' | 'fixed' | 'explosive' | 'cmj';

interface Spec {
  slot: string;
  type: SpecType;
  date: IsoDate;
  load: number | null;
  sets?: number;
  sets_max?: number;
  reps?: number;
  rep_range?: [number, number];
  secs?: number;
  per_side?: boolean;
  contacts?: number;
  variant?: string;
  landings?: [number, number];
  inside_rest?: boolean;
  // barbell
  mode?: BarbellMode;
  position?: Position;
  pct?: number;
  amrap?: boolean;
  par?: number;
  ramp?: RampSet[];
  single?: { reason: SingleReason };
  singleTaken?: boolean;
  forced?: boolean;
  refer?: string;
  // progression
  rirCap?: number;
  tempo?: boolean;
  hint?: number;
  pending?: 'up' | 'down';
  incText?: string;
  // explosive
  streakNote?: string;
}

const LIFT_IDS = new Set(['front_squat', 'deadlift']);
const PER_HAND = new Set(['db_pp_strength', 'bss', 'db_pp_explosive']);

function specFromLive(item: SessionSlotItem, date: IsoDate, config: ProgrammeConfig): Spec {
  const p = item.prescription;
  const t = item.template;
  const base: Spec = { slot: item.slot, type: 'fixed', date, load: null };
  if (t.per_side) base.per_side = true;
  if (t.secs !== undefined) base.secs = t.secs;
  if (t.variant !== undefined) base.variant = t.variant;
  if (t.inside_rest) base.inside_rest = true;
  const landings = config.slots[item.slot]?.landings;
  if (landings) base.landings = [landings[0], landings[1]];
  switch (p.kind) {
    case 'refer':
      return { ...base, type: 'barbell', refer: p.reason };
    case 'lift': {
      const s: Spec = { ...base, type: 'barbell', load: p.load, sets: p.sets, reps: p.reps, mode: p.mode, pct: p.pct, amrap: p.amrap, ramp: p.ramp };
      if (p.sets_max !== undefined) s.sets_max = p.sets_max;
      if (p.position !== undefined) s.position = p.position;
      if (p.par !== undefined) s.par = p.par;
      if (p.single_suggested) {
        s.single = { reason: p.single_suggested.reason };
        s.singleTaken = p.single_suggested.taken;
      }
      if (p.notes.some((n) => n.startsWith('Downward trigger'))) s.forced = true;
      return s;
    }
    case 'rdl':
      return { ...base, type: 'rdl', load: p.load, sets: t.sets ?? 3, rep_range: [p.rep_range[0], p.rep_range[1]], rirCap: p.rir_cap, tempo: true };
    case 'slot': {
      const s: Spec = { ...base, type: 'slot', load: p.load, sets: t.sets ?? 3, reps: p.reps, rirCap: p.rir_cap, tempo: p.cls === 'B' };
      if (t.sets_max !== undefined) s.sets_max = t.sets_max;
      if (p.start_hint_kg !== undefined) s.hint = p.start_hint_kg;
      if (p.pending) {
        s.pending = p.pending;
        s.incText = p.increment.kind === 'kg' ? `${p.increment.kg} kg${p.increment.per_hand ? ' per hand' : ''}` : p.increment.text;
      }
      return s;
    }
    case 'explosive': {
      const s: Spec = { ...base, type: 'explosive', load: p.load, sets: t.sets ?? 3 };
      if (t.sets_max !== undefined) s.sets_max = t.sets_max;
      if (t.reps !== undefined) s.reps = t.reps;
      if (p.load !== null && p.streak_needed !== undefined && p.increment_kg !== undefined) s.streakNote = `${p.clean_streak} of ${p.streak_needed} clean sessions banked; two in a row with no set cut short and it goes up ${p.increment_kg} kg.`;
      else if (p.load !== null) s.streakNote = 'Same weight all block. Log a different weight if you change it.';
      return s;
    }
    case 'fixed': {
      const s: Spec = { ...base, type: 'fixed' };
      if (p.load_kg !== undefined) s.load = p.load_kg;
      if (t.secs !== undefined) s.secs = t.secs;
      if (t.sets !== undefined) s.sets = t.sets;
      if (t.sets_max !== undefined) s.sets_max = t.sets_max;
      if (t.reps !== undefined) s.reps = t.reps;
      if (p.contacts !== undefined) s.contacts = p.contacts;
      return s;
    }
  }
  return base;
}

function specFromPlan(item: PlanItem, date: IsoDate, config: ProgrammeConfig): Spec {
  const s: Spec = { slot: item.slot, type: 'fixed', date, load: item.load ?? null };
  if (item.sets !== undefined) s.sets = item.sets;
  if (item.sets_max !== undefined) s.sets_max = item.sets_max;
  if (item.reps !== undefined) s.reps = item.reps;
  if (item.rep_range) s.rep_range = item.rep_range;
  if (item.secs !== undefined) s.secs = item.secs;
  if (item.per_side) s.per_side = true;
  if (item.contacts !== undefined) s.contacts = item.contacts;
  if (item.variant !== undefined) s.variant = item.variant;
  if (item.landings) s.landings = item.landings;
  if (item.inside_rest) s.inside_rest = true;
  if (item.slot === 'cmj') return { ...s, type: 'cmj' };
  if (LIFT_IDS.has(item.slot)) {
    const mode = mesocycleOn(config, date)?.barbell_mode ?? 'wave';
    const out: Spec = { ...s, type: 'barbell', mode, amrap: item.amrap ?? false };
    if (item.position !== undefined) out.position = item.position;
    if (item.pct !== undefined) out.pct = item.pct;
    return out;
  }
  const slot = config.slots[item.slot];
  if (item.slot === 'rdl') return { ...s, type: 'rdl', rirCap: slot?.rir_cap ?? 2, tempo: true };
  if (slot && (slot.cls === 'B' || slot.cls === 'C')) return { ...s, type: 'slot', rirCap: slot.rir_cap ?? 2, tempo: slot.cls === 'B' };
  if (isCarrySlot(slot)) return { ...s, type: 'explosive' };
  return s;
}

// ---------------------------------------------------------------------
// help text
// ---------------------------------------------------------------------

const REACTIVE = 'reactive strength: bounce height divided by time on the floor; quick and high wins';

const SLOT_HELP: Record<string, string> = {
  rsi_ladder: 'Step off the box, do not jump off. Land and rebound as fast and as high as you can. Three jumps from 20 cm, three from 30 cm, three from 40 cm. The height that feels quickest and springiest wins; then three more jumps from that height.',
  depth_jump: 'Step off the box, do not jump off. Land and rebound as fast and as high as you can, with the least time on the floor. Full rest between jumps.',
  depth_landing: 'Step off a box a little higher than your usual drop height. Land soft, quiet and balanced, and hold it. No rebound.',
  skater_bound: 'Push off one leg sideways, land on the other and stick the landing before the next bound.',
  trap_bar_jump: 'Hold the empty bar, dip and jump as high as you can. Land soft, reset, and go again. Stop the set at the first slower jump.',
  kb_swing: 'Heavy bell. Hinge at the hips and snap it to chest height. Stop the set at the first slower swing.',
  jump_shrug: 'Barbell from the hang. Jump and shrug hard, no pull under. Stop the set at the first slower rep.',
  db_pp_explosive: 'Light dumbbells. Dip and drive them overhead as fast as you can. Stop the set at the first slower rep.',
  landmine_cpp: 'One arm. Clean the bar to the shoulder, then dip and press it overhead in one fast movement. Stop the set at the first slower rep.',
  rdl: 'Bar in the hands, soft knees. Lower for 3 seconds with a flat back until the hamstrings pull, then stand up.',
  hack_squat: 'Lower for 3 seconds on every rep, drive up without pause.',
  abductor_hsr: 'Stand on the working leg with the cable on the other ankle. Move the free leg out slowly, 3 seconds each way.',
  db_pp_strength: 'Hammer grip. Small dip, press both dumbbells overhead, lower under control.',
  pull_up: 'Add weight on a belt. Full hang to chin over the bar, no kicking.',
  landmine_press: 'One arm. Press the end of the bar up and forward, keep the ribs down.',
  cs_row: 'Chest on the bench. Pull the handles to the ribs, pause, lower slowly.',
  bss: 'Back foot on the bench, dumbbells in the hands. Drop straight down until the back knee nearly touches, drive up.',
  nordic: 'Knees down, ankles held. Lower the body forward as slowly as you can, catch with the hands, push back up.',
  abd_iso: 'Lie on your side, top leg straight. Lift it a little and hold still for the time.',
  y_raise: 'Face down on an incline bench, light dumbbells. Raise the arms to a Y, thumbs up, and lower slowly.',
  pallof: 'Cable at chest height, stand side on. Press the handle straight out and hold it there against the pull.',
  spanish_squat_iso: 'Strap behind the knees anchored in front. Sit back into a squat with a vertical shin and hold.',
  oh_carry: 'One dumbbell locked out overhead. Walk tall for the distance, then swap arms.',
  cmj: 'Average of three jumps, before the warm-up.',
};

const WARMUP_NAMES: Record<string, string> = {
  warmup: 'Warm-up',
  warmup_glute_shoulder: 'Warm-up: glutes and shoulders',
};

const RIR_OPTIONS = [0, 1, 2, 3, 4].map((v) => ({ value: v, text: v === 4 ? '4+' : String(v) }));
const LADDER_OPTIONS = [20, 30, 40].map((v) => ({ value: v, text: `${v} cm` }));

function setsText(sets: number | undefined, max?: number): string {
  if (sets === undefined) return '';
  return max !== undefined ? `${sets}–${max} sets` : `${sets} sets`;
}

function rxLine(spec: Spec): HTMLElement {
  const rx = h('div', { class: 'rx' });
  if (spec.load !== null && spec.slot === 'pull_up' && spec.load === 0) rx.append(h('span', { class: 'big' }, 'Bodyweight'));
  else if (spec.load !== null) rx.append(h('span', { class: 'big' }, kg(spec.load)), h('span', { class: 'unit' }, PER_HAND.has(spec.slot) ? 'kg per hand' : 'kg'));
  const side = spec.per_side ? ' each side' : '';
  const setsN = spec.sets !== undefined ? (spec.sets_max !== undefined ? `${spec.sets}–${spec.sets_max}` : `${spec.sets}`) : '';
  if (spec.sets !== undefined && spec.reps !== undefined) rx.append(h('span', { class: 'sets' }, `${setsN} × ${spec.reps}${side}`));
  else if (spec.sets !== undefined && spec.rep_range) rx.append(h('span', { class: 'sets' }, `${setsN} × ${spec.rep_range[0]}–${spec.rep_range[1]}`));
  else if (spec.sets !== undefined && spec.secs !== undefined) rx.append(h('span', { class: 'sets' }, `${spec.sets} × ${spec.secs} s${side}`));
  else if (spec.sets !== undefined) rx.append(h('span', { class: 'sets' }, setsText(spec.sets, spec.sets_max)));
  else if (spec.reps !== undefined) rx.append(h('span', { class: 'sets' }, `${spec.reps} reps${side}`));
  else if (spec.secs !== undefined) rx.append(h('span', { class: 'sets' }, `${spec.secs} s${side}`));
  if (spec.landings) rx.append(h('span', { class: 'sets' }, `${spec.landings[0]}–${spec.landings[1]} landings`));
  if (spec.variant) rx.append(h('span', { class: 'unit' }, spec.variant));
  if (spec.inside_rest) rx.append(h('span', { class: 'unit' }, 'inside the rests'));
  if (spec.contacts !== undefined) rx.append(h('span', { class: 'sets' }, spec.slot === 'rsi_ladder' ? `${spec.contacts} jumps in total` : `${spec.contacts} jumps`));
  if (spec.load === null && (spec.type === 'slot' || spec.type === 'explosive')) rx.append(h('span', { class: 'unit' }, spec.hint !== undefined ? `pick a load, try ${spec.hint} kg` : 'first time: pick a load'));
  if (!rx.childElementCount) rx.append(h('span', { class: 'sets' }, 'As usual'));
  return rx;
}

function instruction(spec: Spec): string {
  const help = SLOT_HELP[spec.slot];
  switch (spec.type) {
    case 'barbell':
      if (spec.amrap) return `Last set: as many clean reps as you can, stop with 2 left.${spec.par !== undefined ? ` About ${spec.par} reps keeps your max where it is; more raises it, fewer lowers it.` : ''}`;
      if (spec.position === 1) return `${spec.sets ?? 3} × ${spec.reps ?? 4} and stop. Light weeks don't change your max.`;
      return 'All sets at the prescribed reps, with 2 or more left in the tank.';
    case 'rdl':
    case 'slot':
      return `${help ? `${help} ` : ''}Last set: as many clean reps as you can, stop with ${spec.rirCap ?? 2} left${spec.tempo ? ', or as soon as the 3-second lowering speeds up' : ''}.`;
    case 'explosive':
      return [help, spec.load === null ? 'Work up in small jumps until a rep slows down. Log the heaviest load that stayed fast; the app keeps it from here.' : spec.streakNote].filter(Boolean).join(' ');
    case 'fixed':
      return [help, spec.slot === 'rsi_ladder' || spec.slot === 'depth_jump' ? `Scored on ${REACTIVE}.` : ''].filter(Boolean).join(' ');
    case 'cmj':
      return help ?? '';
  }
}

// ---------------------------------------------------------------------
// the form for one item: live logging, a change, or an edit-mode draft
// ---------------------------------------------------------------------

interface FormOpts {
  key: string;
  initial?: AnyLog;
  submitLabel: string;
  onSubmit: (logs: AnyLog[]) => void;
  onSkip?: (reason?: SkipReason) => void;
  onRemove?: () => void;
  onCancel?: () => void;
  /** Live only: the test-single callout and "last time". */
  live?: boolean;
}

function valuesFor(app: App, key: string, spec: Spec, initial?: AnyLog): FormValues {
  const existing = app.forms.get(key);
  if (existing) return existing;
  const v: FormValues = {};
  switch (spec.type) {
    case 'barbell':
      if (initial?.kind === 'barbell') Object.assign(v, { load: initial.last_set.load, reps: initial.last_set.reps, rir: initial.last_set.rir, missed: initial.missed });
      else Object.assign(v, { load: spec.load, reps: spec.amrap ? null : (spec.reps ?? null), rir: null, missed: false });
      break;
    case 'rdl':
    case 'slot':
      if (initial && (initial.kind === 'rdl' || initial.kind === 'slot')) Object.assign(v, { load: initial.load, reps: initial.last_set.reps, rir: initial.last_set.rir, tempo: initial.last_set.tempo_break ?? false });
      else Object.assign(v, { load: spec.load ?? spec.hint ?? null, reps: null, rir: null, tempo: false });
      break;
    case 'explosive':
      if (initial?.kind === 'explosive') Object.assign(v, { load: initial.load, sets: initial.sets_done, cut: initial.cut });
      else Object.assign(v, { load: spec.load, sets: spec.sets ?? 3, cut: false });
      break;
    case 'fixed':
      v.value = initial?.kind === 'fixed' ? (initial.value ?? null) : null;
      break;
    case 'cmj':
      v.value = initial?.kind === 'cmj' ? initial.value : null;
      break;
  }
  app.forms.set(key, v);
  return v;
}

function skipRow(app: App, ctx: Ctx, key: string, onSkip: (reason?: SkipReason) => void): HTMLElement | null {
  if (app.skipOpen !== key) return null;
  const reasons: (SkipReason | undefined)[] = ['time', 'tissue', 'equipment', 'fatigue', 'other', undefined];
  return h(
    'div',
    { class: 'skip-reasons' },
    h('span', { class: 'lab' }, 'Why skip? Nothing moves either way.'),
    h('div', { class: 'choices' }, ...reasons.map((r) => h('button', { type: 'button', onclick: () => { app.skipOpen = null; onSkip(r); } }, r ? SKIP_LABEL[r] : 'No reason'))),
    h('button', { type: 'button', class: 'subtle', onclick: () => { app.skipOpen = null; ctx.rerender(); } }, 'Cancel'),
  );
}

function itemForm(app: App, ctx: Ctx, spec: Spec, opts: FormOpts): HTMLElement[] {
  const key = opts.key;
  const v = valuesFor(app, key, spec, opts.initial);
  const err = app.errors.get(key);
  const out: HTMLElement[] = [];
  const fields = h('div', { class: 'fields' });
  const fail = (msg: string) => {
    app.errors.set(key, msg);
    ctx.rerender();
  };
  const done = (logs: AnyLog[]) => {
    app.errors.delete(key);
    app.forms.delete(key);
    app.zeroAsk = null;
    opts.onSubmit(logs);
  };

  let submit: () => void = () => undefined;
  const isChange = opts.initial !== undefined;

  switch (spec.type) {
    case 'barbell': {
      const lift = spec.slot as LiftId;
      fields.append(
        stepper({ label: 'Load', unit: 'kg', value: v.load ?? null, step: 2.5, start: spec.load ?? 0, onChange: (x) => (v.load = x), invalid: err !== undefined && v.load == null }).el,
        stepper({ label: spec.amrap ? 'Reps, last set' : 'Reps per set', value: v.reps ?? null, step: 1, start: spec.reps ?? 1, integer: true, onChange: (x) => (v.reps = x), invalid: err !== undefined && v.reps == null }).el,
        choices({ label: 'Reps left in the tank, last set', options: RIR_OPTIONS, value: v.rir ?? null, onChange: (x) => (v.rir = x), invalid: err !== undefined && v.rir == null }),
        checkbox('An earlier set fell short', v.missed ?? false, (x) => (v.missed = x)),
      );
      submit = () => {
        if (v.load == null) return fail('Enter the load.');
        if (v.reps == null) return fail('Enter the reps.');
        if (v.rir == null) return fail('Choose reps left.');
        if (v.reps === 0 && app.zeroAsk !== key) {
          app.zeroAsk = key;
          return ctx.rerender();
        }
        const init = opts.initial?.kind === 'barbell' ? opts.initial : undefined;
        const planned = init ? (init.override?.from ?? init.prescribed.load) : (spec.load ?? v.load);
        const log: AnyLog = {
          kind: 'barbell',
          lift,
          date: spec.date,
          mode: init?.mode ?? spec.mode ?? 'wave',
          prescribed: { load: v.load, reps: init?.prescribed.reps ?? spec.reps ?? v.reps, sets: init?.prescribed.sets ?? spec.sets ?? 3 },
          last_set: { load: v.load, reps: v.reps, rir: v.rir },
          missed: v.missed ?? false,
        };
        const pos = init?.position ?? spec.position;
        if (pos !== undefined) log.position = pos;
        if (init?.single) log.single = init.single;
        if (v.load !== planned) log.override = { from: planned };
        done([log]);
      };
      break;
    }
    case 'rdl':
    case 'slot': {
      fields.append(
        stepper({ label: 'Load', unit: PER_HAND.has(spec.slot) ? 'kg per hand' : 'kg', value: v.load ?? null, step: loadStep(spec.slot), start: spec.load ?? spec.hint ?? 0, onChange: (x) => (v.load = x), invalid: err !== undefined && v.load == null }).el,
        stepper({ label: 'Reps, last set', value: v.reps ?? null, step: 1, start: spec.reps ?? spec.rep_range?.[0] ?? 1, integer: true, onChange: (x) => (v.reps = x), invalid: err !== undefined && v.reps == null }).el,
        choices({ label: 'Reps left in the tank, last set', options: RIR_OPTIONS, value: v.rir ?? null, onChange: (x) => (v.rir = x), invalid: err !== undefined && v.rir == null }),
      );
      if (spec.tempo) fields.append(checkbox('The 3-second lowering sped up on the last set', v.tempo ?? false, (x) => (v.tempo = x)));
      submit = () => {
        if (v.load == null) return fail('Enter the load.');
        if (v.reps == null) return fail('Enter the reps.');
        if (v.rir == null) return fail('Choose reps left.');
        if (v.reps === 0 && app.zeroAsk !== key) {
          app.zeroAsk = key;
          return ctx.rerender();
        }
        const init = opts.initial && (opts.initial.kind === 'rdl' || opts.initial.kind === 'slot') ? opts.initial : undefined;
        const planned = init ? (init.override?.from ?? init.load) : spec.load;
        const last = { reps: v.reps, rir: v.rir, ...(v.tempo ? { tempo_break: true } : {}) };
        const sets = init?.sets_done ?? spec.sets ?? 3;
        const override = planned !== null && v.load !== planned ? { override: { from: planned } } : {};
        const log: AnyLog =
          spec.type === 'rdl'
            ? { kind: 'rdl', slot: 'rdl', date: spec.date, load: v.load, sets_done: sets, last_set: last, ...override }
            : { kind: 'slot', slot: spec.slot, date: spec.date, load: v.load, sets_done: sets, last_set: last, ...override };
        done([log]);
      };
      break;
    }
    case 'explosive': {
      fields.append(
        stepper({ label: 'Load', unit: spec.slot === 'db_pp_explosive' ? 'kg per hand' : 'kg', value: v.load ?? null, step: loadStep(spec.slot), start: spec.load ?? 0, onChange: (x) => (v.load = x), invalid: err !== undefined && v.load == null }).el,
        stepper({ label: 'Sets done', value: v.sets ?? null, step: 1, start: spec.sets ?? 3, integer: true, onChange: (x) => (v.sets = x), invalid: err !== undefined && v.sets == null }).el,
        checkbox('A rep slowed and I cut a set short', v.cut ?? false, (x) => (v.cut = x)),
      );
      submit = () => {
        if (v.load == null) return fail('Enter the load.');
        if (v.sets == null) return fail('Enter the sets done.');
        done([{ kind: 'explosive', slot: spec.slot, date: spec.date, load: v.load, sets_done: v.sets, cut: v.cut ?? false }]);
      };
      break;
    }
    case 'cmj': {
      const s = stepper({ label: 'Jump height, average of 3', unit: 'cm', value: v.value ?? null, step: 0.5, start: 40, onChange: (x) => (v.value = x), invalid: err !== undefined && v.value == null });
      fields.append(s.el, calculator('height', (x) => { v.value = x; s.input.value = String(x); }));
      submit = () => {
        if (v.value == null) return fail('Enter the jump height.');
        done([{ kind: 'cmj', date: spec.date, value: v.value }]);
      };
      break;
    }
    case 'fixed': {
      if (spec.slot === 'rsi_ladder') {
        fields.append(choices({ label: 'Winning drop height', options: LADDER_OPTIONS, value: (v.value as 20 | 30 | 40 | null) ?? null, onChange: (x) => (v.value = x), invalid: err !== undefined && v.value == null }), calculator('ladder', (x) => { v.value = x; ctx.rerender(); }));
        submit = () => {
          if (v.value == null) return fail('Choose the winning height.');
          done([{ kind: 'fixed', slot: spec.slot, date: spec.date, done: true, value: v.value }, { kind: 'depth_jump_height', date: spec.date, height_cm: v.value }]);
        };
      } else if (spec.slot === 'depth_jump') {
        const s = stepper({ label: 'Reactive strength, optional', value: v.value ?? null, step: 0.05, start: 1.5, onChange: (x) => (v.value = x) });
        fields.append(s.el, calculator('rsi', (x) => { v.value = x; s.input.value = String(x); }));
        submit = () => done([{ kind: 'fixed', slot: spec.slot, date: spec.date, done: true, ...(v.value != null ? { value: v.value } : {}) }]);
      } else {
        submit = () => done([{ kind: 'fixed', slot: spec.slot, date: spec.date, done: true }]);
      }
      break;
    }
  }

  out.push(fields);
  if (err) out.push(h('p', { class: 'err', role: 'alert' }, err));
  if (app.zeroAsk === key) {
    out.push(
      h(
        'div',
        { class: 'callout warn' },
        h('div', {}, h('strong', {}, '0 reps logs a failed set and lowers the load.'), " Didn't do it? Skip instead."),
        h(
          'div',
          { class: 'row' },
          opts.onSkip ? h('button', { type: 'button', onclick: () => { app.zeroAsk = null; app.skipOpen = key; ctx.rerender(); } }, 'Skip instead') : null,
          h('button', { type: 'button', class: 'danger', onclick: () => submit() }, 'Log 0 reps'),
        ),
      ),
    );
  }
  const buttons = h('div', { class: 'row actions' });
  buttons.append(h('button', { type: 'button', class: 'primary', onclick: () => submit() }, opts.submitLabel));
  if (opts.onSkip) buttons.append(h('button', { type: 'button', onclick: () => { app.skipOpen = app.skipOpen === key ? null : key; ctx.rerender(); } }, 'Skip'));
  if (opts.onRemove) buttons.append(h('button', { type: 'button', class: 'subtle danger-text', onclick: opts.onRemove }, 'Remove'));
  if (opts.onCancel) buttons.append(h('button', { type: 'button', class: 'subtle', onclick: () => { app.forms.delete(key); app.errors.delete(key); opts.onCancel!(); } }, 'Cancel'));
  out.push(buttons);
  if (opts.onSkip) {
    const sr = skipRow(app, ctx, key, opts.onSkip);
    if (sr) out.push(sr);
  }
  void isChange;
  return out;
}

// ---------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------

function itemHead(name: string, right?: Child): HTMLElement {
  return h('div', { class: 'title' }, h('h2', {}, name), right ? h('span', { class: 'meta' }, right) : null);
}

function mathsToggle(app: App, ctx: Ctx, key: string, step: ReplayStep): HTMLElement[] {
  const open = app.open.has(key);
  const lines = step.explanation.steps.map((s) => s.text).filter(Boolean);
  if (!lines.length) return [];
  const out: HTMLElement[] = [h('button', { type: 'button', class: 'quiet', onclick: () => { if (open) app.open.delete(key); else app.open.add(key); ctx.rerender(); } }, open ? 'Hide the maths' : 'Show the maths')];
  if (open) out.push(h('ul', { class: 'steps' }, ...lines.map((t) => h('li', {}, t))));
  return out;
}

function correctedTags(step: ReplayStep): HTMLElement[] {
  const tags: HTMLElement[] = [];
  const c = step.item.corrections;
  if (c.length) tags.push(h('span', { class: 'tag' }, `Corrected ${prettyDate(c[c.length - 1]!.date)}`));
  if (step.item.inserted) tags.push(h('span', { class: 'tag' }, `Added ${prettyDate(step.item.inserted.date)}`));
  return tags;
}

function loadTag(log: AnyLog): HTMLElement | null {
  const ov = log.kind === 'barbell' || log.kind === 'rdl' || log.kind === 'slot' ? log.override : undefined;
  if (!ov) return null;
  const did = log.kind === 'barbell' ? log.last_set.load : (log as { load: number }).load;
  const d = did - ov.from;
  if (Math.abs(d) < 1e-9) return null;
  return h('span', { class: 'tag warn' }, `Load ${d > 0 ? 'raised' : 'lowered'} ${kg(Math.abs(d))} kg`);
}

/** A logged item in live mode: one line of what was done and what it changed. */
function doneItem(app: App, ctx: Ctx, name: string, step: ReplayStep, key: string, onChange: () => void): HTMLElement {
  const log = step.item.log;
  const skipped = log.kind === 'skip' || (log.kind === 'fixed' && !log.done);
  const line = outcomeLine(step, ctx.config);
  return h(
    'div',
    { class: `item done-item${skipped ? ' skipped' : ''}` },
    itemHead(name, h('span', { class: skipped ? 'status skip' : 'status ok' }, skipped ? 'Skipped' : 'Done')),
    h('p', { class: 'did' }, didText(log, ctx.config)),
    line ? h('p', { class: 'outcome' }, line) : null,
    h('div', { class: 'tags' }, loadTag(log), ...correctedTags(step)),
    h('div', { class: 'row tight' }, h('button', { type: 'button', class: 'quiet', onclick: onChange }, 'Change'), ...mathsToggle(app, ctx, `maths|${key}`, step)),
  );
}

const ROW_KINDS = new Set(['barbell', 'rdl', 'slot', 'fixed', 'explosive', 'skip', 'cmj']);

function stepsFor(ctx: Ctx, date: IsoDate, slot: string): ReplayStep[] {
  return (ctx.history.byDate.get(date) ?? []).filter((s) => ROW_KINDS.has(s.item.log.kind) && slotOfLog(s.item.log) === slot);
}

/** Actions to replace an existing item with new logs (the first replaces, the rest are added). */
function replaceActions(step: ReplayStep, logs: AnyLog[]): CorrectionAction[] {
  const [first, ...rest] = logs;
  const out: CorrectionAction[] = [{ op: 'replace', target: step.item.origin, entry: first! }];
  for (const l of rest) out.push({ op: 'insert', entry: l });
  return out;
}

// ---------------------------------------------------------------------
// live mode
// ---------------------------------------------------------------------

function singleCallout(app: App, ctx: Ctx, spec: Spec): HTMLElement | null {
  if (!spec.single || spec.singleTaken) return null;
  const lift = spec.slot as LiftId;
  const key = `single|${spec.date}|${lift}`;
  const v = app.forms.get(key) ?? {};
  app.forms.set(key, v);
  const why = spec.single.reason === 'boundary' ? 'a new block starts' : 'your last session disagreed with the training max';
  return h(
    'div',
    { class: 'callout warn' },
    h('div', {}, h('strong', {}, 'Test single suggested'), ` because ${why}. Work up to one clean rep with 2 left, log it, and today's sets are recomputed from it. Or skip it.`),
    h(
      'div',
      { class: 'fields' },
      stepper({ label: 'Single', unit: 'kg', value: v.single ?? null, step: 2.5, start: spec.load ?? 0, onChange: (x) => (v.single = x) }).el,
    ),
    h(
      'div',
      { class: 'row actions' },
      h('button', { type: 'button', class: 'primary', onclick: () => {
        if (v.single == null) {
          app.errors.set(key, 'Enter the single.');
          return ctx.rerender();
        }
        app.forms.delete(key);
        ctx.logLive([{ kind: 'single', lift, date: spec.date, load: v.single, rir: 2 }], `${displayName(lift, ctx.config)} test single`);
      } }, 'Log single'),
      h('button', { type: 'button', onclick: () => ctx.logLive([{ kind: 'single_skipped', date: spec.date, lift }], 'Test single skipped') }, 'Skip single'),
    ),
    app.errors.get(key) ? h('p', { class: 'err' }, app.errors.get(key)!) : null,
  );
}

function liveItem(app: App, ctx: Ctx, item: SessionSlotItem): HTMLElement {
  const date = app.date;
  const name = displayName(item.slot, ctx.config);
  const key = `live|${date}|${item.slot}`;
  const changeKey = `change|${date}|${item.slot}`;
  const spec = specFromLive(item, date, ctx.config);
  const mine = stepsFor(ctx, date, item.slot);
  const last = mine[mine.length - 1];

  if (last && !app.open.has(changeKey)) {
    return doneItem(app, ctx, name, last, key, () => {
      app.open.add(changeKey);
      ctx.rerender();
    });
  }
  if (last) {
    const box = h('div', { class: 'item editing' }, itemHead(name, 'Changing what you logged'));
    box.append(
      ...itemForm(app, ctx, spec, {
        key: changeKey,
        initial: last.item.log,
        submitLabel: 'Check the change',
        onSubmit: (logs) => {
          app.open.delete(changeKey);
          ctx.previewCorrection(date, replaceActions(last, logs));
        },
        onSkip: (reason) => {
          app.open.delete(changeKey);
          ctx.previewCorrection(date, [{ op: 'replace', target: last.item.origin, entry: { kind: 'skip', slot: item.slot, date, ...(reason ? { reason } : {}) } }]);
        },
        onRemove: () => {
          app.open.delete(changeKey);
          ctx.previewCorrection(date, [{ op: 'remove', target: last.item.origin }]);
        },
        onCancel: () => {
          app.open.delete(changeKey);
          ctx.rerender();
        },
      }),
    );
    return box;
  }

  const right = spec.type === 'barbell' && spec.position !== undefined ? `${POSITION_LABEL[spec.position]} · ${POSITION_PCT[spec.position]}` : spec.type === 'barbell' && spec.pct !== undefined ? `${Math.round(spec.pct * 100)}% of max` : undefined;
  const box = h('div', { class: 'item' }, itemHead(name, right));
  if (spec.refer) {
    box.append(h('p', { class: 'refer' }, `Ask the coach: ${spec.refer}`));
    return box;
  }
  const single = spec.type === 'barbell' ? singleCallout(app, ctx, spec) : null;
  if (single) box.append(single);
  if (spec.singleTaken) box.append(h('div', { class: 'callout info' }, "Single logged. Straight sets today from the new training max."));
  if (spec.forced) box.append(h('div', { class: 'callout info' }, 'Two sessions down in a row: light day, two sets.'));
  box.append(rxLine(spec));
  if (spec.type === 'slot' && spec.pending) box.append(h('div', { class: 'callout info' }, h('strong', {}, `Go ${spec.pending} ${spec.incText}`), ' this session. Log whatever you lift.'));
  const ins = instruction(spec);
  if (ins) box.append(h('p', { class: 'sub' }, ins));
  if (spec.ramp?.length) box.append(h('p', { class: 'ramp' }, 'Warm-up ', ...spec.ramp.map((r) => h('span', {}, `${kg(r.load)} × ${r.reps}`))));
  const prev = lastLogged(ctx.history, item.slot, date, spec.type === 'barbell' ? spec.position : undefined);
  if (prev) {
    const label = spec.type === 'barbell' && spec.position !== undefined ? `Last ${POSITION_LABEL[spec.position].toLowerCase()}` : 'Last time';
    box.append(h('p', { class: 'last' }, `${label} (${prettyDate(prev.item.log.date)}): ${didText(prev.item.log, ctx.config)}`));
  }
  box.append(
    ...itemForm(app, ctx, spec, {
      key,
      submitLabel: spec.type === 'fixed' ? 'Done' : 'Log',
      live: true,
      onSubmit: (logs) => ctx.logLive(logs, name),
      onSkip: (reason) => ctx.logLive([{ kind: 'skip', slot: item.slot, date, ...(reason ? { reason } : {}) }], `${name} skipped`),
    }),
  );
  return box;
}

function blockCard(app: App, ctx: Ctx, b: SessionBlock, index: number, render: (it: SessionSlotItem) => HTMLElement): HTMLElement {
  const onlyWarmup = b.items.every((it) => it.kind === 'warmup');
  if (onlyWarmup) {
    return h('section', { class: 'card' }, ...b.items.map((it) => (it.kind === 'warmup' ? itemHead(WARMUP_NAMES[it.name] ?? it.name.replace(/_/g, ' '), b.min !== undefined ? `${b.min} min` : undefined) : null)));
  }
  let kicker = `Block ${index}`;
  if (b.superset) kicker = 'Superset: alternate the two';
  if (b.contrast) kicker = `Contrast pairs: heavy lift, then a jump${b.rounds ? ` · ${Array.isArray(b.rounds) ? b.rounds.join('–') : b.rounds} rounds` : ''}`;
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, kicker), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null),
    ...b.items.map((it) => (it.kind === 'warmup' ? h('p', { class: 'warm' }, WARMUP_NAMES[it.name] ?? it.name.replace(/_/g, ' ')) : render(it))),
  );
}

function cmjLive(app: App, ctx: Ctx, date: IsoDate): HTMLElement {
  const fake: SessionSlotItem = { kind: 'slot', slot: 'cmj', cls: 'E', name: 'Jump test', log_kind: 'fixed', template: {}, prescription: { kind: 'fixed', slot: 'cmj', cls: 'E', name: 'Jump test', text: '', notes: [] } };
  const mine = stepsFor(ctx, date, 'cmj');
  const last = mine[mine.length - 1];
  const key = `live|${date}|cmj`;
  const changeKey = `change|${date}|cmj`;
  if (last && !app.open.has(changeKey)) return h('section', { class: 'card' }, doneItem(app, ctx, 'Jump test', last, key, () => { app.open.add(changeKey); ctx.rerender(); }));
  const spec: Spec = { slot: 'cmj', type: 'cmj', date, load: null };
  const box = h('section', { class: 'card' }, h('div', { class: 'item' }, itemHead('Jump test', 'before the warm-up'), h('p', { class: 'sub' }, instruction(spec))));
  const inner = box.firstElementChild as HTMLElement;
  if (last) {
    inner.append(...itemForm(app, ctx, spec, {
      key: changeKey,
      initial: last.item.log,
      submitLabel: 'Check the change',
      onSubmit: (logs) => { app.open.delete(changeKey); ctx.previewCorrection(date, replaceActions(last, logs)); },
      onRemove: () => { app.open.delete(changeKey); ctx.previewCorrection(date, [{ op: 'remove', target: last.item.origin }]); },
      onCancel: () => { app.open.delete(changeKey); ctx.rerender(); },
    }));
  } else {
    inner.append(...itemForm(app, ctx, spec, {
      key,
      submitLabel: 'Log',
      onSubmit: (logs) => ctx.logLive(logs, 'Jump test'),
      onSkip: (reason) => ctx.logLive([{ kind: 'skip', slot: 'cmj', date, ...(reason ? { reason } : {}) }], 'Jump test skipped'),
    }));
  }
  void fake;
  return box;
}

function liveBody(app: App, ctx: Ctx, s: Session): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (s.pre.includes('cmj')) out.push(cmjLive(app, ctx, s.date));
  let n = 0;
  for (const b of s.blocks) out.push(blockCard(app, ctx, b, ++n, (it) => liveItem(app, ctx, it)));
  return out;
}

// ---------------------------------------------------------------------
// preview mode (future dates)
// ---------------------------------------------------------------------

function previewBody(app: App, ctx: Ctx, s: Session): HTMLElement[] {
  const snap = planSnapshot(s, ctx.config);
  const byBlock = new Map<number, PlanItem[]>();
  for (const it of snap.items) {
    if (!byBlock.has(it.block)) byBlock.set(it.block, []);
    byBlock.get(it.block)!.push(it);
  }
  const out: HTMLElement[] = [];
  if (s.pre.includes('cmj')) out.push(h('section', { class: 'card' }, h('div', { class: 'item' }, itemHead('Jump test', 'before the warm-up'))));
  s.blocks.forEach((b, i) => {
    const items = byBlock.get(i + 1) ?? [];
    if (!items.length) {
      out.push(h('section', { class: 'card' }, ...b.items.map((it) => (it.kind === 'warmup' ? itemHead(WARMUP_NAMES[it.name] ?? it.name, b.min !== undefined ? `${b.min} min` : undefined) : null))));
      return;
    }
    out.push(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'head' }, h('span', { class: 'kicker' }, b.superset ? 'Superset: alternate the two' : `Block ${i + 1}`), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null),
        ...items.map((it) => h('div', { class: 'item compact' }, itemHead(displayName(it.slot, ctx.config)), h('p', { class: 'planned' }, plannedText(it)))),
      ),
    );
  });
  void app;
  return out;
}

// ---------------------------------------------------------------------
// record and edit modes (past dates)
// ---------------------------------------------------------------------

function statusChip(row: RecordRow, draft?: Draft): HTMLElement {
  if (draft) return h('span', { class: 'status pending' }, draft.after === null ? 'Will be removed' : 'Change pending');
  if (row.status === 'done') return h('span', { class: 'status ok' }, 'Done');
  if (row.status === 'skipped') return h('span', { class: 'status skip' }, 'Skipped');
  return h('span', { class: 'status none' }, 'Not logged');
}

function recordRow(app: App, ctx: Ctx, view: RecordView, row: RecordRow, editing: boolean): HTMLElement {
  const name = displayName(row.item.slot, ctx.config);
  const key = `rec|${view.date}|${row.item.slot}`;
  const draft = editing ? app.editing?.drafts.find((d) => d.slot === row.item.slot) : undefined;
  const box = h('div', { class: `item rec st-${row.status}` }, itemHead(name, statusChip(row, draft)));
  const planned = h('div', {}, h('span', { class: 'lab' }, 'Planned'), h('span', {}, row.item.slot === 'cmj' ? 'Before the warm-up' : plannedText(row.item)));
  if (row.step) {
    const log = row.step.item.log;
    const did = h('div', {}, h('span', { class: 'lab' }, row.status === 'skipped' ? 'Recorded' : 'You did'), h('span', {}, didText(log, ctx.config)));
    box.append(h('div', { class: 'pvd' }, planned, did));
    if (row.single) box.append(h('p', { class: 'outcome' }, `${didText(row.single.item.log, ctx.config)}. ${outcomeLine(row.single, ctx.config)}`));
    const line = outcomeLine(row.step, ctx.config);
    if (line) box.append(h('p', { class: 'outcome' }, line));
    const tags = [loadTag(log), ...correctedTags(row.step), row.twice ? h('span', { class: 'tag' }, 'Logged more than once; the last one counts') : null];
    box.append(h('div', { class: 'tags' }, ...tags));
    if (!editing) box.append(h('div', { class: 'row tight' }, ...mathsToggle(app, ctx, `maths|${key}`, row.step)));
  } else {
    box.append(h('div', { class: 'pvd' }, planned));
  }
  if (!editing) return box;

  // Edit mode controls.
  if (draft) {
    box.append(h('p', { class: 'pending-text' }, draft.after === null ? 'This entry will be removed.' : `Will read: ${didText(draft.after, ctx.config)}`));
    box.append(h('div', { class: 'row tight' }, h('button', { type: 'button', class: 'quiet', onclick: () => ctx.dropDraft(row.item.slot) }, 'Undo this change')));
    return box;
  }
  const formKey = `edit|${view.date}|${row.item.slot}`;
  const spec = specFromPlan(row.item, view.date, ctx.config);
  const step = row.step;
  if (app.open.has(formKey)) {
    box.classList.add('editing');
    box.append(
      ...itemForm(app, ctx, spec, {
        key: formKey,
        ...(step ? { initial: step.item.log } : {}),
        submitLabel: 'Apply',
        onSubmit: (logs) => {
          app.open.delete(formKey);
          ctx.setDraft({ slot: row.item.slot, actions: step ? replaceActions(step, logs) : logs.map((l) => ({ op: 'insert' as const, entry: l })), after: logs[0]! });
        },
        onSkip: (reason) => {
          app.open.delete(formKey);
          const entry: AnyLog = { kind: 'skip', slot: row.item.slot, date: view.date, ...(reason ? { reason } : {}) };
          ctx.setDraft({ slot: row.item.slot, actions: step ? [{ op: 'replace', target: step.item.origin, entry }] : [{ op: 'insert', entry }], after: entry });
        },
        onCancel: () => {
          app.open.delete(formKey);
          ctx.rerender();
        },
      }),
    );
    return box;
  }
  const buttons = h('div', { class: 'row tight' });
  if (step) {
    buttons.append(
      h('button', { type: 'button', onclick: () => { app.open.add(formKey); ctx.rerender(); } }, 'Change'),
      h('button', { type: 'button', class: 'subtle danger-text', onclick: () => ctx.setDraft({ slot: row.item.slot, actions: [{ op: 'remove', target: step.item.origin }], after: null }) }, 'Remove'),
    );
  } else {
    buttons.append(
      h('button', { type: 'button', onclick: () => { app.open.add(formKey); ctx.rerender(); } }, 'Add'),
      h('button', { type: 'button', onclick: () => {
        const entry: AnyLog = { kind: 'skip', slot: row.item.slot, date: view.date };
        ctx.setDraft({ slot: row.item.slot, actions: [{ op: 'insert', entry }], after: entry });
      } }, 'Mark skipped'),
    );
  }
  box.append(buttons);
  return box;
}

function recordBody(app: App, ctx: Ctx, view: RecordView, editing: boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (!view.plan) {
    out.push(
      h(
        'section',
        { class: 'card empty' },
        h('h2', {}, `Nothing logged on ${prettyDate(view.date)}`),
        h('p', { class: 'sub' }, editing ? 'Choose the day above, then add what you did.' : 'Rest day, or a session that was never logged.'),
      ),
    );
    if (!editing) return out;
  }
  if (view.plan) {
    const summary = [`${view.counts.done} of ${view.counts.planned} logged`];
    if (view.counts.skipped) summary.push(`${view.counts.skipped} skipped`);
    if (view.minutes !== undefined) summary.push(`${view.minutes} min`);
    out.push(
      h(
        'div',
        { class: 'rec-head' },
        h('span', {}, summary.join(' · ')),
        h('span', { class: 'muted' }, view.source === 'snapshot' ? 'Plan as shown on the day' : 'Plan rebuilt from your log'),
      ),
    );
    const byBlock = new Map<number, RecordRow[]>();
    for (const r of view.rows) {
      if (!byBlock.has(r.item.block)) byBlock.set(r.item.block, []);
      byBlock.get(r.item.block)!.push(r);
    }
    for (const [, rows] of [...byBlock.entries()].sort((a, b) => a[0] - b[0])) {
      out.push(h('section', { class: 'card' }, ...rows.map((r) => recordRow(app, ctx, view, r, editing))));
    }
  }
  if (view.extras.length) {
    out.push(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'head' }, h('span', { class: 'kicker' }, 'Also logged')),
        ...view.extras.map((s) => {
          const line = outcomeLine(s, ctx.config);
          const slot = slotOfLog(s.item.log);
          const title = s.item.log.kind === 'tm_override' && slot ? `${displayName(slot, ctx.config)} max` : slot ? displayName(slot, ctx.config) : didText(s.item.log, ctx.config);
          return h('div', { class: 'item compact' }, itemHead(title), h('p', { class: line ? 'outcome' : 'did' }, line || didText(s.item.log, ctx.config)), h('div', { class: 'tags' }, ...correctedTags(s)));
        }),
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------
// sheets
// ---------------------------------------------------------------------

function previewSheet(app: App, ctx: Ctx, sheet: Extract<Sheet, { kind: 'preview' }>): HTMLElement {
  const note = h('input', { type: 'text', placeholder: 'Miscounted reps', 'aria-label': 'Note, optional' });
  const body: Child[] = [h('h2', {}, 'Check the change')];
  if (sheet.error) {
    body.push(h('p', { class: 'err' }, sheet.error), h('div', { class: 'row actions' }, h('button', { type: 'button', onclick: ctx.closeSheet }, 'Close')));
  } else {
    body.push(
      h('h3', {}, "What you're changing"),
      h('ul', { class: 'list' }, ...sheet.changes.map((c) => h('li', {}, c))),
      h('h3', {}, 'What else changes'),
      sheet.effects.length ? h('ul', { class: 'list' }, ...sheet.effects.map((c) => h('li', {}, c))) : h('p', { class: 'sub' }, 'Nothing else changes.'),
      h('label', { class: 'f' }, 'Note, optional', note),
      h('p', { class: 'sub' }, 'The original entry stays in your log, marked as corrected.'),
      h('div', { class: 'row actions' }, h('button', { type: 'button', class: 'primary', onclick: () => ctx.saveCorrection(note.value.trim()) }, 'Save correction'), h('button', { type: 'button', onclick: ctx.closeSheet }, 'Cancel')),
    );
  }
  void app;
  return h('div', { class: 'sheet-wrap', onclick: (e: Event) => { if (e.target === e.currentTarget) ctx.closeSheet(); } }, h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Check the change' }, ...body));
}

function tmSheet(app: App, ctx: Ctx, lift: LiftId): HTMLElement {
  const cfg = ctx.config;
  const name = displayName(lift, cfg);
  const cur = app.state.lifts[lift].tm;
  let next = Math.round(cur * 10) / 10;
  const loadsFor = (tm: number) => (['1', '2', '3'] as const).map((p) => `${POSITION_LABEL[Number(p) as Position].split(' ')[0]!.toLowerCase()} ${kg(Math.ceil((tm * cfg.wave.positions[p].pct) / 2.5 - 0.5) * 2.5)}`).join(' · ');
  const loads = h('p', { class: 'sub' }, `At this max: ${loadsFor(cur)} kg`);
  const msg = h('p', { class: 'sub' });
  const note = h('input', { type: 'text', placeholder: 'Felt strong on the single', 'aria-label': 'Reason, optional' });
  const s = stepper({ label: 'Set by hand', unit: 'kg', value: next, step: 0.5, start: next, onChange: (x) => {
    if (x !== null) {
      next = x;
      loads.textContent = `At this max: ${loadsFor(x)} kg`;
      msg.textContent = '';
    }
  } });
  const history = ctx.history.steps
    .filter((st) => (st.item.log.kind === 'barbell' && st.item.log.lift === lift) || (st.item.log.kind === 'tm_override' && st.item.log.lift === lift) || (st.item.log.kind === 'single' && st.item.log.lift === lift))
    .map((st) => {
      const l = st.item.log;
      const what = l.kind === 'barbell' ? (l.position !== undefined ? `${POSITION_LABEL[l.position].toLowerCase()}` : 'session') : l.kind === 'single' ? 'test single' : 'set by hand';
      return h('li', {}, h('time', {}, prettyDate(l.date)), ` ${what} · ${outcomeLine(st, cfg) || didText(l, cfg)}`);
    })
    .reverse()
    .slice(0, 12);
  return h(
    'div',
    { class: 'sheet-wrap', onclick: (e: Event) => { if (e.target === e.currentTarget) ctx.closeSheet(); } },
    h(
      'div',
      { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${name} training max` },
      h('h2', {}, `${name} training max`),
      h('div', { class: 'rx' }, h('span', { class: 'big' }, cur.toFixed(1)), h('span', { class: 'unit' }, 'kg')),
      loads,
      h('p', { class: 'sub' }, `Next session: ${nextFor(app.state, lift, cfg, app.live)}`),
      history.length ? h('h3', {}, 'History') : null,
      history.length ? h('ul', { class: 'list hist-list' }, ...history) : null,
      h('h3', {}, 'Set it by hand'),
      h('div', { class: 'fields' }, s.el),
      h('label', { class: 'f' }, 'Reason, optional', note),
      msg,
      h(
        'div',
        { class: 'row actions' },
        h('button', { type: 'button', class: 'primary', onclick: () => {
          if (Math.abs(next - cur) < 0.05) {
            msg.textContent = "That's the current max. Nothing to save.";
            return;
          }
          ctx.saveTm(lift, next, note.value.trim());
        } }, 'Save'),
        h('button', { type: 'button', onclick: ctx.closeSheet }, 'Close'),
      ),
    ),
  );
}

// ---------------------------------------------------------------------
// recent sessions, plan, export panel
// ---------------------------------------------------------------------

const recordCache = new WeakMap<History, Map<string, RecordView>>();

function cachedRecord(app: App, ctx: Ctx, date: IsoDate): RecordView {
  let m = recordCache.get(ctx.history);
  if (!m) {
    m = new Map();
    recordCache.set(ctx.history, m);
  }
  let v = m.get(date);
  if (!v) {
    v = recordFor(ctx.history, ctx.base, app.state, ctx.config, date);
    m.set(date, v);
  }
  return v;
}

function recentCard(app: App, ctx: Ctx): HTMLElement {
  const dates = ctx.history.dates.slice(0, 8);
  return h(
    'details',
    { class: 'card hist', open: true },
    h('summary', {}, 'Recent sessions'),
    dates.length
      ? h(
          'ul',
          { class: 'recent' },
          ...dates.map((d) => {
            const v = cachedRecord(app, ctx, d);
            const label = v.plan ? `Day ${v.day} · ${v.counts.done} of ${v.counts.planned} logged${v.counts.skipped ? `, ${v.counts.skipped} skipped` : ''}` : 'Other entries';
            return h('li', {}, h('button', { type: 'button', class: d === app.date ? 'on' : '', onclick: () => ctx.setDate(d) }, h('span', { class: 'd' }, prettyDate(d)), h('span', { class: 'muted' }, label)));
          }),
        )
      : h('p', { class: 'sub' }, 'Nothing logged yet.'),
  );
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function planCard(app: App, ctx: Ctx): HTMLElement {
  const cfg = ctx.config;
  const current = mesocycleOn(cfg, app.live);
  const fs = app.state.lifts.front_squat.next_position;
  const dl = app.state.lifts.deadlift.next_position;
  return h(
    'details',
    { class: 'card hist plan' },
    h('summary', {}, 'Plan'),
    h('p', { class: 'plan-now' }, `Week ${programmeWeek(cfg, app.live)} of the programme. Next front squat: ${POSITION_LABEL[fs].toLowerCase()}. Next deadlift: ${POSITION_LABEL[dl].toLowerCase()}.`),
    h(
      'ul',
      { class: 'blocks' },
      ...cfg.mesocycles.map((m) => h('li', { class: current?.id === m.id ? 'now' : '' }, h('span', { class: 'd' }, shortDate(m.start)), h('span', {}, BLOCK_LABEL[m.id]), current?.id === m.id ? h('span', { class: 'now-tag' }, 'Now') : null)),
    ),
  );
}

function allEntries(app: App, ctx: Ctx): HTMLElement {
  const steps = [...ctx.history.steps].reverse().slice(0, 200);
  return h(
    'details',
    { class: 'card hist' },
    h('summary', {}, `All log entries (${app.state.log.length})`),
    h('ul', { class: 'raw' }, ...steps.map((s) => h('li', {}, h('time', {}, s.item.log.date.slice(5)), h('span', {}, s.entry.summary)))),
  );
}

function exportPanel(app: App, ctx: Ctx): HTMLElement {
  const file = h('input', { type: 'file', accept: '.md,text/markdown,text/plain' });
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) ctx.importFile(f);
  });
  return h(
    'div',
    { class: 'panel' },
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Save a copy of your log'),
      h('p', {}, 'Phones can lose app data without warning. The exported file holds everything and restores it exactly.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: ctx.exportNow }, 'Export log')),
      app.lastExport ? h('p', { class: 'ok' }, app.lastExport) : null,
    ),
    h('section', { class: 'card' }, h('h2', {}, 'Restore from a file'), h('p', {}, 'Choose a file you exported earlier. Nothing changes unless the file is valid.'), h('div', { class: 'row' }, file)),
    backupSection(app, ctx),
    allEntries(app, ctx),
    h('div', { class: 'row' }, h('button', { type: 'button', onclick: ctx.closeExport }, 'Back to the session')),
  );
}

function backupSection(app: App, ctx: Ctx): HTMLElement {
  const status = h('p', { class: 'sub backup-status' }, app.backup.status);
  const s = app.backup.settings;
  if (s) {
    return h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Automatic backup to GitHub'),
      h('p', {}, `On. Every change is copied to your private repo ${s.owner}/${s.repo} a few seconds later, or as soon as you have signal again.`),
      status,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: ctx.backupNow }, 'Back up now'), h('button', { type: 'button', onclick: ctx.restoreFromGitHub }, 'Restore from GitHub'), h('button', { type: 'button', class: 'subtle', onclick: ctx.forgetBackup }, 'Remove token')),
    );
  }
  const text = (label: string, value: string, type = 'text') => {
    const input = h('input', { type, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    input.value = value;
    return { input, wrap: h('label', { class: 'f' }, h('span', {}, label), input) };
  };
  const owner = text('GitHub user', DEFAULT_OWNER);
  const repo = text('Private repo', DEFAULT_REPO);
  const token = text('Token', '', 'password');
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, 'Automatic backup to GitHub'),
    h('p', {}, 'Off. Paste a token that can write only to your private logs repo, and every change is backed up there automatically. The token stays on this phone and is never included in an export.'),
    owner.wrap,
    repo.wrap,
    token.wrap,
    status,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => {
      const t = token.input.value.trim();
      if (!t) {
        token.input.focus();
        return;
      }
      ctx.saveBackup({ owner: owner.input.value.trim(), repo: repo.input.value.trim(), token: t });
    } }, 'Save and back up now')),
  );
}

// ---------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------

function backupPill(app: App): HTMLElement {
  const t = app.backup.status;
  const cls = !app.backup.settings ? 'off' : /waiting|failed/i.test(t) ? 'wait' : 'ok';
  const text = !app.backup.settings ? 'Backup off' : cls === 'wait' ? 'Backup waiting' : 'Backed up';
  return h('span', { class: `pill ${cls}`, title: t }, text);
}

export function renderApp(app: App, ctx: Ctx, appVersion: string): HTMLElement {
  const cfg = ctx.config;
  const mode = ctx.mode;
  const entriesOnDate = (ctx.history.byDate.get(app.date) ?? []).filter((s) => s.item.log.kind !== 'tm_override');

  // Header and date bar.
  const top = h('div', { class: 'top' }, h('h1', {}, 'Acro S&C'), h('span', { class: 'grow' }), backupPill(app), h('button', { type: 'button', class: 'quiet', onclick: ctx.openExport }, 'Backup'));
  const dateInput = h('input', { type: 'date', 'aria-label': 'Session date' });
  dateInput.value = app.date;
  dateInput.addEventListener('change', () => ctx.setDate(dateInput.value));
  const shift = (n: number) => {
    const [y, m, d] = app.date.split('-').map(Number);
    ctx.setDate(new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10));
  };
  const dateBar = h(
    'div',
    { class: 'datebar' },
    h('button', { type: 'button', class: 'nav', 'aria-label': 'Previous day', onclick: () => shift(-1) }, '‹'),
    dateInput,
    h('button', { type: 'button', class: 'nav', 'aria-label': 'Next day', onclick: () => shift(1) }, '›'),
    app.date !== app.live ? h('button', { type: 'button', class: 'today', onclick: () => ctx.setDate(app.live) }, 'Today') : null,
  );

  // Day: switchable only while nothing is logged on the date.
  let day: SessionDay | undefined;
  if (mode === 'live' || mode === 'preview') day = ctx.session?.kind === 'session' ? ctx.session.day : app.day;
  else day = ctx.record?.day ?? app.editing?.day;
  const daySwitchable = (mode === 'live' && entriesOnDate.length === 0) || mode === 'preview' || (mode === 'edit' && !ctx.history.byDate.get(app.date)?.length);
  const dayEl = daySwitchable
    ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Day' }, ...([1, 2] as SessionDay[]).map((d) => h('button', { type: 'button', class: day === d ? 'on' : '', onclick: () => ctx.setDay(d) }, `Day ${d}`)))
    : null;

  // Context line.
  const c = contextFor(cfg, app.date);
  let weekType = '';
  if (mode === 'live' || mode === 'preview') {
    const lift = ctx.session?.kind === 'session' ? ctx.session.blocks.flatMap((b) => b.items).find((it): it is SessionSlotItem => it.kind === 'slot' && it.prescription.kind === 'lift') : undefined;
    if (lift && lift.prescription.kind === 'lift' && lift.prescription.position !== undefined) weekType = POSITION_LABEL[lift.prescription.position];
  } else {
    const lr = ctx.record?.rows.find((r) => r.item.position !== undefined);
    if (lr?.item.position !== undefined) weekType = POSITION_LABEL[lr.item.position];
  }
  const target = ctx.session?.kind === 'session' ? ctx.session.target_min : ctx.record?.plan?.target_min;
  const context = h(
    'div',
    { class: 'context' },
    h('strong', {}, `${prettyDate(app.date)}${day !== undefined ? ` · Day ${day}` : ''}${weekType ? ` · ${weekType}` : ''}`),
    h('span', { class: 'muted' }, [c.week >= 1 ? `Week ${c.week} of ${c.total}` : '', c.block ?? '', target ? `about ${target} min` : ''].filter(Boolean).join(' · ')),
  );

  const chips = h(
    'div',
    { class: 'tms' },
    ...(['front_squat', 'deadlift'] as LiftId[]).map((id) => h('button', { type: 'button', class: 'chip', onclick: () => ctx.openTm(id) }, h('span', { class: 'lab' }, `${displayName(id, cfg)} max`), h('b', {}, `${app.state.lifts[id].tm.toFixed(1)} kg`))),
  );

  // Mode banner.
  let banner: HTMLElement | null = null;
  if (mode === 'record') banner = h('div', { class: 'mode record' }, 'Record of what you logged.');
  if (mode === 'edit') banner = h('div', { class: 'mode edit' }, `Editing ${prettyDate(app.date)}. Nothing is saved until you review the changes.`);
  if (mode === 'preview') banner = h('div', { class: 'mode preview' }, "Preview. Loads assume your training maxes hold; they update as you log.");
  if (mode === 'live' && app.live !== app.date) banner = h('div', { class: 'mode' }, 'Viewing another date.');
  if (mode === 'live' && app.live !== app.today && app.date === app.live) {
    banner = h('div', { class: 'mode' }, `Session still open: logging to ${prettyDate(app.live)}.`);
  }
  if (!ctx.history.ok && (mode === 'record' || mode === 'edit')) {
    banner = h('div', { class: 'mode warn' }, "Your history can't be replayed, so corrections are off and the record shows the summaries saved at the time. Refer to the project.");
  }

  const body: Child[] = [top, dateBar, dayEl ? h('div', { class: 'dayrow' }, dayEl) : null, context, chips, banner, app.banner ? h('div', { class: 'banner', role: 'alert' }, app.banner) : null];

  if (mode === 'live' || mode === 'preview') {
    const s = ctx.session;
    if (!s || s.kind === 'refer') body.push(h('p', { class: 'refer' }, `No session for this date. ${s?.kind === 'refer' ? s.reason : ''}`));
    else body.push(...(mode === 'live' ? liveBody(app, ctx, s) : previewBody(app, ctx, s)));
  } else if (ctx.record) {
    body.push(...recordBody(app, ctx, ctx.record, mode === 'edit'));
  }

  body.push(recentCard(app, ctx), planCard(app, ctx));
  body.push(h('p', { class: 'foot backup-status' }, app.backup.status));
  body.push(h('p', { class: 'foot' }, `Acro Base S&C · v${appVersion}`));

  // Bottom bar: one main action per mode.
  let bar: HTMLElement | null = null;
  if (mode === 'live') {
    const finished = entriesOnDate.length > 0 && (ctx.history.byDate.get(app.date) ?? []).some((s) => s.item.log.kind === 'session_end' && (day === undefined || s.item.log.day === day));
    bar = h('div', { class: 'end' }, h('button', { type: 'button', class: finished ? '' : 'primary', onclick: ctx.finish }, finished ? 'Session finished · save a copy' : 'Finish session'));
  } else if (mode === 'record' && ctx.history.ok) {
    bar = h('div', { class: 'end' }, h('button', { type: 'button', class: 'primary', onclick: ctx.startEdit }, ctx.record?.plan ? 'Edit session' : 'Add a missed session'));
  } else if (mode === 'edit') {
    const n = app.editing?.drafts.length ?? 0;
    bar = h('div', { class: 'end two' }, h('button', { type: 'button', class: 'primary', onclick: ctx.reviewEdit }, n ? `Review changes (${n})` : 'Review changes'), h('button', { type: 'button', onclick: ctx.cancelEdit }, 'Cancel'));
  } else if (mode === 'preview') {
    bar = h('div', { class: 'end' }, h('button', { type: 'button', onclick: () => ctx.setDate(app.live) }, 'Back to today'));
  }

  let sheet: HTMLElement | null = null;
  if (app.sheet?.kind === 'preview') sheet = previewSheet(app, ctx, app.sheet);
  if (app.sheet?.kind === 'tm') sheet = tmSheet(app, ctx, app.sheet.lift);

  return h('div', {}, ...body, bar, app.showExport ? exportPanel(app, ctx) : null, sheet);
}

export { leftText };
