/**
 * Regression found in the 9 Oct Block 2 dry run: items whose template gives
 * reps without sets (skater bound, 6 per side, stuck landing) and drop
 * landings (4 to 6) showed "As planned" / "As usual". Release 1 dropped the
 * reps-only case, the variant and the landing count.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import { planSnapshot, prescribe } from '../src/engine';
import type { Session } from '../src/engine';
import { plannedText } from '../src/ui/model';

// Week 10, Day 1 of Block 2: not a ladder week, so the drop jump and drop landings both appear.
const day = prescribe(INITIAL_STATE, cfg, '2026-11-16', 1) as Session;
const snap = planSnapshot(day, cfg);
const item = (slot: string) => snap.items.find((i) => i.slot === slot)!;

describe('Block 2 Day 1 plan text', () => {
  it('skater bound: reps per side and the variant', () => {
    expect(item('skater_bound')).toMatchObject({ reps: 6, per_side: true, variant: 'stuck landing' });
    expect(plannedText(item('skater_bound'))).toBe('6 reps each side · stuck landing');
  });
  it('drop landings: the landing count', () => {
    expect(item('depth_landing')).toMatchObject({ landings: [4, 6] });
    expect(plannedText(item('depth_landing'))).toBe('4–6 landings');
  });
  it('drop jump keeps its contacts', () => {
    expect(plannedText(item('depth_jump'))).toBe('6 jumps');
  });
  it('the pull-up inside the contrast rests says so', () => {
    expect(item('pull_up').inside_rest).toBe(true);
  });
});
