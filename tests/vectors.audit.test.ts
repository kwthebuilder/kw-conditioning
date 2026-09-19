import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { prescribeLift, roundLoad, tmFromSingle, updateLift } from '../src/engine';
import { closeTo, stateWith, waveLog, M1_DATE } from './helpers';

const tol = TEST_VECTORS.tolerance;
const v = TEST_VECTORS.audit_rescale;

describe('audit_rescale vector (2.8, A.8)', () => {
  it('resets the TM from the single and rescales every set β', () => {
    const state = stateWith('front_squat', {
      tm: v.tm_before,
      beta: { '2': v.betas_before['2'], '3': v.betas_before['3'] },
      next_position: 1,
    });
    state.lifts.front_squat.single_scheduled = true;

    const p = prescribeLift(state, PROGRAMME_CONFIG, 'front_squat', M1_DATE, v.single);
    expect(p.kind).toBe('lift');
    if (p.kind !== 'lift') return;
    expect(p.single_suggested?.reason).toBe('big_gap');
    expect(p.amrap).toBe(false);
    expect(closeTo(p.tm, v.expect.tm, tol.tm)).toBe(true);
    expect(p.load).toBe(roundLoad(tmFromSingle(v.single) * p.pct, PROGRAMME_CONFIG.equipment.barbell_round_kg));

    const log = waveLog('front_squat', 1, { load: p.load, reps: p.reps, rir: 3, presc: p.reps }, { single: { load: v.single, rir: 2 } });
    const { state: after, outcome, explanation } = updateLift(state, PROGRAMME_CONFIG, log);
    const ls = after.lifts.front_squat;
    expect(closeTo(ls.tm, v.expect.tm, tol.tm), `tm ${ls.tm}`).toBe(true);
    expect(closeTo(ls.beta['2'] ?? NaN, v.expect.betas['2'], tol.beta), `β2 ${ls.beta['2']}`).toBe(true);
    expect(closeTo(ls.beta['3'] ?? NaN, v.expect.betas['3'], tol.beta), `β3 ${ls.beta['3']}`).toBe(true);
    expect(ls.single_scheduled).toBe(false);
    expect(outcome.rule).toBe('single');
    expect(outcome.step).toBe(0);
    expect(explanation.steps[0]?.rule).toBe('single');
    expect(explanation.steps[0]?.text).toContain(`${v.single.toFixed(1)} kg`);
  });

  it('on a single day the work sets are straight sets: no calibration, position still advances', () => {
    const state = stateWith('front_squat', { tm: v.tm_before, next_position: 2 });
    state.lifts.front_squat.single_scheduled = true;
    const p = prescribeLift(state, PROGRAMME_CONFIG, 'front_squat', M1_DATE, v.single);
    if (p.kind !== 'lift') throw new Error('expected lift');
    expect(p.amrap).toBe(false);
    expect(p.par).toBeUndefined();
    const log = waveLog('front_squat', 2, { load: p.load, reps: 9, rir: 2, presc: p.reps }, { single: { load: v.single, rir: 2 } });
    const { state: after, outcome } = updateLift(state, PROGRAMME_CONFIG, log);
    expect(outcome.rule).toBe('single');
    expect(after.lifts.front_squat.beta['2']).toBeNull();
    expect(closeTo(after.lifts.front_squat.tm, v.expect.tm, tol.tm)).toBe(true);
    expect(after.lifts.front_squat.next_position).toBe(3);
  });

  it('the failure signal still applies on a single day', () => {
    const state = stateWith('front_squat', { tm: v.tm_before, next_position: 2 });
    state.lifts.front_squat.single_scheduled = true;
    const log = waveLog('front_squat', 2, { load: 80, reps: 2, rir: 2, presc: 3 }, { single: { load: v.single, rir: 2 } });
    const { outcome } = updateLift(state, PROGRAMME_CONFIG, log);
    expect(outcome.rule).toBe('failure');
    expect(closeTo(outcome.tm_after, v.expect.tm * 0.975, tol.tm)).toBe(true);
  });
});

describe('when a single opens the session (2.8, Q4 ruling)', () => {
  const m = (id: string) => PROGRAMME_CONFIG.mesocycles.find((x) => x.id === id)!;
  it('big-gap flag schedules one', () => {
    const s = stateWith('front_squat', { tm: 100 });
    s.lifts.front_squat.single_scheduled = true;
    const p = prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', M1_DATE);
    expect(p.kind === 'lift' && p.single_suggested?.reason).toBe('big_gap');
  });
  it('entering M2, M3 and M4 does; M1, TAPER do not', () => {
    for (const [id, expected] of [['M2', 'boundary'], ['M3', 'boundary'], ['M4', 'boundary'], ['TAPER', undefined]] as const) {
      const s = stateWith('deadlift', { tm: 150 });
      s.lifts.deadlift.last_logged = m(id).start; // no >14 day gap
      const p = prescribeLift(s, PROGRAMME_CONFIG, 'deadlift', m(id).start);
      expect(p.kind === 'lift' ? p.single_suggested?.reason : 'refer', id).toBe(expected);
    }
    const s = stateWith('deadlift', { tm: 150 });
    const p = prescribeLift(s, PROGRAMME_CONFIG, 'deadlift', M1_DATE);
    expect(p.kind).toBe('lift');
    expect(p).not.toHaveProperty('single_suggested');
  });
  it('not twice in the same mesocycle', () => {
    const s = stateWith('deadlift', { tm: 150 });
    s.lifts.deadlift.last_mesocycle = 'M2';
    s.lifts.deadlift.last_logged = m('M2').start;
    const p = prescribeLift(s, PROGRAMME_CONFIG, 'deadlift', m('M2').start);
    expect(p.kind === 'lift' && p.single_suggested).toBeUndefined();
  });
  it('a long gap does not (A.15: no gap-based single)', () => {
    const s = stateWith('front_squat', { tm: 100 });
    s.lifts.front_squat.last_logged = '2026-09-21';
    expect(prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', '2026-10-20')).not.toHaveProperty('single_suggested');
  });
  it('INTENSIVE has no barbell mode, so refer to project', () => {
    const s = stateWith('front_squat', { tm: 100 });
    expect(prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', m('INTENSIVE').start).kind).toBe('refer');
  });
});
