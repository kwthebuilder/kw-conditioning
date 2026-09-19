/**
 * Progression slots: class C strength accessories (§4) and, through
 * tempo.ts, the class B streak slots (§3). One streak engine, two rule
 * shapes. A.11: the first logged session sets the load; streaks reset
 * on any load change. A.10: no upward step after the freeze week.
 *
 * Pure: no clock, no I/O.
 */
import type { AccessoryState, ProgrammeConfig, Slot, SlotId, State } from '../config/types';
import { programmeWeek } from './calendar';
import { explainStep, f1, kg } from './explain';
import type { ExplanationStep, Increment, SlotDirection, SlotLog, SlotOutcome, SlotPrescription, SlotUpdateResult } from './types';

/**
 * Increment sizes ruled outside the config (SPEC_QUESTIONS.md Q6).
 * Anything else with a text increment shows "go up one plate".
 */
const RULED_INCREMENTS: Record<string, Increment> = {
  hack_squat: { kind: 'kg', kg: 5, per_hand: false },
};
const DEFAULT_TEXT_INCREMENT = 'one plate';

/** "2 kg/hand" → 2 per hand; "2.5 kg" → 2.5; anything else is text. */
export function parseIncrement(slot: Slot): Increment {
  const ruled = RULED_INCREMENTS[slot.id];
  if (ruled) return ruled;
  if (slot.increment === undefined) return { kind: 'text', text: DEFAULT_TEXT_INCREMENT };
  const m = /^(\d+(?:\.\d+)?)\s*kg(\/hand)?$/i.exec(slot.increment.trim());
  if (m && m[1] !== undefined) return { kind: 'kg', kg: Number(m[1]), per_hand: m[2] !== undefined };
  return { kind: 'text', text: slot.increment };
}

export function incrementText(inc: Increment): string {
  return inc.kind === 'kg' ? `${inc.kg} kg${inc.per_hand ? '/hand' : ''}` : inc.text;
}

/** The streak rule for one slot. */
export interface ProgressionRule {
  cls: 'B' | 'C';
  /** Reps prescribed on the earlier sets. */
  reps: number;
  rir_cap: number;
  /** Last-set reps at or above this count towards a step up. */
  up_at: number;
  /** Last-set reps below this count towards a step down. */
  down_below: number;
  /** Consecutive qualifying sessions needed. */
  streak: number;
  never_zero: boolean;
}

function need<T>(slot: Slot, key: keyof Slot, v: T | undefined): T {
  if (v === undefined) throw new Error(`config.slots.${slot.id}.${String(key)} missing`);
  return v;
}

/** §4: below prescribed reps twice → down; surplus at or above up_at twice → up. */
export function ruleForClassC(slot: Slot): ProgressionRule {
  if (slot.cls !== 'C') throw new Error(`${slot.id} is class ${slot.cls}, not C`);
  const reps = need(slot, 'reps', slot.reps);
  return {
    cls: 'C',
    reps,
    rir_cap: need(slot, 'rir_cap', slot.rir_cap),
    up_at: need(slot, 'up_at', slot.up_at),
    down_below: reps,
    streak: need(slot, 'streak', slot.streak),
    never_zero: slot.never_zero ?? false,
  };
}

export function slotOf(config: ProgrammeConfig, id: SlotId): Slot {
  const slot = config.slots[id];
  if (!slot) throw new Error(`unknown slot ${id}`);
  return slot;
}

function ensureAccessory(state: State, id: SlotId): AccessoryState {
  const existing = state.accessories[id];
  if (existing) return existing;
  const fresh: AccessoryState = { load: null, streak_up: 0, streak_down: 0 };
  state.accessories[id] = fresh;
  return fresh;
}

export interface ProgressionContext {
  /** L8 / §3: the slot's site was flagged in the last 48 h, so no upward step. */
  site_flagged?: boolean;
}

// ---------------------------------------------------------------------
// prescribe
// ---------------------------------------------------------------------

export function prescribeProgression(state: State, config: ProgrammeConfig, id: SlotId, rule: ProgressionRule): SlotPrescription {
  const slot = slotOf(config, id);
  const acc = state.accessories[id] ?? { load: null, streak_up: 0, streak_down: 0 };
  const increment = parseIncrement(slot);
  const notes: string[] = [];
  const p: SlotPrescription = {
    kind: 'slot',
    slot: id,
    cls: rule.cls,
    name: slot.name,
    load: acc.load,
    reps: rule.reps,
    rir_cap: rule.rir_cap,
    increment,
    notes,
  };
  if (slot.start_hint_kg !== undefined) p.start_hint_kg = slot.start_hint_kg;
  if (acc.load === null) {
    notes.push(`First session: set the load${slot.start_hint_kg !== undefined ? ` (hint ${slot.start_hint_kg} kg)` : ''}. Earlier sets at ${rule.reps} reps, last set to RIR ${rule.rir_cap}.`);
  } else {
    notes.push(`Earlier sets at ${rule.reps} reps, last set to RIR ${rule.rir_cap}; log its reps.`);
  }
  if (acc.pending) {
    p.pending = acc.pending;
    notes.push(`Go ${acc.pending} ${incrementText(increment)} from ${kg(acc.load)}; the new load is read from what you lift.`);
  }
  return p;
}

// ---------------------------------------------------------------------
// update
// ---------------------------------------------------------------------

export function updateProgression(
  state: State,
  config: ProgrammeConfig,
  log: SlotLog,
  rule: ProgressionRule,
  ctx: ProgressionContext = {},
): SlotUpdateResult {
  const slot = slotOf(config, log.slot);
  const increment = parseIncrement(slot);
  const next = structuredClone(state);
  const acc = ensureAccessory(next, log.slot);
  const steps: ExplanationStep[] = [];
  const week = programmeWeek(config, log.date);
  const frozen = week > config.freeze.no_upward_steps_after_week;
  const before = acc.load;
  const reps = log.last_set.reps;
  let direction: SlotDirection = 'hold';

  // Load as lifted is the record (L1).
  if (before === null) {
    acc.load = log.load;
    direction = 'set';
    steps.push(explainStep('set_load', `${slot.name}: first logged session sets the load at ${f1(log.load)} kg.`, { load: log.load }));
  } else if (log.load !== before) {
    const moved: 'up' | 'down' = log.load > before ? 'up' : 'down';
    if (acc.pending === moved) {
      steps.push(explainStep('pending_taken', `${slot.name}: owed step ${moved} taken, ${f1(before)} → ${f1(log.load)} kg. Streaks reset.`, { from: before, to: log.load }));
    } else {
      steps.push(explainStep('load_change', `${slot.name}: load changed ${f1(before)} → ${f1(log.load)} kg, so streaks reset (A.11).`, { from: before, to: log.load }));
    }
    delete acc.pending;
    acc.load = log.load;
    acc.streak_up = 0;
    acc.streak_down = 0;
  }

  // Streaks from the last set.
  const setText = `Last set ${reps} reps at RIR ${log.last_set.rir}${log.last_set.tempo_break ? ' (tempo broke)' : ''}, prescribed ${rule.reps}.`;
  if (reps >= rule.up_at) {
    acc.streak_up += 1;
    acc.streak_down = 0;
    steps.push(explainStep('streak', `${setText} At or above ${rule.up_at}: ${acc.streak_up} of ${rule.streak} towards a step up.`, { reps, streak_up: acc.streak_up }));
  } else if (reps < rule.down_below) {
    acc.streak_down += 1;
    acc.streak_up = 0;
    steps.push(explainStep('streak', `${setText} Below ${rule.down_below}: ${acc.streak_down} of ${rule.streak} towards a step down.`, { reps, streak_down: acc.streak_down }));
  } else {
    if (acc.streak_up || acc.streak_down) steps.push(explainStep('streak', `${setText} Inside the band: streaks reset.`, { reps }));
    else steps.push(explainStep('streak', `${setText} Inside the band: hold.`, { reps }));
    acc.streak_up = 0;
    acc.streak_down = 0;
  }

  const outcome: SlotOutcome = {
    direction,
    load_before: before,
    load_after: acc.load,
    increment,
    streak_up: acc.streak_up,
    streak_down: acc.streak_down,
  };
  const incText = incrementText(increment);

  if (acc.streak_up >= rule.streak) {
    if (frozen) {
      outcome.withheld = 'freeze';
      steps.push(explainStep('freeze', `Step up earned but week ${week} is past week ${config.freeze.no_upward_steps_after_week}: no upward steps. Load holds at ${kg(acc.load)}.`, { week }));
    } else if (ctx.site_flagged) {
      outcome.withheld = 'site_flag';
      steps.push(explainStep('site_flag', `Step up earned but the site was flagged in the last 48 h: load holds at ${kg(acc.load)} (L8).`, {}));
    } else {
      direction = 'up';
      acc.streak_up = 0;
      acc.streak_down = 0;
      if (increment.kind === 'kg' && acc.load !== null) {
        const to = acc.load + increment.kg;
        steps.push(explainStep('step_up', `${rule.streak} sessions running at or above ${rule.up_at}: up ${incText}, ${f1(acc.load)} → ${f1(to)} kg.`, { from: acc.load, to, delta_kg: increment.kg }));
        acc.load = to;
        outcome.delta_kg = increment.kg;
      } else {
        acc.pending = 'up';
        steps.push(explainStep('step_up', `${rule.streak} sessions running at or above ${rule.up_at}: go up ${incText} next session. The new load is read from what you lift.`, {}));
      }
    }
  } else if (acc.streak_down >= rule.streak) {
    direction = 'down';
    acc.streak_up = 0;
    acc.streak_down = 0;
    if (increment.kind === 'kg' && acc.load !== null) {
      const to = acc.load - increment.kg;
      if (rule.never_zero && to <= 0) {
        steps.push(explainStep('step_down', `${rule.streak} sessions running below ${rule.down_below}, but this slot never goes to zero: load holds at ${f1(acc.load)} kg.`, { from: acc.load }));
        direction = 'hold';
      } else {
        steps.push(explainStep('step_down', `${rule.streak} sessions running below ${rule.down_below}: down ${incText}, ${f1(acc.load)} → ${f1(to)} kg.`, { from: acc.load, to, delta_kg: -increment.kg }));
        acc.load = to;
        outcome.delta_kg = -increment.kg;
      }
    } else {
      acc.pending = 'down';
      steps.push(explainStep('step_down', `${rule.streak} sessions running below ${rule.down_below}: go down ${incText} next session.`, {}));
    }
  }

  if (log.override) {
    const rec = { kind: 'load' as const, date: log.date, slot: log.slot, from: log.override.from, to: log.load };
    (next.overrides ??= []).push(log.override.note !== undefined ? { ...rec, note: log.override.note } : rec);
    steps.push(explainStep('override', `Load overridden by the athlete: ${f1(log.override.from)} → ${f1(log.load)} kg${log.override.note ? ` (${log.override.note})` : ''}.`, { from: log.override.from, to: log.load }));
  }

  outcome.direction = direction;
  outcome.load_after = acc.load;
  outcome.streak_up = acc.streak_up;
  outcome.streak_down = acc.streak_down;
  if (acc.pending) outcome.pending = acc.pending;

  const summary = `${slot.name}: ${kg(before)} → ${kg(acc.load)} (${direction}${acc.pending ? `, go ${acc.pending} ${incText}` : ''}).`;
  return { state: next, outcome, explanation: { summary, steps } };
}

// ---------------------------------------------------------------------
// class C entry points
// ---------------------------------------------------------------------

export function prescribeAccessory(state: State, config: ProgrammeConfig, id: SlotId): SlotPrescription {
  return prescribeProgression(state, config, id, ruleForClassC(slotOf(config, id)));
}

export function updateAccessory(state: State, config: ProgrammeConfig, log: SlotLog, ctx: ProgressionContext = {}): SlotUpdateResult {
  return updateProgression(state, config, log, ruleForClassC(slotOf(config, log.slot)), ctx);
}
