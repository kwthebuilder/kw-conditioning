/**
 * Release 3.3 (config v1.9, ui_spec_v1_7.md §29 to §31), synthetic data only:
 * the strength push press stays on Blocks 3 and 4 Day 1, the jump test is
 * taken at the end of the warm-up, and the reactive strength wording matches
 * the app's own arithmetic (time in the air divided by time on the floor).
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import { jumpFromFrames, prescribe } from '../src/engine';
import type { Session, SessionSlotItem } from '../src/engine';

const items = (s: Session): SessionSlotItem[] => s.blocks.flatMap((b) => b.items).filter((i): i is SessionSlotItem => i.kind === 'slot');
const day = (date: string, d: 1 | 2): Session => prescribe(INITIAL_STATE, cfg, date, d) as Session;

describe('§29 the strength push press in Blocks 3 and 4', () => {
  it('Block 3 Day 1: 2 sets of 6, alternating with the pull-up, after the Romanian deadlift', () => {
    const s = day('2026-12-28', 1);
    const it = items(s).find((i) => i.slot === 'db_pp_strength')!;
    expect(it.template.sets).toBe(2);
    expect(it.prescription.kind === 'slot' && it.prescription.reps).toBe(6);
    const upper = s.blocks.find((b) => b.upper)!;
    expect(upper.superset).toBe(true);
    expect(upper.items.map((i) => (i.kind === 'slot' ? i.slot : i.name))).toEqual(['db_pp_strength', 'pull_up']);
    expect(s.target_min).toBe(68);
  });
  it('still there in week 23, after the Romanian deadlift has gone', () => {
    const order = items(day('2027-02-15', 1)).map((i) => i.slot);
    expect(order).not.toContain('db_rdl');
    expect(order.slice(-2)).toEqual(['db_pp_strength', 'pull_up']);
  });
  it('not in the taper', () => {
    expect(items(day('2027-03-04', 1)).map((i) => i.slot)).not.toContain('db_pp_strength');
  });
});

describe('§30 the jump test at the end of the warm-up', () => {
  it('the config says when, and the warm-up line hands over to it', () => {
    expect(cfg.text?.cmj_when).toBe('End of the warm-up');
    expect(cfg.text?.warmup).toMatch(/On Day 1 the jump test comes straight after/);
    expect(cfg.text?.cmj).toMatch(/^Straight after the 2 building jumps/);
  });
});

describe('§31 reactive strength is time in the air divided by time on the floor', () => {
  it('the calculator and the phase-test words agree', () => {
    const m = jumpFromFrames({ fps: 240, air: 120, ground: 60 });
    expect(m.rsi).toBeCloseTo(2, 6);
    expect(cfg.slots.phase_test!.cue).toMatch(/time in the air divided by time on the floor/);
    expect(cfg.slots.phase_test!.cue).toMatch(/not extra/);
  });
});
