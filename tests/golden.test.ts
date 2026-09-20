/**
 * Golden sessions: week 2 Day 1 (2026-09-21) and Day 2 (2026-09-24) as
 * written in spec/training_log_2026_w01_w02_r4.md, from
 * initial_state_v1_1 and programme_config_v1_2. Every computed load,
 * the slot list and the block order. The expected values below are
 * transcribed from the log, item by item.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG, TEST_VECTORS } from '../src/config/load';
import { prescribe, update } from '../src/engine';
import type { Session, SessionSlotItem } from '../src/engine';

const cfg = PROGRAMME_CONFIG;
const DAY1 = '2026-09-21';
const DAY2 = '2026-09-24';

function session(date: string, day?: 1 | 2): Session {
  const s = prescribe(INITIAL_STATE, cfg, date, day);
  if (s.kind !== 'session') throw new Error(`refer: ${s.reason}`);
  return s;
}

function slotItem(s: Session, slot: string): SessionSlotItem {
  for (const b of s.blocks) for (const it of b.items) if (it.kind === 'slot' && it.slot === slot) return it;
  throw new Error(`${slot} not in session`);
}

/** Block-by-block slot ids; warm-ups shown by name. */
function layout(s: Session): string[][] {
  return s.blocks.map((b) => b.items.map((it) => (it.kind === 'slot' ? it.slot : it.name)));
}

describe(`golden sessions: ${TEST_VECTORS.golden_sessions}`, () => {
  it('vectors name the files the loader reads', () => {
    expect(TEST_VECTORS.golden_sessions).toContain('training_log_2026_w01_w02_r4.md');
    expect(TEST_VECTORS.golden_sessions).toContain('initial_state_v1_1.json');
    expect(TEST_VECTORS.golden_sessions).toContain('programme_config_v1_2.json');
  });

  describe('Day 1, Mon 21 Sep, target 72 min', () => {
    const s = session(DAY1);

    it('is week 2 of M1, Day 1 by default, CMJ before warm-up, ladder day', () => {
      expect(s).toMatchObject({ mesocycle: 'M1', programme_week: 2, day: 1, template: 'M1', target_min: 72, pre: ['cmj'], ladder_day: true });
      expect(s.singles_suggested).toEqual([]);
    });

    it('block order and slot list match the log items 2 to 8', () => {
      expect(layout(s)).toEqual([
        ['warmup_glute_shoulder'], // 2. warm-up 10 min
        ['rsi_ladder'], // 3. RSI ladder replaces the depth-jump set
        ['trap_bar_jump'], // 4.
        ['front_squat'], // 5.
        ['db_pp_strength', 'pull_up'], // 6. alternated
        ['rdl'], // 7.
        ['nordic', 'abd_iso', 'y_raise'], // 8.
      ]);
      expect(s.blocks[0]?.min).toBe(10);
      expect(s.blocks[4]?.superset).toBe(true);
      expect(s.blocks[6]?.superset).toBe(true);
    });

    it('3. RSI ladder: 12 contacts, fixed text, depth jump absent', () => {
      const p = slotItem(s, 'rsi_ladder').prescription;
      expect(p).toMatchObject({ kind: 'fixed', cls: 'E', contacts: 12 });
      expect(() => slotItem(s, 'depth_jump')).toThrow();
    });

    it('4. trap-bar jump 2 × 3 at the empty bar, 24 kg', () => {
      const it = slotItem(s, 'trap_bar_jump');
      expect(it.prescription).toMatchObject({ kind: 'fixed', load_kg: 24 });
      expect(it.template).toEqual({ sets: 2, reps: 3 });
    });

    it('5. front squat: ramp 37.5 × 5, 55 × 3, 65 × 1; 3 × 3 at 77.5 kg, rep-out capped RIR 2, par 7', () => {
      const p = slotItem(s, 'front_squat').prescription;
      expect(p).toMatchObject({
        kind: 'lift',
        mode: 'wave',
        position: 2,
        load: 77.5,
        sets: 3,
        reps: 3,
        amrap: true,
        par: 7,
        ramp: [
          { load: 37.5, reps: 5 },
          { load: 55, reps: 3 },
          { load: 65, reps: 1 },
        ],
      });
      expect(p).not.toHaveProperty('single_suggested');
    });

    it('6. DB push press 3 × 6 + weighted pull-up 3 × 5, last set to RIR 2, no load on record', () => {
      const pp = slotItem(s, 'db_pp_strength');
      const pu = slotItem(s, 'pull_up');
      expect(pp.prescription).toMatchObject({ kind: 'slot', load: null, reps: 6, rir_cap: 2 });
      expect(pp.template).toEqual({ sets: 3 });
      expect(pu.prescription).toMatchObject({ kind: 'slot', load: null, reps: 5, rir_cap: 2 });
      expect(pu.template).toEqual({ sets: 3 });
    });

    it('7. RDL 3 × 6-8 at 100 kg, last set to RIR 2 or tempo break', () => {
      const it = slotItem(s, 'rdl');
      expect(it.prescription).toMatchObject({ kind: 'rdl', load: 100, rep_range: [6, 8], rir_cap: 2, amrap: true, session_number: 1 });
      expect(it.template).toEqual({ sets: 3 });
    });

    it('8. Nordic 2 × 3, hip abduction iso 2 × 30 s/side, Y-raise 2 × 10', () => {
      expect(slotItem(s, 'nordic').template).toEqual({ sets: 2, reps: 3 });
      expect(slotItem(s, 'abd_iso').template).toEqual({ sets: 2, secs: 30, per_side: true });
      expect(slotItem(s, 'y_raise').template).toEqual({ sets: 2, reps: 10 });
      for (const id of ['nordic', 'abd_iso', 'y_raise']) expect(slotItem(s, id).prescription.kind).toBe('fixed');
    });
  });

  describe('Day 2, Thu 24 Sep, target 70 min', () => {
    const s = session(DAY2, 2);

    it('is week 2 of M1, Day 2, no CMJ, not a ladder day', () => {
      expect(s).toMatchObject({ mesocycle: 'M1', programme_week: 2, day: 2, target_min: 70, pre: [], ladder_day: false });
      expect(s.singles_suggested).toEqual([]);
    });

    it('block order and slot list match the log items 1 to 6', () => {
      expect(layout(s)).toEqual([
        ['warmup'], // 1.
        ['kb_swing'], // 2.
        ['deadlift'], // 3.
        ['landmine_press', 'cs_row'], // 4. alternated
        ['abductor_hsr', 'bss'], // 5. alternated
        ['hack_squat', 'pallof'], // 6.
      ]);
    });

    it('2. KB swing 2 × 6, heavy', () => {
      const it = slotItem(s, 'kb_swing');
      expect(it.prescription.kind).toBe('fixed');
      expect(it.template).toEqual({ sets: 2, reps: 6 });
    });

    it('3. deadlift: ramp 60 × 5, 85 × 3, 105 × 1; 3 × 3 at 122.5 kg, rep-out capped RIR 2, par 7', () => {
      expect(slotItem(s, 'deadlift').prescription).toMatchObject({
        kind: 'lift',
        mode: 'wave',
        position: 2,
        load: 122.5,
        sets: 3,
        reps: 3,
        amrap: true,
        par: 7,
        ramp: [
          { load: 60, reps: 5 },
          { load: 85, reps: 3 },
          { load: 105, reps: 1 },
        ],
      });
    });

    it('4. landmine press 3 × 6/side + chest-supported row 3 × 10, last sets to RIR 2', () => {
      expect(slotItem(s, 'landmine_press').prescription).toMatchObject({ kind: 'slot', load: null, reps: 6, rir_cap: 2 });
      expect(slotItem(s, 'landmine_press').template).toEqual({ sets: 3, per_side: true });
      expect(slotItem(s, 'cs_row').prescription).toMatchObject({ kind: 'slot', load: null, reps: 10, rir_cap: 2 });
    });

    it('5. abductor heavy-slow 3 × 8 + Bulgarian split squat 3 × 8/side, last set RIR 3', () => {
      expect(slotItem(s, 'abductor_hsr').prescription).toMatchObject({ kind: 'slot', cls: 'B', load: null, reps: 8, rir_cap: 2 });
      expect(slotItem(s, 'abductor_hsr').template).toEqual({ sets: 3 });
      expect(slotItem(s, 'bss').prescription).toMatchObject({ kind: 'slot', cls: 'C', load: null, reps: 8, rir_cap: 3 });
      expect(slotItem(s, 'bss').template).toEqual({ sets: 3, per_side: true });
    });

    it('6. hack squat 2 × 8 at RIR 2 + Pallof 2 × 10/side', () => {
      expect(slotItem(s, 'hack_squat').prescription).toMatchObject({ kind: 'slot', cls: 'B', load: null, reps: 8, rir_cap: 2 });
      expect(slotItem(s, 'hack_squat').template).toEqual({ sets: 2 });
      expect(slotItem(s, 'pallof').template).toEqual({ sets: 2, reps: 10, per_side: true });
    });
  });

  it('after Day 1 is logged, Day 2 is the default on 24 Sep (A.22)', () => {
    const fs = slotItem(session(DAY1), 'front_squat').prescription;
    if (fs.kind !== 'lift') throw new Error();
    const r = update(
      INITIAL_STATE,
      { kind: 'barbell', lift: 'front_squat', date: DAY1, mode: 'wave', position: 2, prescribed: { load: fs.load, reps: fs.reps, sets: fs.sets }, last_set: { load: fs.load, reps: 9, rir: 2 }, missed: false },
      cfg,
    );
    const d2 = prescribe(r.state, cfg, DAY2);
    expect(d2.kind === 'session' && d2.day).toBe(2);
  });
});
