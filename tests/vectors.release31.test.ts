/**
 * engine_test_vectors_v1_7.json blocks added for programme config v1.7
 * (engine_spec_v1_10.md A.40 to A.42): the target reached with 4 or more
 * reps in reserve counts towards a step up from 7 Nov 2026 (older logs
 * replay unchanged), the jump test on taper Day 1 only, and the athlete's
 * own session length as a record-only entry.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg, TEST_VECTORS as V } from '../src/config/load';
import type { State } from '../src/config/types';
import { describeLog, prescribe, update } from '../src/engine';
import type { AnyLog, SlotLog } from '../src/engine';

function seeded(slot: string, load: number): State {
  const s = structuredClone(INITIAL_STATE);
  s.accessories[slot] = { load, streak_up: 0, streak_down: 0 };
  return s;
}

describe('config v1.7', () => {
  it('carries the reserve step rule from 7 Nov 2026 at 4 or more in reserve', () => {
    expect(cfg.version).toBe('1.7');
    expect(cfg.rir_step).toMatchObject({ min_rir: 4, from: '2026-11-07' });
  });
  it('loads the jump shrug by speed, not by a percentage of the deadlift', () => {
    const cue = cfg.slots.jump_shrug!.cue!;
    expect(cue).not.toMatch(/70%/);
    expect(cue).toMatch(/fast/);
  });
  it('gives the seated abduction an approved swap', () => {
    expect(cfg.slots.seated_abduction!.swaps).toEqual(['Standing cable hip abduction, 3 s lowering']);
  });
});

describe('A.40: the target reached with 4 or more in reserve counts towards a step up', () => {
  for (const c of V.rir_step ?? []) {
    it(c.name, () => {
      let s = seeded(c.slot, c.seed_load);
      for (const l of c.logs) {
        const log: SlotLog = { slot: c.slot, date: l.date, load: c.seed_load, sets_done: 3, last_set: { reps: l.reps, rir: l.rir } };
        if (l.target_reps !== undefined) log.target_reps = l.target_reps;
        s = update(s, { kind: 'slot', ...log } as AnyLog, cfg).state;
      }
      const a = s.accessories[c.slot]!;
      expect(a.load).toBe(c.expect.load);
      if (c.expect.streak_up !== undefined) expect(a.streak_up).toBe(c.expect.streak_up);
      if (c.expect.pending !== undefined) expect(a.pending).toBe(c.expect.pending);
    });
  }
  it('the block exists and is non-empty', () => expect((V.rir_step ?? []).length).toBeGreaterThan(5));
  it('the explanation names the reserve when it is the reason', () => {
    const r = update(seeded('bss', 16), { kind: 'slot', slot: 'bss', date: '2026-11-12', load: 16, sets_done: 3, last_set: { reps: 8, rir: 4 } }, cfg);
    expect(r.explanation.steps.map((x) => x.text).join(' ')).toMatch(/with 4 in reserve \(4 or more counts\): 1 of 2 towards a step up/);
  });
  it('the prescription says so', () => {
    const s = prescribe(seeded('bss', 16), cfg, '2026-11-12', 2);
    if (s.kind !== 'session') throw new Error('refer');
    const bss = s.blocks.flatMap((b) => b.items).find((i) => i.kind === 'slot' && i.slot === 'bss');
    expect(bss && bss.kind === 'slot' && 'notes' in bss.prescription ? bss.prescription.notes.join(' ') : '').toMatch(/Stopping at 8 with 4 or more reps in reserve also counts towards a step up/);
  });
});

describe('A.41: the jump test on taper Day 1 only', () => {
  for (const c of V.taper_pre ?? []) {
    it(c.name, () => {
      const s = prescribe(INITIAL_STATE, cfg, c.date, c.day);
      if (s.kind !== 'session') throw new Error('refer');
      expect(s.pre).toEqual(c.pre);
    });
  }
});

describe('A.42: session length, the athlete\'s own figure, record only', () => {
  it('logs, moves nothing and reads in plain words', () => {
    const before = structuredClone(INITIAL_STATE);
    const r = update(before, { kind: 'session_length', date: '2026-11-09', day: 1, minutes: 74 }, cfg);
    expect({ ...r.state, log: [] }).toEqual({ ...before, log: [] });
    expect(r.state.log).toHaveLength(1);
    expect(describeLog({ kind: 'session_length', date: '2026-11-09', day: 1, minutes: 74 }, cfg)).toBe('Day 1 session length 74 min (your figure)');
  });
  it('refuses a length that is not whole minutes from 1 to 600', () => {
    for (const m of [0, -5, 72.5, 601]) expect(() => update(structuredClone(INITIAL_STATE), { kind: 'session_length', date: '2026-11-09', day: 1, minutes: m }, cfg)).toThrow();
  });
});
