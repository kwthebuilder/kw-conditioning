/**
 * A.27 and A.28: plan snapshot, replay and amend. Synthetic logs only;
 * no training data in this repo.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import { amend, AmendError, effectiveLog, planSnapshot, prescribe, replay, replayMatches, stateBefore, update } from '../src/engine';
import type { AnyLog, CorrectionLog, Session } from '../src/engine';
import type { State } from '../src/config/types';

function fsLog(date: string, position: 1 | 2 | 3, load: number, reps: number, rir: number, presc: number, extra: Partial<AnyLog> = {}): AnyLog {
  return { kind: 'barbell', lift: 'front_squat', date, mode: 'wave', position, prescribed: { load, reps: presc, sets: 3 }, last_set: { load, reps, rir }, missed: false, ...extra } as AnyLog;
}
function dlLog(date: string, position: 1 | 2 | 3, load: number, reps: number, rir: number, presc: number): AnyLog {
  return { kind: 'barbell', lift: 'deadlift', date, mode: 'wave', position, prescribed: { load, reps: presc, sets: 3 }, last_set: { load, reps, rir }, missed: false };
}

/** Six weeks of synthetic logging touching every kind of entry. */
const LOGS: AnyLog[] = [
  { kind: 'cmj', date: '2026-09-21', value: 48 },
  fsLog('2026-09-21', 2, 77.5, 8, 2, 3),
  { kind: 'slot', slot: 'pull_up', date: '2026-09-21', load: 0, sets_done: 3, last_set: { reps: 7, rir: 2 } },
  { kind: 'rdl', slot: 'rdl', date: '2026-09-21', load: 70, sets_done: 3, last_set: { reps: 9, rir: 2 }, override: { from: 100 } },
  { kind: 'fixed', slot: 'nordic', date: '2026-09-21', done: true },
  { kind: 'session_end', date: '2026-09-21', day: 1 },
  dlLog('2026-09-24', 2, 122.5, 7, 2, 3),
  { kind: 'slot', slot: 'landmine_press', date: '2026-09-24', load: 20, sets_done: 3, last_set: { reps: 8, rir: 2 } },
  { kind: 'skip', slot: 'hack_squat', date: '2026-09-24', reason: 'time' },
  fsLog('2026-09-28', 3, 82.5, 5, 2, 2),
  { kind: 'skip', slot: 'pull_up', date: '2026-09-28', reason: 'fatigue' },
  dlLog('2026-10-01', 3, 132.5, 5, 2, 2),
  { kind: 'slot', slot: 'landmine_press', date: '2026-10-01', load: 20, sets_done: 3, last_set: { reps: 9, rir: 2 } },
  fsLog('2026-10-05', 1, 77.5, 4, 3, 4),
  { kind: 'slot', slot: 'pull_up', date: '2026-10-05', load: 0, sets_done: 3, last_set: { reps: 7, rir: 2 } },
  { kind: 'tm_override', date: '2026-10-05', lift: 'deadlift', tm: 150 },
  dlLog('2026-10-08', 1, 120, 4, 3, 4),
];

function incremental(logs: AnyLog[]): State {
  let s = structuredClone(INITIAL_STATE);
  for (const l of logs) s = update(s, l, cfg).state;
  return s;
}

describe('replay (A.28)', () => {
  it('reproduces the state built entry by entry', () => {
    const s = incremental(LOGS);
    const r = replay(INITIAL_STATE, s.log, cfg);
    expect({ ...r.state, log: [] }).toEqual({ ...s, log: [] });
    expect(r.steps).toHaveLength(LOGS.length);
    expect(replayMatches(INITIAL_STATE, s, cfg)).toBe(true);
  });

  it('a skip between two qualifying sessions keeps the pull-up streak (A.26, Q13)', () => {
    const s = incremental(LOGS);
    expect(s.accessories.pull_up?.load).toBe(2.5);
  });

  it('detects a state that its log does not explain', () => {
    const s = incremental(LOGS);
    s.lifts.front_squat.tm += 1;
    expect(replayMatches(INITIAL_STATE, s, cfg)).toBe(false);
    const c: CorrectionLog = { kind: 'correction', date: '2026-10-09', on: '2026-09-24', actions: [{ op: 'remove', target: 8 }] };
    expect(() => amend(INITIAL_STATE, s, c, cfg)).toThrow(AmendError);
  });

  it('stateBefore gives the state the day was prescribed from', () => {
    const s = incremental(LOGS);
    const before = stateBefore(INITIAL_STATE, s.log, cfg, '2026-10-05');
    const direct = incremental(LOGS.slice(0, 13));
    expect({ ...before, log: [] }).toEqual({ ...direct, log: [] });
    const day = prescribe(before, cfg, '2026-10-05', 1);
    expect(day.kind).toBe('session');
    const fs = (day as Session).blocks.flatMap((b) => b.items).find((it) => it.kind === 'slot' && it.slot === 'front_squat');
    expect(fs && fs.kind === 'slot' && fs.prescription.kind === 'lift' && fs.prescription.position).toBe(1);
  });
});

describe('amend (A.28)', () => {
  it('never edits the log in place and keeps every correction', () => {
    const s = incremental(LOGS);
    const frozen = JSON.stringify(s.log);
    const c: CorrectionLog = { kind: 'correction', date: '2026-10-09', on: '2026-09-21', actions: [{ op: 'replace', target: 3, entry: { kind: 'rdl', slot: 'rdl', date: '2026-09-21', load: 70, sets_done: 3, last_set: { reps: 12, rir: 2 }, override: { from: 100 } } }], note: 'miscounted' };
    const r = amend(INITIAL_STATE, s, c, cfg);
    expect(JSON.stringify(s.log)).toBe(frozen);
    expect(r.state.log).toHaveLength(s.log.length + 1);
    expect(r.state.rdl.load_kg).toBe(80);
    expect(r.explanation.summary).toContain('Correction to 2026-09-21');
    expect(r.explanation.summary).toContain('miscounted');
    const item = effectiveLog(r.state.log).find((x) => x.origin === 3);
    expect(item?.corrections).toHaveLength(1);
    expect(replayMatches(INITIAL_STATE, r.state, cfg)).toBe(true);
  });

  it('refuses a missing target without touching state', () => {
    const s = incremental(LOGS);
    const c: CorrectionLog = { kind: 'correction', date: '2026-10-09', on: '2026-09-21', actions: [{ op: 'remove', target: 999 }] };
    expect(() => amend(INITIAL_STATE, s, c, cfg)).toThrow(/no entry 999/);
  });

  it('refuses an empty correction', () => {
    const s = incremental(LOGS);
    expect(() => amend(INITIAL_STATE, s, { kind: 'correction', date: '2026-10-09', on: '2026-09-21', actions: [] }, cfg)).toThrow(AmendError);
  });

  it('removing a primary-lift session shifts the wave pointer for later sessions', () => {
    const s = incremental(LOGS);
    expect(s.lifts.front_squat.next_position).toBe(2);
    const c: CorrectionLog = { kind: 'correction', date: '2026-10-09', on: '2026-09-28', actions: [{ op: 'remove', target: 9 }] };
    const r = amend(INITIAL_STATE, s, c, cfg);
    expect(r.state.lifts.front_squat.next_position).toBe(1);
  });

  it('update refuses a correction', () => {
    const c = { kind: 'correction', date: '2026-10-09', on: '2026-09-21', actions: [] } as unknown as AnyLog;
    expect(() => update(INITIAL_STATE, c, cfg)).toThrow(/amend/);
  });
});

describe('plan snapshot (A.27)', () => {
  it('freezes the displayed plan', () => {
    const day = prescribe(INITIAL_STATE, cfg, '2026-09-21', 1) as Session;
    const snap = planSnapshot(day);
    expect(snap.day).toBe(1);
    expect(snap.pre).toEqual(['cmj']);
    const fs = snap.items.find((i) => i.slot === 'front_squat');
    expect(fs).toMatchObject({ load: 77.5, sets: 3, reps: 3, position: 2, amrap: true, pct: 0.85 });
    const rdl = snap.items.find((i) => i.slot === 'rdl');
    expect(rdl).toMatchObject({ load: 100, sets: 3, rep_range: [6, 8] });
    const r = update(INITIAL_STATE, { kind: 'session_start', date: '2026-09-21', day: 1, at: '2026-09-21T18:00:00+08:00', plan: snap }, cfg);
    expect({ ...r.state, log: [] }).toEqual({ ...INITIAL_STATE, log: [] });
  });
});
