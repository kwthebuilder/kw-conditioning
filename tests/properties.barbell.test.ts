import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG } from '../src/config/load';
import type { LiftId } from '../src/config/types';
import { updateLift } from '../src/engine';
import { stateWith, waveLog } from './helpers';

const BIG_GAP = 0.07;
const step = PROGRAMME_CONFIG.equipment.barbell_round_kg;

const liftArb = fc.constantFrom<LiftId>('front_squat', 'deadlift');
const tmArb = fc.double({ min: 40, max: 250, noNaN: true });
const betaArb = fc.option(fc.double({ min: 0.9, max: 1.15, noNaN: true }), { nil: null });
const setArb = fc.record({
  reps: fc.integer({ min: 0, max: 15 }),
  rir: fc.integer({ min: 0, max: 4 }),
  missed: fc.boolean(),
  loadJitter: fc.double({ min: -5, max: 5, noNaN: true }),
});

describe('barbell properties', () => {
  it('no step ever exceeds its cap', () => {
    fc.assert(
      fc.property(liftArb, tmArb, fc.constantFrom(2 as const, 3 as const), betaArb, setArb, (lift, tm, pos, beta, set) => {
        const state = stateWith(lift, { tm, beta: { [String(pos)]: beta }, next_position: pos });
        const wp = PROGRAMME_CONFIG.wave.positions[String(pos) as '2' | '3'];
        const load = Math.max(20, tm * wp.pct + set.loadJitter);
        const { outcome } = updateLift(state, PROGRAMME_CONFIG, waveLog(lift, pos, { load, reps: set.reps, rir: set.rir, presc: wp.reps, missed: set.missed }));
        const rel = Math.abs(outcome.step) / tm;
        expect(rel).toBeLessThanOrEqual(0.05 + 1e-12);
        const calCap = PROGRAMME_CONFIG.slots[lift]!.cal_cap!;
        const bigGap = outcome.gap !== undefined && Math.abs(outcome.gap) >= BIG_GAP;
        const allowed =
          outcome.rule === 'biggap' || (outcome.rule === 'calibration' && bigGap)
            ? 0.05
            : outcome.rule === 'calibration'
              ? calCap
              : 0.025;
        expect(rel, `${lift} ${outcome.rule} gap=${outcome.gap}`).toBeLessThanOrEqual(allowed + 1e-12);
      }),
      { numRuns: 2000 },
    );
  });

  it('state never holds a rounded training max', () => {
    fc.assert(
      fc.property(liftArb, tmArb, fc.constantFrom(2 as const, 3 as const), betaArb, setArb, (lift, tm, pos, beta, set) => {
        const state = stateWith(lift, { tm, beta: { [String(pos)]: beta }, next_position: pos });
        const wp = PROGRAMME_CONFIG.wave.positions[String(pos) as '2' | '3'];
        const load = Math.max(20, tm * wp.pct + set.loadJitter);
        const { state: after, outcome } = updateLift(state, PROGRAMME_CONFIG, waveLog(lift, pos, { load, reps: set.reps, rir: set.rir, presc: wp.reps, missed: set.missed }));
        // The stored TM is exactly the unrounded arithmetic result...
        expect(after.lifts[lift].tm).toBeCloseTo(tm + outcome.step, 9);
        // ...and is not snapped to the plate step when the arithmetic did not land on one.
        const onGrid = Math.abs(after.lifts[lift].tm / step - Math.round(after.lifts[lift].tm / step)) < 1e-9;
        const arithmeticOnGrid = Math.abs((tm + outcome.step) / step - Math.round((tm + outcome.step) / step)) < 1e-9;
        expect(onGrid).toBe(arithmeticOnGrid);
      }),
      { numRuns: 2000 },
    );
  });

  it('a position 1 session never moves the training max', () => {
    fc.assert(
      fc.property(liftArb, tmArb, betaArb, betaArb, fc.integer({ min: 4, max: 12 }), fc.integer({ min: 2, max: 4 }), (lift, tm, b2, b3, reps, rir) => {
        const state = stateWith(lift, { tm, beta: { '2': b2, '3': b3 }, next_position: 1 });
        const wp = PROGRAMME_CONFIG.wave.positions['1'];
        // reps ≥ prescribed and RIR ≥ 2: no failure signal, so position 1 must be a no-op on the TM.
        const { state: after, outcome } = updateLift(state, PROGRAMME_CONFIG, waveLog(lift, 1, { load: tm * wp.pct, reps, rir, presc: wp.reps }));
        expect(outcome.rule).toBe('position1');
        expect(outcome.step).toBe(0);
        expect(after.lifts[lift].tm).toBe(tm);
        expect(after.lifts[lift].beta).toEqual({ '2': b2, '3': b3 });
        expect(after.lifts[lift].neg_streak).toBe(0);
        expect(after.lifts[lift].next_position).toBe(2);
      }),
      { numRuns: 1000 },
    );
  });
});
