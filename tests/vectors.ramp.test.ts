import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { prescribeLift, rampSets } from '../src/engine';
import { M1_DATE, stateWith } from './helpers';

const cfg = PROGRAMME_CONFIG;

describe('ramp vectors (A.20: one rounding rule)', () => {
  for (const v of TEST_VECTORS.ramp) {
    it(`day load ${v.day_load} → ${v.expect.map(([l, r]) => `${l} × ${r}`).join(', ')}${v.note ? ` (${v.note})` : ''}`, () => {
      expect(rampSets(v.day_load, cfg)).toEqual(v.expect.map(([load, reps]) => ({ load, reps })));
    });
  }

  it('the prescription carries the same ramp as the helper', () => {
    // A TM whose 85% displays as the first vector's day load.
    const first = TEST_VECTORS.ramp[0]!;
    const tm = first.day_load / cfg.wave.positions['2'].pct;
    const p = prescribeLift(stateWith('front_squat', { tm, next_position: 2 }), cfg, 'front_squat', M1_DATE);
    if (p.kind !== 'lift') throw new Error();
    expect(p.load).toBe(first.day_load);
    expect(p.ramp).toEqual(rampSets(first.day_load, cfg));
  });
});
