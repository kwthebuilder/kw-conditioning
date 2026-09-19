import { describe, expect, it } from 'vitest';
import { PROGRAMME_CONFIG } from '../src/config/load';
import type { State } from '../src/config/types';
import type { BarbellLog } from '../src/engine';
import { prescribeLift, roundLoad, updateLift } from '../src/engine';
import { stateWith } from './helpers';

const m = (id: string) => PROGRAMME_CONFIG.mesocycles.find((x) => x.id === id)!;
const step = PROGRAMME_CONFIG.equipment.barbell_round_kg;

/** State that has already logged in the mesocycle, so no boundary single fires. */
function inMeso(id: 'M2' | 'M3' | 'M4' | 'TAPER', tm: number): { s: State; date: string } {
  const s = stateWith('front_squat', { tm, beta: { '2': 1, '3': 1 } });
  s.lifts.front_squat.last_mesocycle = id;
  s.lifts.front_squat.last_logged = m(id).start;
  return { s, date: m(id).start };
}

function heldLog(date: string, mode: BarbellLog['mode'], load: number, reps: number, rir: number, presc = 2): BarbellLog {
  return { lift: 'front_squat', date, mode, prescribed: { load, reps: presc, sets: 2 }, last_set: { load, reps, rir }, missed: false };
}

describe('M2 band_87_90 (2.9, A.9)', () => {
  it('starts at 87%, doubles, no rep-out', () => {
    const { s, date } = inMeso('M2', 100);
    const p = prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', date);
    expect(p).toMatchObject({ kind: 'lift', mode: 'band_87_90', pct: 0.87, reps: 2, amrap: false, load: roundLoad(87, step) });
  });
  it('moves to 90% after two consecutive sessions at RIR 3 or more, and the TM does not move', () => {
    const { s, date } = inMeso('M2', 100);
    let r = updateLift(s, PROGRAMME_CONFIG, heldLog(date, 'band_87_90', 87.5, 2, 3));
    expect(r.outcome).toMatchObject({ rule: 'hold', step: 0, band_pct: 0.87 });
    r = updateLift(r.state, PROGRAMME_CONFIG, heldLog(date, 'band_87_90', 87.5, 2, 4));
    expect(r.outcome.band_pct).toBe(0.9);
    expect(r.state.lifts.front_squat.tm).toBe(100);
    expect(prescribeLift(r.state, PROGRAMME_CONFIG, 'front_squat', date)).toMatchObject({ pct: 0.9 });
  });
  it('a RIR 2 session breaks the streak', () => {
    const { s, date } = inMeso('M2', 100);
    let r = updateLift(s, PROGRAMME_CONFIG, heldLog(date, 'band_87_90', 87.5, 2, 3));
    r = updateLift(r.state, PROGRAMME_CONFIG, heldLog(date, 'band_87_90', 87.5, 2, 2));
    r = updateLift(r.state, PROGRAMME_CONFIG, heldLog(date, 'band_87_90', 87.5, 2, 3));
    expect(r.outcome.band_pct).toBe(0.87);
  });
  it('a failure signal cuts the TM 2.5% and returns the band to 87%', () => {
    const { s, date } = inMeso('M2', 100);
    s.lifts.front_squat.band = { pct: 0.9, high_rir_streak: 0 };
    const r = updateLift(s, PROGRAMME_CONFIG, heldLog(date, 'band_87_90', 90, 1, 2));
    expect(r.outcome).toMatchObject({ rule: 'failure', band_pct: 0.87 });
    expect(r.state.lifts.front_squat.tm).toBeCloseTo(97.5, 9);
    expect(r.explanation.steps.map((x) => x.rule)).toEqual(['failure', 'band']);
  });
});

describe('M3/M4 primer and taper (2.9)', () => {
  it('M3 and M4: 2 × 2 at 90%; taper: 1 × 2 at 90%', () => {
    for (const [id, sets] of [['M3', 2], ['M4', 2], ['TAPER', 1]] as const) {
      const { s, date } = inMeso(id, 100);
      const p = prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', date);
      expect(p, id).toMatchObject({ kind: 'lift', pct: 0.9, sets, reps: 2, amrap: false, load: 90 });
    }
  });
  it('TM holds unless a failure signal fires', () => {
    const { s, date } = inMeso('M3', 100);
    const hold = updateLift(s, PROGRAMME_CONFIG, heldLog(date, 'primer_2x2_90', 90, 2, 2));
    expect(hold.outcome).toMatchObject({ rule: 'hold', step: 0, tm_after: 100 });
    const fail = updateLift(s, PROGRAMME_CONFIG, heldLog(date, 'primer_2x2_90', 90, 2, 1));
    expect(fail.outcome.rule).toBe('failure');
    expect(fail.state.lifts.front_squat.tm).toBeCloseTo(97.5, 9);
  });
});

describe('wave prescription (2.2)', () => {
  it('shows ramp sets and par at positions 2 and 3, and no par at position 1', () => {
    const s = stateWith('front_squat', { tm: 92, next_position: 2 });
    const p2 = prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', '2026-09-21');
    const w = PROGRAMME_CONFIG.wave;
    expect(p2).toMatchObject({ position: 2, load: roundLoad(92 * w.positions['2'].pct, step), reps: w.positions['2'].reps, sets: w.sets, amrap: true, par: w.positions['2'].par });
    if (p2.kind !== 'lift') throw new Error();
    expect(p2.ramp).toEqual(w.ramp.map(([frac, reps]) => ({ load: roundLoad(p2.load * frac, step), reps })));
    s.lifts.front_squat.next_position = 1;
    const p1 = prescribeLift(s, PROGRAMME_CONFIG, 'front_squat', '2026-09-21');
    expect(p1).toMatchObject({ position: 1, amrap: false });
    expect(p1).not.toHaveProperty('par');
  });
});
