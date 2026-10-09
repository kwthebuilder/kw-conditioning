/**
 * A.28: the corrected log and the replay that rebuilds every derived
 * number from it. state.log only grows; a correction is its own entry.
 *
 * Pure: the base state (initial_state_v1_1.json) is passed in.
 */
import type { IsoDate, ProgrammeConfig, State } from '../config/types';
import { describeAction } from './describe';
import { update } from './update';
import type { AnyLog, CorrectionAction, CorrectionLog, CorrectionTarget, Explanation, LogEntry, RecordLog } from './types';

export class AmendError extends Error {
  constructor(
    readonly code: 'mismatch' | 'target' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'AmendError';
  }
}

/** One entry of the corrected log. */
export interface EffectiveItem {
  /** Raw index of the original entry, or [correction index, action index] for an inserted one. */
  origin: CorrectionTarget;
  log: AnyLog;
  /** Corrections that replaced this item's content, oldest first, with what they replaced. */
  corrections: { index: number; date: IsoDate; note?: string; was: AnyLog }[];
  /** The correction that inserted this item. */
  inserted?: { index: number; date: IsoDate; note?: string };
  /** The correction that removed this item. Removed items are skipped by the replay. */
  removed?: { index: number; date: IsoDate; note?: string };
}

/** One replayed entry: the item, the entry update() wrote, and its explanation and outcome. */
export interface ReplayStep {
  item: EffectiveItem;
  entry: LogEntry;
  explanation: Explanation;
  outcome: unknown;
}

export interface Replay {
  /** Derived state from the corrected log; `log` is the raw log passed in. */
  state: State;
  items: EffectiveItem[];
  steps: ReplayStep[];
}

export function isLogEntry(e: unknown): e is LogEntry {
  return typeof e === 'object' && e !== null && 'kind' in e && 'date' in e && 'log' in e && 'summary' in e;
}

export function sameTarget(a: CorrectionTarget, b: CorrectionTarget): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

function targetText(t: CorrectionTarget): string {
  return typeof t === 'number' ? `entry ${t}` : `entry ${t[1]} added by correction ${t[0]}`;
}

/** A.28: walk the raw log and apply every correction in order. */
export function effectiveLog(raw: readonly unknown[]): EffectiveItem[] {
  const items: EffectiveItem[] = [];
  raw.forEach((e, i) => {
    if (!isLogEntry(e)) return;
    const log = e.log as RecordLog;
    if (log.kind !== 'correction') {
      items.push({ origin: i, log, corrections: [] });
      return;
    }
    log.actions.forEach((a: CorrectionAction, j) => {
      if (a.op === 'insert') {
        const item: EffectiveItem = { origin: [i, j], log: a.entry, corrections: [], inserted: { index: i, date: log.date, ...(log.note ? { note: log.note } : {}) } };
        const at = items.findIndex((x) => !x.removed && x.log.date > a.entry.date);
        if (at === -1) items.push(item);
        else items.splice(at, 0, item);
        return;
      }
      const t = items.find((x) => !x.removed && sameTarget(x.origin, a.target));
      if (!t) throw new AmendError('target', `Correction ${i}, change ${j + 1}: there is no ${targetText(a.target)} to correct.`);
      if (a.op === 'replace') {
        t.corrections.push({ index: i, date: log.date, was: t.log, ...(log.note ? { note: log.note } : {}) });
        t.log = a.entry;
      } else {
        t.removed = { index: i, date: log.date, ...(log.note ? { note: log.note } : {}) };
      }
    });
  });
  return items;
}

/**
 * Pass the corrected log through update(), one entry at a time, from the
 * base state. `stopBefore`: stop at the first item for which it returns true.
 */
export function replay(base: State, raw: readonly unknown[], config: ProgrammeConfig, stopBefore?: (item: EffectiveItem) => boolean): Replay {
  const items = effectiveLog(raw);
  let s: State = { ...structuredClone(base), log: [] };
  const steps: ReplayStep[] = [];
  for (const item of items) {
    if (item.removed) continue;
    if (stopBefore?.(item)) break;
    const r = update(s, item.log, config);
    const entry = r.state.log.pop() as LogEntry;
    s = r.state;
    steps.push({ item, entry, explanation: r.explanation, outcome: r.outcome });
  }
  return { state: { ...s, log: raw as unknown[] }, items, steps };
}

/** The derived state just before the first entry of a date (A.27 reconstruction). */
export function stateBefore(base: State, raw: readonly unknown[], config: ProgrammeConfig, date: IsoDate): State {
  return replay(base, raw, config, (item) => item.log.date >= date).state;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (ao[k] === undefined && bo[k] === undefined) continue;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/** Every derived field equal (the log itself is not compared). */
export function derivedEqual(a: State, b: State): boolean {
  return deepEqual({ ...a, log: null }, { ...b, log: null });
}

/** A.28 precondition: replaying the current log from the base reproduces the current state. */
export function replayMatches(base: State, state: State, config: ProgrammeConfig): boolean {
  try {
    return derivedEqual(replay(base, state.log, config).state, state);
  } catch {
    return false;
  }
}

export interface AmendResult {
  state: State;
  explanation: Explanation;
  /** Replays before and after, for the preview. */
  before: Replay;
  after: Replay;
}

/**
 * A.28: apply a correction. Appends one correction entry and rebuilds
 * the derived state by replay. Refuses, without touching state, if the
 * current log does not replay to the current state or a target is missing.
 */
export function amend(base: State, state: State, correction: CorrectionLog, config: ProgrammeConfig): AmendResult {
  if (correction.actions.length === 0) throw new AmendError('invalid', 'A correction needs at least one change.');
  for (const a of correction.actions) {
    if (a.op !== 'remove' && (a.entry as RecordLog).kind === 'correction') throw new AmendError('invalid', 'A correction cannot contain a correction.');
  }
  let before: Replay;
  try {
    before = replay(base, state.log, config);
  } catch (e) {
    throw new AmendError('mismatch', `The log cannot be replayed (${e instanceof Error ? e.message : String(e)}), so a correction cannot be applied safely.`);
  }
  if (!derivedEqual(before.state, state)) {
    throw new AmendError('mismatch', 'Replaying the log from the start does not reproduce the current numbers, so a correction cannot be applied safely. Refer to the project.');
  }
  const lines = correction.actions.map((a) => {
    if (a.op === 'insert') return describeAction(a, undefined, config);
    const prior = before.items.find((x) => !x.removed && sameTarget(x.origin, a.target));
    if (!prior) throw new AmendError('target', `There is no ${targetText(a.target)} to correct.`);
    return describeAction(a, prior.log, config);
  });
  const summary = `Correction to ${correction.on}: ${lines.join('; ')}${correction.note ? ` (${correction.note})` : ''}.`;
  const entry: LogEntry = { kind: 'correction', date: correction.date, summary, log: correction };
  const after = replay(base, [...state.log, entry], config);
  return {
    state: after.state,
    explanation: { summary, steps: lines.map((text) => ({ rule: 'correction', text, numbers: {} })) },
    before,
    after,
  };
}
