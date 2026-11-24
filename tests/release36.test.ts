/**
 * Release 3.6 (config v1.12, engine_spec_v1_12.md A.46, design rationale
 * v3.9): B weeks in Block 2. On programme weeks 12 and 14 the main lifts
 * are 3 triples at the same effort as the doubles, the pull-up is done with
 * a neutral grip, the carry is the front-rack carry and the row is the
 * split-stance one-arm cable row. Synthetic data only. Vectors:
 * engine_test_vectors_v1_12.json `alternate_weeks`.
 */
import { describe, expect, it } from 'vitest';
import v111 from '../spec/programme_config_v1_11.json';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg, TEST_VECTORS as V } from '../src/config/load';
import type { LogSequenceVector, State, StatePatch } from '../src/config/types';
import { parseProgrammeConfig } from '../src/config/validate';
import { prescribe, update } from '../src/engine';
import type { AnyLog, LiftPrescription, Session, SessionSlotItem } from '../src/engine';

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

function session(state: State, date: string, day: 1 | 2): Session {
  const s = prescribe(state, cfg, date, day);
  if (s.kind !== 'session') throw new Error(`refer: ${s.reason}`);
  return s;
}

function itemOf(s: Session, slot: string): SessionSlotItem {
  for (const b of s.blocks) for (const it of b.items) if (it.kind === 'slot' && it.slot === slot) return it;
  throw new Error(`${slot} not in the session`);
}

function liftOf(s: Session, slot: string): LiftPrescription {
  const p = itemOf(s, slot).prescription;
  if (p.kind !== 'lift') throw new Error(`${slot} is not a lift`);
  return p;
}

const tol = V.tolerance.tm;
const A = V.alternate_weeks!;

describe('B weeks: what the main lifts prescribe (A.46)', () => {
  for (const v of A.prescribe) {
    it(v.name, () => {
      const p = liftOf(session(patched(v.state_patch), v.date, v.day), v.lift);
      expect(p.mode).toBe(v.expect.mode);
      expect(p.load).toBe(v.expect.load);
      expect(p.sets).toBe(v.expect.sets);
      expect(p.sets_max ?? null).toBe(v.expect.sets_max);
      expect(p.reps).toBe(v.expect.reps);
      expect(p.single_suggested !== undefined).toBe(v.expect.single);
    });
  }

  it('the B-week percentage is the doubles percentage × 0.9722 (same effort by the estimate formula: 35/36)', () => {
    const fs = { lifts: { front_squat: { tm: 98, last_mesocycle: 'M2', last_logged: '2026-11-24', entered_on: '2026-11-10' } } };
    const a = liftOf(session(patched(fs), '2026-12-08', 1), 'front_squat');
    const b = liftOf(session(patched(fs), '2026-12-01', 1), 'front_squat');
    expect(b.pct).toBeCloseTo(a.pct * 0.9722, 12);
    expect(0.9722).toBeCloseTo((1 + 5 / 30) / (1 + 6 / 30), 4);
  });

  it('the warm-up ramp follows the lighter B-week load', () => {
    const fs = { lifts: { front_squat: { tm: 98, last_mesocycle: 'M2', last_logged: '2026-11-24', entered_on: '2026-11-10' } } };
    const b = liftOf(session(patched(fs), '2026-12-01', 1), 'front_squat');
    expect(b.ramp.length).toBeGreaterThan(0);
    for (const [i, [frac]] of cfg.wave.ramp.entries()) {
      const raw = b.load * frac;
      expect(Math.abs(b.ramp[i]!.load - raw)).toBeLessThanOrEqual(1.25);
    }
  });
});

describe('B weeks: the other items (A.46)', () => {
  for (const v of A.items) {
    it(v.name, () => {
      const it = itemOf(session(patched(), v.date, v.day), v.slot);
      const t = it.template;
      expect(t.reps ?? null).toBe(v.expect.reps);
      expect(t.variant ?? null).toBe(v.expect.variant);
      if (v.expect.note_prefix === null) expect(t.note).toBeUndefined();
      else expect(t.note?.startsWith(v.expect.note_prefix)).toBe(true);
      expect(t.alternate === true).toBe(v.expect.alternate);
    });
  }

  it('the pull-up B week changes only the grip: same slot, same load rule', () => {
    const a = itemOf(session(patched(), '2026-12-08', 1), 'pull_up');
    const b = itemOf(session(patched(), '2026-12-01', 1), 'pull_up');
    expect(b.prescription).toEqual(a.prescription);
  });

  it('the row offers the split-stance one-arm cable row as a swap', () => {
    expect(cfg.slots.cs_row!.swaps).toEqual(['Split-stance one-arm cable row']);
  });
});

describe('B weeks: the last set is read as on any other day (A.43 unchanged)', () => {
  for (const v of A.update as LogSequenceVector[]) {
    it(v.name, () => {
      let state = patched(v.state_patch);
      let outcome: ReturnType<typeof update>['outcome'] = null;
      for (const l of v.logs) {
        const r = update(state, l as AnyLog, cfg);
        state = r.state;
        outcome = r.outcome;
      }
      expect(state.lifts[v.expect.lift].tm).toBeCloseTo(v.expect.tm!, -Math.log10(tol));
      const o = outcome as { rule: string; single_scheduled: boolean };
      if (v.expect.rule !== undefined) expect(o.rule).toBe(v.expect.rule);
      if (v.expect.single_scheduled !== undefined) expect(o.single_scheduled).toBe(v.expect.single_scheduled);
    });
  }
});

describe('config v1.12 changes nothing else (rationale v3.9)', () => {
  it('only the B-week fields, the row swap and the triples line differ from config v1.11', () => {
    const old = parseProgrammeConfig(v111 as unknown) as unknown as Record<string, any>;
    const now = structuredClone(cfg) as unknown as Record<string, any>;
    for (const day of ['day1', 'day2']) for (const b of now.templates.M2[day].blocks) for (const it of b.items) if (typeof it !== 'string') delete it.alternate;
    delete now.slots.cs_row.swaps;
    delete now.text.triples;
    for (const c of [old, now]) {
      delete c.version;
      delete c.date;
      delete c.governs;
      delete c.text.note;
    }
    expect(now).toEqual(old);
  });

  it('B weeks are weeks 12 and 14 only, inside Block 2, and on the five agreed items', () => {
    const found: string[] = [];
    for (const [name, t] of Object.entries(cfg.templates)) {
      const days = [t.day1, t.day2, t.both_days].filter(Boolean);
      for (const d of days) for (const b of d!.blocks) for (const it of b.items) if (typeof it !== 'string' && it.alternate) found.push(`${name}:${it.slot}:${it.alternate.weeks.join(',')}`);
    }
    expect(found.sort()).toEqual(['M2:cs_row:12,14', 'M2:deadlift:12,14', 'M2:front_squat:12,14', 'M2:oh_carry:12,14', 'M2:pull_up:12,14']);
    const m2 = cfg.mesocycles.find((m) => m.id === 'M2')!;
    expect(m2.weeks).toEqual([9, 14]);
  });

  it('the split squat, abduction, Romanian deadlift, push press and every jump and explosive item are untouched on B weeks', () => {
    const d1 = session(patched(), '2026-12-01', 1);
    const d1a = session(patched(), '2026-12-08', 1);
    for (const slot of ['depth_jump', 'skater_bound', 'trap_bar_jump', 'db_rdl', 'db_pp_strength']) expect(itemOf(d1, slot)).toEqual(itemOf(d1a, slot));
    const d2 = session(patched(), '2026-12-03', 2);
    const d2a = session(patched(), '2026-12-10', 2);
    for (const slot of ['jump_shrug', 'landmine_cpp', 'bss', 'seated_abduction']) expect(itemOf(d2, slot)).toEqual(itemOf(d2a, slot));
  });
});
