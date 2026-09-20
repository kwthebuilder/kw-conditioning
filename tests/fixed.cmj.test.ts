import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../src/config/load';
import type { MesocycleId } from '../src/config/types';
import { cmjSummary, contactsFor, prescribeFixed, recordCmj } from '../src/engine';

const cfg = PROGRAMME_CONFIG;
const start = (id: MesocycleId) => cfg.mesocycles.find((m) => m.id === id)!.start;

describe('fixed prescriptions for classes D, E, F (no logic)', () => {
  it('trap-bar jump runs at the bar from config.equipment', () => {
    const p = prescribeFixed(INITIAL_STATE, cfg, 'trap_bar_jump', start('M1'));
    expect(p).toMatchObject({ kind: 'fixed', cls: 'D', load_kg: cfg.equipment.trap_bar_kg });
    expect(p.text).toContain(cfg.slots.trap_bar_jump!.name);
  });

  it('depth-jump contacts follow the config map by mesocycle, week map in M4', () => {
    const map = cfg.slots.depth_jump!.contacts as Record<string, unknown>;
    expect(contactsFor(cfg, 'depth_jump', start('M1'))).toBe(map.M1);
    expect(contactsFor(cfg, 'depth_jump', start('M2'))).toBe(map.M2);
    expect(contactsFor(cfg, 'depth_jump', start('M2'))).toBe(6);
    expect(contactsFor(cfg, 'depth_jump', start('M3'))).toBe(map.M3);
    const m4 = map.M4 as Record<string, number>;
    for (const [span, value] of Object.entries(m4)) {
      const [lo, hi] = span.split('-').map(Number) as [number, number];
      for (const week of [lo, hi]) {
        const d = new Date(cfg.mesocycles[0]!.start + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + (week - 1) * 7);
        expect(contactsFor(cfg, 'depth_jump', d.toISOString().slice(0, 10)), `week ${week}`).toBe(value);
      }
    }
    expect(contactsFor(cfg, 'depth_jump', start('TAPER'))).toBe(map.TAPER);
    expect(prescribeFixed(INITIAL_STATE, cfg, 'depth_jump', start('M1')).contacts).toBe(map.M1);
  });

  it('a numeric contacts field and slots without contacts', () => {
    expect(contactsFor(cfg, 'rsi_ladder', start('M1'))).toBe(cfg.slots.rsi_ladder!.contacts);
    expect(contactsFor(cfg, 'kb_swing', start('M1'))).toBeUndefined();
    expect(prescribeFixed(INITIAL_STATE, cfg, 'nordic', start('M1'))).toMatchObject({ cls: 'F' });
    expect(prescribeFixed(INITIAL_STATE, cfg, 'nordic', start('M1')).notes.join(' ')).toContain('Never cut to zero');
  });

  it('refuses classes A, B and C', () => {
    for (const id of ['front_squat', 'rdl', 'pull_up']) {
      expect(() => prescribeFixed(INITIAL_STATE, cfg, id, start('M1'))).toThrow();
    }
  });
});

describe('CMJ: stored, running mean shown, no flag', () => {
  it('appends values and reports count, last and mean', () => {
    expect(cmjSummary(INITIAL_STATE)).toEqual({ count: 0, last: null, mean: null });
    const a = recordCmj(INITIAL_STATE, 38.2);
    const b = recordCmj(a.state, 37.6);
    expect(b.summary).toEqual({ count: 2, last: 37.6, mean: (38.2 + 37.6) / 2 });
    expect(b.state.cmj.series).toEqual([38.2, 37.6]);
    expect(b.state.cmj).not.toHaveProperty('baseline');
    expect(INITIAL_STATE.cmj.series).toEqual([]);
  });

  it('rejects non-positive values', () => {
    expect(() => recordCmj(INITIAL_STATE, 0)).toThrow();
    expect(() => recordCmj(INITIAL_STATE, Number.NaN)).toThrow();
  });
});
