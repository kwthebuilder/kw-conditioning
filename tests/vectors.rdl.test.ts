import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { prescribeRdl, rdlRow, updateRdl, WIDE_WINDOW_SESSIONS } from '../src/engine';
import type { RdlLog } from '../src/engine';
import { M1_DATE } from './helpers';

const cfg = PROGRAMME_CONFIG;

function rdlLog(load: number, reps: number, date = M1_DATE): RdlLog {
  return { slot: 'rdl', date, load, sets_done: 3, last_set: { reps, rir: 2 } };
}

describe('rdl vectors (§3 table, L10 window)', () => {
  for (const v of TEST_VECTORS.rdl) {
    it(`session ${v.session}, ${v.reps} reps → ${v.expect_delta >= 0 ? '+' : ''}${v.expect_delta} kg`, () => {
      const state = structuredClone(INITIAL_STATE);
      state.rdl.sessions_logged = v.session - 1;
      const before = state.rdl.load_kg;
      const { state: after, outcome, explanation } = updateRdl(state, cfg, rdlLog(before, v.reps));
      expect(outcome.delta_kg).toBe(v.expect_delta);
      expect(outcome.session_number).toBe(v.session);
      expect(after.rdl.load_kg).toBe(before + v.expect_delta);
      expect(after.rdl.sessions_logged).toBe(v.session);
      expect(explanation.steps[0]?.text).toContain(`${(before + v.expect_delta).toFixed(1)} kg`);
      // input untouched
      expect(state.rdl.load_kg).toBe(before);
    });
  }

  it('the +10 row is read from the config table and closes after the window', () => {
    const table = cfg.slots.rdl!.table!;
    const windowRow = table.find((r) => r.length === 3)!;
    expect(rdlRow(table, windowRow[0], WIDE_WINDOW_SESSIONS - 1)).toBe(windowRow);
    expect(rdlRow(table, windowRow[0], WIDE_WINDOW_SESSIONS)).not.toBe(windowRow);
  });

  it('prescription carries the load, rep range, RIR cap, AMRAP and window state', () => {
    const p = prescribeRdl(INITIAL_STATE, cfg);
    expect(p).toMatchObject({
      kind: 'rdl',
      load: INITIAL_STATE.rdl.load_kg,
      rep_range: cfg.slots.rdl!.rep_range,
      rir_cap: cfg.slots.rdl!.rir_cap,
      amrap: true,
      session_number: 1,
      wide_window: true,
    });
    const s = structuredClone(INITIAL_STATE);
    s.rdl.sessions_logged = WIDE_WINDOW_SESSIONS;
    expect(prescribeRdl(s, cfg).wide_window).toBe(false);
  });

  it('steps from the load actually lifted, not the prescribed one', () => {
    const { outcome } = updateRdl(INITIAL_STATE, cfg, rdlLog(95, 10));
    expect(outcome.load_before).toBe(95);
    expect(outcome.load_after).toBe(95 + outcome.delta_kg);
  });

  it('withholds upward steps after the freeze week, still takes downward ones', () => {
    const m4 = cfg.mesocycles.find((m) => m.id === 'M4')!;
    const freezeWeek = cfg.freeze.no_upward_steps_after_week;
    // First day of the week after the freeze week.
    const first = new Date(cfg.mesocycles[0]!.start + 'T00:00:00Z');
    first.setUTCDate(first.getUTCDate() + freezeWeek * 7);
    const date = first.toISOString().slice(0, 10);
    expect(date >= m4.start).toBe(true);
    const up = updateRdl(INITIAL_STATE, cfg, rdlLog(100, 10, date));
    expect(up.outcome).toMatchObject({ delta_kg: 0, withheld: 'freeze' });
    const down = updateRdl(INITIAL_STATE, cfg, rdlLog(100, 4, date));
    expect(down.outcome.delta_kg).toBeLessThan(0);
  });
});
