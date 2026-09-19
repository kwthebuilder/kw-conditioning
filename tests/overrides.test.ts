import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../src/config/load';
import { parseState } from '../src/config/validate';
import { overrideLoad, overrideTm, prescribeAccessory, prescribeLift, prescribeRdl, rawEstimate, roundLoad, updateAccessory, updateLift, updateRdl } from '../src/engine';
import type { BarbellLog, RdlLog, SlotLog } from '../src/engine';
import { M1_DATE, stateWith } from './helpers';

const cfg = PROGRAMME_CONFIG;
const step = cfg.equipment.barbell_round_kg;

describe('load override: the overridden load is what update reads', () => {
  it('barbell: prescription, ramp and update all follow the override; state records it', () => {
    const state = structuredClone(INITIAL_STATE);
    const p = prescribeLift(state, cfg, 'front_squat', M1_DATE);
    if (p.kind !== 'lift') throw new Error('expected lift');
    const p2 = overrideLoad(p, cfg, p.load + 2.5, 'bar felt light');
    expect(p2.load).toBe(p.load + 2.5);
    expect(p2.override).toEqual({ from: p.load, note: 'bar felt light' });
    expect(p2.ramp).toEqual(cfg.wave.ramp.map(([frac, reps]) => ({ load: roundLoad(p2.load * frac, step), reps })));
    expect(p.load).not.toBe(p2.load); // original untouched
    expect(p).not.toHaveProperty('override');

    const log: BarbellLog = {
      lift: 'front_squat',
      date: M1_DATE,
      mode: 'wave',
      position: p2.position!,
      prescribed: { load: p2.load, reps: p2.reps, sets: p2.sets },
      last_set: { load: p2.load, reps: 8, rir: 2 },
      missed: false,
      override: p2.override!,
    };
    const { state: after, outcome, explanation } = updateLift(state, cfg, log);
    expect(outcome.E).toBeCloseTo(rawEstimate(p2.load, 8, 2), 9);
    expect(after.overrides).toEqual([{ kind: 'load', date: M1_DATE, slot: 'front_squat', from: p.load, to: p2.load, note: 'bar felt light' }]);
    expect(explanation.steps.some((s) => s.rule === 'override')).toBe(true);
    expect(state.overrides).toBeUndefined();
  });

  it('RDL and accessories: same contract', () => {
    const pr = overrideLoad(prescribeRdl(INITIAL_STATE, cfg), cfg, 95);
    expect(pr.override).toEqual({ from: INITIAL_STATE.rdl.load_kg });
    const rlog: RdlLog = { slot: 'rdl', date: M1_DATE, load: pr.load, sets_done: 3, last_set: { reps: 8, rir: 2 }, override: pr.override! };
    const r = updateRdl(INITIAL_STATE, cfg, rlog);
    expect(r.outcome.load_before).toBe(95);
    expect(r.state.overrides?.[0]).toMatchObject({ kind: 'load', slot: 'rdl', from: 100, to: 95 });

    const s = structuredClone(INITIAL_STATE);
    s.accessories.pull_up = { load: 10, streak_up: 0, streak_down: 0 };
    const pa = overrideLoad(prescribeAccessory(s, cfg, 'pull_up'), cfg, 7.5, 'shoulder');
    const alog: SlotLog = { slot: 'pull_up', date: M1_DATE, load: pa.load!, sets_done: 3, last_set: { reps: 5, rir: 2 }, override: pa.override! };
    const a = updateAccessory(s, cfg, alog);
    expect(a.outcome.load_after).toBe(7.5);
    expect(a.state.overrides?.[0]).toMatchObject({ kind: 'load', slot: 'pull_up', from: 10, to: 7.5, note: 'shoulder' });
  });

  it('rejects a negative load', () => {
    const p = prescribeRdl(INITIAL_STATE, cfg);
    expect(() => overrideLoad(p, cfg, -1)).toThrow();
  });
});

describe('training-max override drives the next prescription', () => {
  it('sets the TM unrounded, scales β by new ÷ old (A.18), records it, and the next loads follow', () => {
    const state = stateWith('deadlift', { tm: 145.2, beta: { '2': 1.01 }, next_position: 2 });
    const r = overrideTm(state, 'deadlift', 150.3, M1_DATE, 'after physio review');
    expect(r.state.lifts.deadlift.tm).toBe(150.3);
    expect(r.state.lifts.deadlift.beta['2']).toBeCloseTo(1.01 * (150.3 / 145.2), 12);
    expect(r.state.lifts.deadlift.beta['3']).toBeNull();
    expect(r.state.overrides).toEqual([{ kind: 'tm', date: M1_DATE, lift: 'deadlift', from: 145.2, to: 150.3, note: 'after physio review' }]);
    expect(state.lifts.deadlift.tm).toBe(145.2);
    const p = prescribeLift(r.state, cfg, 'deadlift', M1_DATE);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.tm).toBe(150.3);
    expect(p.load).toBe(roundLoad(150.3 * cfg.wave.positions['2'].pct, step));
    expect(r.explanation.steps[0]?.text).toContain('150.3');
  });

  it('a state carrying overrides round-trips through the validator', () => {
    const r = overrideTm(INITIAL_STATE, 'front_squat', 93.7, M1_DATE);
    const json = JSON.parse(JSON.stringify(r.state)) as unknown;
    expect(parseState(json)).toEqual(r.state);
  });
});

describe('singles are a suggestion, never forced', () => {
  it('a scheduled single leaves the normal prescription intact and is cleared when skipped (A.17)', () => {
    const s = stateWith('front_squat', { tm: 92, next_position: 2 });
    s.lifts.front_squat.single_scheduled = true;
    const p = prescribeLift(s, cfg, 'front_squat', M1_DATE);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.single_suggested).toEqual({ reason: 'big_gap', rir: 2, taken: false });
    expect(p.amrap).toBe(true);
    expect(p.par).toBe(cfg.wave.positions['2'].par);
    expect(p.tm).toBe(92);
    expect(p.notes.join(' ')).toMatch(/suggested/);
    // Skipped: the session updates as normal and the suggestion is cleared.
    const log: BarbellLog = { lift: 'front_squat', date: M1_DATE, mode: 'wave', position: 2, prescribed: { load: p.load, reps: p.reps, sets: p.sets }, last_set: { load: p.load, reps: 9, rir: 2 }, missed: false };
    const r = updateLift(s, cfg, log);
    expect(r.outcome.rule).toBe('calibration');
    expect(r.state.lifts.front_squat.single_scheduled).toBe(false);
    expect(r.explanation.steps.some((x) => x.rule === 'single_skipped')).toBe(true);
    expect(prescribeLift(r.state, cfg, 'front_squat', M1_DATE)).not.toHaveProperty('single_suggested');
  });

  it('a skipped single that itself produces a new big gap stays scheduled', () => {
    const s = stateWith('front_squat', { tm: 94, beta: { '2': 1 }, next_position: 2 });
    s.lifts.front_squat.single_scheduled = true;
    const log: BarbellLog = { lift: 'front_squat', date: M1_DATE, mode: 'wave', position: 2, prescribed: { load: 80, reps: 3, sets: 3 }, last_set: { load: 80, reps: 10, rir: 2 }, missed: false };
    const r = updateLift(s, cfg, log);
    expect(r.outcome.rule).toBe('biggap');
    expect(r.state.lifts.front_squat.single_scheduled).toBe(true);
  });

  it('a skipped boundary suggestion is not repeated after the first session in the mesocycle', () => {
    const m2 = cfg.mesocycles.find((m) => m.id === 'M2')!;
    const s = stateWith('deadlift', { tm: 150 });
    s.lifts.deadlift.last_logged = m2.start;
    const p = prescribeLift(s, cfg, 'deadlift', m2.start);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.single_suggested?.reason).toBe('boundary');
    const log: BarbellLog = { lift: 'deadlift', date: m2.start, mode: 'band_87_90', prescribed: { load: p.load, reps: 2, sets: 3 }, last_set: { load: p.load, reps: 2, rir: 3 }, missed: false };
    const r = updateLift(s, cfg, log);
    expect(prescribeLift(r.state, cfg, 'deadlift', m2.start)).not.toHaveProperty('single_suggested');
  });
});
