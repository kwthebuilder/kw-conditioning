import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import type { LiftId } from '../src/config/types';
import { roundLoad, updateLift } from '../src/engine';
import { closeTo, stateWith, waveLog } from './helpers';

const tol = TEST_VECTORS.tolerance;
/** The file prints E, T and gap to three decimals. */
const PRINTED = 0.0006;

describe('barbell vectors (§2, A.2)', () => {
  for (const v of TEST_VECTORS.barbell) {
    const lift: LiftId = v.name.startsWith('dl_') ? 'deadlift' : 'front_squat';
    const inp = v.input;

    it(v.name, () => {
      if (inp.cal_cap !== undefined) {
        // The vector's cap must be the config's cap for this lift; otherwise the test is wrong, not the engine.
        expect(PROGRAMME_CONFIG.slots[lift]?.cal_cap).toBe(inp.cal_cap);
      }
      const beta: Partial<Record<'2' | '3', number | null>> = {};
      if (inp.beta !== undefined && (inp.pos === 2 || inp.pos === 3)) beta[String(inp.pos) as '2' | '3'] = inp.beta;
      if (inp.calibrating) expect(inp.beta).toBeUndefined();

      const state = stateWith(lift, { tm: inp.tm, beta, next_position: inp.pos });
      const log = waveLog(lift, inp.pos, {
        load: inp.load,
        reps: inp.reps,
        rir: inp.rir,
        presc: inp.presc,
        ...(inp.missed !== undefined ? { missed: inp.missed } : {}),
      });

      const { state: after, outcome, explanation } = updateLift(state, PROGRAMME_CONFIG, log);
      const exp = v.expect;

      expect(outcome.rule).toBe(exp.rule);
      expect(closeTo(outcome.tm_after, exp.tm, tol.tm), `tm ${outcome.tm_after} vs ${exp.tm}`).toBe(true);
      expect(after.lifts[lift].tm).toBe(outcome.tm_after);
      if (exp.step !== undefined) expect(closeTo(outcome.step, exp.step, tol.tm), `step ${outcome.step}`).toBe(true);
      if (exp.E !== undefined) expect(closeTo(outcome.E ?? NaN, exp.E, PRINTED), `E ${outcome.E}`).toBe(true);
      if (exp.T !== undefined) expect(closeTo(outcome.T ?? NaN, exp.T, PRINTED), `T ${outcome.T}`).toBe(true);
      if (exp.gap !== undefined) expect(closeTo(outcome.gap ?? NaN, exp.gap, PRINTED), `gap ${outcome.gap}`).toBe(true);
      if (exp.beta === null) expect(outcome.beta).toBeNull();
      else expect(closeTo(outcome.beta ?? NaN, exp.beta, tol.beta), `beta ${outcome.beta}`).toBe(true);
      expect(outcome.single_scheduled).toBe(exp.single);
      expect(after.lifts[lift].single_scheduled).toBe(exp.single);

      // Displayed loads at 80/85/90% of the resulting TM, rounded.
      const step = PROGRAMME_CONFIG.equipment.barbell_round_kg;
      for (const p of ['1', '2', '3'] as const) {
        const pct = PROGRAMME_CONFIG.wave.positions[p].pct;
        expect(closeTo(roundLoad(outcome.tm_after * pct, step), v.next_loads[p], tol.load), `next load pos ${p}`).toBe(true);
      }

      // The explanation names the rule and the resulting TM.
      const text = explanation.steps.map((s) => s.text).join(' ');
      expect(text).toContain(`${exp.tm.toFixed(1)} kg`);
      expect(explanation.steps.some((s) => s.rule === exp.rule)).toBe(true);
      expect(explanation.summary).toContain(`→ ${exp.tm.toFixed(1)} kg`);
    });
  }

  it('never mutates the input state', () => {
    const v = TEST_VECTORS.barbell[0]!;
    const state = stateWith('front_squat', { tm: v.input.tm, next_position: v.input.pos });
    const frozen = JSON.stringify(state);
    updateLift(state, PROGRAMME_CONFIG, waveLog('front_squat', v.input.pos, { load: v.input.load, reps: v.input.reps, rir: v.input.rir, presc: v.input.presc }));
    expect(JSON.stringify(state)).toBe(frozen);
  });
});
