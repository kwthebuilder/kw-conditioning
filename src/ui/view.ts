/**
 * The screens (ui_spec_v1_3.md). One main screen, Today: the live
 * session or the next one, then History by programme week, then the
 * Plan. A past session opens from History as a record and is corrected
 * in Edit; a session trained but not logged is added with Add a missed
 * session. Both preview every change before saving. There is no date
 * bar and no future date anywhere.
 *
 * Builds DOM only. Every change goes back through ctx: live logging
 * through update(), corrections through amend() (engine A.23, A.28).
 */
import type { BarbellMode, IsoDate, LiftId, Position, ProgrammeConfig, State } from '../config/types';
import { defaultDay, isCarrySlot, mesocycleOn, planSnapshot, programmeWeek, slotOfLog } from '../engine';
import type {
  AnyLog,
  CorrectionAction,
  PlanItem,
  PlanSnapshot,
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
  blockWeekText,
  clockTime,
  countsText,
  didText,
  displayName,
  FLARE_PROTOCOL,
  historyLines,
  historyLineText,
  kg,
  lastLogged,
  leftText,
  loadRange,
  loadStep,
  nextFor,
  outcomeLine,
  plannedText,
  POSITION_LABEL,
  POSITION_PCT,
  prettyDate,
  rangeText,
  RELEASE_1,
  SKIP_LABEL,
  tissueTags,
  weekdayName,
  weekLine,
  weekTypeOf,
  type History,
  type RecordRow,
  type RecordView,
  type SessionGroup,
} from './model';

// ---------------------------------------------------------------------
// app state shared with main.ts
// ---------------------------------------------------------------------

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
  /** §14.2: the athlete answered the earlier-sets question. */
  setsConfirmed?: boolean;
  /** §14.9 */
  patellar?: number | null;
  gluteal?: number | null;
  shoulder?: number | null;
}

/** One pending change in Edit or Add a missed session, per item. */
export interface Draft {
  slot: string;
  actions: CorrectionAction[];
  /** What the item will read as once saved; null when removed. */
  after: AnyLog | null;
}

/** The draft key for Remove this session (§4.3). */
export const WHOLE_SESSION = '*session';

export type Screen =
  | { kind: 'today' }
  | { kind: 'record'; id: string }
  | { kind: 'edit'; id: string; drafts: Draft[] }
  | { kind: 'add'; step: 1 | 2; date: IsoDate; day: SessionDay; separate: boolean; drafts: Draft[]; error?: string };

export type Sheet =
  | { kind: 'preview'; changes: string[]; effects: string[]; error?: string }
  | { kind: 'tm'; lift: LiftId }
  | { kind: 'finish'; id: string };

/** §10 and §14.6: what the finish sheet shows. */
export interface FinishView {
  /** Planned items with neither a log nor a skip, each with its plan. */
  unrecorded: { slot: string; name: string; plan: string }[];
  finished: boolean;
  minutes?: number;
  moved: string[];
  next: string[];
  backupOk: boolean;
}

export interface App {
  state: State;
  /** The phone's local date (§9). */
  today: IsoDate;
  screen: Screen;
  /** The day switch for the next session, while nothing is logged (§4.4). */
  day?: SessionDay;
  /** An earlier open session made live: Carry on, or a live session that ran past midnight (§9). */
  carry: string | null;
  /** §4.4: Start it today, after a session has finished today. */
  startToday: boolean;
  /** §11: History shows every week, not the last four. */
  showEarlier: boolean;
  /** §14.2, §14.8: set ticks by key ("<session key>|slot", or "<session key>|bN" for a contrast grid). */
  ticks: Map<string, boolean[]>;
  /** §14.1: the block the athlete opened in a session. */
  focus: { key: string; block: number } | null;
  /** Item key asking whether every earlier set was done. */
  setsAsk: string | null;
  /** §14.9: the check-in card is showing the three sites. */
  tissueOpen: boolean;
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

/** The session being logged on Today, or the next one ready to start (§4.1, §4.4). */
export interface LiveView {
  /** The date its entries carry: the session's own date, or today for the next session. */
  date: IsoDate;
  day: SessionDay;
  session: SessionResult;
  /** Set once the first item is logged. */
  group?: SessionGroup;
  /** Entries logged into it so far. */
  steps: ReplayStep[];
  carried: boolean;
  /** Key for ticks, focus and forms. */
  key: string;
}

/** What Today shows under the status line (§3, §4.4). */
export type TodayState = 'live' | 'next' | 'blocked' | 'done';

/** Add a missed session (§11A). */
export interface AddView {
  /** The plan for the chosen date and day, from the log up to where it will be inserted. */
  plan?: PlanSnapshot;
  rotationDay: SessionDay;
  dayLines: Record<SessionDay, string>;
  /** Sessions already on the chosen date. */
  existing: SessionGroup[];
  firstDate: IsoDate;
}

export interface Ctx {
  config: ProgrammeConfig;
  base: State;
  history: History;
  sessions: SessionGroup[];
  todayState: TodayState;
  live?: LiveView;
  /** §9: an earlier session still open and not carried on. */
  unfinished?: { group: SessionGroup; view: RecordView };
  /** The session finished today, while Today reads "Done today". */
  doneToday?: { group: SessionGroup; view: RecordView };
  /** The record or edit screen's session. */
  record?: { group: SessionGroup; view: RecordView; open: boolean };
  add?: AddView;
  /** §5.5: the one drop-jump box, from the stored height. */
  boxCm?: number;
  recordOf: (g: SessionGroup) => RecordView;
  isOpen: (g: SessionGroup) => boolean;
  rerender: () => void;
  setDay: (day: SessionDay) => void;
  logLive: (logs: AnyLog[], label: string) => void;
  previewCorrection: (on: IsoDate, actions: CorrectionAction[], changes?: string[]) => void;
  saveCorrection: (note: string) => void;
  closeSheet: () => void;
  openRecord: (id: string) => void;
  goToday: () => void;
  startEdit: () => void;
  cancelEdit: () => void;
  setDraft: (draft: Draft) => void;
  dropDraft: (slot: string) => void;
  reviewEdit: () => void;
  removeSession: () => void;
  openAdd: () => void;
  addDate: (date: string) => void;
  addDay: (day: SessionDay) => void;
  addNext: () => void;
  addToExisting: (id: string) => void;
  addSeparate: () => void;
  addBack: () => void;
  cancelAdd: () => void;
  reviewAdd: () => void;
  carryOn: () => void;
  closeIt: () => void;
  startToday: () => void;
  showEarlier: () => void;
  openTm: (lift: LiftId) => void;
  saveTm: (lift: LiftId, tm: number, note: string) => void;
  finish: () => void;
  /** §10, §14.6 */
  finishView?: FinishView;
  finishNow: () => void;
  skipRest: (slots: string[]) => void;
  backToSession: (slot: string) => void;
  /** §14.2: tick or untick one set; ticking starts the rest timer. */
  tick: (key: string, index: number, on: boolean, label: string, slot: string) => void;
  focusBlock: (block: number) => void;
  /** §14.3: what logging this would do, computed without saving. */
  previewLift: (log: AnyLog) => string;
  /** §14.9 */
  tissueDue?: IsoDate;
  tissueProtocol?: boolean;
  saveTissue: (forDate: IsoDate, scores: { patellar: number; gluteal: number; shoulder: number }) => void;
  dismissTissue: (forDate: IsoDate) => void;
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
  /** §5.5: the drop-jump box height. */
  box?: number;
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

function specFromLive(item: SessionSlotItem, date: IsoDate, config: ProgrammeConfig, box?: number): Spec {
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
      if (item.slot === 'depth_jump' && box !== undefined) s.box = box;
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

/** A plan line, with the drop-jump box on live and next sessions (§5.5). */
function planLine(item: PlanItem, box?: number): string {
  const t = plannedText(item);
  return item.slot === 'depth_jump' && box !== undefined ? `${t} · ${box} cm box` : t;
}

// ---------------------------------------------------------------------
// help text
// ---------------------------------------------------------------------

const REACTIVE = 'reactive strength: bounce height divided by time on the floor; quick and high wins';

const SLOT_HELP: Record<string, string> = {
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
  if (spec.contacts !== undefined) rx.append(h('span', { class: 'sets' }, `${spec.contacts} jumps${spec.box !== undefined ? ` · ${spec.box} cm box` : ''}`));
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
      return [help, spec.slot === 'depth_jump' ? `Scored on ${REACTIVE}.` : ''].filter(Boolean).join(' ');
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
  /** §14.2: tick key and the number of sets before the last one; the barbell asks if any is unticked. */
  ticksKey?: string;
  earlierSets?: number;
  /** §14.3: show what logging would do. */
  preview?: boolean;
  /** §14.8: sets or rounds ticked for this item, for the logged set count. */
  ticked?: () => number;
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
    app.setsAsk = null;
    opts.onSubmit(logs);
  };
  // §5.1: dumbbell loads stay on the rack.
  const range = loadRange(spec.slot, ctx.config);
  const outOfRange = (x: number | null | undefined): boolean => range !== undefined && x != null && (x < range[0] || x > range[1]);
  const loadLimits = range ? { min: range[0], max: range[1] } : {};

  let submit: () => void = () => undefined;

  switch (spec.type) {
    case 'barbell': {
      const lift = spec.slot as LiftId;
      const usesTicks = opts.ticksKey !== undefined && (opts.earlierSets ?? 0) > 0;
      const build = (): AnyLog | null => {
        if (v.load == null || v.reps == null || v.rir == null) return null;
        const init = opts.initial?.kind === 'barbell' ? opts.initial : undefined;
        const planned = init ? (init.override?.from ?? init.prescribed.load) : (spec.load ?? v.load);
        const ticked = opts.ticked ? opts.ticked() : 0;
        const sets = init?.prescribed.sets ?? (spec.sets_max !== undefined && ticked > 0 ? Math.max(spec.sets ?? 1, ticked) : (spec.sets ?? 3));
        const log: AnyLog = {
          kind: 'barbell',
          lift,
          date: spec.date,
          mode: init?.mode ?? spec.mode ?? 'wave',
          prescribed: { load: v.load, reps: init?.prescribed.reps ?? spec.reps ?? v.reps, sets },
          last_set: { load: v.load, reps: v.reps, rir: v.rir },
          missed: v.missed ?? false,
        };
        const pos = init?.position ?? spec.position;
        if (pos !== undefined) log.position = pos;
        if (init?.single) log.single = init.single;
        if (v.load !== planned) log.override = { from: planned };
        return log;
      };
      const pv = opts.preview ? h('div', { class: 'preview', 'aria-live': 'polite' }) : null;
      const refresh = () => {
        if (!pv) return;
        const log = build();
        pv.textContent = log ? ctx.previewLift(log) : spec.amrap && spec.par !== undefined ? `Aim for about ${spec.par} reps with 2 left.` : 'Set the reps and reps left to see what this does to your max.';
      };
      fields.append(
        stepper({ label: 'Load', unit: 'kg', value: v.load ?? null, step: 2.5, start: spec.load ?? 0, onChange: (x) => { v.load = x; refresh(); }, invalid: err !== undefined && v.load == null }).el,
        stepper({ label: spec.amrap ? 'Reps, last set' : 'Reps per set', value: v.reps ?? null, step: 1, start: spec.reps ?? 1, integer: true, onChange: (x) => { v.reps = x; refresh(); }, invalid: err !== undefined && v.reps == null }).el,
        choices({ label: 'Reps left in the tank, last set', options: RIR_OPTIONS, value: v.rir ?? null, onChange: (x) => { v.rir = x; refresh(); }, invalid: err !== undefined && v.rir == null }),
      );
      if (!usesTicks) fields.append(checkbox(spec.mode === 'band_87_90' ? 'An earlier double fell short' : 'An earlier set fell short', v.missed ?? false, (x) => (v.missed = x)));
      if (pv) {
        fields.append(pv);
        refresh();
      }
      submit = () => {
        if (v.load == null) return fail('Enter the load.');
        if (v.reps == null) return fail('Enter the reps.');
        if (v.rir == null) return fail('Choose reps left.');
        if (v.reps === 0 && app.zeroAsk !== key) {
          app.zeroAsk = key;
          return ctx.rerender();
        }
        if (usesTicks && !v.setsConfirmed) {
          const t = app.ticks.get(opts.ticksKey!) ?? [];
          const unticked: number[] = [];
          for (let i = 0; i < opts.earlierSets!; i++) if (!t[i]) unticked.push(i + 1);
          if (unticked.length) {
            app.setsAsk = key;
            return ctx.rerender();
          }
        }
        const log = build();
        if (log) done([log]);
      };
      break;
    }
    case 'rdl':
    case 'slot': {
      fields.append(
        stepper({ label: 'Load', unit: PER_HAND.has(spec.slot) ? 'kg per hand' : 'kg', value: v.load ?? null, step: loadStep(spec.slot), start: spec.load ?? spec.hint ?? range?.[0] ?? 0, ...loadLimits, onChange: (x) => (v.load = x), invalid: err !== undefined && (v.load == null || outOfRange(v.load)) }).el,
        stepper({ label: 'Reps, last set', value: v.reps ?? null, step: 1, start: spec.reps ?? spec.rep_range?.[0] ?? 1, integer: true, onChange: (x) => (v.reps = x), invalid: err !== undefined && v.reps == null }).el,
        choices({ label: 'Reps left in the tank, last set', options: RIR_OPTIONS, value: v.rir ?? null, onChange: (x) => (v.rir = x), invalid: err !== undefined && v.rir == null }),
      );
      if (spec.tempo) fields.append(checkbox('The 3-second lowering sped up on the last set', v.tempo ?? false, (x) => (v.tempo = x)));
      submit = () => {
        if (v.load == null) return fail('Enter the load.');
        if (range && outOfRange(v.load)) return fail(rangeText(range));
        if (v.reps == null) return fail('Enter the reps.');
        if (v.rir == null) return fail('Choose reps left.');
        if (v.reps === 0 && app.zeroAsk !== key) {
          app.zeroAsk = key;
          return ctx.rerender();
        }
        const init = opts.initial && (opts.initial.kind === 'rdl' || opts.initial.kind === 'slot') ? opts.initial : undefined;
        const planned = init ? (init.override?.from ?? init.load) : spec.load;
        const last = { reps: v.reps, rir: v.rir, ...(v.tempo ? { tempo_break: true } : {}) };
        const tickedSets = opts.ticked ? opts.ticked() : 0;
        const sets = init?.sets_done ?? (spec.sets_max !== undefined && tickedSets > 0 ? Math.max(spec.sets ?? 1, tickedSets) : (spec.sets ?? 3));
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
      if (opts.ticked && !opts.initial) {
        const n = opts.ticked();
        if (n > 0 && (v.sets == null || v.sets === spec.sets)) v.sets = n;
      }
      fields.append(
        stepper({ label: 'Load', unit: spec.slot === 'db_pp_explosive' ? 'kg per hand' : 'kg', value: v.load ?? null, step: loadStep(spec.slot), start: spec.load ?? range?.[0] ?? 0, ...loadLimits, onChange: (x) => (v.load = x), invalid: err !== undefined && (v.load == null || outOfRange(v.load)) }).el,
        stepper({ label: 'Sets done', value: v.sets ?? null, step: 1, start: spec.sets ?? 3, integer: true, onChange: (x) => (v.sets = x), invalid: err !== undefined && v.sets == null }).el,
        checkbox('A rep slowed and I cut a set short', v.cut ?? false, (x) => (v.cut = x)),
      );
      submit = () => {
        if (v.load == null) return fail('Enter the load.');
        if (range && outOfRange(v.load)) return fail(rangeText(range));
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
      if (spec.slot === 'depth_jump') {
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
  if (app.setsAsk === key) {
    const t = app.ticks.get(opts.ticksKey ?? '') ?? [];
    const n = opts.earlierSets ?? 0;
    const unticked: number[] = [];
    for (let i = 0; i < n; i++) if (!t[i]) unticked.push(i + 1);
    const which = unticked.length === 1 ? `Set ${unticked[0]} isn't ticked.` : `Sets ${unticked.join(' and ')} aren't ticked.`;
    out.push(
      h(
        'div',
        { class: 'callout warn' },
        h('div', {}, h('strong', {}, which), ' Was every earlier set done as prescribed?'),
        h(
          'div',
          { class: 'row' },
          h('button', { type: 'button', class: 'primary', onclick: () => { v.missed = false; v.setsConfirmed = true; app.setsAsk = null; submit(); } }, 'All done'),
          h('button', { type: 'button', onclick: () => { v.missed = true; v.setsConfirmed = true; app.setsAsk = null; submit(); } }, 'One fell short'),
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
  return out;
}

// ---------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------

function itemHead(name: string, right?: Child): HTMLElement {
  return h('div', { class: 'title' }, h('h2', {}, name), right ? h('span', { class: 'meta' }, right) : null);
}

function chevron(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'chev');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M9 6l6 6-6 6');
  svg.append(path);
  return svg;
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

/** A logged item in a live session: one line of what was done and what it changed. */
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

/** The live session's entries for a slot. */
function stepsFor(live: LiveView, slot: string): ReplayStep[] {
  return live.steps.filter((s) => ROW_KINDS.has(s.item.log.kind) && slotOfLog(s.item.log) === slot);
}

function itemLogged(live: LiveView, slot: string): boolean {
  return stepsFor(live, slot).length > 0;
}

/** Actions to replace an existing item with new logs (the first replaces, the rest are added). */
function replaceActions(step: ReplayStep, logs: AnyLog[]): CorrectionAction[] {
  const [first, ...rest] = logs;
  const out: CorrectionAction[] = [{ op: 'replace', target: step.item.origin, entry: first! }];
  for (const l of rest) out.push({ op: 'insert', entry: l });
  return out;
}

// ---------------------------------------------------------------------
// live session (§4.1) and the next session ready to start (§4.4)
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
    h('div', { class: 'fields' }, stepper({ label: 'Single', unit: 'kg', value: v.single ?? null, step: 2.5, start: spec.load ?? 0, onChange: (x) => (v.single = x) }).el),
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

/** §14.2: one tickable set row. Ticking updates in place and starts the rest timer. */
function tickRow(app: App, ctx: Ctx, key: string, index: number, text: string, slot: string, name: string): HTMLElement {
  const on = (app.ticks.get(key) ?? [])[index] ?? false;
  const box = h('span', { class: 'box', 'aria-hidden': 'true' }, on ? '✓' : '');
  const b = h('button', { type: 'button', class: `tick${on ? ' on' : ''}`, 'aria-pressed': String(on) }, box, h('span', {}, text));
  b.addEventListener('click', () => {
    const now = !b.classList.contains('on');
    b.classList.toggle('on', now);
    b.setAttribute('aria-pressed', String(now));
    box.textContent = now ? '✓' : '';
    ctx.tick(key, index, now, name, slot);
  });
  return b;
}

function countTicks(app: App, key: string, pick?: (i: number) => boolean): number {
  return (app.ticks.get(key) ?? []).filter((t, i) => t && (!pick || pick(i))).length;
}

/** Earlier-set rows for an item: everything before the last set, whose numbers are logged. */
function setRows(app: App, ctx: Ctx, spec: Spec, name: string, tk: string): { rows: HTMLElement[]; earlier: number; lastLabel?: string } {
  const rows: HTMLElement[] = [];
  const side = spec.per_side ? ' each side' : '';
  const sets = spec.sets ?? 0;
  if (spec.type === 'barbell') {
    if (spec.ramp?.length) rows.push(tickRow(app, ctx, `${tk}|warm`, 0, `Warm-up ${spec.ramp.map((r) => `${kg(r.load)} × ${r.reps}`).join(' · ')}`, spec.slot, name));
    const earlier = Math.max(0, sets - 1);
    for (let i = 0; i < earlier; i++) rows.push(tickRow(app, ctx, tk, i, `Set ${i + 1} · ${spec.load !== null ? `${kg(spec.load)} kg × ` : ''}${spec.reps ?? ''}`, spec.slot, name));
    return { rows, earlier, lastLabel: `Set ${sets}, the last` };
  }
  if (spec.type === 'rdl' || spec.type === 'slot') {
    const earlier = Math.max(0, sets - 1);
    const reps = spec.rep_range ? `${spec.rep_range[0]}–${spec.rep_range[1]}` : `${spec.reps ?? ''}`;
    for (let i = 0; i < earlier; i++) rows.push(tickRow(app, ctx, tk, i, `Set ${i + 1} · ${spec.load !== null ? `${spec.slot === 'pull_up' && spec.load === 0 ? 'bodyweight' : `${kg(spec.load)} kg`} × ` : '× '}${reps}${side}`, spec.slot, name));
    return { rows, earlier, lastLabel: `Set ${sets}, the last` };
  }
  if (spec.type === 'fixed' || spec.type === 'explosive') {
    const n = spec.sets_max ?? sets;
    const what = spec.reps !== undefined ? ` · ${spec.reps}${side}` : spec.secs !== undefined ? ` · ${spec.secs} s${side}` : '';
    for (let i = 0; i < n; i++) rows.push(tickRow(app, ctx, tk, i, `Set ${i + 1}${i + 1 > sets ? ' (optional)' : ''}${what}`, spec.slot, name));
    return { rows, earlier: 0 };
  }
  return { rows, earlier: 0 };
}

interface LiveOpts {
  /** §14.8: in a contrast block the grid holds the ticks. */
  contrast?: { ticked: () => number };
}

function liveItem(app: App, ctx: Ctx, live: LiveView, item: SessionSlotItem, lo: LiveOpts = {}): HTMLElement {
  const date = live.date;
  const name = displayName(item.slot, ctx.config);
  const key = `live|${live.key}|${item.slot}`;
  const changeKey = `change|${live.key}|${item.slot}`;
  const spec = specFromLive(item, date, ctx.config, ctx.boxCm);
  const mine = stepsFor(live, item.slot);
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
  const tags = tissueTags(ctx.history, app.today, item.slot, ctx.config);
  if (tags.length) box.append(h('div', { class: 'tags' }, ...tags.map((t) => h('span', { class: 'tag warn' }, t))));
  if (spec.refer) {
    box.append(h('p', { class: 'refer' }, `Ask the coach: ${spec.refer}`));
    return box;
  }
  const single = spec.type === 'barbell' && !lo.contrast ? singleCallout(app, ctx, spec) : null;
  if (single) box.append(single);
  if (spec.singleTaken) box.append(h('div', { class: 'callout info' }, 'Single logged. Straight sets today from the new training max.'));
  if (spec.forced) box.append(h('div', { class: 'callout info' }, 'Two sessions down in a row: light day, two sets.'));
  box.append(rxLine(spec));
  if (spec.type === 'slot' && spec.pending) box.append(h('div', { class: 'callout info' }, h('strong', {}, `Go ${spec.pending} ${spec.incText}`), ' this session. Log whatever you lift.'));
  const ins = instruction(spec);
  if (ins) box.append(h('p', { class: 'sub' }, ins));
  const prev = lastLogged(ctx.history, item.slot, date, spec.type === 'barbell' ? spec.position : undefined);
  if (prev) {
    const label = spec.type === 'barbell' && spec.position !== undefined ? `Last ${POSITION_LABEL[spec.position].toLowerCase()}` : 'Last time';
    box.append(h('p', { class: 'last' }, `${label} (${prettyDate(prev.item.log.date)}): ${didText(prev.item.log, ctx.config)}`));
  }
  const tk = `${live.key}|${item.slot}`;
  let earlier = 0;
  if (!lo.contrast) {
    const sr = setRows(app, ctx, spec, name, tk);
    earlier = sr.earlier;
    if (sr.rows.length) box.append(h('div', { class: 'sets-list' }, ...sr.rows));
    if (sr.lastLabel && (spec.type === 'barbell' || spec.type === 'rdl' || spec.type === 'slot')) box.append(h('p', { class: 'lastset' }, sr.lastLabel));
  } else if (spec.type === 'barbell' && spec.ramp?.length) {
    box.append(h('div', { class: 'sets-list' }, tickRow(app, ctx, `${tk}|warm`, 0, `Warm-up ${spec.ramp.map((r) => `${kg(r.load)} × ${r.reps}`).join(' · ')}`, spec.slot, name)));
  }
  box.append(
    ...itemForm(app, ctx, spec, {
      key,
      submitLabel: spec.type === 'fixed' ? 'Done' : 'Log',
      ...(lo.contrast ? { ticked: lo.contrast.ticked } : { ticksKey: tk, earlierSets: earlier, ticked: () => countTicks(app, tk) }),
      preview: spec.type === 'barbell',
      onSubmit: (logs) => ctx.logLive(logs, name),
      onSkip: (reason) => ctx.logLive([{ kind: 'skip', slot: item.slot, date, ...(reason ? { reason } : {}) }], `${name} skipped`),
    }),
  );
  return box;
}

function kickerFor(b: SessionBlock, index: number): string {
  if (b.contrast) return `Contrast: heavy set, then jump${b.rounds ? ` · ${Array.isArray(b.rounds) ? b.rounds.join('–') : b.rounds} rounds` : ''}`;
  if (b.superset) return 'Superset: alternate the two';
  return `Block ${index}`;
}

function blockCard(b: SessionBlock, index: number, render: (it: SessionSlotItem) => HTMLElement): HTMLElement {
  const onlyWarmup = b.items.every((it) => it.kind === 'warmup');
  if (onlyWarmup) {
    return h('section', { class: 'card' }, ...b.items.map((it) => (it.kind === 'warmup' ? itemHead(WARMUP_NAMES[it.name] ?? it.name.replace(/_/g, ' '), b.min !== undefined ? `${b.min} min` : undefined) : null)));
  }
  return h(
    'section',
    { class: 'card focus' },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, kickerFor(b, index)), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null),
    ...b.items.map((it) => (it.kind === 'warmup' ? h('p', { class: 'warm' }, WARMUP_NAMES[it.name] ?? it.name.replace(/_/g, ' ')) : render(it))),
  );
}

function cmjLive(app: App, ctx: Ctx, live: LiveView): HTMLElement {
  const date = live.date;
  const mine = stepsFor(live, 'cmj');
  const last = mine[mine.length - 1];
  const key = `live|${live.key}|cmj`;
  const changeKey = `change|${live.key}|cmj`;
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
  return box;
}

/** §14.8: a contrast block as a grid of rounds, one tick per item, then each item logs once. */
function contrastBlock(app: App, ctx: Ctx, live: LiveView, b: SessionBlock, index: number): HTMLElement {
  const items = b.items.filter((it): it is SessionSlotItem => it.kind === 'slot');
  const [lo, hi] = Array.isArray(b.rounds) ? b.rounds : [b.rounds ?? 3, b.rounds ?? 3];
  const gk = `${live.key}|b${index}`;
  const grid = h('div', { class: 'grid' });
  for (let r = 0; r < hi; r++) {
    const row = h('div', { class: 'grid-row' }, h('span', { class: 'lab' }, `Round ${r + 1}${r + 1 > lo ? ' (optional)' : ''}`));
    items.forEach((it, i) => {
      const t = it.template;
      const reps = it.prescription.kind === 'lift' || it.prescription.kind === 'slot' ? it.prescription.reps : t.reps;
      const short = it.slot === 'pull_up' ? 'Pull-up' : displayName(it.slot, ctx.config);
      row.append(tickRow(app, ctx, gk, r * items.length + i, `${short}${reps !== undefined ? ` × ${reps}` : ''}`, it.slot, displayName(it.slot, ctx.config)));
    });
    grid.append(row);
  }
  const cols = items.length;
  // A test single comes before the rounds, so its callout sits above the grid.
  const lift = items.find((it) => it.prescription.kind === 'lift');
  const liftLogged = lift ? itemLogged(live, lift.slot) : true;
  const single = lift && !liftLogged ? singleCallout(app, ctx, specFromLive(lift, live.date, ctx.config)) : null;
  return h(
    'section',
    { class: 'card focus' },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, kickerFor(b, index)), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null),
    single,
    h('p', { class: 'sub' }, `Tick each item as you finish it in a round. Stop after round ${lo} or go to ${hi}; then log each item once below.`),
    grid,
    ...items.map((it, i) => liveItem(app, ctx, live, it, { contrast: { ticked: () => countTicks(app, gk, (k) => k % cols === i) } })),
  );
}

/** A finished block, one line per item (§14.1). Tapping opens it. */
function doneCard(ctx: Ctx, live: LiveView, b: SessionBlock, index: number): HTMLElement {
  const rows = b.items.filter((it): it is SessionSlotItem => it.kind === 'slot').map((it) => {
    const steps = stepsFor(live, it.slot);
    const st = steps[steps.length - 1]!;
    const log = st.item.log;
    const skipped = log.kind === 'skip' || (log.kind === 'fixed' && !log.done);
    const line = outcomeLine(st, ctx.config);
    return h('div', { class: `line${skipped ? ' skipped' : ''}` }, h('span', { class: 'mark', 'aria-hidden': 'true' }, skipped ? '–' : '✓'), h('span', { class: 'nm' }, displayName(it.slot, ctx.config)), h('span', { class: 'dt' }, didText(log, ctx.config)), line ? h('span', { class: 'oc' }, line) : null);
  });
  return h(
    'section',
    { class: 'card compact-card done-card', role: 'button', tabindex: '0', 'aria-label': `${kickerFor(b, index)}, done. Open to change.`, onclick: () => ctx.focusBlock(index) },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, kickerFor(b, index)), h('span', { class: 'status ok' }, 'Done')),
    ...rows,
  );
}

/** A block still to come, with each item's plan (§14.1). Tapping opens it. */
function nextCard(ctx: Ctx, live: LiveView, b: SessionBlock, index: number, plan: Map<string, PlanItem>): HTMLElement {
  const rows = b.items.filter((it): it is SessionSlotItem => it.kind === 'slot').map((it) => {
    const p = plan.get(it.slot);
    const logged = itemLogged(live, it.slot);
    return h('div', { class: 'line' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, logged ? '✓' : ''), h('span', { class: 'nm' }, displayName(it.slot, ctx.config)), h('span', { class: 'dt' }, p ? planLine(p, ctx.boxCm) : ''));
  });
  return h(
    'section',
    { class: 'card compact-card next-card', role: 'button', tabindex: '0', 'aria-label': `${kickerFor(b, index)}. Open.`, onclick: () => ctx.focusBlock(index) },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, `Up next · ${kickerFor(b, index)}`), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null),
    ...rows,
  );
}

/** §14.1: one block open; done blocks one line per item; later blocks as "Up next". */
function liveBody(app: App, ctx: Ctx, live: LiveView, s: Session): HTMLElement[] {
  const out: HTMLElement[] = [];
  const plan = new Map(planSnapshot(s, ctx.config).items.map((i) => [i.slot, i] as const));
  const slotsOf = (b: SessionBlock) => b.items.filter((it): it is SessionSlotItem => it.kind === 'slot');
  const blockDone = (b: SessionBlock) => slotsOf(b).length > 0 && slotsOf(b).every((it) => itemLogged(live, it.slot));
  const hasCmj = s.pre.includes('cmj');
  const cmjDone = itemLogged(live, 'cmj');
  // 0 = the jump test, 1..n = a block, -1 = everything logged.
  let focus: number;
  if (app.focus && app.focus.key === live.key) focus = app.focus.block;
  else if (hasCmj && !cmjDone) focus = 0;
  else {
    const i = s.blocks.findIndex((b) => slotsOf(b).length > 0 && !blockDone(b));
    focus = i === -1 ? -1 : i + 1;
  }
  if (hasCmj) out.push(cmjLive(app, ctx, live));
  s.blocks.forEach((b, i) => {
    const index = i + 1;
    if (slotsOf(b).length === 0) {
      out.push(blockCard(b, index, () => h('div')));
      return;
    }
    if (index === focus) out.push(b.contrast ? contrastBlock(app, ctx, live, b, index) : blockCard(b, index, (it) => liveItem(app, ctx, live, it)));
    else if (blockDone(b)) out.push(doneCard(ctx, live, b, index));
    else out.push(nextCard(ctx, live, b, index, plan));
  });
  return out;
}

/** §4.4: the next session, read-only, after a session has finished today. */
function nextReadOnly(ctx: Ctx, s: Session): HTMLElement[] {
  const snap = planSnapshot(s, ctx.config);
  const out: HTMLElement[] = [];
  const rows: HTMLElement[] = [];
  if (s.pre.includes('cmj')) rows.push(h('div', { class: 'line' }, h('span', { class: 'nm' }, 'Jump test'), h('span', { class: 'dt' }, 'Before the warm-up')));
  for (const it of snap.items) rows.push(h('div', { class: 'line' }, h('span', { class: 'nm' }, displayName(it.slot, ctx.config)), h('span', { class: 'dt' }, planLine(it, ctx.boxCm))));
  out.push(h('div', { class: 'plan-lines' }, ...rows));
  return out;
}

// ---------------------------------------------------------------------
// Today (§3)
// ---------------------------------------------------------------------

function weekTypeOfSession(s: SessionResult | undefined): string | undefined {
  if (!s || s.kind !== 'session') return undefined;
  const lift = s.blocks.flatMap((b) => b.items).find((it): it is SessionSlotItem => it.kind === 'slot' && it.prescription.kind === 'lift');
  return lift && lift.prescription.kind === 'lift' && lift.prescription.position !== undefined ? POSITION_LABEL[lift.prescription.position] : undefined;
}

/** §9: the unfinished-session card. */
function unfinishedCard(ctx: Ctx, u: NonNullable<Ctx['unfinished']>): HTMLElement {
  const g = u.group;
  const at = g.start && g.start.item.log.kind === 'session_start' ? clockTime(g.start.item.log.at) : undefined;
  const day = g.day !== undefined ? `Day ${g.day}` : 'session';
  return h(
    'section',
    { class: 'card attention unfinished' },
    h('h2', {}, `${prettyDate(g.date)}'s ${day} isn't finished`),
    h('p', { class: 'sub' }, `${countsText(u.view.counts)}${at ? ` · started ${at}` : ''}. Carry on to log the rest into ${weekdayName(g.date)}'s session, or close it.`),
    h('div', { class: 'row actions' }, h('button', { type: 'button', class: 'primary', onclick: ctx.carryOn }, 'Carry on'), h('button', { type: 'button', onclick: ctx.closeIt }, 'Close it')),
    h('p', { class: 'sub' }, 'Carry on is open until the end of today.'),
  );
}

/** §14.9: the morning-after card, and the flare protocol on a day a score was above 3. */
function tissueCard(app: App, ctx: Ctx): HTMLElement | null {
  if (ctx.tissueProtocol) {
    return h(
      'section',
      { class: 'card protocol' },
      h('div', { class: 'head' }, h('span', { class: 'kicker' }, 'Above 3/10 today: your flare protocol')),
      h('p', {}, FLARE_PROTOCOL),
      h('p', { class: 'sub' }, 'Recorded only; the app changes no load for it. Adjust today with the coach in mind.'),
    );
  }
  const due = ctx.tissueDue;
  if (!due) return null;
  const v = app.forms.get('tissue') ?? { patellar: 0, gluteal: 0, shoulder: 0 };
  app.forms.set('tissue', v);
  const head = h('div', { class: 'head' }, h('span', { class: 'kicker' }, 'Check-in'));
  if (!app.tissueOpen) {
    return h(
      'section',
      { class: 'card checkin' },
      head,
      h('h2', {}, 'How do they feel today?'),
      h('p', { class: 'sub' }, `After ${prettyDate(due)}'s session: patellar, gluteal and left shoulder, 0 to 10.`),
      h(
        'div',
        { class: 'row actions' },
        h('button', { type: 'button', class: 'primary', onclick: () => ctx.saveTissue(due, { patellar: 0, gluteal: 0, shoulder: 0 }) }, 'All clear'),
        h('button', { type: 'button', onclick: () => { app.tissueOpen = true; ctx.rerender(); } }, "Something's sore"),
        h('button', { type: 'button', class: 'subtle', onclick: () => ctx.dismissTissue(due) }, 'Not now'),
      ),
    );
  }
  const err = app.errors.get('tissue');
  const field = (label: string, k: 'patellar' | 'gluteal' | 'shoulder') =>
    stepper({ label, unit: 'out of 10', value: v[k] ?? 0, step: 1, start: 0, integer: true, onChange: (x) => (v[k] = x) }).el;
  return h(
    'section',
    { class: 'card checkin' },
    head,
    h('h2', {}, 'How do they feel today?'),
    h('p', { class: 'sub' }, `After ${prettyDate(due)}'s session. 0 is nothing at all.`),
    h('div', { class: 'fields' }, field('Patellar tendon', 'patellar'), field('Gluteal tendon', 'gluteal'), field('Left shoulder', 'shoulder')),
    err ? h('p', { class: 'err' }, err) : null,
    h(
      'div',
      { class: 'row actions' },
      h('button', { type: 'button', class: 'primary', onclick: () => {
        const vals = [v.patellar, v.gluteal, v.shoulder];
        if (vals.some((x) => x == null || x < 0 || x > 10 || !Number.isInteger(x))) {
          app.errors.set('tissue', 'Each score is a whole number from 0 to 10.');
          return ctx.rerender();
        }
        app.errors.delete('tissue');
        app.tissueOpen = false;
        app.forms.delete('tissue');
        ctx.saveTissue(due, { patellar: v.patellar!, gluteal: v.gluteal!, shoulder: v.shoulder! });
      } }, 'Save'),
      h('button', { type: 'button', class: 'subtle', onclick: () => { app.tissueOpen = false; ctx.rerender(); } }, 'Cancel'),
    ),
  );
}

function sessionLabel(ctx: Ctx, g: SessionGroup): string {
  const v = ctx.recordOf(g);
  if (!v.plan) return `${g.steps.filter((s) => ROW_KINDS.has(s.item.log.kind)).length} logged`;
  return `Day ${v.day} · ${countsText(v.counts)}`;
}

function sessionTags(ctx: Ctx, g: SessionGroup): HTMLElement[] {
  const v = ctx.recordOf(g);
  const tags: HTMLElement[] = [];
  if (ctx.isOpen(g)) tags.push(h('span', { class: 'tag warn' }, 'Not finished'));
  if (v.rows.some((r) => r.twice)) tags.push(h('span', { class: 'tag' }, 'Logged twice'));
  return tags;
}

/** §11: one row per session; tapping opens its record. */
function sessionRow(ctx: Ctx, g: SessionGroup): HTMLElement {
  const tags = sessionTags(ctx, g);
  return h(
    'button',
    { type: 'button', class: 'session-row', onclick: () => ctx.openRecord(g.id) },
    h('span', { class: 'txt' }, h('span', { class: 'd' }, prettyDate(g.date)), h('span', { class: 'muted' }, sessionLabel(ctx, g))),
    tags.length ? h('span', { class: 'tags' }, ...tags) : null,
    chevron(),
  );
}

/** §11: History, grouped by programme week, then Add a missed session. */
function historySection(app: App, ctx: Ctx): HTMLElement[] {
  const out: HTMLElement[] = [h('h2', { class: 'section-title' }, 'History')];
  const { lines, more } = historyLines(ctx.sessions, ctx.config, app.today, app.showEarlier ? undefined : 4);
  if (!lines.length) out.push(h('p', { class: 'sub' }, 'No sessions yet.'));
  for (const line of lines) {
    const t = historyLineText(line);
    if (line.kind === 'empty') {
      out.push(h('div', { class: 'hist-empty' }, t.left));
      continue;
    }
    out.push(
      h(
        'section',
        { class: 'card hist-week' },
        h('div', { class: 'week-head' }, h('span', {}, t.left), h('span', { class: 'muted' }, t.right)),
        ...line.sessions.map((g) => sessionRow(ctx, g)),
      ),
    );
  }
  if (more && !app.showEarlier) out.push(h('button', { type: 'button', class: 'subtle wide', onclick: ctx.showEarlier }, 'Show earlier weeks'));
  out.push(h('button', { type: 'button', class: 'outline wide', onclick: ctx.openAdd }, 'Add a missed session'));
  return out;
}

/** §3 item 8: one row, opening the blocks with their dates. */
function planCard(app: App, ctx: Ctx): HTMLElement {
  const cfg = ctx.config;
  const current = mesocycleOn(cfg, app.today);
  const fs = app.state.lifts.front_squat.next_position;
  const dl = app.state.lifts.deadlift.next_position;
  return h(
    'details',
    { class: 'card hist plan' },
    h('summary', {}, h('span', {}, 'Plan'), h('span', { class: 'muted plan-where' }, blockWeekText(cfg, app.today))),
    h('p', { class: 'plan-now' }, `Week ${programmeWeek(cfg, app.today)} of the programme. Next front squat: ${POSITION_LABEL[fs].toLowerCase()}. Next deadlift: ${POSITION_LABEL[dl].toLowerCase()}.`),
    h(
      'ul',
      { class: 'blocks' },
      ...cfg.mesocycles.map((m) =>
        h('li', { class: current?.id === m.id ? 'now' : '' }, h('span', { class: 'd' }, `${prettyDate(m.start)} to ${prettyDate(m.end)}`), h('span', {}, BLOCK_LABEL[m.id]), current?.id === m.id ? h('span', { class: 'now-tag' }, 'Now') : null),
      ),
    ),
  );
}

function statusLine(ctx: Ctx, app: App): string {
  const live = ctx.live;
  if (ctx.todayState === 'live' && live) {
    const g = live.group;
    const at = g?.start && g.start.item.log.kind === 'session_start' ? clockTime(g.start.item.log.at) : undefined;
    // The week type as planned when the session started; logging the lift moves the prescription on.
    const wt = (g ? weekTypeOf(ctx.recordOf(g).plan) : undefined) ?? weekTypeOfSession(live.session);
    const head = live.carried ? `${prettyDate(live.date)}'s session, carried on` : "Today's session";
    return [head, `Day ${live.day}`, wt, at ? `started ${at}` : ''].filter(Boolean).join(' · ');
  }
  if (ctx.todayState === 'done' && ctx.doneToday) {
    const v = ctx.doneToday.view;
    return ['Done today', v.day !== undefined ? `Day ${v.day}` : '', v.minutes !== undefined ? `${v.minutes} min` : ''].filter(Boolean).join(' · ');
  }
  const last = [...ctx.sessions].filter((g) => g.date <= app.today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).at(-1);
  if (!last) return 'No sessions yet.';
  return `No session today. Last session: ${last.day !== undefined ? `Day ${last.day} on ` : ''}${prettyDate(last.date)}.`;
}

function daySwitch(ctx: Ctx, day: SessionDay): HTMLElement {
  return h('div', { class: 'seg', role: 'group', 'aria-label': 'Day' }, ...([1, 2] as SessionDay[]).map((d) => h('button', { type: 'button', class: day === d ? 'on' : '', 'aria-pressed': String(day === d), onclick: () => ctx.setDay(d) }, `Day ${d}`)));
}

function todayScreen(app: App, ctx: Ctx, appVersion: string): { body: Child[]; bar: HTMLElement | null } {
  const cfg = ctx.config;
  const body: Child[] = [];
  body.push(h('div', { class: 'top' }, h('h1', {}, 'Acro S&C'), h('span', { class: 'grow' }), backupPill(app), h('button', { type: 'button', class: 'quiet', onclick: ctx.openExport }, 'Backup')));
  body.push(h('div', { class: 'dateline' }, h('div', { class: 'today-date' }, prettyDate(app.today, true)), h('div', { class: 'muted' }, weekLine(cfg, app.today))));
  body.push(
    h(
      'div',
      { class: 'tms' },
      ...(['front_squat', 'deadlift'] as LiftId[]).map((id) => h('button', { type: 'button', class: 'chip', onclick: () => ctx.openTm(id) }, h('span', { class: 'lab' }, `${displayName(id, cfg)} max`), h('b', {}, `${app.state.lifts[id].tm.toFixed(1)} kg`))),
    ),
  );
  if (app.banner) body.push(h('div', { class: 'banner', role: 'alert' }, app.banner));
  // §3: at most one attention card; an unfinished session first.
  const attention = ctx.unfinished ? unfinishedCard(ctx, ctx.unfinished) : tissueCard(app, ctx);
  if (attention) body.push(attention);
  body.push(h('p', { class: 'status-line' }, statusLine(ctx, app)));

  const live = ctx.live;
  const s = live?.session;
  if (ctx.todayState === 'live' && live && s) {
    if (s.kind !== 'session') body.push(h('p', { class: 'refer' }, `No session for this date. ${s.reason}`));
    else body.push(...liveBody(app, ctx, live, s));
  } else if (ctx.todayState === 'blocked' && live) {
    const u = ctx.unfinished!.group;
    body.push(h('section', { class: 'card next-head' }, h('span', { class: 'kicker' }, 'Next session'), h('h2', { class: 'muted' }, `Day ${live.day}`), h('p', { class: 'sub' }, `Ready once ${weekdayName(u.date)}'s session is finished or closed.`)));
  } else if (ctx.todayState === 'done' && ctx.doneToday && live && s) {
    const g = ctx.doneToday.group;
    body.push(h('section', { class: 'card hist-week' }, sessionRow(ctx, g)));
    const head = h('section', { class: 'card next-head' }, h('span', { class: 'kicker' }, 'Next session · loads assume your training maxes hold'), h('h2', {}, `Day ${live.day}${s.kind === 'session' ? ` · about ${s.target_min} min` : ''}`));
    if (s.kind === 'session') head.append(...nextReadOnly(ctx, s));
    head.append(h('div', { class: 'row actions' }, h('button', { type: 'button', onclick: ctx.startToday }, 'Start it today')));
    body.push(head);
  } else if (live && s) {
    const rotation = defaultDay(app.state);
    const line = live.day === rotation
      ? `Day ${rotation} is next in your rotation. Logging the first item starts the session and fixes the day.`
      : `You've chosen Day ${live.day}. Day ${rotation} is next in your rotation.`;
    body.push(h('section', { class: 'card next-head' }, h('span', { class: 'kicker' }, 'Next session'), h('h2', {}, `Day ${live.day}${s.kind === 'session' ? ` · about ${s.target_min} min` : ''}`), daySwitch(ctx, live.day), h('p', { class: 'sub' }, line)));
    if (s.kind !== 'session') body.push(h('p', { class: 'refer' }, `No session for this date. ${s.reason}`));
    else body.push(...liveBody(app, ctx, live, s));
  }

  body.push(...historySection(app, ctx));
  body.push(planCard(app, ctx));
  body.push(h('p', { class: 'foot backup-status' }, app.backup.status));
  body.push(h('p', { class: 'foot' }, `Acro Base S&C · v${appVersion}`));

  const bar = ctx.todayState === 'live' ? h('div', { class: 'end' }, h('button', { type: 'button', class: 'primary', onclick: ctx.finish }, 'Finish session')) : null;
  return { body, bar };
}

// ---------------------------------------------------------------------
// a record (§4.2) and Edit (§4.3)
// ---------------------------------------------------------------------

function statusChip(row: RecordRow, draft?: Draft): HTMLElement {
  if (draft) return h('span', { class: 'status pending' }, draft.after === null ? 'Will be removed' : 'Change pending');
  if (row.status === 'done') return h('span', { class: 'status ok' }, 'Done');
  if (row.status === 'skipped') return h('span', { class: 'status skip' }, 'Skipped');
  return h('span', { class: 'status none' }, 'Not recorded');
}

function rowTags(row: RecordRow): (HTMLElement | null)[] {
  if (!row.step) return [];
  return [
    loadTag(row.step.item.log),
    ...correctedTags(row.step),
    row.twice ? h('span', { class: 'tag' }, 'Logged twice') : null,
    row.viaLadder ? h('span', { class: 'tag' }, 'Logged on the ladder item') : null,
  ];
}

/** A done or skipped item in a record: planned against done, and what it changed. */
function recordItem(app: App, ctx: Ctx, view: RecordView, row: RecordRow): HTMLElement {
  const name = displayName(row.item.slot, ctx.config);
  const key = `rec|${view.date}|${row.item.slot}`;
  const box = h('div', { class: `item rec st-${row.status}` }, itemHead(name, statusChip(row)));
  const planned = h('div', {}, h('span', { class: 'lab' }, 'Planned'), h('span', {}, row.item.slot === 'cmj' ? 'Before the warm-up' : plannedText(row.item)));
  const log = row.step!.item.log;
  const skipped = row.status === 'skipped';
  const did = h('div', {}, h('span', { class: 'lab' }, skipped ? 'Recorded' : 'You did'), h('span', {}, skipped && log.kind === 'skip' ? `Skipped${log.reason ? ` · ${SKIP_LABEL[log.reason]}` : ''}` : didText(log, ctx.config)));
  box.append(h('div', { class: 'pvd' }, planned, did));
  if (row.single) box.append(h('p', { class: 'outcome' }, `${didText(row.single.item.log, ctx.config)}. ${outcomeLine(row.single, ctx.config)}`));
  const line = outcomeLine(row.step!, ctx.config);
  if (line) box.append(h('p', { class: 'outcome' }, line));
  box.append(h('div', { class: 'tags' }, ...rowTags(row)));
  box.append(h('div', { class: 'row tight' }, ...mathsToggle(app, ctx, `maths|${key}`, row.step!)));
  return box;
}

/** An item in Edit or in Add a missed session, with its controls. */
function editRow(app: App, ctx: Ctx, date: IsoDate, row: RecordRow, drafts: Draft[], locked: boolean): HTMLElement {
  const name = displayName(row.item.slot, ctx.config);
  const draft = drafts.find((d) => d.slot === row.item.slot);
  const box = h('div', { class: `item rec st-${row.status}` }, itemHead(name, statusChip(row, draft)));
  const planned = h('div', {}, h('span', { class: 'lab' }, 'Planned'), h('span', {}, row.item.slot === 'cmj' ? 'Before the warm-up' : plannedText(row.item)));
  if (row.step) {
    const did = h('div', {}, h('span', { class: 'lab' }, row.status === 'skipped' ? 'Recorded' : 'You did'), h('span', {}, didText(row.step.item.log, ctx.config)));
    box.append(h('div', { class: 'pvd' }, planned, did), h('div', { class: 'tags' }, ...rowTags(row)));
  } else {
    box.append(h('div', { class: 'pvd' }, planned));
  }
  if (locked) return box;
  if (draft) {
    box.append(h('p', { class: 'pending-text' }, draft.after === null ? 'This entry will be removed.' : `Will read: ${didText(draft.after, ctx.config)}`));
    box.append(h('div', { class: 'row tight' }, h('button', { type: 'button', class: 'quiet', onclick: () => ctx.dropDraft(row.item.slot) }, 'Undo this change')));
    return box;
  }
  const formKey = `edit|${date}|${row.item.slot}`;
  const spec = specFromPlan(row.item, date, ctx.config);
  const step = row.step;
  const skipTo = (reason?: SkipReason) => {
    app.open.delete(formKey);
    const entry: AnyLog = { kind: 'skip', slot: row.item.slot, date, ...(reason ? { reason } : {}) };
    ctx.setDraft({ slot: row.item.slot, actions: step ? [{ op: 'replace', target: step.item.origin, entry }] : [{ op: 'insert', entry }], after: entry });
  };
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
        onSkip: skipTo,
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
    const skipKey = `editskip|${date}|${row.item.slot}`;
    buttons.append(
      h('button', { type: 'button', onclick: () => { app.open.add(formKey); ctx.rerender(); } }, 'Add'),
      h('button', { type: 'button', onclick: () => { app.skipOpen = app.skipOpen === skipKey ? null : skipKey; ctx.rerender(); } }, 'Skip'),
    );
    box.append(buttons);
    const sr = skipRow(app, ctx, skipKey, skipTo);
    if (sr) box.append(sr);
    return box;
  }
  box.append(buttons);
  return box;
}

function recordHeader(ctx: Ctx, group: SessionGroup, view: RecordView, open: boolean): Child[] {
  const target = view.plan?.target_min;
  const status = ['Record', view.day !== undefined ? `Day ${view.day}` : '', weekTypeOf(view.plan) ?? '', target ? `about ${target} min` : ''].filter(Boolean).join(' · ');
  const counts = [view.plan ? countsText(view.counts) : '', view.minutes !== undefined ? `${view.minutes} min` : ''].filter(Boolean).join(' · ');
  return [
    h('button', { type: 'button', class: 'back', onclick: ctx.goToday }, '‹ Today'),
    h('h1', { class: 'rec-title' }, prettyDate(group.date, true)),
    h('p', { class: 'status-line' }, status),
    h('p', { class: 'muted rec-week' }, weekLine(ctx.config, group.date)),
    open ? h('div', { class: 'tags' }, h('span', { class: 'tag warn' }, 'Not finished')) : null,
    view.plan ? h('div', { class: 'rec-head' }, h('span', {}, counts), h('span', { class: 'muted' }, view.source === 'snapshot' ? 'Plan as shown on the day' : 'Plan rebuilt from your log')) : null,
  ];
}

function alsoLogged(ctx: Ctx, view: RecordView): HTMLElement | null {
  if (!view.extras.length) return null;
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, 'Also logged')),
    ...view.extras.map((s) => {
      const line = outcomeLine(s, ctx.config);
      const slot = slotOfLog(s.item.log);
      const title = s.item.log.kind === 'tm_override' && slot ? `${displayName(slot, ctx.config)} max` : slot ? displayName(slot, ctx.config) : didText(s.item.log, ctx.config);
      return h('div', { class: 'item compact' }, itemHead(title), h('p', { class: line ? 'outcome' : 'did' }, line || didText(s.item.log, ctx.config)), h('div', { class: 'tags' }, ...correctedTags(s)));
    }),
  );
}

function recordScreen(app: App, ctx: Ctx): { body: Child[]; bar: HTMLElement | null } {
  const r = ctx.record!;
  const { group, view } = r;
  const body: Child[] = [...recordHeader(ctx, group, view, r.open)];
  if (!ctx.history.ok) body.push(h('div', { class: 'mode warn' }, "Your history can't be replayed, so corrections are off and the record shows the summaries saved at the time. Refer to the project."));
  if (app.banner) body.push(h('div', { class: 'banner', role: 'alert' }, app.banner));
  const recorded = view.rows.filter((x) => x.status !== 'not_logged');
  const byBlock = new Map<number, RecordRow[]>();
  for (const row of recorded) byBlock.set(row.item.block, [...(byBlock.get(row.item.block) ?? []), row]);
  for (const [, rows] of [...byBlock.entries()].sort((a, b) => a[0] - b[0])) body.push(h('section', { class: 'card' }, ...rows.map((row) => recordItem(app, ctx, view, row))));
  const missing = view.rows.filter((x) => x.status === 'not_logged');
  if (missing.length) {
    body.push(
      h(
        'section',
        { class: 'card not-recorded' },
        h('h2', {}, `Not recorded (${missing.length})`),
        group.date < RELEASE_1 ? h('p', { class: 'sub' }, 'Logged before the app could record a skip. Use Edit to add or skip them; skipping moves nothing.') : null,
        ...missing.map((row) => h('div', { class: 'line' }, h('span', { class: 'nm' }, displayName(row.item.slot, ctx.config)), h('span', { class: 'dt' }, row.item.slot === 'cmj' ? 'Before the warm-up' : plannedText(row.item)))),
      ),
    );
  }
  const also = alsoLogged(ctx, view);
  if (also) body.push(also);
  const bar = ctx.history.ok ? h('div', { class: 'end' }, h('button', { type: 'button', class: 'primary', onclick: ctx.startEdit }, 'Edit session')) : null;
  return { body, bar };
}

function editScreen(app: App, ctx: Ctx, drafts: Draft[]): { body: Child[]; bar: HTMLElement | null } {
  const r = ctx.record!;
  const { group, view } = r;
  const removing = drafts.some((d) => d.slot === WHOLE_SESSION);
  const body: Child[] = [...recordHeader(ctx, group, view, r.open)];
  body.push(h('div', { class: 'mode edit' }, `Editing ${prettyDate(group.date)}. Nothing is saved until you review the changes.`));
  if (app.banner) body.push(h('div', { class: 'banner', role: 'alert' }, app.banner));
  if (removing) body.push(h('div', { class: 'callout warn' }, h('strong', {}, 'This session will be removed'), ' when you save. Every entry in it is taken out of the replay; nothing else is touched.', h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => ctx.dropDraft(WHOLE_SESSION) }, 'Undo this change'))));
  const byBlock = new Map<number, RecordRow[]>();
  for (const row of view.rows) byBlock.set(row.item.block, [...(byBlock.get(row.item.block) ?? []), row]);
  for (const [, rows] of [...byBlock.entries()].sort((a, b) => a[0] - b[0])) body.push(h('section', { class: 'card' }, ...rows.map((row) => editRow(app, ctx, group.date, row, drafts, removing))));
  const also = alsoLogged(ctx, view);
  if (also) body.push(also);
  if (!removing) body.push(h('button', { type: 'button', class: 'subtle danger-text wide', onclick: ctx.removeSession }, 'Remove this session'));
  const n = drafts.length;
  const bar = h('div', { class: 'end two' }, h('button', { type: 'button', class: 'primary', onclick: ctx.reviewEdit }, n ? `Review changes (${n})` : 'Review changes'), h('button', { type: 'button', onclick: ctx.cancelEdit }, 'Cancel'));
  return { body, bar };
}

// ---------------------------------------------------------------------
// Add a missed session (§11A)
// ---------------------------------------------------------------------

/** §5.8: a button showing the date written out; the phone's own picker opens on tap. */
function dateButton(value: IsoDate, min: IsoDate, max: IsoDate, onPick: (date: string) => void): HTMLElement {
  const input = h('input', { type: 'date', min, max, class: 'date-native', 'aria-label': 'When did you train?' });
  input.value = value;
  input.addEventListener('change', () => onPick(input.value));
  input.addEventListener('click', () => {
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      /* the tap itself opens the picker on phones */
    }
  });
  return h('label', { class: 'date-btn' }, h('span', { class: 'date-face' }, prettyDate(value, true)), h('span', { class: 'muted' }, 'Change'), input);
}

function addScreen(app: App, ctx: Ctx, screen: Extract<Screen, { kind: 'add' }>): { body: Child[]; bar: HTMLElement | null } {
  const add = ctx.add!;
  const body: Child[] = [h('div', { class: 'flow-top' }, h('button', { type: 'button', class: 'quiet', onclick: ctx.cancelAdd }, 'Cancel'), h('span', { class: 'muted' }, `Step ${screen.step} of 2`))];
  if (screen.step === 1) {
    body.push(h('h1', {}, 'Add a missed session'), h('p', { class: 'sub' }, "For a session you trained but didn't log."));
    body.push(
      h('div', { class: 'flow-block' }, h('span', { class: 'lab' }, 'When did you train?'), dateButton(screen.date, add.firstDate, app.today, ctx.addDate), h('p', { class: 'sub' }, `Any day from ${prettyDate(add.firstDate)} up to today.`), screen.error ? h('p', { class: 'err', role: 'alert' }, screen.error) : null),
    );
    const choice = (d: SessionDay) =>
      h(
        'button',
        { type: 'button', role: 'radio', 'aria-checked': String(screen.day === d), class: `radio-card${screen.day === d ? ' on' : ''}`, onclick: () => ctx.addDay(d) },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        h('span', {}, h('span', { class: 'rc-title' }, `Day ${d}`), h('span', { class: 'rc-sub' }, add.dayLines[d])),
      );
    body.push(h('div', { class: 'flow-block', role: 'radiogroup', 'aria-label': 'Which session?' }, h('span', { class: 'lab' }, 'Which session?'), choice(1), choice(2)));
    const existing = add.existing;
    if (existing.length && !screen.separate) {
      const days = existing.map((g) => (g.day !== undefined ? `Day ${g.day}` : 'a session')).join(' and ');
      body.push(
        h(
          'section',
          { class: 'card attention' },
          h('h2', {}, `${prettyDate(screen.date)} already has ${days}`),
          h('p', { class: 'sub' }, 'Add what you did to that session, or add a separate session. Nothing is duplicated unless you choose a separate one.'),
          h('div', { class: 'col actions' }, h('button', { type: 'button', class: 'primary', onclick: () => ctx.addToExisting(existing[existing.length - 1]!.id) }, 'Add to that session'), h('button', { type: 'button', onclick: ctx.addSeparate }, 'Add a separate session')),
        ),
      );
    }
    body.push(h('div', { class: 'callout info' }, "Adding a session can change your loads and your next session. You'll see every change before anything is saved."));
    if (app.banner) body.push(h('div', { class: 'banner', role: 'alert' }, app.banner));
    const blocked = existing.length > 0 && !screen.separate;
    const bar = blocked ? null : h('div', { class: 'end' }, h('button', { type: 'button', class: 'primary', onclick: ctx.addNext }, 'Next: enter what you did'));
    return { body, bar };
  }
  body.push(h('div', { class: 'mode edit' }, `Adding ${prettyDate(screen.date)} · Day ${screen.day}. Nothing is saved until you check the changes.`));
  if (app.banner) body.push(h('div', { class: 'banner', role: 'alert' }, app.banner));
  if (!add.plan) {
    body.push(h('p', { class: 'refer' }, 'There is no session in the programme for that date.'));
  } else {
    const items: PlanItem[] = [...(add.plan.pre.includes('cmj') ? [{ slot: 'cmj', name: 'Jump test', block: 0 } as PlanItem] : []), ...add.plan.items];
    const byBlock = new Map<number, PlanItem[]>();
    for (const it of items) byBlock.set(it.block, [...(byBlock.get(it.block) ?? []), it]);
    for (const [, list] of [...byBlock.entries()].sort((a, b) => a[0] - b[0])) {
      body.push(h('section', { class: 'card' }, ...list.map((item) => editRow(app, ctx, screen.date, { item, status: 'not_logged', twice: false }, screen.drafts, false))));
    }
  }
  const n = screen.drafts.length;
  const bar = h('div', { class: 'end two' }, h('button', { type: 'button', class: 'primary', onclick: ctx.reviewAdd }, n ? `Review changes (${n})` : 'Review changes'), h('button', { type: 'button', onclick: ctx.addBack }, 'Back'));
  return { body, bar };
}

// ---------------------------------------------------------------------
// sheets
// ---------------------------------------------------------------------

function previewSheet(ctx: Ctx, sheet: Extract<Sheet, { kind: 'preview' }>): HTMLElement {
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
      h('p', { class: 'sub' }, 'The original entries stay in your log, marked as corrected.'),
      h('div', { class: 'row actions' }, h('button', { type: 'button', class: 'primary', onclick: () => ctx.saveCorrection(note.value.trim()) }, 'Save correction'), h('button', { type: 'button', onclick: ctx.closeSheet }, 'Cancel')),
    );
  }
  return h('div', { class: 'sheet-wrap', onclick: (e: Event) => { if (e.target === e.currentTarget) ctx.closeSheet(); } }, h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Check the change' }, ...body));
}

/** §10: the not-recorded question first; then release 2's summary (§14.6). */
function finishSheet(app: App, ctx: Ctx, f: FinishView): HTMLElement {
  const body: Child[] = [];
  if (!f.finished && f.unrecorded.length) {
    const n = f.unrecorded.length;
    body.push(
      h('h2', {}, `${n} ${n === 1 ? 'item' : 'items'} not recorded`),
      h('ul', { class: 'plan-list' }, ...f.unrecorded.map((u) => h('li', {}, h('span', {}, u.name), h('span', { class: 'muted' }, u.plan)))),
      h('p', { class: 'sub' }, "Log them now, or skip them so this session's record is complete. Skipping moves nothing."),
      h(
        'div',
        { class: 'row actions' },
        h('button', { type: 'button', class: 'primary', onclick: () => ctx.backToSession(f.unrecorded[0]!.slot) }, 'Log them'),
        h('button', { type: 'button', onclick: () => ctx.skipRest(f.unrecorded.map((u) => u.slot)) }, 'Skip the rest'),
      ),
      h('p', { class: 'sub center' }, 'Either way, saving a copy comes next.'),
    );
  } else {
    body.push(
      h('h2', {}, 'Session finished'),
      f.minutes !== undefined ? h('p', { class: 'sub' }, `${f.minutes} min from the first log.`) : null,
      h('h3', {}, 'What moved'),
      f.moved.length ? h('ul', { class: 'list' }, ...f.moved.map((m) => h('li', {}, m))) : h('p', { class: 'sub' }, 'Nothing moved today.'),
      h('h3', {}, "What's next"),
      h('ul', { class: 'list' }, ...f.next.map((m) => h('li', {}, m))),
      h('h3', {}, 'Backup'),
      h('p', { class: `sub backup-status` }, app.backup.status),
      h(
        'div',
        { class: 'row actions' },
        f.backupOk
          ? h('button', { type: 'button', class: 'primary', onclick: ctx.closeSheet }, 'Done')
          : h('button', { type: 'button', class: 'primary', onclick: () => { ctx.closeSheet(); ctx.openExport(); } }, 'Save a copy'),
        f.backupOk
          ? h('button', { type: 'button', onclick: () => { ctx.closeSheet(); ctx.openExport(); } }, 'Save a copy too')
          : h('button', { type: 'button', onclick: ctx.closeSheet }, 'Done'),
      ),
    );
  }
  return h('div', { class: 'sheet-wrap', onclick: (e: Event) => { if (e.target === e.currentTarget) ctx.closeSheet(); } }, h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Finish' }, ...body));
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
      h('p', { class: 'sub' }, `Next session: ${nextFor(app.state, lift, cfg, app.today)}`),
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
// save-a-copy panel
// ---------------------------------------------------------------------

function allEntries(app: App, ctx: Ctx): HTMLElement {
  const steps = [...ctx.history.steps].reverse().slice(0, 200);
  return h(
    'details',
    { class: 'card hist' },
    h('summary', {}, `All log entries (${app.state.log.length})`),
    h('ul', { class: 'raw' }, ...steps.map((s) => h('li', {}, h('time', {}, prettyDate(s.item.log.date)), h('span', {}, s.entry.summary)))),
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
    h('div', { class: 'row' }, h('button', { type: 'button', onclick: ctx.closeExport }, 'Back to Today')),
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
  let screen: { body: Child[]; bar: HTMLElement | null };
  const sc = app.screen;
  if (sc.kind === 'record' && ctx.record) screen = recordScreen(app, ctx);
  else if (sc.kind === 'edit' && ctx.record) screen = editScreen(app, ctx, sc.drafts);
  else if (sc.kind === 'add' && ctx.add) screen = addScreen(app, ctx, sc);
  else screen = todayScreen(app, ctx, appVersion);

  let sheet: HTMLElement | null = null;
  if (app.sheet?.kind === 'preview') sheet = previewSheet(ctx, app.sheet);
  if (app.sheet?.kind === 'tm') sheet = tmSheet(app, ctx, app.sheet.lift);
  if (app.sheet?.kind === 'finish' && ctx.finishView) sheet = finishSheet(app, ctx, ctx.finishView);

  return h('div', { class: `screen-${sc.kind}` }, ...screen.body, screen.bar, app.showExport ? exportPanel(app, ctx) : null, sheet);
}

export { leftText };
