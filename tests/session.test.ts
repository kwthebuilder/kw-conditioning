import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import type { State } from '../src/config/types';
import { defaultDay, prescribe } from '../src/engine';
import type { Session } from '../src/engine';
import { stateWith } from './helpers';

const cfg = PROGRAMME_CONFIG;
const v = TEST_VECTORS.session;
const meso = (id: string) => cfg.mesocycles.find((m) => m.id === id)!;

function session(state: State, date: string, day?: 1 | 2): Session {
  const s = prescribe(state, cfg, date, day);
  if (s.kind !== 'session') throw new Error(`refer: ${s.reason}`);
  return s;
}
const slots = (s: Session): string[] => s.blocks.flatMap((b) => b.items.map((it) => (it.kind === 'slot' ? it.slot : `warmup:${it.name}`)));
const item = (s: Session, slot: string) => s.blocks.flatMap((b) => b.items).find((it) => it.kind === 'slot' && it.slot === slot);

describe('session vectors: ladder days (A.21)', () => {
  for (const c of v.ladder) {
    it(`${c.date} day ${c.day}: ${c.expect}`, () => {
      const s = session(INITIAL_STATE, c.date, c.day);
      const ids = slots(s);
      const hasLadder = ids.includes(cfg.ladder!.slot);
      if (/rsi_ladder present|holds rsi_ladder/.test(c.expect)) {
        expect(hasLadder).toBe(true);
        expect(s.ladder_day).toBe(true);
        for (const r of cfg.ladder!.replaces) expect(ids, `${r} absent`).not.toContain(r);
        const p = item(s, 'rsi_ladder')!;
        expect(p.kind === 'slot' && p.prescription.kind === 'fixed' && p.prescription.contacts).toBe(12);
      } else {
        expect(hasLadder).toBe(false);
        expect(s.ladder_day).toBe(false);
      }
      if (/depth_jump, 6 contacts/.test(c.expect)) {
        const p = item(s, 'depth_jump')!;
        expect(p.kind === 'slot' && p.prescription.kind === 'fixed' && p.prescription.contacts).toBe(6);
      }
      if (/no reactive item/.test(c.expect)) {
        for (const id of ['depth_jump', 'depth_landing', 'rsi_ladder', 'skater_bound']) expect(ids).not.toContain(id);
      }
      if (/skater_bound unchanged/.test(c.expect)) expect(ids).toContain('skater_bound');
      if (/week (\d+)/.test(c.expect)) expect(s.programme_week).toBe(Number(/week (\d+)/.exec(c.expect)![1]));
    });
  }

  it('the ladder replaces the first named slot in template order and drops the rest (M2 has both)', () => {
    const m2week = cfg.ladder!.weeks.find((w) => w >= meso('M2').weeks[0])!;
    const d = new Date(cfg.mesocycles[0]!.start + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + (m2week - 1) * 7);
    const s = session(INITIAL_STATE, d.toISOString().slice(0, 10), cfg.ladder!.day);
    const reactive = s.blocks[1]!;
    expect(reactive.items.map((it) => (it.kind === 'slot' ? it.slot : it.name))).toEqual(['rsi_ladder']);
  });
});

describe('session vectors: default day (A.22)', () => {
  for (const c of v.day_default) {
    it(`${c.state}${c.explicit_day ? `, explicit ${c.explicit_day}` : ''} → day ${c.expect_day}`, () => {
      let state: State;
      if (c.state.startsWith('initial_state')) {
        state = INITIAL_STATE;
        expect(state.lifts.front_squat.last_logged).toBe('2026-09-14');
        expect(state.lifts.deadlift.last_logged).toBe('2026-09-17');
      } else if (c.state.startsWith('front_squat last_logged later')) {
        state = structuredClone(INITIAL_STATE);
        state.lifts.front_squat.last_logged = '2026-09-21';
      } else if (c.state.startsWith('both last_logged null')) {
        state = structuredClone(INITIAL_STATE);
        delete state.lifts.front_squat.last_logged;
        delete state.lifts.deadlift.last_logged;
      } else if (c.state === 'any') {
        state = structuredClone(INITIAL_STATE);
        state.lifts.deadlift.last_logged = '2026-09-30'; // would default to 1
      } else {
        throw new Error(`no fixture for vector state "${c.state}"`);
      }
      if (c.explicit_day === undefined) expect(defaultDay(state)).toBe(c.expect_day);
      // Sunday and Wednesday: the weekday is never consulted.
      for (const date of ['2026-09-20', '2026-09-23']) {
        expect(session(state, date, c.explicit_day).day).toBe(c.expect_day);
      }
    });
  }
});

describe('template walk', () => {
  it('TAPER both_days: items tagged by day, template contacts override', () => {
    const t = meso('TAPER');
    const s1 = session(INITIAL_STATE, t.start, 1);
    const s2 = session(INITIAL_STATE, t.start, 2);
    expect(slots(s1)).toEqual(['warmup:warmup', 'depth_jump', 'trap_bar_jump', 'front_squat', 'pull_up', 'abd_iso', 'nordic', 'y_raise']);
    expect(slots(s2)).toEqual(['warmup:warmup', 'depth_jump', 'jump_shrug', 'deadlift', 'cs_row', 'abd_iso', 'nordic', 'y_raise']);
    const dj = item(s1, 'depth_jump')!;
    expect(dj.kind === 'slot' && dj.prescription.kind === 'fixed' && dj.prescription.contacts).toBe(6);
    const fs = item(s1, 'front_squat')!;
    expect(fs.kind === 'slot' && fs.prescription).toMatchObject({ kind: 'lift', mode: 'single_1x2_90', sets: 1, reps: 2 });
    expect(s1.target_min).toBe(45);
  });

  it('until_week items disappear after their week (M34 RDL until week 22)', () => {
    const first = new Date(cfg.mesocycles[0]!.start + 'T00:00:00Z');
    const dateOfWeek = (w: number) => {
      const d = new Date(first);
      d.setUTCDate(d.getUTCDate() + (w - 1) * 7);
      return d.toISOString().slice(0, 10);
    };
    expect(slots(session(INITIAL_STATE, dateOfWeek(22), 1))).toContain('rdl');
    expect(slots(session(INITIAL_STATE, dateOfWeek(23), 1))).not.toContain('rdl');
    expect(session(INITIAL_STATE, dateOfWeek(23), 1).notes.join(' ')).toMatch(/no upward steps/);
  });

  it('INTENSIVE and dates outside the programme refer to project', () => {
    expect(prescribe(INITIAL_STATE, cfg, meso('INTENSIVE').start).kind).toBe('refer');
    expect(prescribe(INITIAL_STATE, cfg, '2026-01-01').kind).toBe('refer');
  });

  it('M2 contrast block carries rounds and the band mode', () => {
    const s = session(INITIAL_STATE, '2026-11-12', 1); // week 9, not the ladder day when day 2... use day 1 after ladder week check
    const contrast = s.blocks.find((b) => b.contrast)!;
    expect(contrast.rounds).toEqual([3, 4]);
    const fs = contrast.items[0]!;
    expect(fs.kind === 'slot' && fs.prescription).toMatchObject({ kind: 'lift', mode: 'band_87_90', pct: 0.87, reps: 2 });
  });

  it('a big-gap flag surfaces in singles_suggested and the rep-out stays', () => {
    const state = stateWith('front_squat', { tm: 92, next_position: 2 });
    state.lifts.front_squat.single_scheduled = true;
    const s = session(state, '2026-09-21', 1);
    expect(s.singles_suggested).toEqual([{ lift: 'front_squat', reason: 'big_gap' }]);
    const fs = item(s, 'front_squat')!;
    expect(fs.kind === 'slot' && fs.prescription).toMatchObject({ kind: 'lift', amrap: true, par: 7 });
  });

  it('never mutates the input state', () => {
    const before = JSON.stringify(INITIAL_STATE);
    session(INITIAL_STATE, '2026-09-21');
    session(INITIAL_STATE, '2026-09-24', 2);
    expect(JSON.stringify(INITIAL_STATE)).toBe(before);
  });
});
