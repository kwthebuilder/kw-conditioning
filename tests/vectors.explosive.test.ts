/**
 * engine_spec_v1_6.md A.24 (explosive carry-load slots) and A.25 (round
 * ranges), driven from the explosive and rounds blocks of
 * engine_test_vectors_v1_3.json.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { parseState } from '../src/config/validate';
import { prescribe, prescribeExplosive, update } from '../src/engine';
import type { SessionSlotItem } from '../src/engine';

const cfg = PROGRAMME_CONFIG;

describe('explosive vectors (A.24)', () => {
  for (const v of TEST_VECTORS.explosive) {
    it(v.name, () => {
      let state = structuredClone(INITIAL_STATE);
      for (const s of v.sessions) {
        state = update(state, { kind: 'explosive', slot: v.slot, date: v.date, load: s.load, sets_done: 3, cut: s.cut }, cfg).state;
      }
      expect(state.explosive?.[v.slot]).toEqual({ load: v.expect_load, clean_streak: v.expect_streak });
      expect(prescribeExplosive(state, cfg, v.slot).load).toBe(v.expect_load);
    });
  }

  it('no load is prescribed before the first log, and the input state is untouched', () => {
    const p = prescribeExplosive(INITIAL_STATE, cfg, 'jump_shrug');
    expect(p.load).toBeNull();
    const before = structuredClone(INITIAL_STATE);
    update(INITIAL_STATE, { kind: 'explosive', slot: 'jump_shrug', date: '2026-11-12', load: 60, sets_done: 3, cut: false }, cfg);
    expect(INITIAL_STATE).toEqual(before);
  });

  it('the 70% of deadlift TM start is gone from the config', () => {
    expect(cfg.slots.jump_shrug?.start_pct_dl_tm).toBeUndefined();
    for (const id of ['jump_shrug', 'landmine_cpp', 'db_pp_explosive']) expect(cfg.slots[id]?.load_rule).toBe('carry');
    expect(cfg.slots.db_pp_explosive?.increment_kg).toBeUndefined();
  });

  it('a load change is recorded as an override and the state round-trips through the parser', () => {
    let state = structuredClone(INITIAL_STATE);
    for (const load of [60, 65]) state = update(state, { kind: 'explosive', slot: 'jump_shrug', date: '2026-11-12', load, sets_done: 3, cut: false }, cfg).state;
    expect(state.overrides?.at(-1)).toMatchObject({ kind: 'load', slot: 'jump_shrug', from: 60, to: 65 });
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('a state from before v1.6 (no explosive field) still parses', () => {
    const old = structuredClone(INITIAL_STATE) as unknown as Record<string, unknown>;
    delete old.explosive;
    expect(() => parseState(old)).not.toThrow();
  });

  it('M2 and M3/M4 sessions give the three slots an explosive prescription', () => {
    for (const [date, day] of [['2026-11-12', 2], ['2026-12-24', 1], ['2026-12-24', 2]] as const) {
      const s = prescribe(INITIAL_STATE, cfg, date, day);
      if (s.kind !== 'session') throw new Error(s.reason);
      const items = s.blocks.flatMap((b) => b.items).filter((i): i is SessionSlotItem => i.kind === 'slot');
      for (const i of items) {
        if (['jump_shrug', 'landmine_cpp', 'db_pp_explosive'].includes(i.slot)) {
          expect(i.log_kind).toBe('explosive');
          expect(i.prescription.kind).toBe('explosive');
        }
      }
    }
  });
});

describe('rounds vectors (A.25)', () => {
  for (const v of TEST_VECTORS.rounds) {
    it(`${v.date} Day ${v.day} ${v.slot}: ${v.expect_sets}${v.expect_sets_max !== null ? `–${v.expect_sets_max}` : ''} sets`, () => {
      const s = prescribe(INITIAL_STATE, cfg, v.date, v.day);
      if (s.kind !== 'session') throw new Error(s.reason);
      const item = s.blocks.flatMap((b) => b.items).find((i): i is SessionSlotItem => i.kind === 'slot' && i.slot === v.slot);
      if (!item) throw new Error(`${v.slot} not in session`);
      expect(item.template.sets).toBe(v.expect_sets);
      expect(item.template.sets_max ?? null).toBe(v.expect_sets_max);
      if (item.prescription.kind === 'lift') {
        expect(item.prescription.sets).toBe(v.expect_sets);
        expect(item.prescription.sets_max ?? null).toBe(v.expect_sets_max);
      }
    });
  }
});
