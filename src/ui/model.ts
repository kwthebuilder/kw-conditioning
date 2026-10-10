/**
 * View model for the interface (ui_spec_v1_3.md). Pure: no DOM, no
 * clock (the caller passes "now" and "today"). Everything the screens say
 * about the past comes from replaying the log (engine A.28), so a
 * corrected entry reads the same everywhere.
 */
import type { IsoDate, LiftId, MesocycleId, Position, ProgrammeConfig, State } from '../config/types';
import {
  daysBetween,
  defaultDay,
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
  CorrectionAction,
  CorrectionTarget,
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
// words (ui_spec_v1_3.md §2)
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

/** Load step for the plus and minus buttons (ui_spec §5.1). Typing a value is allowed within the equipment's range. */
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

/** §5.1: dumbbell slots, held to the rack's range (config db_min_kg, db_max_kg). The chest-supported row is not one. */
export const DB_SLOTS = new Set(['db_pp_strength', 'db_pp_explosive', 'bss']);

/** The load range a slot's buttons and typed values must stay inside, if it has one. */
export function loadRange(slot: string, config: ProgrammeConfig): [number, number] | undefined {
  return DB_SLOTS.has(slot) ? [config.equipment.db_min_kg, config.equipment.db_max_kg] : undefined;
}

export function rangeText(range: [number, number]): string {
  return `Your dumbbells run ${kg(range[0])} to ${kg(range[1])} kg.`;
}

/** "77.5", "26", "0". */
export function kg(n: number): string {
  return String(Math.round(n * 100) / 100);
}
const f1 = (n: number): string => n.toFixed(1);
export const leftText = (rir: number): string => (rir >= 4 ? '4+ left' : `${rir} left`);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 6 Oct", or "Tue 6 Oct 2026". */
export function prettyDate(iso: IsoDate, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} ${MONTHS[m! - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "Thursday". */
export function weekdayName(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS_LONG[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

/** "5 to 11 Oct", "28 Sep to 4 Oct". */
export function rangeOfDates(from: IsoDate, to: IsoDate): string {
  const [, m1, d1] = from.split('-').map(Number);
  const [, m2, d2] = to.split('-').map(Number);
  return m1 === m2 ? `${d1} to ${d2} ${MONTHS[m2! - 1]}` : `${d1} ${MONTHS[m1! - 1]} to ${d2} ${MONTHS[m2! - 1]}`;
}

/** "19:05" in the phone's time, from an ISO timestamp. */
export function clockTime(at: string | undefined): string | undefined {
  if (!at) return undefined;
  const t = new Date(at);
  if (!Number.isFinite(t.getTime())) return undefined;
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
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
    case 'tissue_check': {
      const sc = log.scores;
      const parts = TISSUE_SITES.filter((t) => sc[t.key] !== undefined).map((t) => `${t.label} ${sc[t.key]}`);
      return `${parts.join(' · ') || 'No scores'}${log.for_date ? ` (after ${prettyDate(log.for_date)})` : ''}`;
    }
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
  else if (item.reps !== undefined) parts.push(`${item.reps} reps${side}`);
  else if (item.secs !== undefined) parts.push(`${item.secs} s${side}`);
  if (item.contacts !== undefined) parts.push(`${item.contacts} jumps`);
  if (item.landings) parts.push(`${item.landings[0]}–${item.landings[1]} landings`);
  if (item.variant) parts.push(item.variant);
  if (item.inside_rest) parts.push('inside the rests');
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
          if (log.last_set.reps > log.prescribed.reps + 2) line += ` ${LIGHT_WEEK_EXTRA}`;
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
    case 'tissue_check':
      return Object.values(log.scores).some((v) => (v ?? 0) > 3) ? 'Above 3/10: the flare protocol applies.' : '';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------
// release 2 helpers (ui_spec §14)
// ---------------------------------------------------------------------

/** §14.7: the extra line on a light week taken well past the prescription. */
export const LIGHT_WEEK_EXTRA = "Light weeks are for recovery; extra reps here don't count towards your max.";

export const TISSUE_SITES = [
  { key: 'patellar', label: 'Patellar', site: 'patellar' },
  { key: 'gluteal', label: 'Gluteal', site: 'gluteal' },
  { key: 'shoulder', label: 'Left shoulder', site: null },
] as const;
export type TissueKey = (typeof TISSUE_SITES)[number]['key'];

/**
 * §14.9: the athlete's flare protocol, word for word from the programme
 * context transfer (v8, clinical register item 5). Shown above 3/10.
 */
export const FLARE_PROTOCOL =
  'Pain above 3/10 persisting beyond 24 h: drop plyometrics, cut load 30-50%, reintroduce isotonic at 50-60% of pre-flare and progress ~10% every 3-4 sessions. Above 5/10 or worsening night pain: physio. Never cease; reduce. Return to plyometrics only when isotonic work at pre-flare levels is pain-free, restarting at 50% of pre-flare volume. Monitoring is the 24-48 h response.';

const SESSION_KINDS = new Set(['barbell', 'rdl', 'slot', 'fixed', 'explosive', 'cmj', 'single']);

/** The most recent date before `date` with a session item logged. */
export function lastSessionBefore(history: History, date: IsoDate): IsoDate | undefined {
  for (const d of history.dates) {
    if (d >= date) continue;
    if ((history.byDate.get(d) ?? []).some((s) => SESSION_KINDS.has(s.item.log.kind))) return d;
  }
  return undefined;
}

/** §14.9: the session a check-in is due for today (one or two days after it), if not yet done. */
export function checkInDue(history: History, today: IsoDate): IsoDate | undefined {
  const last = lastSessionBefore(history, today);
  if (!last) return undefined;
  const gap = daysBetween(last, today);
  if (gap < 1 || gap > 2) return undefined;
  const done = history.steps.some((s) => s.item.log.kind === 'tissue_check' && (s.item.log.for_date ?? s.item.log.date) === last);
  return done ? undefined : last;
}

/** The latest check-in in the last two days, if any. */
export function recentCheckIn(history: History, today: IsoDate): { date: IsoDate; scores: Partial<Record<TissueKey, number>> } | undefined {
  for (let i = history.steps.length - 1; i >= 0; i--) {
    const l = history.steps[i]!.item.log;
    if (l.kind !== 'tissue_check') continue;
    const gap = daysBetween(l.date, today);
    if (gap < 0 || gap > 2) continue;
    return { date: l.date, scores: l.scores };
  }
  return undefined;
}

/** "Gluteal 2/10 yesterday" for each site an item loads that scored above 0 recently. */
export function tissueTags(history: History, today: IsoDate, slot: string, config: ProgrammeConfig): string[] {
  const c = recentCheckIn(history, today);
  if (!c) return [];
  const sites = config.slots[slot]?.sites ?? [];
  const when = c.date === today ? 'today' : daysBetween(c.date, today) === 1 ? 'yesterday' : prettyDate(c.date);
  const out: string[] = [];
  for (const t of TISSUE_SITES) {
    if (t.site === null || !(sites as readonly string[]).includes(t.site)) continue;
    const v = c.scores[t.key];
    if (v !== undefined && v > 0) out.push(`${t.label} ${v}/10 ${when}`);
  }
  return out;
}

/** Whole minutes from an ISO timestamp to now, or undefined. */
export function minutesSince(at: string | undefined, nowMs: number): number | undefined {
  if (!at) return undefined;
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return undefined;
  const m = Math.round((nowMs - t) / 60_000);
  return m > 0 && m < 600 ? m : undefined;
}

/** "1:05", "12:30", "1:02:03". */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
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
  // §7 (release 1.1): which day Today offers next, by engine A.22.
  const da = defaultDay(a);
  const db = defaultDay(b);
  if (da !== db) lines.push(`Your next session: Day ${da} → Day ${db}`);
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
// sessions (ui_spec_v1_3.md §9, §11): the replayed log grouped into sessions
// ---------------------------------------------------------------------

/** §9: sessions dated before this are never treated as open (SPEC_QUESTIONS Q28). */
export const OPEN_FROM: IsoDate = '2026-10-11';
/** §4.2: sessions before release 1 (9 Oct) were logged before the app could record a skip. */
export const RELEASE_1: IsoDate = '2026-10-09';

/** Entries that belong to a session. Others (a max set by hand, a check-in, a drop height) attach to one if it shares the date. */
const SESSION_ENTRY = new Set(['barbell', 'rdl', 'slot', 'fixed', 'explosive', 'skip', 'cmj', 'single', 'single_skipped', 'session_start', 'session_end']);

export interface SessionGroup {
  /** Stable key: the origin of the session's first entry in the log. */
  id: string;
  date: IsoDate;
  day?: SessionDay;
  /** The session_start entry, when the session was logged with one (engine A.27). */
  start?: ReplayStep;
  /** The first session_end entry. */
  end?: ReplayStep;
  /** Every entry of the session in log order, including entries attached by date. */
  steps: ReplayStep[];
}

export function originKey(o: CorrectionTarget): string {
  return typeof o === 'number' ? String(o) : `${o[0]}.${o[1]}`;
}

/**
 * The corrected log as sessions, oldest first. A session_start opens a
 * session; every other session entry joins the latest session of its
 * date that has not ended (else the latest of its date), so entries
 * logged on the next day into a carried-on session stay in it (§9), and
 * an added separate session keeps to itself (§11A). Sessions logged
 * before release 1 have no session_start and are grouped by date.
 */
export function sessionsFrom(history: History, config: ProgrammeConfig): SessionGroup[] {
  const groups: SessionGroup[] = [];
  const byDate = new Map<IsoDate, SessionGroup[]>();
  const index = new Map<ReplayStep, number>();
  const latest = (date: IsoDate): SessionGroup | undefined => {
    const list = byDate.get(date) ?? [];
    return [...list].reverse().find((g) => !g.end) ?? list[list.length - 1];
  };
  const extras: ReplayStep[] = [];
  history.steps.forEach((s, i) => {
    index.set(s, i);
    const l = s.item.log;
    if (!SESSION_ENTRY.has(l.kind)) {
      extras.push(s);
      return;
    }
    let g = l.kind === 'session_start' ? undefined : latest(l.date);
    if (!g) {
      g = { id: originKey(s.item.origin), date: l.date, steps: [] };
      groups.push(g);
      byDate.set(l.date, [...(byDate.get(l.date) ?? []), g]);
    }
    g.steps.push(s);
    if (l.kind === 'session_start' && !g.start) g.start = s;
    if (l.kind === 'session_end' && !g.end) g.end = s;
  });
  // Extras join the latest session of their date that started before them, else the first of that date.
  for (const x of extras) {
    const list = byDate.get(x.item.log.date);
    if (!list) continue;
    const at = index.get(x)!;
    const g = [...list].reverse().find((c) => index.get(c.steps[0]!)! < at) ?? list[0]!;
    g.steps.push(x);
    g.steps.sort((a, b) => index.get(a)! - index.get(b)!);
  }
  for (const g of groups) {
    const d = dayFor(g.steps, g.date, config);
    if (d !== undefined) g.day = d;
  }
  return groups;
}

/**
 * §9: open from its first log until Finish, Close it, or the end of the
 * day after its date. A session dated today is the live one; one from
 * before release 1.1 (OPEN_FROM) is never open on the day after, so it
 * never produces the unfinished-session card.
 */
export function isOpen(g: SessionGroup, today: IsoDate): boolean {
  if (!g.start || g.end) return false;
  const d = daysBetween(g.date, today);
  if (d === 0) return true;
  return d === 1 && g.date >= OPEN_FROM;
}

/** The open session, if any (there is at most one: the next cannot start while one is open). */
export function openSession(groups: readonly SessionGroup[], today: IsoDate): SessionGroup | undefined {
  return [...groups].reverse().find((g) => isOpen(g, today));
}

/** §11A: the latest session of a day before a date. */
export function lastSessionOfDay(groups: readonly SessionGroup[], day: SessionDay, before: IsoDate): SessionGroup | undefined {
  return [...groups].reverse().find((g) => g.day === day && g.date < before);
}

/** §4.3: Remove this session: one removal per entry of the session (entries attached by date stay). */
export function sessionRemoval(g: SessionGroup): CorrectionAction[] {
  return g.steps.filter((s) => SESSION_ENTRY.has(s.item.log.kind)).map((s) => ({ op: 'remove' as const, target: s.item.origin }));
}

/**
 * §11A: the derived state where entries for `date` will be inserted
 * (engine A.28 places them before the first entry dated later), so the
 * plan shown for an added session is the one its numbers replay from.
 */
export function stateAtInsert(base: State, raw: readonly unknown[], config: ProgrammeConfig, date: IsoDate): State {
  return replay(base, raw, config, (item) => item.log.date > date).state;
}

/** The derived state just before a session's first entry (what the session moved, §14.6). */
export function stateBeforeSession(base: State, raw: readonly unknown[], config: ProgrammeConfig, g: SessionGroup): State {
  const first = g.steps[0]?.item.origin;
  if (first === undefined) return replay(base, raw, config).state;
  return replay(base, raw, config, (item) => originKey(item.origin) === originKey(first)).state;
}

// ---------------------------------------------------------------------
// history by programme week (ui_spec §11)
// ---------------------------------------------------------------------

export type HistoryLine =
  | { kind: 'week'; week: number; from: IsoDate; to: IsoDate; sessions: SessionGroup[] }
  | { kind: 'empty'; first: number; last: number; current: boolean };

export function weekStart(config: ProgrammeConfig, week: number): IsoDate {
  return addDays(config.mesocycles[0]!.start, (week - 1) * 7);
}

/**
 * Newest week first, from the current week back to the first week with a
 * session. Consecutive weeks without sessions fold into one line; the
 * current week with nothing yet has a line of its own. `weeks` limits the
 * list to that many programme weeks; `more` says earlier weeks exist.
 */
export function historyLines(groups: readonly SessionGroup[], config: ProgrammeConfig, today: IsoDate, weeks?: number): { lines: HistoryLine[]; more: boolean } {
  if (!groups.length) return { lines: [], more: false };
  const current = programmeWeek(config, today);
  const byWeek = new Map<number, SessionGroup[]>();
  groups.forEach((g) => {
    const w = programmeWeek(config, g.date);
    byWeek.set(w, [...(byWeek.get(w) ?? []), g]);
  });
  const first = Math.min(...byWeek.keys());
  const top = Math.max(current, ...byWeek.keys());
  const bottom = weeks !== undefined ? Math.max(first, top - weeks + 1) : first;
  const lines: HistoryLine[] = [];
  let w = top;
  while (w >= bottom) {
    const list = byWeek.get(w);
    if (list) {
      lines.push({ kind: 'week', week: w, from: weekStart(config, w), to: addDays(weekStart(config, w), 6), sessions: [...list].reverse() });
      w -= 1;
      continue;
    }
    if (w === current) {
      lines.push({ kind: 'empty', first: w, last: w, current: true });
      w -= 1;
      continue;
    }
    let lo = w;
    while (lo - 1 >= bottom && !byWeek.has(lo - 1) && lo - 1 !== current) lo -= 1;
    lines.push({ kind: 'empty', first: lo, last: w, current: false });
    w = lo - 1;
  }
  return { lines, more: bottom > first };
}

export function historyLineText(line: HistoryLine): { left: string; right: string } {
  if (line.kind === 'week') {
    const n = line.sessions.length;
    return { left: `Week ${line.week} · ${rangeOfDates(line.from, line.to)}`, right: `${n} session${n === 1 ? '' : 's'}` };
  }
  if (line.current) return { left: `Week ${line.last} · no sessions yet`, right: '' };
  return { left: line.first === line.last ? `Week ${line.first} · no sessions` : `Weeks ${line.first} to ${line.last} · no sessions`, right: '' };
}

// ---------------------------------------------------------------------
// the record of a session (ui_spec §4.2)
// ---------------------------------------------------------------------

export type RowStatus = 'done' | 'skipped' | 'not_logged';

export interface RecordRow {
  item: PlanItem;
  status: RowStatus;
  /** The entry that decides the status (the last one for the slot in the session). */
  step?: ReplayStep;
  /** A test single logged before the work sets. */
  single?: ReplayStep;
  /** More than one entry for the slot in the session. */
  twice: boolean;
  /** SPEC_QUESTIONS Q27: a ladder entry counted as the drop jump on a rebuilt plan. */
  viaLadder?: boolean;
}

export interface RecordCounts {
  planned: number;
  done: number;
  skipped: number;
  notRecorded: number;
}

export interface RecordView {
  date: IsoDate;
  day?: SessionDay;
  source: 'snapshot' | 'rebuilt' | 'none';
  plan?: PlanSnapshot;
  rows: RecordRow[];
  /** Logged in the session but not in the plan. */
  extras: ReplayStep[];
  counts: RecordCounts;
  minutes?: number;
}

const ROW_KINDS = new Set(['barbell', 'rdl', 'slot', 'fixed', 'explosive', 'skip', 'cmj']);

/** "2 done · 6 not recorded", "7 done · 2 skipped · 1 not recorded": separate counts, zeros left out. */
export function countsText(c: RecordCounts): string {
  const parts: string[] = [];
  if (c.done) parts.push(`${c.done} done`);
  if (c.skipped) parts.push(`${c.skipped} skipped`);
  if (c.notRecorded) parts.push(`${c.notRecorded} not recorded`);
  return parts.join(' · ') || 'Nothing planned';
}

/** The plan for a session: the snapshot saved on the day, else rebuilt by replay (A.27). */
export function planFor(history: History, base: State, state: State, config: ProgrammeConfig, date: IsoDate, day: SessionDay, steps?: readonly ReplayStep[]): { plan?: PlanSnapshot; source: RecordView['source'] } {
  const start = (steps ?? history.byDate.get(date) ?? []).find((s) => s.item.log.kind === 'session_start');
  if (start && start.item.log.kind === 'session_start') return { plan: start.item.log.plan, source: 'snapshot' };
  if (!history.ok) return { source: 'none' };
  const before = stateBefore(base, state.log, config, date);
  const s = prescribe(before, config, date, day);
  if (s.kind !== 'session') return { source: 'none' };
  return { plan: planSnapshot(s, config), source: 'rebuilt' };
}

function buildRecord(history: History, base: State, state: State, config: ProgrammeConfig, date: IsoDate, steps: readonly ReplayStep[], dayHint?: SessionDay): RecordView {
  const day = dayFor(steps, date, config) ?? dayHint;
  const view: RecordView = { date, source: 'none', rows: [], extras: [], counts: { planned: 0, done: 0, skipped: 0, notRecorded: 0 } };
  if (day !== undefined) {
    view.day = day;
    const { plan, source } = planFor(history, base, state, config, date, day, steps);
    view.source = source;
    if (plan) view.plan = plan;
  }
  const used = new Set<ReplayStep>();
  const items: PlanItem[] = [];
  if (view.plan?.pre.includes('cmj')) items.push({ slot: 'cmj', name: 'Jump test', block: 0 });
  if (view.plan) items.push(...view.plan.items);
  // SPEC_QUESTIONS Q27: on a rebuilt plan with a drop jump and no ladder, a logged ladder entry is that day's drop jump.
  const ladderAsDrop = view.source === 'rebuilt' && items.some((i) => i.slot === 'depth_jump') && !items.some((i) => i.slot === 'rsi_ladder');
  for (const item of items) {
    const slots = item.slot === 'depth_jump' && ladderAsDrop ? ['depth_jump', 'rsi_ladder'] : [item.slot];
    const mine = steps.filter((s) => ROW_KINDS.has(s.item.log.kind) && slots.includes(slotOfLog(s.item.log) ?? ''));
    const singles = steps.filter((s) => s.item.log.kind === 'single' && slotOfLog(s.item.log) === item.slot);
    mine.forEach((s) => used.add(s));
    singles.forEach((s) => used.add(s));
    const last = mine[mine.length - 1];
    const isSkip = last ? last.item.log.kind === 'skip' || (last.item.log.kind === 'fixed' && !last.item.log.done) : false;
    const row: RecordRow = { item, status: last ? (isSkip ? 'skipped' : 'done') : 'not_logged', twice: mine.length > 1 };
    if (last) row.step = last;
    if (last && slotOfLog(last.item.log) === 'rsi_ladder' && item.slot === 'depth_jump') row.viaLadder = true;
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
    notRecorded: view.rows.filter((r) => r.status === 'not_logged').length,
  };
  const end = [...steps].reverse().find((s) => s.item.log.kind === 'session_end');
  if (end && end.item.log.kind === 'session_end' && end.item.log.minutes !== undefined) view.minutes = end.item.log.minutes;
  return view;
}

/** The record of one session. */
export function recordOf(history: History, base: State, state: State, config: ProgrammeConfig, g: SessionGroup, dayHint?: SessionDay): RecordView {
  return buildRecord(history, base, state, config, g.date, g.steps, g.day ?? dayHint);
}

/** The record of everything logged on a date (one session on most dates). */
export function recordFor(history: History, base: State, state: State, config: ProgrammeConfig, date: IsoDate, dayHint?: SessionDay): RecordView {
  return buildRecord(history, base, state, config, date, history.byDate.get(date) ?? [], dayHint);
}

/** "Light week" from a plan's barbell item, if any. */
export function weekTypeOf(plan: PlanSnapshot | undefined): string | undefined {
  const p = plan?.items.find((i) => i.position !== undefined)?.position;
  return p !== undefined ? POSITION_LABEL[p] : undefined;
}

/** Context line pieces for a date. */
export function contextFor(config: ProgrammeConfig, date: IsoDate): { week: number; total: number; block?: string } {
  const meso = mesocycleOn(config, date);
  const last = config.mesocycles.filter((m) => m.template !== null).at(-1);
  const out: { week: number; total: number; block?: string } = { week: programmeWeek(config, date), total: last ? last.weeks[1] : 25 };
  if (meso) out.block = BLOCK_LABEL[meso.id];
  return out;
}

/** "Week 4 of 25 · Block 1: build tissue and reserve". */
export function weekLine(config: ProgrammeConfig, date: IsoDate): string {
  const c = contextFor(config, date);
  return [c.week >= 1 ? `Week ${c.week} of ${c.total}` : '', c.block ?? ''].filter(Boolean).join(' · ');
}

/** §3: "Block 1 · week 4 of 8". */
export function blockWeekText(config: ProgrammeConfig, date: IsoDate): string {
  const meso = mesocycleOn(config, date);
  if (!meso) return '';
  const label = BLOCK_LABEL[meso.id].split(':')[0]!;
  const n = meso.weeks[1] - meso.weeks[0] + 1;
  return `${label} · week ${programmeWeek(config, date) - meso.weeks[0] + 1} of ${n}`;
}
