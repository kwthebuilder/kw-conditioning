import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import type { State } from '../src/config/types';
import { prescribeLift, updateLift } from '../src/engine';
import { M1_DATE, stateWith, waveLog } from './helpers';

const LIFT = 'front_squat';
const sets = PROGRAMME_CONFIG.wave.sets;

/** A matched-update session at the given position whose step is negative but not a big gap or a failure. */
function negativeSession(state: State, position: 2 | 3): State {
  const ls = state.lifts[LIFT];
  const pct = PROGRAMME_CONFIG.wave.positions[String(position) as '2' | '3'];
  const load = ls.tm * pct.pct;
  const reps = (pct.par ?? 0) - 1; // one rep short of par at RIR 2: a small negative gap
  const { state: next, outcome } = updateLift(state, PROGRAMME_CONFIG, waveLog(LIFT, position, { load, reps, rir: 2, presc: pct.reps }));
  expect(outcome.rule).toBe('matched');
  expect(outcome.step).toBeLessThan(0);
  return next;
}

/** Prescribe, assert position 1 with the expected sets, log it clean. */
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

function expectNext(state: State, position: number, expectSets: number): void {
  const p = prescribeLift(state, PROGRAMME_CONFIG, LIFT, M1_DATE);
  expect(p).toMatchObject({ kind: 'lift', position, sets: expectSets });
}

/** One scenario per vector case, keyed by the case name in the file. */
const scenarios: Record<string, () => void> = {
  due_position_1() {
    // negative at pos 2, negative at pos 3 → position 1 is due anyway
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 2 });
    s = negativeSession(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(1);
    s = negativeSession(s, 3);
    expect(s.lifts[LIFT].neg_streak).toBe(2);
    expectNext(s, 1, 2);
    s = cleanPosition1(s, 2); // counts as the due position 1
    expect(s.lifts[LIFT].neg_streak).toBe(0);
    expectNext(s, 2, sets);
  },
  due_position_3() {
    // negative at pos 3, clean pos 1, negative at pos 2 → position 3 is due, forced 1 is inserted
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 3 });
    s = negativeSession(s, 3);
    s = cleanPosition1(s, sets);
    expect(s.lifts[LIFT].neg_streak).toBe(1); // position 1 neither counts nor resets (A.6)
    s = negativeSession(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(2);
    expect(s.lifts[LIFT].next_position).toBe(3);
    expectNext(s, 1, 2);
    s = cleanPosition1(s, 2);
    expect(s.lifts[LIFT].neg_streak).toBe(0);
    expect(s.lifts[LIFT].next_position).toBe(3); // pointer stayed
    expectNext(s, 3, sets);
  },
  failure_in_forced_session() {
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 2 });
    s = negativeSession(s, 2);
    s = negativeSession(s, 3);
    const fail = (state: State) => {
      const p = prescribeLift(state, PROGRAMME_CONFIG, LIFT, M1_DATE);
      if (p.kind !== 'lift') throw new Error('expected lift');
      expect(p).toMatchObject({ position: 1, sets: 2 });
      return updateLift(state, PROGRAMME_CONFIG, waveLog(LIFT, 1, { load: p.load, reps: p.reps - 1, rir: 2, presc: p.reps, sets: 2 }));
    };
    const tm0 = s.lifts[LIFT].tm;
    let r = fail(s);
    expect(r.outcome.rule).toBe('failure');
    expect(r.state.lifts[LIFT].tm).toBeCloseTo(tm0 * 0.975, 9);
    expectNext(r.state, 1, 2); // one more forced session
    r = fail(r.state);
    expect(r.state.lifts[LIFT].tm).toBeCloseTo(tm0 * 0.975 * 0.975, 9);
    const p = prescribeLift(r.state, PROGRAMME_CONFIG, LIFT, M1_DATE);
    expect(p.kind).toBe('refer');
    if (p.kind === 'refer') expect(p.reason.toLowerCase()).toContain('failure');
  },
};

describe('downward_trigger vectors (2.7, A.6, A.14)', () => {
  for (const c of TEST_VECTORS.downward_trigger.cases) {
    it(`${c.name}: ${c.sequence ? c.sequence + ' → ' : ''}${c.expect}`, () => {
      const run = scenarios[c.name];
      if (!run) throw new Error(`no scenario for vector case "${c.name}"`);
      run();
    });
  }

  it('a non-negative step at position 2 or 3 resets the streak before it reaches two', () => {
    let s = stateWith(LIFT, { tm: 100, beta: { '2': 1, '3': 1 }, next_position: 2 });
    s = negativeSession(s, 2);
    const pct = PROGRAMME_CONFIG.wave.positions['3'];
    const { state: next, outcome } = updateLift(s, PROGRAMME_CONFIG, waveLog(LIFT, 3, { load: s.lifts[LIFT].tm * pct.pct, reps: (pct.par ?? 0) + 1, rir: 2, presc: pct.reps }));
    expect(outcome.step).toBeGreaterThan(0);
    expect(next.lifts[LIFT].neg_streak).toBe(0);
  });
});
