import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import type { MesocycleId } from '../src/config/types';
import { prescribeLift, roundLoad, tmFromSingle, updateLift } from '../src/engine';
import type { BarbellLog } from '../src/engine';
import { closeTo, M1_DATE, stateWith, waveLog } from './helpers';

const cfg = PROGRAMME_CONFIG;
const v = TEST_VECTORS.singles;
const tol = TEST_VECTORS.tolerance;
const meso = (id: string) => cfg.mesocycles.find((m) => m.id === id)!;
const previous = (id: MesocycleId): MesocycleId => {
  const i = cfg.mesocycles.findIndex((m) => m.id === id);
  return cfg.mesocycles[i - 1]!.id;
};

describe('singles vectors: boundary (A.15)', () => {
  it('the config lists the same boundaries as the vectors', () => {
    expect(cfg.boundary_singles_on_entering).toEqual(v.boundary.fires_on_entering);
  });

  for (const id of v.boundary.fires_on_entering) {
    it(`suggests a single on entering ${id}`, () => {
      const s = stateWith('deadlift', { tm: 150 });
      s.lifts.deadlift.last_mesocycle = previous(id);
      s.lifts.deadlift.last_logged = meso(previous(id)).end;
      const p = prescribeLift(s, cfg, 'deadlift', meso(id).start);
      expect(p).toMatchObject({ kind: 'lift', single_suggested: { reason: 'boundary', rir: 2, taken: false } });
    });
  }

  for (const entry of v.boundary.never) {
    const id = entry.split(' ')[0] as MesocycleId;
    it(`never for ${entry}`, () => {
      const s = stateWith('deadlift', { tm: 150 });
      if (id !== 'M1') {
        s.lifts.deadlift.last_mesocycle = previous(id);
        s.lifts.deadlift.last_logged = meso(previous(id)).end;
      } else {
        delete s.lifts.deadlift.last_mesocycle; // absent means M1
      }
      const p = prescribeLift(s, cfg, 'deadlift', meso(id).start);
      expect(p).not.toHaveProperty('single_suggested');
    });
  }

  it('is skippable: skipping clears the suggestion and changes nothing else (A.17)', () => {
    expect(v.boundary.skippable).toBe(true);
    const id = v.boundary.fires_on_entering[0]!;
    const withFlag = stateWith('front_squat', { tm: 100, beta: { '2': 1, '3': 1 } });
    withFlag.lifts.front_squat.last_mesocycle = previous(id);
    const p = prescribeLift(withFlag, cfg, 'front_squat', meso(id).start);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.single_suggested?.reason).toBe('boundary');
    // Same log, skipped: the suggestion is gone next time and the state equals the no-suggestion path.
    const log: BarbellLog = { lift: 'front_squat', date: meso(id).start, mode: p.mode, prescribed: { load: p.load, reps: p.reps, sets: p.sets }, last_set: { load: p.load, reps: p.reps, rir: 3 }, missed: false };
    const skipped = updateLift(withFlag, cfg, log).state;
    expect(prescribeLift(skipped, cfg, 'front_squat', meso(id).start)).not.toHaveProperty('single_suggested');
    const noFlag = structuredClone(withFlag);
    noFlag.lifts.front_squat.last_mesocycle = id;
    const plain = updateLift(noFlag, cfg, log).state;
    expect(skipped).toEqual(plain);
  });
});

describe('singles vectors: single-day work sets (A.16)', () => {
  const inp = v.single_day_work_sets.input;
  const exp = v.single_day_work_sets.expect;

  it(exp.rule_for_work_sets, () => {
    const s = stateWith('front_squat', { tm: inp.tm_before, next_position: inp.pos });
    s.lifts.front_squat.single_scheduled = true;
    const p = prescribeLift(s, cfg, 'front_squat', M1_DATE, inp.single);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.single_suggested?.taken).toBe(true);
    expect(p.amrap).toBe(false);
    expect(p).not.toHaveProperty('par');
    expect(closeTo(p.tm, exp.tm, tol.tm)).toBe(true);
    expect(p.load).toBe(roundLoad(tmFromSingle(inp.single) * p.pct, cfg.equipment.barbell_round_kg));

    const log = waveLog('front_squat', inp.pos, { load: inp.work_last_set.load, reps: inp.work_last_set.reps, rir: inp.work_last_set.rir, presc: p.reps }, { single: { load: inp.single, rir: 2 } });
    const { state: after, outcome } = updateLift(s, cfg, log);
    expect(closeTo(after.lifts.front_squat.tm, exp.tm, tol.tm), `tm ${after.lifts.front_squat.tm}`).toBe(true);
    expect(outcome.rule).toBe('single');
    expect(outcome.step).toBe(0);
    expect(outcome.E).toBeUndefined(); // no rep-out, no calibration
    expect(after.lifts.front_squat.beta[String(inp.pos) as '2' | '3']).toBeNull();
    expect(after.lifts.front_squat.single_scheduled).toBe(false);
    expect(after.lifts.front_squat.next_position).toBe(inp.pos === 3 ? 1 : inp.pos + 1);
  });

  it('the failure signal still applies on a single day', () => {
    const s = stateWith('front_squat', { tm: inp.tm_before, next_position: inp.pos });
    s.lifts.front_squat.single_scheduled = true;
    const presc = cfg.wave.positions[String(inp.pos) as '2' | '3'].reps;
    const log = waveLog('front_squat', inp.pos, { load: inp.work_last_set.load, reps: presc - 1, rir: 2, presc }, { single: { load: inp.single, rir: 2 } });
    const { outcome } = updateLift(s, cfg, log);
    expect(outcome.rule).toBe('failure');
    expect(closeTo(outcome.tm_after, exp.tm * 0.975, tol.tm)).toBe(true);
  });
});

describe('singles vectors: big gap', () => {
  it(v.big_gap, () => {
    const s = stateWith('front_squat', { tm: 94, beta: { '2': 1 }, next_position: 2 });
    const big = updateLift(s, cfg, waveLog('front_squat', 2, { load: 80, reps: 10, rir: 2, presc: 3 }));
    expect(big.outcome.rule).toBe('biggap');
    expect(big.state.lifts.front_squat.single_scheduled).toBe(true);
    const p = prescribeLift(big.state, cfg, 'front_squat', M1_DATE);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.single_suggested).toEqual({ reason: 'big_gap', rir: 2, taken: false });
    expect(p.amrap).toBe(true);
    // Skip: cleared, nothing else changes.
    const log = waveLog('front_squat', 3, { load: p.load, reps: 5, rir: 2, presc: p.reps });
    const skipped = updateLift(big.state, cfg, log).state;
    const noFlag = structuredClone(big.state);
    noFlag.lifts.front_squat.single_scheduled = false;
    const plain = updateLift(noFlag, cfg, log).state;
    expect(skipped.lifts.front_squat.single_scheduled).toBe(false);
    expect(skipped).toEqual(plain);
  });
});
