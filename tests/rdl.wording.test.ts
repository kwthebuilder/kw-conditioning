/**
 * A.30 (v1.8): the RDL explanation names the band the reps fall in.
 * Bug from the 8 Oct audit: 0 reps was explained as "0 reps is 0 or more: -5 kg".
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import { updateRdl } from '../src/engine';
import type { State } from '../src/config/types';

function stateAt(load: number, sessions: number): State {
  const s = structuredClone(INITIAL_STATE);
  s.rdl = { load_kg: load, sessions_logged: sessions };
  return s;
}

const text = (reps: number, sessions = 5): string =>
  updateRdl(stateAt(60, sessions), cfg, { slot: 'rdl', date: '2026-10-12', load: 60, sets_done: 3, last_set: { reps, rir: 2 } }).explanation.steps.map((s) => s.text).join(' ');

describe('RDL explanation names the band (A.30)', () => {
  it('under 6 for a failed set', () => {
    expect(text(0)).toContain('0 reps is under 6: −5 kg');
    expect(text(0)).not.toContain('0 or more');
  });
  it('6 to 7 holds', () => expect(text(7)).toContain('7 reps is 6 to 7: hold'));
  it('8 to 9 steps 2.5', () => expect(text(9)).toContain('9 reps is 8 to 9: +2.5 kg'));
  it('10 or more after the wide window', () => expect(text(12)).toContain('12 reps is 10 or more: +5 kg'));
  it('10 to 11 inside the wide window, 12 or more takes the window row', () => {
    expect(text(11, 0)).toContain('11 reps is 10 to 11: +5 kg');
    expect(text(12, 0)).toContain('12 reps is 12 or more (first 3 sessions): +10 kg');
  });
});
