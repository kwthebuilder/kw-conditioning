import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../src/config/load';
import { parseState } from '../src/config/validate';
import { bindConfig, prescribe, roundLoad, tmFromSingle, update, updateAccessory, updateLift, updateRdl } from '../src/engine';
import type { AnyLog, LogEntry } from '../src/engine';
import { M1_DATE, stateWith, waveLog } from './helpers';

const cfg = PROGRAMME_CONFIG;
const lastEntry = (s: { log: unknown[] }): LogEntry => s.log[s.log.length - 1] as LogEntry;

describe('update(): one door for state (A.23)', () => {
  it('barbell, rdl and slot logs give the same result as the slot functions, plus one log entry', () => {
    const b = waveLog('front_squat', 2, { load: 77.5, reps: 9, rir: 2, presc: 3 });
    const viaDoor = update(INITIAL_STATE, { kind: 'barbell', ...b }, cfg);
    const direct = updateLift(INITIAL_STATE, cfg, b);
    expect(viaDoor.outcome).toEqual(direct.outcome);
    expect({ ...viaDoor.state, log: [] }).toEqual({ ...direct.state, log: [] });
    expect(viaDoor.state.log).toHaveLength(INITIAL_STATE.log.length + 1);
    expect(lastEntry(viaDoor.state)).toMatchObject({ kind: 'barbell', date: M1_DATE, summary: direct.explanation.summary });

    const r = { slot: 'rdl' as const, date: M1_DATE, load: 100, sets_done: 3, last_set: { reps: 10, rir: 2 } };
    expect(update(INITIAL_STATE, { kind: 'rdl', ...r }, cfg).outcome).toEqual(updateRdl(INITIAL_STATE, cfg, r).outcome);

    const a = { slot: 'pull_up', date: M1_DATE, load: 10, sets_done: 3, last_set: { reps: 6, rir: 2 } };
    expect(update(INITIAL_STATE, { kind: 'slot', ...a }, cfg).outcome).toEqual(updateAccessory(INITIAL_STATE, cfg, a).outcome);
    expect(() => update(INITIAL_STATE, { kind: 'slot', ...a, slot: 'rdl' }, cfg)).toThrow(/kind "rdl"/);
  });

  it('a single logged first: TM reset, then prescribe for the same date gives straight sets from the new TM (A.8, A.16, A.23)', () => {
    const s = stateWith('front_squat', { tm: 96, beta: { '2': 1.0, '3': 1.02 }, next_position: 2 });
    s.lifts.front_squat.single_scheduled = true;
    const r1 = update(s, { kind: 'single', lift: 'front_squat', date: M1_DATE, load: 102.5, rir: 2 }, cfg);
    const ls = r1.state.lifts.front_squat;
    expect(ls.tm).toBeCloseTo(tmFromSingle(102.5), 9);
    expect(ls.beta['2']).toBeCloseTo(1.0 * (ls.tm / 96), 9);
    expect(ls.single_scheduled).toBe(false);
    expect(ls.single_taken).toEqual({ date: M1_DATE, reason: 'big_gap' });

    const sess = prescribe(r1.state, cfg, M1_DATE, 1);
    if (sess.kind !== 'session') throw new Error();
    const fs = sess.blocks.flatMap((b) => b.items).find((it) => it.kind === 'slot' && it.slot === 'front_squat')!;
    if (fs.kind !== 'slot' || fs.prescription.kind !== 'lift') throw new Error();
    expect(fs.prescription).toMatchObject({ load: roundLoad(ls.tm * 0.85, 2.5), amrap: false, single_suggested: { reason: 'big_gap', taken: true } });
    expect(fs.prescription).not.toHaveProperty('par');
    expect(sess.singles_suggested).toEqual([]);

    // The work sets: straight sets, no update, position advances, marker cleared.
    const r2 = update(r1.state, { kind: 'barbell', ...waveLog('front_squat', 2, { load: fs.prescription.load, reps: 3, rir: 3, presc: 3 }) }, cfg);
    expect(r2.outcome).toMatchObject({ rule: 'single', step: 0 });
    expect(r2.state.lifts.front_squat.beta['2']).toBeCloseTo(ls.beta['2']!, 12);
    expect(r2.state.lifts.front_squat.next_position).toBe(3);
    expect(r2.state.lifts.front_squat.single_taken).toBeUndefined();
    expect(r2.state.log.map((e) => (e as LogEntry).kind)).toEqual(['single', 'barbell']);
  });

  it('single_skipped clears the flag and changes nothing else (A.17)', () => {
    const s = stateWith('front_squat', { tm: 94, beta: { '2': 1 }, next_position: 2 });
    s.lifts.front_squat.single_scheduled = true;
    const r = update(s, { kind: 'single_skipped', date: M1_DATE, lift: 'front_squat' }, cfg);
    expect(r.state.lifts.front_squat.single_scheduled).toBe(false);
    const plain = structuredClone(s);
    plain.lifts.front_squat.single_scheduled = false;
    expect({ ...r.state, log: [] }).toEqual(plain);
    expect(lastEntry(r.state).kind).toBe('single_skipped');
    expect(prescribe(r.state, cfg, M1_DATE, 1)).toMatchObject({ singles_suggested: [] });
  });

  it('a boundary single logged through the door is recorded with its reason', () => {
    const m2 = cfg.mesocycles.find((m) => m.id === 'M2')!;
    const s = stateWith('deadlift', { tm: 150 });
    const r = update(s, { kind: 'single', lift: 'deadlift', date: m2.start, load: 160, rir: 2 }, cfg);
    expect(r.state.lifts.deadlift.single_taken).toEqual({ date: m2.start, reason: 'boundary' });
    expect(r.state.lifts.deadlift.last_mesocycle).toBe('M2');
    const sess = prescribe(r.state, cfg, m2.start, 2);
    expect(sess.kind === 'session' && sess.singles_suggested).toEqual([]);
  });

  it('tm_override, cmj, depth_jump_height, fixed and session_end all pass through and log', () => {
    let s = INITIAL_STATE;
    const logs: AnyLog[] = [
      { kind: 'tm_override', date: M1_DATE, lift: 'deadlift', tm: 150.3, note: 'physio' },
      { kind: 'cmj', date: M1_DATE, value: 38.2 },
      { kind: 'depth_jump_height', date: M1_DATE, height_cm: 30 },
      { kind: 'fixed', slot: 'trap_bar_jump', date: M1_DATE, done: true, value: 24 },
      { kind: 'session_end', date: M1_DATE, day: 1, minutes: 71 },
    ];
    for (const log of logs) {
      const r = update(s, log, cfg);
      expect(r.explanation.summary.length).toBeGreaterThan(0);
      expect(lastEntry(r.state)).toMatchObject({ kind: log.kind, date: M1_DATE, log });
      s = r.state;
    }
    expect(s.lifts.deadlift.tm).toBe(150.3);
    expect(s.overrides).toEqual([{ kind: 'tm', date: M1_DATE, lift: 'deadlift', from: 145.2, to: 150.3, note: 'physio' }]);
    expect(s.cmj.series).toEqual([38.2]);
    expect(s.depth_jump.height_cm).toBe(30);
    expect(s.log).toHaveLength(logs.length);
    expect(INITIAL_STATE.log).toHaveLength(0);
    // Everything the door wrote still validates.
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('bindConfig gives the CLAUDE.md two-argument surface', () => {
    const engine = bindConfig(cfg);
    const sess = engine.prescribe(INITIAL_STATE, M1_DATE);
    expect(sess.kind).toBe('session');
    const r = engine.update(INITIAL_STATE, { kind: 'cmj', date: M1_DATE, value: 37.9 });
    expect(r.state.cmj.series).toEqual([37.9]);
  });
});
