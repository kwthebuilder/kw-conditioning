/**
 * Release 3.5 (config v1.11, design rationale v3.8): Block 2 Day 2 rebuilt
 * to fit the 80-minute cap. Config only; no engine rule changes. Synthetic
 * data only. The new Day 2 itself is checked by engine_test_vectors_v1_11.json
 * `templates` (Block 2 Day 2) and `audit_trims` (first Day 2 of Block 2).
 */
import { describe, expect, it } from 'vitest';
import v110 from '../spec/programme_config_v1_10.json';
import { PROGRAMME_CONFIG as cfg } from '../src/config/load';

type Item = string | { slot: string; sets?: number };
type Day = { target_min: number; blocks: { items: Item[] }[] };

const setsOf = (day: Day): Record<string, number | undefined> => {
  const out: Record<string, number | undefined> = {};
  for (const b of day.blocks) for (const it of b.items) if (typeof it !== 'string') out[it.slot] = it.sets;
  return out;
};

describe('config v1.11: Block 2 Day 2 (rationale v3.8 section 1)', () => {
  const d2 = cfg.templates.M2!.day2 as unknown as Day;

  it('prescribes the agreed set counts and keeps the jump shrug as its own item', () => {
    expect(setsOf(d2)).toEqual({ jump_shrug: 3, landmine_cpp: 2, deadlift: 3, bss: 2, seated_abduction: 2, oh_carry: 1, cs_row: 2 });
    expect(d2.target_min).toBe(71);
  });

  it('reads the new running-long line on Day 2 and leaves Day 1 and the short-session lines alone', () => {
    expect(cfg.text?.session_note_day2).toBe('Running long? First drop the carry and row. Then swap the split squat for the hack squat. Never cut the explosive work, the deadlift or the abduction.');
    expect(cfg.text?.session_note_day1).toBe(v110.text.session_note_day1);
    expect(cfg.text?.short_day1).toBe(v110.text.short_day1);
    expect(cfg.text?.short_day2).toBe(v110.text.short_day2);
  });

  it('changes nothing else: Block 2 Day 1 (push press 3 rounds), Blocks 3 and 4, the taper, slots and rules match config v1.10', () => {
    const strip = (c: Record<string, unknown>): Record<string, unknown> => {
      const x = structuredClone(c) as Record<string, any>;
      delete x.version;
      delete x.governs;
      delete x.templates.M2.day2;
      delete x.text.session_note_day2;
      delete x.text.note;
      return x;
    };
    expect(strip(cfg as unknown as Record<string, unknown>)).toEqual(strip(v110 as unknown as Record<string, unknown>));
    expect(setsOf(cfg.templates.M2!.day1 as unknown as Day)).toMatchObject({ db_rdl: 3, db_pp_strength: 3, pull_up: 3 });
  });
});
