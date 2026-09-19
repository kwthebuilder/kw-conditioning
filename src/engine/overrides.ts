/**
 * Manual overrides (phase 2 scope). Two kinds:
 *
 * - A load override on any prescription: returns a new prescription with
 *   the load replaced and `override` set. The log built from it echoes
 *   that record, and every update() reads the load lifted, so the
 *   override is what the engine sees. The update appends it to
 *   state.overrides for the export.
 * - A training-max override: writes the TM directly, records it in
 *   state.overrides, and the next prescription is computed from it.
 */
import type { LiftId, ProgrammeConfig, State } from '../config/types';
import { explainStep, f1 } from './explain';
import { roundLoad } from './rounding';
import type { Explanation, LoadOverride, RampSet } from './types';

interface Overridable {
  load: number | null;
  override?: LoadOverride;
  ramp?: RampSet[];
  notes: string[];
}

/**
 * Replace the prescribed load. Ramp sets, where present, are recomputed
 * from the new load using the config's ramp fractions.
 */
export function overrideLoad<P extends Overridable>(prescription: P, config: ProgrammeConfig, load: number, note?: string): P {
  if (!Number.isFinite(load) || load < 0) throw new Error(`override load must be a non-negative number, got ${load}`);
  const from = prescription.load ?? load;
  const override: LoadOverride = note !== undefined ? { from, note } : { from };
  const out: P = { ...prescription, load, override, notes: [...prescription.notes] };
  if (prescription.ramp) {
    const step = config.equipment.barbell_round_kg;
    out.ramp = config.wave.ramp.map(([frac, reps]) => ({ load: roundLoad(load * frac, step), reps }));
  }
  out.notes.push(`Load overridden: ${f1(from)} → ${f1(load)} kg${note ? ` (${note})` : ''}.`);
  return out;
}

/** Set a lift's training max by hand. Stored unrounded, like every TM. */
export function overrideTm(state: State, lift: LiftId, tm: number, date: string, note?: string): { state: State; explanation: Explanation } {
  if (!Number.isFinite(tm) || tm <= 0) throw new Error(`override TM must be a positive number, got ${tm}`);
  const next = structuredClone(state);
  const ls = next.lifts[lift];
  const from = ls.tm;
  const ratio = tm / from;
  // A.18: an override is a level change, so the mapping scales with it, as after a single (2.8).
  const betaText: string[] = [];
  for (const p of ['2', '3'] as const) {
    const b = ls.beta[p];
    if (b !== null) {
      ls.beta[p] = b * ratio;
      betaText.push(`β${p} ${b.toFixed(3)} → ${(b * ratio).toFixed(3)}`);
    }
  }
  ls.tm = tm;
  const rec = { kind: 'tm' as const, date, lift, from, to: tm };
  (next.overrides ??= []).push(note !== undefined ? { ...rec, note } : rec);
  const text = `${lift} training max set by hand: ${f1(from)} → ${f1(tm)} kg${note ? ` (${note})` : ''}. Every β scales by ${ratio.toFixed(3)}${betaText.length ? ` (${betaText.join(', ')})` : ''}; the next prescription uses ${f1(tm)}.`;
  return {
    state: next,
    explanation: { summary: text, steps: [explainStep('override_tm', text, { from, to: tm, ratio })] },
  };
}
