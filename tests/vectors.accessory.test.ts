import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import type { SlotId, State } from '../src/config/types';
import { incrementText, parseIncrement, prescribeAccessory, prescribeTempo, updateAccessory, updateTempo } from '../src/engine';
import type { SlotLog, SlotUpdateResult } from '../src/engine';
import { M1_DATE } from './helpers';

const cfg = PROGRAMME_CONFIG;

/**
 * Pending SPEC_QUESTIONS.md Q1: the vectors name three accessory slots
 * differently from the config. The engine uses config ids only; this map
 * binds the vectors until vectors v1.1 lands. Ruled to stay for phase 2.
 */
const VECTOR_SLOT_ALIAS: Record<string, SlotId> = {
  db_push_press_strength: 'db_pp_strength',
  weighted_pull_up: 'pull_up',
  bulgarian_split_squat: 'bss',
};

const SEED_LOAD = 30;

function seeded(slot: SlotId, load = SEED_LOAD): State {
  const s = structuredClone(INITIAL_STATE);
  s.accessories[slot] = { load, streak_up: 0, streak_down: 0 };
  return s;
}

function run(state: State, slot: SlotId, reps: number, opts: { site_flagged?: boolean } = {}): SlotUpdateResult {
  const cls = cfg.slots[slot]!.cls;
  const log: SlotLog = {
    slot,
    date: M1_DATE,
    load: state.accessories[slot]!.load ?? SEED_LOAD,
    sets_done: 3,
    last_set: { reps, rir: cfg.slots[slot]!.rir_cap ?? 2 },
  };
  return cls === 'B' ? updateTempo(state, cfg, log, opts) : updateAccessory(state, cfg, log, opts);
}

/** "+2 kg/hand" → up 2 per hand; "-2 kg/hand (…)" → down; "hold (…)" → hold. */
function parseExpect(text: string): { direction: 'up' | 'down' | 'hold'; kg?: number; perHand?: boolean } {
  if (/^hold/.test(text)) return { direction: 'hold' };
  const m = /^([+-])(\d+(?:\.\d+)?) kg(\/hand)?/.exec(text);
  if (!m) throw new Error(`cannot read expect "${text}"`);
  return { direction: m[1] === '+' ? 'up' : 'down', kg: Number(m[2]), perHand: m[3] !== undefined };
}

describe('accessory vectors (§3 streak slots, §4 double progression)', () => {
  for (const v of TEST_VECTORS.accessory) {
    const slot = VECTOR_SLOT_ALIAS[v.slot] ?? v.slot;
    it(`${v.slot} ${JSON.stringify(v.history_last_set_reps)}${v.site_flag_last_48h ? ' + site flag' : ''} → ${v.expect}`, () => {
      expect(cfg.slots[slot], `config has ${slot}`).toBeDefined();
      const want = parseExpect(v.expect);
      let state = seeded(slot);
      let last: SlotUpdateResult | undefined;
      v.history_last_set_reps.forEach((reps, i) => {
        const isLast = i === v.history_last_set_reps.length - 1;
        last = run(state, slot, reps, isLast && v.site_flag_last_48h ? { site_flagged: true } : {});
        state = last.state;
      });
      const out = last!.outcome;
      expect(out.direction).toBe(want.direction);
      if (want.direction === 'hold') {
        expect(out.load_after).toBe(SEED_LOAD);
        if (v.site_flag_last_48h) expect(out.withheld).toBe('site_flag');
      } else {
        const inc = parseIncrement(cfg.slots[slot]!);
        expect(inc.kind).toBe('kg');
        if (inc.kind !== 'kg') return;
        expect(inc.kg).toBe(want.kg);
        expect(inc.per_hand).toBe(want.perHand);
        expect(out.delta_kg).toBe(want.direction === 'up' ? want.kg : -want.kg!);
        expect(out.load_after).toBe(SEED_LOAD + out.delta_kg!);
        expect(out.streak_up).toBe(0);
        expect(out.streak_down).toBe(0);
      }
      expect(last!.explanation.steps.length).toBeGreaterThan(0);
    });
  }
});

describe('increments', () => {
  it('reads kg and kg/hand from the config text, hack squat is 5 kg by ruling, cable slots are text', () => {
    expect(parseIncrement(cfg.slots.pull_up!)).toEqual({ kind: 'kg', kg: 2.5, per_hand: false });
    expect(parseIncrement(cfg.slots.db_pp_strength!)).toEqual({ kind: 'kg', kg: 2, per_hand: true });
    expect(parseIncrement(cfg.slots.hack_squat!)).toEqual({ kind: 'kg', kg: 5, per_hand: false });
    expect(parseIncrement(cfg.slots.abductor_hsr!).kind).toBe('text');
    expect(parseIncrement(cfg.slots.cs_row!)).toEqual({ kind: 'text', text: cfg.slots.cs_row!.increment });
    expect(incrementText(parseIncrement(cfg.slots.abductor_hsr!))).toBe('one plate');
  });

  it('a text-increment slot owes "go up one plate" until a heavier load is logged', () => {
    const slot = 'abductor_hsr';
    let s = seeded(slot, 20);
    const upAt = cfg.slots[slot]!.up_at!;
    s = run(s, slot, upAt).state;
    const r = run(s, slot, upAt);
    expect(r.outcome).toMatchObject({ direction: 'up', pending: 'up', load_after: 20 });
    expect(r.outcome.delta_kg).toBeUndefined();
    const p = prescribeTempo(r.state, cfg, slot);
    expect(p.pending).toBe('up');
    expect(p.load).toBe(20);
    expect(p.notes.join(' ')).toContain('Go up one plate');
    // Heavier load logged: pending cleared, streaks reset, new load recorded.
    const heavier: SlotLog = { slot, date: M1_DATE, load: 25, sets_done: 3, last_set: { reps: 8, rir: 2 } };
    const r2 = updateTempo(r.state, cfg, heavier);
    expect(r2.outcome).toMatchObject({ load_before: 20, load_after: 25, streak_up: 0, streak_down: 0 });
    expect(r2.outcome.pending).toBeUndefined();
    expect(prescribeTempo(r2.state, cfg, slot).pending).toBeUndefined();
  });
});

describe('progression rules', () => {
  it('first logged session sets the load', () => {
    const s = structuredClone(INITIAL_STATE);
    expect(prescribeAccessory(s, cfg, 'pull_up').load).toBeNull();
    const r = updateAccessory(s, cfg, { slot: 'pull_up', date: M1_DATE, load: 10, sets_done: 3, last_set: { reps: 6, rir: 2 } });
    expect(r.outcome).toMatchObject({ direction: 'set', load_before: null, load_after: 10 });
    expect(prescribeAccessory(r.state, cfg, 'pull_up').load).toBe(10);
  });

  it('a load change resets streaks (A.11)', () => {
    const slot = 'pull_up';
    let s = seeded(slot, 10);
    s = run(s, slot, cfg.slots[slot]!.up_at!).state;
    expect(s.accessories[slot]!.streak_up).toBe(1);
    const r = updateAccessory(s, cfg, { slot, date: M1_DATE, load: 12.5, sets_done: 3, last_set: { reps: 5, rir: 2 } });
    expect(r.outcome.streak_up).toBe(0);
    expect(r.outcome.load_after).toBe(12.5);
  });

  it('class C steps down after two sessions below the prescribed reps, class B below down_below', () => {
    const c = 'landmine_press';
    let s = seeded(c);
    s = run(s, c, cfg.slots[c]!.reps! - 1).state;
    expect(run(s, c, cfg.slots[c]!.reps! - 1).outcome).toMatchObject({ direction: 'down', delta_kg: -2.5 });
    const b = 'hack_squat';
    let t = seeded(b, 60);
    t = run(t, b, cfg.slots[b]!.down_below! - 1).state;
    expect(run(t, b, cfg.slots[b]!.down_below! - 1).outcome).toMatchObject({ direction: 'down', delta_kg: -5, load_after: 55 });
    // reps between down_below and up_at hold
    expect(run(seeded(b, 60), b, cfg.slots[b]!.down_below!).outcome.direction).toBe('hold');
  });

  it('withholds upward steps after the freeze week (A.10)', () => {
    const slot = 'pull_up';
    const first = new Date(cfg.mesocycles[0]!.start + 'T00:00:00Z');
    first.setUTCDate(first.getUTCDate() + cfg.freeze.no_upward_steps_after_week * 7);
    const date = first.toISOString().slice(0, 10);
    let s = seeded(slot, 10);
    const log = (st: State): SlotLog => ({ slot, date, load: st.accessories[slot]!.load!, sets_done: 3, last_set: { reps: cfg.slots[slot]!.up_at!, rir: 2 } });
    s = updateAccessory(s, cfg, log(s)).state;
    const r = updateAccessory(s, cfg, log(s));
    expect(r.outcome).toMatchObject({ direction: 'hold', withheld: 'freeze', load_after: 10 });
  });
});
