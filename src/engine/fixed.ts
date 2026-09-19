/**
 * Classes D, E and F (§5 to §7) under the phase 2 scope cut: no
 * progression logic. The prescription is read from the config as text
 * and numbers; the athlete logs done / not done with an optional value.
 *
 * Trap-bar jump runs at the bar (config.equipment.trap_bar_kg).
 * Depth-jump contacts come from the slot's per-mesocycle map; a range
 * uses its low end (6 in M2); a week map is resolved by programme week.
 */
import type { ContactSpec, MesocycleId, ProgrammeConfig, SlotId, State } from '../config/types';
import { mesocycleOn, programmeWeek } from './calendar';
import type { FixedPrescription } from './types';

function resolveContactSpec(spec: ContactSpec, week: number, path: string): number {
  if (typeof spec === 'number') return spec;
  if (Array.isArray(spec)) return spec[0];
  for (const [key, value] of Object.entries(spec)) {
    const m = /^(\d+)-(\d+)$/.exec(key);
    if (!m) throw new Error(`${path}: cannot read week span "${key}"`);
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (week >= lo && week <= hi) return value;
  }
  throw new Error(`${path}: no week span covers week ${week}`);
}

/** Contacts for a class E slot on a date, or undefined if the slot has none configured. */
export function contactsFor(config: ProgrammeConfig, slotId: SlotId, date: string): number | undefined {
  const slot = config.slots[slotId];
  if (!slot || slot.contacts === undefined) return undefined;
  if (typeof slot.contacts === 'number') return slot.contacts;
  const meso = mesocycleOn(config, date);
  if (!meso) return undefined;
  const spec = slot.contacts[meso.id as MesocycleId];
  if (spec === undefined) return undefined;
  return resolveContactSpec(spec, programmeWeek(config, date), `config.slots.${slotId}.contacts.${meso.id}`);
}

export function prescribeFixed(_state: State, config: ProgrammeConfig, slotId: SlotId, date: string): FixedPrescription {
  const slot = config.slots[slotId];
  if (!slot) throw new Error(`unknown slot ${slotId}`);
  if (slot.cls !== 'D' && slot.cls !== 'E' && slot.cls !== 'F') {
    throw new Error(`${slotId} is class ${slot.cls}; fixed prescriptions cover D, E and F only`);
  }
  const notes: string[] = [];
  const text: string[] = [slot.name];
  if (slot.progress) text.push(`Progress: ${slot.progress}.`);
  if (slot.when) text.push(slot.when);
  if (slot.regression) text.push(`Regression: ${slot.regression}.`);
  if (slot.alt) notes.push(`Alternative: ${slot.alt}.`);
  if (slot.never_zero) notes.push('Never cut to zero.');
  if (slot.cls === 'D') notes.push('Stop rule: the first visibly slower rep ends the set.');

  const p: FixedPrescription = { kind: 'fixed', slot: slotId, cls: slot.cls, name: slot.name, text: text.join(' '), notes };

  if (slotId === 'trap_bar_jump') {
    p.load_kg = config.equipment.trap_bar_kg;
    notes.push(`At the bar, ${config.equipment.trap_bar_kg} kg${config.equipment.trap_bar_kg_confirmed ? '' : ' (weight to be confirmed)'}.`);
  }
  const contacts = contactsFor(config, slotId, date);
  if (contacts !== undefined) p.contacts = contacts;
  if (slot.landings) notes.push(`${slot.landings[0]} to ${slot.landings[1]} landings.`);
  return p;
}
