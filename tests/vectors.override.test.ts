import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { overrideLoad, overrideTm, prescribeLift, rawEstimate, roundLoad, updateLift } from '../src/engine';
import type { BarbellLog } from '../src/engine';
import { closeTo, M1_DATE, stateWith } from './helpers';

const cfg = PROGRAMME_CONFIG;
const tol = TEST_VECTORS.tolerance;
const step = cfg.equipment.barbell_round_kg;

describe('override vectors (A.18)', () => {
  for (const v of TEST_VECTORS.override) {
    if (v.name === 'load_override') {
      it(`${v.name}: ${v.expect}`, () => {
        // The initial state prescribes the vector's load on the front squat at week 2.
        const p = prescribeLift(INITIAL_STATE, cfg, 'front_squat', M1_DATE);
        if (p.kind !== 'lift') throw new Error('expected lift');
        expect(p.load).toBe(v.prescribed_load);

        const p2 = overrideLoad(p, cfg, v.athlete_changes_to, 'felt light');
        expect(p2.load).toBe(v.athlete_changes_to);
        expect(p2.override).toEqual({ from: v.prescribed_load, note: 'felt light' });

        const log: BarbellLog = {
          lift: 'front_squat',
          date: M1_DATE,
          mode: 'wave',
          position: p2.position!,
          prescribed: { load: p2.load, reps: p2.reps, sets: p2.sets },
          last_set: { load: v.log.load, reps: v.log.reps, rir: v.log.rir },
          missed: false,
          override: p2.override!,
        };
        const { state, outcome } = updateLift(INITIAL_STATE, cfg, log);
        // update() reads the performed load
        expect(outcome.E).toBeCloseTo(rawEstimate(v.log.load, v.log.reps, v.log.rir), 9);
        // export record: prescribed, performed, optional note
        expect(state.overrides).toEqual([
          { kind: 'load', date: M1_DATE, slot: 'front_squat', from: v.prescribed_load, to: v.athlete_changes_to, note: 'felt light' },
        ]);
      });
    } else {
      it(`${v.name}: TM ${v.tm_before} → ${v.athlete_sets}, ${v.expect.betas}`, () => {
        const betas = { '2': 1.0, '3': 1.02 };
        const s = stateWith(v.lift, { tm: v.tm_before, beta: betas, next_position: 2 });
        const r = overrideTm(s, v.lift, v.athlete_sets, M1_DATE, 'coach call');
        const ls = r.state.lifts[v.lift];
        expect(closeTo(ls.tm, v.expect.tm, tol.tm)).toBe(true);
        const ratio = v.athlete_sets / v.tm_before;
        expect(closeTo(ls.beta['2']!, betas['2'] * ratio, tol.beta)).toBe(true);
        expect(closeTo(ls.beta['3']!, betas['3'] * ratio, tol.beta)).toBe(true);
        for (const pos of ['1', '2', '3'] as const) {
          expect(roundLoad(ls.tm * cfg.wave.positions[pos].pct, step), `next load pos ${pos}`).toBe(v.expect.next_loads[pos]);
        }
        // the next prescription is driven by the new TM
        const p = prescribeLift(r.state, cfg, v.lift, M1_DATE);
        expect(p).toMatchObject({ kind: 'lift', tm: v.expect.tm, load: v.expect.next_loads['2'] });
        // export record
        expect(r.state.overrides).toEqual([{ kind: 'tm', date: M1_DATE, lift: v.lift, from: v.tm_before, to: v.athlete_sets, note: 'coach call' }]);
        expect(s.lifts[v.lift].tm).toBe(v.tm_before);
      });
    }
  }
});
