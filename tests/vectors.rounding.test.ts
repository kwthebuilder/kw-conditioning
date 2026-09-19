import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { roundLoad } from '../src/engine';

describe('rounding vectors (§10, A.1)', () => {
  const step = PROGRAMME_CONFIG.equipment.barbell_round_kg;
  for (const v of TEST_VECTORS.rounding) {
    it(`${v.raw} → ${v.expect}`, () => {
      expect(roundLoad(v.raw, step)).toBe(v.expect);
    });
  }
  it('ties go down at every half step', () => {
    for (let k = 0; k < 80; k++) {
      const tie = k * step + step / 2;
      expect(roundLoad(tie, step)).toBe(k * step);
    }
  });
});
