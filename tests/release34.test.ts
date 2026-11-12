/**
 * Release 3.4 (config v1.10, engine_spec_v1_11.md A.43 and A.44), synthetic
 * data only: heavy doubles in Blocks 2 to 4 and the taper, and the test
 * single read by its reps left. Vectors: engine_test_vectors_v1_10.json
 * `heavy_doubles` and `single_rir`.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg, TEST_VECTORS as V } from '../src/config/load';
import type { LogSequenceVector, State, StatePatch } from '../src/config/types';
import { amend, prescribe, prescribeLift, update } from '../src/engine';
import type { AnyLog, BarbellLog, LiftPrescription, Session } from '../src/engine';

/** Deep-merge a patch into a copy of the initial state (as in vectors.release3.test.ts). */
function patched(patch?: StatePatch): State {
  const s = structuredClone(INITIAL_STATE) as unknown as Record<string, unknown>;
  const merge = (into: Record<string, unknown>, from: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(from)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v) && into[k] !== null && typeof into[k] === 'object' && !Array.isArray(into[k])) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
      else into[k] = structuredClone(v);
    }
  };
  if (patch) merge(s, patch);
  return s as unknown as State;
}

const tol = V.tolerance.tm;

function run(v: LogSequenceVector): { state: State; outcome: ReturnType<typeof update>['outcome'] } {
  let state = patched(v.state_patch);
  let outcome: ReturnType<typeof update>['outcome'] = null;
  for (const l of v.logs) {
    const r = update(state, l as AnyLog, cfg);
    state = r.state;
    outcome = r.outcome;
  }
  return { state, outcome };
}

function liftItem(s: Session, lift: string): { prescription: LiftPrescription } {
  for (const b of s.blocks) for (const it of b.items) if (it.kind === 'slot' && it.slot === lift && it.prescription.kind === 'lift') return { prescription: it.prescription };
  throw new Error(`${lift} not in the session`);
}

function lift(p: ReturnType<typeof prescribeLift>): LiftPrescription {
  if (p.kind !== 'lift') throw new Error('refer');
  return p;
}

describe('heavy doubles: what is prescribed (A.43)', () => {
  for (const v of V.heavy_doubles!.prescribe) {
    it(v.name, () => {
      const s = prescribe(patched(v.state_patch), cfg, v.date, v.day);
      if (s.kind !== 'session') throw new Error('refer');
      const p = liftItem(s, v.lift).prescription;
      expect(p.mode).toBe(v.expect.mode);
      expect(p.load).toBe(v.expect.load);
      expect(p.sets).toBe(v.expect.sets);
      expect(p.sets_max ?? null).toBe(v.expect.sets_max);
      expect(p.reps).toBe(v.expect.reps);
      expect(p.amrap).toBe(false);
      expect(p.single_suggested !== undefined).toBe(v.expect.single);
    });
  }

  it('the load is 87% of the estimated max (TM ÷ 0.90), so 0.967 of the TM', () => {
    const p = lift(prescribeLift(patched({ lifts: { front_squat: { tm: 90, last_mesocycle: 'M2', entered_on: '2026-11-10' } } }), cfg, 'front_squat', '2026-11-16'));
    expect(p.pct).toBeCloseTo(0.87 / 0.9, 12);
    expect(p.load).toBe(87.5);
  });

  it('a warm-up ramp is shown unless a test single was taken today', () => {
    const plain = lift(prescribeLift(patched({ lifts: { front_squat: { tm: 92, last_mesocycle: 'M2', entered_on: '2026-11-10' } } }), cfg, 'front_squat', '2026-11-16'));
    expect(plain.ramp.length).toBeGreaterThan(0);
    const after = lift(prescribeLift(
      patched({ lifts: { deadlift: { tm: 150, last_mesocycle: 'M2', entered_on: '2026-11-12', single_taken: { date: '2026-11-12', reason: 'boundary' } } } }),
      cfg,
      'deadlift',
      '2026-11-12',
    ));
    expect(after.ramp).toEqual([]);
  });
});

describe('heavy doubles: what the last double does to the training max (A.43)', () => {
  for (const v of V.heavy_doubles!.update) {
    it(v.name, () => {
      const { state, outcome } = run(v);
      expect(state.lifts[v.expect.lift].tm).toBeCloseTo(v.expect.tm!, -Math.log10(tol));
      expect(outcome).not.toBeNull();
      const o = outcome as { rule: string; single_scheduled: boolean };
      if (v.expect.rule !== undefined) expect(o.rule).toBe(v.expect.rule);
      if (v.expect.single_scheduled !== undefined) expect(state.lifts[v.expect.lift].single_scheduled).toBe(v.expect.single_scheduled);
    });
  }

  it('the explanation names the numbers', () => {
    const r = update(
      patched({ lifts: { front_squat: { tm: 92, last_mesocycle: 'M2', entered_on: '2026-11-10' } } }),
      { kind: 'barbell', lift: 'front_squat', date: '2026-11-16', mode: 'heavy_doubles', prescribed: { load: 90, reps: 2, sets: 3 }, last_set: { load: 90, reps: 2, rir: 3 }, missed: false },
      cfg,
    );
    const text = r.explanation.steps.map((s) => s.text).join(' ');
    expect(text).toMatch(/Last double 90\.0 kg × 2 at RIR 3/);
    expect(text).toMatch(/E = 90\.0 × \(1 \+ \(2 \+ 3\) \/ 30\) = 105\.0/);
    expect(text).toMatch(/Half the gap, capped at 2\.5%/);
  });

  it('β is neither read nor changed by a heavy double', () => {
    const before = patched({ lifts: { front_squat: { tm: 92, beta: { '2': 1.03, '3': 0.97 }, last_mesocycle: 'M2', entered_on: '2026-11-10' } } });
    const r = update(
      before,
      { kind: 'barbell', lift: 'front_squat', date: '2026-11-16', mode: 'heavy_doubles', prescribed: { load: 90, reps: 2, sets: 3 }, last_set: { load: 90, reps: 2, rir: 3 }, missed: false },
      cfg,
    );
    expect(r.state.lifts.front_squat.beta).toEqual({ '2': 1.03, '3': 0.97 });
    expect(r.state.lifts.front_squat.tm).toBeCloseTo(93.25, 9);
  });
});

describe('test single by reps left (A.44)', () => {
  for (const v of V.single_rir!) {
    it(v.name, () => {
      if (v.expect.refused) {
        expect(() => run(v)).toThrow(/0 to 3 reps left/);
        return;
      }
      const { state } = run(v);
      expect(state.lifts[v.expect.lift].tm).toBeCloseTo(v.expect.tm!, -Math.log10(tol));
    });
  }

  it('2 left gives exactly the v1.10 number, so older logs replay to the bit', () => {
    const s = patched({ lifts: { deadlift: { tm: 152 } } });
    const r = update(s, { kind: 'single', lift: 'deadlift', date: '2026-11-12', load: 160, rir: 2 }, cfg);
    expect(r.state.lifts.deadlift.tm).toBe(160 * (0.9 / 0.93));
  });

  it('changing a logged single to 1 left rebuilds the training max (A.28)', () => {
    const base = patched({ lifts: { front_squat: { tm: 92.0, last_mesocycle: 'M1' } } });
    const single = { kind: 'single', lift: 'front_squat', date: '2026-11-16', load: 102.5, rir: 2 } as const;
    const s1 = update(base, single, cfg).state;
    expect(s1.lifts.front_squat.tm).toBeCloseTo(102.5 * (0.9 / 0.93), 9);
    const r = amend(base, s1, { kind: 'correction', date: '2026-11-16', on: '2026-11-16', actions: [{ op: 'replace', target: 0, entry: { ...single, rir: 1 } }] }, cfg);
    expect(r.state.lifts.front_squat.tm).toBeCloseTo(102.5 * (0.9 / 0.955), 9);
  });
});

describe('older logs are untouched by release 3.4', () => {
  it('a Block 2 band double from config v1.9 replays by the band rule, not the doubles rule', () => {
    const s = patched({ lifts: { front_squat: { tm: 100, last_mesocycle: 'M2', entered_on: '2026-11-10' } } });
    const band: BarbellLog = { lift: 'front_squat', date: '2026-11-10', mode: 'band_87_90', prescribed: { load: 80, reps: 2, sets: 3 }, last_set: { load: 82.5, reps: 4, rir: 2 }, missed: false };
    const r = update(s, { kind: 'barbell', ...band }, cfg);
    expect(r.outcome).toMatchObject({ rule: 'hold', step: 0 });
    expect(r.state.lifts.front_squat.tm).toBe(100);
  });

  it('the initial state still plans Block 1 by the wave', () => {
    const s = prescribe(INITIAL_STATE, cfg, '2026-10-20', 1);
    if (s.kind !== 'session') throw new Error('refer');
    expect(liftItem(s, 'front_squat').prescription.mode).toBe('wave');
  });
});
