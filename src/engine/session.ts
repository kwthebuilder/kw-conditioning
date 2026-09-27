/**
 * The session for a date: template walk over programme_config, one
 * prescription per slot from the class modules (A.7, A.21, A.22).
 *
 * Pure: the date and the optional day are passed in; no clock.
 */
import type { IsoDate, ProgrammeConfig, SessionTemplate, SlotId, SlotItem, State } from '../config/types';
import { prescribeAccessory } from './accessory';
import { isCarrySlot, prescribeExplosive } from './explosive';
import { prescribeLift } from './barbell';
import { mesocycleOn, programmeWeek } from './calendar';
import { prescribeFixed } from './fixed';
import { prescribeRdl } from './rdl';
import { prescribeTempo } from './tempo';
import type { Session, SessionBlock, SessionDay, SessionResult, SessionSlotItem, SessionTemplateFields } from './types';

/**
 * A.22: Day 2 if the front squat's last_logged is later than the
 * deadlift's, otherwise Day 1 (including when both are absent).
 */
export function defaultDay(state: State): SessionDay {
  const fs = state.lifts.front_squat.last_logged;
  const dl = state.lifts.deadlift.last_logged;
  if (fs !== undefined && (dl === undefined || fs > dl)) return 2;
  return 1;
}

/** A.21: the rsi_ladder item stands in on the listed weeks and day. */
export function isLadderDay(config: ProgrammeConfig, week: number, day: SessionDay): boolean {
  return config.ladder !== undefined && config.ladder.day === day && config.ladder.weeks.includes(week);
}

function templateFields(it: SlotItem): SessionTemplateFields {
  const tf: SessionTemplateFields = {};
  if (it.sets !== undefined) tf.sets = it.sets;
  if (it.reps !== undefined) tf.reps = it.reps;
  if (it.secs !== undefined) tf.secs = it.secs;
  if (it.per_side !== undefined) tf.per_side = it.per_side;
  if (it.variant !== undefined) tf.variant = it.variant;
  if (it.contacts !== undefined) tf.contacts = it.contacts;
  if (it.inside_rest !== undefined) tf.inside_rest = it.inside_rest;
  return tf;
}

function buildItem(state: State, config: ProgrammeConfig, slotId: SlotId, date: IsoDate, template: SessionTemplateFields): SessionSlotItem {
  const slot = config.slots[slotId];
  if (!slot) throw new Error(`template names unknown slot ${slotId}`);
  const base = { kind: 'slot' as const, slot: slotId, cls: slot.cls, name: slot.name, template };
  switch (slot.cls) {
    case 'A':
      return { ...base, log_kind: 'barbell', prescription: prescribeLift(state, config, slotId as 'front_squat' | 'deadlift', date) };
    case 'B':
      return slotId === 'rdl'
        ? { ...base, log_kind: 'rdl', prescription: prescribeRdl(state, config) }
        : { ...base, log_kind: 'slot', prescription: prescribeTempo(state, config, slotId) };
    case 'C':
      return { ...base, log_kind: 'slot', prescription: prescribeAccessory(state, config, slotId) };
    default: {
      if (isCarrySlot(slot)) return { ...base, log_kind: 'explosive', prescription: prescribeExplosive(state, config, slotId) };
      const p = prescribeFixed(state, config, slotId, date);
      // A template item may fix the contacts (TAPER).
      if (template.contacts !== undefined) p.contacts = template.contacts;
      return { ...base, log_kind: 'fixed', prescription: p };
    }
  }
}

export function prescribe(state: State, config: ProgrammeConfig, date: IsoDate, day?: SessionDay): SessionResult {
  const meso = mesocycleOn(config, date);
  if (!meso) return { kind: 'refer', date, reason: `no mesocycle covers ${date}` };
  if (meso.template === null) return { kind: 'refer', date, reason: `${meso.id} has no template in the config; refer to project` };
  const template = config.templates[meso.template];
  const week = programmeWeek(config, date);
  const d: SessionDay = day ?? defaultDay(state);
  const st: SessionTemplate = template.both_days ?? (d === 1 ? template.day1 : template.day2);
  const ladder = isLadderDay(config, week, d) ? config.ladder : undefined;
  let ladderPlaced = false;

  const blocks: SessionBlock[] = [];
  for (const b of st.blocks) {
    const items: SessionBlock['items'] = [];
    for (const it of b.items) {
      if (typeof it === 'string') {
        items.push({ kind: 'warmup', name: it });
        continue;
      }
      if (template.both_days && it.day !== undefined && it.day !== d) continue;
      if (it.until_week !== undefined && week > it.until_week) continue;
      let slotId = it.slot;
      let tf = templateFields(it);
      if (ladder && ladder.replaces.includes(slotId)) {
        if (ladderPlaced) continue; // every other replaced item is dropped
        ladderPlaced = true;
        slotId = ladder.slot;
        tf = {};
      }
      // A.25: a block's round range sets the sets on every item without its own.
      if (b.rounds !== undefined && tf.sets === undefined) {
        tf.sets = Array.isArray(b.rounds) ? b.rounds[0] : b.rounds;
        if (Array.isArray(b.rounds) && b.rounds[1] !== b.rounds[0]) tf.sets_max = b.rounds[1];
      }
      const built = buildItem(state, config, slotId, date, tf);
      if (b.rounds !== undefined && it.sets === undefined && built.prescription.kind === 'lift') {
        built.prescription.sets = tf.sets!;
        if (tf.sets_max !== undefined) built.prescription.sets_max = tf.sets_max;
      }
      items.push(built);
    }
    if (items.length === 0) continue;
    const block: SessionBlock = { items };
    if (b.min !== undefined) block.min = b.min;
    if (b.superset !== undefined) block.superset = b.superset;
    if (b.contrast !== undefined) block.contrast = b.contrast;
    if (b.rounds !== undefined) block.rounds = b.rounds;
    blocks.push(block);
  }

  const singles: Session['singles_suggested'] = [];
  for (const b of blocks) {
    for (const it of b.items) {
      if (it.kind === 'slot' && it.prescription.kind === 'lift' && it.prescription.single_suggested && !it.prescription.single_suggested.taken) {
        singles.push({ lift: it.prescription.lift, reason: it.prescription.single_suggested.reason });
      }
    }
  }

  const notes: string[] = [`${meso.id}, programme week ${week}, barbell mode ${meso.barbell_mode ?? 'none'}.`];
  if (ladder) notes.push(`Ladder day: ${config.slots[ladder.slot]?.name ?? ladder.slot} in place of ${ladder.replaces.join(' and ')}.`);
  if (week > config.freeze.no_upward_steps_after_week) notes.push(`Week ${week} is past week ${config.freeze.no_upward_steps_after_week}: no upward steps.`);

  return {
    kind: 'session',
    date,
    mesocycle: meso.id,
    programme_week: week,
    day: d,
    template: meso.template,
    target_min: st.target_min,
    pre: st.pre ?? [],
    blocks,
    singles_suggested: singles,
    ladder_day: ladder !== undefined,
    notes,
  };
}
