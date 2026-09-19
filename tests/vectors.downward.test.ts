import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import type { State } from '../src/config/types';
import { prescribeLift, updateLift } from '../src/engine';
import { M1_DATE, stateWith, waveLog } from './helpers';

const v = TEST_VECTORS.downward_trigger;
const LIFT = 'front_squat';
const sets = PROGRAMME_CONFIG.wave.sets;

/** A matched-update session at the given position whose step is negative but not a big gap or a failure. */
function negativeSession(state: State, position: 2 | 3): State {
  const ls = state.lifts[LIFT];
  const pct = PROGRAMME_CONFIG.wave.positions[String(position) as '2' | '3'];
  const load = ls.tm * pct.pct;
  // One rep short of par at RIR 2 gives a small negative gap.
  const reps = (pct.par ?? 0) - 1;
  const { state: next, outcome } = updateLift(state, PROGRAMME_CONFIG, waveLog(LIFT, position, { load, reps, rir: 2, presc: pct.reps }));
  expect(outcome.rule).toBe('matched');
  expect(outcome.step).toBeLessThan(0);
  return next;
}

function cleanPosition1(state: State, expectSets: number): State {
  const p = prescribeLift(state, PROGRAMME_CONFIG, LIFT, M1_DATE);
  if (p.kind !== 'lift') throw new Error('expected lift');
  expect(p.position).toBe(1);
  expect(p.sets).toBe(expectSets);
  const { state: next, outcome } = updateLift(state, PROGRAMME_CONFIG, waveLog(LIFT, 1, { load: p.load, reps: p.reps, rir: 3, presc: p.reps, sets: p.sets }));
  expect(outcome.rule).toBe('position1');
  expect(outcome.step).toBe(0);
  return next;
}

describe(`downward_trigger vector (2.7, A.6): ${v.expect}`, () => {
  it('the vector describes two negative steps', () => {
    expect(v.steps.length).toBe(2);
    for (const s of v.steps) expect(s).toBeLessThan(0);
  });

  it('two consecutive negative steps → next session position 1 with 2 sets, then restores', () => {
    // Positions 2 then 3 both step down; position 1 is then due anyway.
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 2 });
    s = negativeSession(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(1);
    s = negativeSession(s, 3);
    expect(s.lifts[LIFT].neg_streak).toBe(v.steps.length);
    expect(s.lifts[LIFT].next_position).toBe(1);

    s = cleanPosition1(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(0);
    // Position 1 was due, so the forced session is that session and the pointer advances (Q2 ruling).
    expect(s.lifts[LIFT].next_position).toBe(2);
    const p = prescribeLift(s, PROGRAMME_CONFIG, LIFT, M1_DATE);
    expect(p.kind === 'lift' && p.sets).toBe(sets);
  });

  it('a forced session inserted before a due position 2 or 3 leaves the pointer where it was', () => {
    // Negative at 3, position 1 does not count, negative at 2 → position 3 is due but the trigger forces 1.
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 3 });
    s = negativeSession(s, 3);
    s = cleanPosition1(s, sets);
    expect(s.lifts[LIFT].neg_streak).toBe(1);
    s = negativeSession(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(2);
    expect(s.lifts[LIFT].next_position).toBe(3);

    s = cleanPosition1(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(0);
    expect(s.lifts[LIFT].next_position).toBe(3);
  });

  it('a non-negative step at position 2 or 3 resets the streak before it reaches two', () => {
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 2 });
    s = negativeSession(s, 2);
    const pct = PROGRAMME_CONFIG.wave.positions['3'];
    const { state: next, outcome } = updateLift(s, PROGRAMME_CONFIG, waveLog(LIFT, 3, { load: s.lifts[LIFT].tm * pct.pct, reps: (pct.par ?? 0) + 1, rir: 2, presc: pct.reps }));
    expect(outcome.step).toBeGreaterThan(0);
    expect(next.lifts[LIFT].neg_streak).toBe(0);
  });

  it('a failure signal on the forced session cuts 2.5% and forces one more; a second refers to project', () => {
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 2 });
    s = negativeSession(s, 2);
    s = negativeSession(s, 3);

    const fail = (state: State) => {
      const p = prescribeLift(state, PROGRAMME_CONFIG, LIFT, M1_DATE);
      if (p.kind !== 'lift') throw new Error('expected lift');
      expect(p.position).toBe(1);
      expect(p.sets).toBe(2);
      return updateLift(state, PROGRAMME_CONFIG, waveLog(LIFT, 1, { load: p.load, reps: p.reps - 1, rir: 2, presc: p.reps, sets: 2 }));
    };
    const tm0 = s.lifts[LIFT].tm;
    let r = fail(s);
    expect(r.outcome.rule).toBe('failure');
    expect(r.state.lifts[LIFT].tm).toBeCloseTo(tm0 * 0.975, 9);
    expect(r.state.lifts[LIFT].forced_failures).toBe(1);
    r = fail(r.state);
    expect(r.state.lifts[LIFT].forced_failures).toBe(2);
    const p = prescribeLift(r.state, PROGRAMME_CONFIG, LIFT, M1_DATE);
    expect(p.kind).toBe('refer');
  });
});
