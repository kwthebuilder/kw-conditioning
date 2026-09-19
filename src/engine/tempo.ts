/**
 * Class B streak slots: hack squat and gluteal abductor HSR (§3).
 * Last set to RIR 2 at tempo. up_at reps in two consecutive sessions →
 * one increment up; under down_below in two → one increment down. No
 * upward step if the site was flagged in the last 48 h (L8).
 * Hack squat steps 5 kg (Q6 ruling); the cable slot shows "one plate".
 */
import type { ProgrammeConfig, Slot, SlotId, State } from '../config/types';
import { prescribeProgression, slotOf, updateProgression, type ProgressionContext, type ProgressionRule } from './accessory';
import type { SlotLog, SlotPrescription, SlotUpdateResult } from './types';

function need<T>(slot: Slot, key: string, v: T | undefined): T {
  if (v === undefined) throw new Error(`config.slots.${slot.id}.${key} missing`);
  return v;
}

export function ruleForClassB(slot: Slot): ProgressionRule {
  if (slot.cls !== 'B') throw new Error(`${slot.id} is class ${slot.cls}, not B`);
  if (slot.id === 'rdl') throw new Error('rdl follows its table (rdl.ts), not the streak rule');
  return {
    cls: 'B',
    reps: need(slot, 'reps', slot.reps),
    rir_cap: need(slot, 'rir_cap', slot.rir_cap),
    up_at: need(slot, 'up_at', slot.up_at),
    down_below: need(slot, 'down_below', slot.down_below),
    streak: need(slot, 'streak', slot.streak),
    never_zero: slot.never_zero ?? false,
  };
}

export function prescribeTempo(state: State, config: ProgrammeConfig, id: SlotId): SlotPrescription {
  const p = prescribeProgression(state, config, id, ruleForClassB(slotOf(config, id)));
  p.notes.unshift('3 s lowering on every rep; when it breaks the set ends and that rep count is logged.');
  return p;
}

export function updateTempo(state: State, config: ProgrammeConfig, log: SlotLog, ctx: ProgressionContext = {}): SlotUpdateResult {
  return updateProgression(state, config, log, ruleForClassB(slotOf(config, log.slot)), ctx);
}
