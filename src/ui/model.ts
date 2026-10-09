/**
 * View model for the interface (ui_spec_v1_0.md). Pure: no DOM, no
 * clock (the caller passes "now"). Everything the screens say about the
 * past comes from replaying the log (engine A.28), so a corrected entry
 * reads the same everywhere.
 */
import type { IsoDate, LiftId, MesocycleId, Position, ProgrammeConfig, State } from '../config/types';
import {
  derivedEqual,
  mesocycleOn,
  planSnapshot,
  prescribe,
  prescribeLift,
  programmeWeek,
  replay,
  slotOfLog,
  stateBefore,
} from '../engine';
import type {
  AnyLog,
  BarbellOutcome,
  EffectiveItem,
  ExplosiveOutcome,
  LogEntry,
  PlanItem,
  PlanSnapshot,
  RdlOutcome,
  ReplayStep,
  SessionDay,
  SkipReason,
  SlotOutcome,
} from '../engine';

// ---------------------------------------------------------------------
// words (ui_spec_v1_0.md §2)
// ---------------------------------------------------------------------

export const POSITION_LABEL: Record<Position, string> = { 1: 'Light week', 2: 'Medium week', 3: 'Heavy week' };
export const POSITION_PCT: Record<Position, string> = { 1: '80%', 2: '85%', 3: '90%' };

export const BLOCK_LABEL: Record<MesocycleId, string> = {
  M1: 'Block 1: build tissue and reserve',
  M2: 'Block 2: convert strength to power',
  M3: 'Block 3: ballistic expression',
  M4: 'Block 4: reactive realisation',
  TAPER: 'Taper',
  INTENSIVE: 'Intensive',
};

export const SKIP_LABEL: Record<SkipReason, string> = {
  time: 'Time',
  tissue: 'Tissue',
  equipment: 'Equipment',
  fatigue: 'Fatigue',
  other: 'Other',
};

/** On-screen names where the config's slot name is shorthand. Logs and exports keep the config name. */
export const DISPLAY_NAMES: Record<string, string> = {
  cmj: 'Jump test',
  rsi_ladder: 'Drop jump ladder',
  depth_jump: 'Drop jump',
  depth_landing: 'Drop landing',
  db_pp_strength: 'Dumbbell push press',
  db_pp_explosive: 'Dumbbell push press, fast',
  abductor_hsr: 'Cable hip abduction, slow',
  rdl: 'Romanian deadlift',
  hack_squat: 'Hack squat',
  landmine_press: 'One-arm landmine press',
  landmine_cpp: 'Landmine clean and push press',
  cs_row: 'Chest-supported row',
  kb_swing: 'Kettlebell swing',
  oh_carry: 'One-arm overhead carry',
  spanish_squat_iso: 'Spanish squat hold',
  abd_iso: 'Hip abduction hold',
  y_raise: 'Incline Y-raise',
  pallof: 'Pallof press',
  nordic: 'Nordic curl',
  skater_bound: 'Skater bound',
  trap_bar_jump: 'Trap-bar jump',
  jump_shrug: 'Jump shrug',
  bss: 'Bulgarian split squat',
  pull_up: 'Weighted pull-up',
  front_squat: 'Front squat',
  deadlift: 'Deadlift',
};

export function displayName(slot: string, config: ProgrammeConfig): string {
  return DISPLAY_NAMES[slot] ?? config.slots[slot]?.name ?? slot;
}

/** Load step for the plus and minus buttons (ui_spec §5.1). Typing any value is still allowed. */
export const LOAD_STEP: Record<string, number> = {
  front_squat: 2.5,
  deadlift: 2.5,
  rdl: 2.5,
  jump_shrug: 2.5,
  landmine_press: 2.5,
  landmine_cpp: 2.5,
  pull_up: 2.5,
  hack_squat: 2.5,
  abductor_hsr: 2.5,
  db_pp_strength: 2,
  db_pp_explosive: 2,
  bss: 2,
  cs_row: 2,
};
export const loadStep = (slot: string): number => LOAD_STEP[slot] ?? 2.5;

/** "77.5", "26", "0". */
export function kg(n: number): string {
  return String(Math.round(n * 100) / 100);
}
const f1 = (n: number): string => n.toFixed(1);
export const leftText = (rir: number): string => (rir >= 4 ? '4+ left' : `${rir} left`);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 6 Oct", or "Tue 6 Oct 2026". */
export function prettyDate(iso: IsoDate, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} ${MONTHS[m! - 1]}${withYear ? ` ${y}` : ''}`;
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n));
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// history: the replayed log, by date
// ---------------------------------------------------------------------

export interface History {
  /** Replaying the log reproduces the stored state (A.28). When false, corrections are off and lines use the saved summaries. */
  ok: boolean;
  steps: ReplayStep[];
  byDate: Map<IsoDate, ReplayStep[]>;
  /** Dates with anything logged, newest first. */
  dates: IsoDate[];
}

function isLogEntry(e: unknown): e is LogEntry {
  return typeof e === 'object' && e !== null && 'kind' in e && 'date' in e && 'log' in e && 'summary' in e;
}

export function buildHistory(base: State, state: State, config: ProgrammeConfig): History {
  let steps: ReplayStep[] | null = null;
  let ok = false;
  try {
    const r = replay(base, state.log, config);
    ok = derivedEqual(r.state, state);
    if (ok) steps = r.steps;
  } catch {
    ok = false;
  }
  if (!steps) {
    // Fallback: the raw entries with the summaries saved at the time.
    steps = [];
    state.log.forEach((e, i) => {
      if (!isLogEntry(e) || e.log.kind === 'correction') return;
      const item: EffectiveItem = { origin: i, log: e.log, corrections: [] };
      const saved = (e as LogEntry & { steps?: string[] }).steps ?? [];
      steps!.push({ item, entry: e, explanation: { summary: e.summary, steps: saved.map((text) => ({ rule: 'saved', text, numbers: {} })) }, outcome: null });
    });
  }
  const byDate = new Map<IsoDate, ReplayStep[]>();
  for (const s of steps) {
    const d = s.item.log.date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(s);
  }
  const dates = [...byDate.keys()].sort().reverse();
  return { ok, steps, byDate, dates };
}

const ITEM_KINDS = new Set(['barbell', 'rdl', 'slot', 'fixed', 'explosive', 'skip', 'cmj']);

/** The session's day for a date, from what was logged on it. */
export function dayFor(steps: readonly ReplayStep[], date: IsoDate, config: ProgrammeConfig): SessionDay | undefined {
  for (const s of steps) {
    const l = s.item.log;
    if (l.kind === 'session_start') return l.day;
  }
  for (const s of steps) {
    const l = s.item.log;
    if (l.kind === 'barbell' || l.kind === 'single') return l.lift === 'front_squat' ? 1 : 2;
  }
  for (const s of steps) {
    const l = s.item.log;
    if (l.kind === 'session_end') return l.day;
  }
  const meso = mesocycleOn(config, date);
  const tpl = meso?.template ? config.templates[meso.template] : undefined;
  if (!tpl || tpl.both_days) return undefined;
  const slotsOf = (day: 'day1' | 'day2') => new Set(tpl[day]!.blocks.flatMap((b) => b.items).flatMap((it) => (typeof it === 'string' ? [] : [it.slot])));
  const d1 = slotsOf('day1');
  const d2 = slotsOf('day2');
  for (const s of steps) {
    const slot = slotOfLog(s.item.log);
    if (!slot || !ITEM_KINDS.has(s.item.log.kind)) continue;
    if (d1.has(slot) && !d2.has(slot)) return 1;
    if (d2.has(slot) && !d1.has(slot)) return 2;
  }
  return undefined;
}

/**
 * ui_spec §9: the live date is today, unless a session started before
 * today is still open (started, not finished, within the last 6 hours).
 */
export function liveDate(today: IsoDate, nowMs: number, history: History): IsoDate {
  const OPEN_MS = 6 * 3600_000;
  for (const date of history.dates) {
    if (date >= today) continue;
    const steps = history.byDate.get(date)!;
    const start = [...steps].reverse().find((s) => s.item.log.kind === 'session_start');
    if (!start || start.item.log.kind !== 'session_start' || !start.item.log.at) return today;
    const ended = steps.some((s) => s.item.log.kind === 'session_end');
    const at = Date.parse(start.item.log.at);
    if (!ended && Number.isFinite(at) && nowMs - at >= 0 && nowMs - at < OPEN_MS) return date;
    return today;
  }
  return today;
}

/** The last time a slot was logged before a date; for barbell lifts, optionally at the same week type. */
export function lastLogged(history: History, slot: string, before: IsoDate, position?: Position): ReplayStep | undefined {
  for (let i = history.steps.length - 1; i >= 0; i--) {
    const s = history.steps[i]!;
    const l = s.item.log;
    if (l.date >= before) continue;
    if (slotOfLog(l) !== slot) continue;
    if (!['barbell', 'rdl', 'slot', 'explosive', 'fixed', 'cmj'].includes(l.kind)) continue;
    if (position !== undefined && l.kind === 'barbell' && l.position !== position) continue;
    return s;
  }
  return undefined;
}

// ---------------------------------------------------------------------
// lines (ui_spec §12)
// ---------------------------------------------------------------------

/** What was done, in one line. */
export function didText(log: AnyLog, config: ProgrammeConfig): string {
  switch (log.kind) {
    case 'barbell':
      return `${log.single ? `Single ${kg(log.single.load)} kg, then ` : ''}${kg(log.last_set.load)} kg · last set ${log.last_set.reps}, ${leftText(log.last_set.rir)}${log.missed ? ' · an earlier set fell short' : ''}`;
    case 'rdl':
    case 'slot':
      return `${loadText(log.slot, log.load)} · last set ${log.last_set.reps}, ${leftText(log.last_set.rir)}${log.last_set.tempo_break ? ', tempo broke' : ''}`;
    case 'fixed':
      return log.done ? `Done${log.value !== undefined ? ` · ${log.value}` : ''}` : 'Not done';
    case 'explosive':
      return `${kg(log.load)} kg · ${log.sets_done} sets${log.cut ? ' · a set cut short' : ''}`;
    case 'skip':
      return `Skipped${log.reason ? ` · ${SKIP_LABEL[log.reason]}` : ''}`;
    case 'cmj':
      return `${kg(log.value)} cm`;
    case 'single':
      return `Test single ${kg(log.load)} kg`;
    case 'single_skipped':
      return 'Test single skipped';
    case 'tm_override':
      return `Max set by hand to ${f1(log.tm)} kg`;
    case 'depth_jump_height':
      return `Drop height ${log.height_cm} cm`;
    case 'session_start':
      return `Day ${log.day} started`;
    case 'session_end':
      return `Day ${log.day} finished${log.minutes !== undefined ? ` · ${log.minutes} min` : ''}`;
    case 'tissue_check':
      return 'Tissue check';
  }
  return displayName((log as { kind: string }).kind, config);
}

/** "26 kg", or "Bodyweight" for an unloaded pull-up. */
export function loadText(slot: string, load: number): string {
  return slot === 'pull_up' && load === 0 ? 'Bodyweight' : `${kg(load)} kg`;
}

/** The plan for one item, in one line. */
export function plannedText(item: PlanItem): string {
  const parts: string[] = [];
  if (item.position !== undefined) parts.push(POSITION_LABEL[item.position]);
  if (item.load !== undefined && item.load !== null) parts.push(loadText(item.slot, item.load));
  const sets = item.sets !== undefined ? (item.sets_max !== undefined ? `${item.sets}–${item.sets_max}` : `${item.sets}`) : undefined;
  const side = item.per_side ? ' each side' : '';
  if (sets && item.reps !== undefined) parts.push(`${sets} × ${item.reps}${side}`);
  else if (sets && item.rep_range) parts.push(`${sets} × ${item.rep_range[0]}–${item.rep_range[1]}`);
  else if (sets && item.secs !== undefined) parts.push(`${sets} × ${item.secs} s${side}`);
  else if (sets) parts.push(`${sets} sets`);
  if (item.contacts !== undefined) parts.push(`${item.contacts} jumps`);
  return parts.join(' · ') || 'As planned';
}

function numberFrom(step: ReplayStep, key: string): number | undefined {
  for (const s of step.explanation.steps) {
    const v = s.numbers?.[key];
    if (typeof v === 'number') return v;
  }
  return undefined;
}

/** What a logged entry changed, in plain words. Empty when it changes nothing worth saying. */
export function outcomeLine(step: ReplayStep, config: ProgrammeConfig): string {
  const log = step.item.log;
  const o = step.outcome;
  if (o === null && !['skip', 'cmj', 'single', 'tm_override', 'depth_jump_height', 'fixed', 'session_start', 'session_end', 'single_skipped', 'tissue_check'].includes(log.kind)) {
    return step.explanation.summary;
  }
  switch (log.kind) {
    case 'barbell': {
      const b = o as BarbellOutcome;
      let line: string;
      const delta = b.tm_after - b.tm_before;
      switch (b.rule) {
        case 'position1':
          line = `Light week: max unchanged at ${f1(b.tm_after)} kg.`;
          break;
        case 'failure':
          line = `Short of the prescription: max ${f1(b.tm_before)} → ${f1(b.tm_after)} kg (−2.5%).`;
          break;
        case 'single':
          line = `Straight sets after a test single. Max ${f1(b.tm_after)} kg.`;
          break;
        case 'hold':
          line = `Max held at ${f1(b.tm_after)} kg in this block.`;
          break;
        default:
          line = Math.abs(delta) < 0.05 ? `Max holds at ${f1(b.tm_after)} kg.` : `Max ${f1(b.tm_before)} → ${f1(b.tm_after)} kg (${delta > 0 ? '+' : '−'}${f1(Math.abs(delta))}).`;
      }
      if (b.single_scheduled && b.rule !== 'position1') line += ' A test single is suggested next time.';
      return line;
    }
    case 'single': {
      const tm = numberFrom(step, 'tm_after');
      return tm !== undefined ? `Max reset to ${f1(tm)} kg. Today's sets are straight sets.` : step.explanation.summary;
    }
    case 'rdl': {
      const r = o as RdlOutcome;
      if (r.withheld) return `Next time ${kg(r.load_after)} kg (no increases after week 22).`;
      if (r.delta_kg > 0) return `Next time ${kg(r.load_after)} kg (+${kg(r.delta_kg)}).`;
      if (r.delta_kg < 0) return `Next time ${kg(r.load_after)} kg (−${kg(-r.delta_kg)}).`;
      return `Next time ${kg(r.load_after)} kg (hold).`;
    }
    case 'slot': {
      const s = o as SlotOutcome;
      const slot = config.slots[log.slot];
      const n = slot?.streak ?? 2;
      const inc = s.increment.kind === 'kg' ? s.increment.kg : null;
      const unit = s.increment.kind === 'kg' && s.increment.per_hand ? ' per hand' : '';
      const load = s.load_after;
      if (s.withheld) return `Step earned, but no increases after week 22. Holding ${load !== null ? kg(load) : '–'} kg.`;
      if (s.direction === 'up') return s.delta_kg !== undefined && load !== null ? `Up to ${kg(load)} kg${unit} next time.` : `Go up ${s.increment.kind === 'text' ? s.increment.text : 'one step'} next time.`;
      if (s.direction === 'down') return s.delta_kg !== undefined && load !== null ? `Down to ${kg(load)} kg${unit} next time.` : `Go down ${s.increment.kind === 'text' ? s.increment.text : 'one step'} next time.`;
      const towards = inc !== null && load !== null ? `${kg(load + inc)} kg` : 'the next step';
      const head = s.direction === 'set' && load !== null ? `Load set at ${kg(load)} kg${unit}.` : `Holding ${load !== null ? kg(load) : '–'} kg${unit}`;
      if (s.streak_up > 0) return `${head}${s.direction === 'set' ? '' : ' ·'} ${s.streak_up} of ${n} towards ${towards}.`;
      if (s.streak_down > 0) return `${head}${s.direction === 'set' ? '' : ' ·'} ${s.streak_down} of ${n} short sessions.`;
      return s.direction === 'set' ? head : `${head}.`;
    }
    case 'explosive': {
      const e = o as ExplosiveOutcome;
      switch (e.rule) {
        case 'first':
          return `Load set at ${kg(e.load_after)} kg.`;
        case 'changed':
          return `Load changed to ${kg(e.load_after)} kg; the count restarts.`;
        case 'step':
          return `Up to ${kg(e.load_after)} kg next time.`;
        case 'clean':
          return `Holding ${kg(e.load_after)} kg · ${e.clean_streak} clean session${e.clean_streak === 1 ? '' : 's'} banked.`;
        case 'cut':
          return `Holding ${kg(e.load_after)} kg; a set was cut short, so the count restarts.`;
        case 'withheld':
          return `Step earned, but no increases after week 22.`;
        case 'fixed':
          return 'Same dumbbells all block.';
      }
      return '';
    }
    case 'skip':
      return 'Nothing moves.';
    case 'cmj': {
      const m = /Running mean of (\d+): ([\d.]+) cm/.exec(step.explanation.summary);
      return m ? `Average ${m[2]} cm over ${m[1]}.` : '';
    }
    case 'tm_override': {
      const from = numberFrom(step, 'from');
      const to = numberFrom(step, 'to');
      return from !== undefined && to !== undefined ? `Max set by hand ${f1(from)} → ${f1(to)} kg.` : step.explanation.summary;
    }
    case 'depth_jump_height':
      return `Drop height set to ${log.height_cm} cm.`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------
// what changes (ui_spec §7 preview)
// ---------------------------------------------------------------------

const LIFTS: LiftId[] = ['front_squat', 'deadlift'];

/** The next session for a lift, in words: "Heavy week 87.5 kg". */
export function nextFor(state: State, lift: LiftId, config: ProgrammeConfig, date: IsoDate): string {
  const p = prescribeLift(state, config, lift, date);
  if (p.kind !== 'lift') return 'refer to project';
  return `${p.position !== undefined ? `${POSITION_LABEL[p.position]} ` : ''}${kg(p.load)} kg`;
}

function streakText(up: number, down: number, n: number): string {
  if (up > 0) return `${up} of ${n} towards a step up`;
  if (down > 0) return `${down} of ${n} short sessions`;
  return `0 of ${n}`;
}

/** Every derived difference between two states, in plain words. */
export function stateDiff(a: State, b: State, config: ProgrammeConfig, date: IsoDate): string[] {
  const lines: string[] = [];
  for (const lift of LIFTS) {
    const name = displayName(lift, config);
    const la = a.lifts[lift];
    const lb = b.lifts[lift];
    if (Math.abs(la.tm - lb.tm) >= 0.05) lines.push(`${name} max ${f1(la.tm)} → ${f1(lb.tm)} kg`);
    const na = nextFor(a, lift, config, date);
    const nb = nextFor(b, lift, config, date);
    if (na !== nb) lines.push(`${name} next session: ${na} → ${nb}`);
    if (la.single_scheduled !== lb.single_scheduled) lines.push(`${name}: test single ${lb.single_scheduled ? 'now suggested' : 'no longer suggested'}`);
  }
  if (a.rdl.load_kg !== b.rdl.load_kg) lines.push(`${displayName('rdl', config)} next load ${kg(a.rdl.load_kg)} → ${kg(b.rdl.load_kg)} kg`);
  const accIds = new Set([...Object.keys(a.accessories), ...Object.keys(b.accessories)]);
  for (const id of accIds) {
    const x = a.accessories[id] ?? { load: null, streak_up: 0, streak_down: 0 };
    const y = b.accessories[id] ?? { load: null, streak_up: 0, streak_down: 0 };
    const name = displayName(id, config);
    const n = config.slots[id]?.streak ?? 2;
    if (x.load !== y.load) lines.push(`${name} ${x.load === null ? 'not set' : `${kg(x.load)} kg`} → ${y.load === null ? 'not set' : `${kg(y.load)} kg`}`);
    if (x.pending !== y.pending) lines.push(`${name}: ${y.pending ? `go ${y.pending} one step next time` : 'no step owed'}`);
    if (x.streak_up !== y.streak_up || x.streak_down !== y.streak_down) lines.push(`${name}: ${streakText(x.streak_up, x.streak_down, n)} → ${streakText(y.streak_up, y.streak_down, n)}`);
  }
  const exIds = new Set([...Object.keys(a.explosive ?? {}), ...Object.keys(b.explosive ?? {})]);
  for (const id of exIds) {
    const x = a.explosive?.[id];
    const y = b.explosive?.[id];
    const name = displayName(id, config);
    if (x?.load !== y?.load) lines.push(`${name} ${x ? `${kg(x.load)} kg` : 'not set'} → ${y ? `${kg(y.load)} kg` : 'not set'}`);
    else if (x?.clean_streak !== y?.clean_streak) lines.push(`${name}: ${x?.clean_streak ?? 0} → ${y?.clean_streak ?? 0} clean sessions banked`);
  }
  if (a.depth_jump.height_cm !== b.depth_jump.height_cm) lines.push(`Drop height ${a.depth_jump.height_cm ?? 'not set'} → ${b.depth_jump.height_cm ?? 'not set'} cm`);
  if (a.cmj.series.length !== b.cmj.series.length) lines.push(`Jump test readings ${a.cmj.series.length} → ${b.cmj.series.length}`);
  return lines;
}

// ---------------------------------------------------------------------
// the record of a date (ui_spec §4.2)
// ---------------------------------------------------------------------

export type RowStatus = 'done' | 'skipped' | 'not_logged';

export interface RecordRow {
  item: PlanItem;
  status: RowStatus;
  /** The entry that decides the status (the last one for the slot that day). */
  step?: ReplayStep;
  /** A test single logged before the work sets. */
  single?: ReplayStep;
  /** More than one entry for the slot that day. */
  twice: boolean;
}

export interface RecordView {
  date: IsoDate;
  day?: SessionDay;
  source: 'snapshot' | 'rebuilt' | 'none';
  plan?: PlanSnapshot;
  rows: RecordRow[];
  /** Logged that day but not in the plan. */
  extras: ReplayStep[];
  counts: { planned: number; done: number; skipped: number };
  minutes?: number;
}

const ROW_KINDS = new Set(['barbell', 'rdl', 'slot', 'fixed', 'explosive', 'skip', 'cmj']);

/** The plan for a date: the snapshot saved on the day, else rebuilt by replay (A.27). */
export function planFor(history: History, base: State, state: State, config: ProgrammeConfig, date: IsoDate, day: SessionDay): { plan?: PlanSnapshot; source: RecordView['source'] } {
  const steps = history.byDate.get(date) ?? [];
  const start = steps.find((s) => s.item.log.kind === 'session_start');
  if (start && start.item.log.kind === 'session_start') return { plan: start.item.log.plan, source: 'snapshot' };
  if (!history.ok) return { source: 'none' };
  const before = stateBefore(base, state.log, config, date);
  const s = prescribe(before, config, date, day);
  if (s.kind !== 'session') return { source: 'none' };
  return { plan: planSnapshot(s), source: 'rebuilt' };
}

export function recordFor(history: History, base: State, state: State, config: ProgrammeConfig, date: IsoDate, dayHint?: SessionDay): RecordView {
  const steps = history.byDate.get(date) ?? [];
  const day = dayFor(steps, date, config) ?? dayHint;
  const view: RecordView = { date, source: 'none', rows: [], extras: [], counts: { planned: 0, done: 0, skipped: 0 } };
  if (day !== undefined) view.day = day;
  if (day !== undefined) {
    const { plan, source } = planFor(history, base, state, config, date, day);
    view.source = source;
    if (plan) view.plan = plan;
  }
  const used = new Set<ReplayStep>();
  const items: PlanItem[] = [];
  if (view.plan?.pre.includes('cmj')) items.push({ slot: 'cmj', name: 'Jump test', block: 0 });
  if (view.plan) items.push(...view.plan.items);
  for (const item of items) {
    const mine = steps.filter((s) => ROW_KINDS.has(s.item.log.kind) && slotOfLog(s.item.log) === item.slot);
    const singles = steps.filter((s) => s.item.log.kind === 'single' && slotOfLog(s.item.log) === item.slot);
    mine.forEach((s) => used.add(s));
    singles.forEach((s) => used.add(s));
    const last = mine[mine.length - 1];
    const isSkip = last ? last.item.log.kind === 'skip' || (last.item.log.kind === 'fixed' && !last.item.log.done) : false;
    const row: RecordRow = { item, status: last ? (isSkip ? 'skipped' : 'done') : 'not_logged', twice: mine.length > 1 };
    if (last) row.step = last;
    if (singles.length) row.single = singles[singles.length - 1]!;
    view.rows.push(row);
  }
  for (const s of steps) {
    if (used.has(s)) continue;
    if (s.item.log.kind === 'session_start' || s.item.log.kind === 'session_end') continue;
    view.extras.push(s);
  }
  view.counts = {
    planned: view.rows.length,
    done: view.rows.filter((r) => r.status === 'done').length,
    skipped: view.rows.filter((r) => r.status === 'skipped').length,
  };
  const end = [...steps].reverse().find((s) => s.item.log.kind === 'session_end');
  if (end && end.item.log.kind === 'session_end' && end.item.log.minutes !== undefined) view.minutes = end.item.log.minutes;
  return view;
}

/** Context line pieces for a date. */
export function contextFor(config: ProgrammeConfig, date: IsoDate): { week: number; total: number; block?: string } {
  const meso = mesocycleOn(config, date);
  const last = config.mesocycles.filter((m) => m.template !== null).at(-1);
  const out: { week: number; total: number; block?: string } = { week: programmeWeek(config, date), total: last ? last.weeks[1] : 25 };
  if (meso) out.block = BLOCK_LABEL[meso.id];
  return out;
}
