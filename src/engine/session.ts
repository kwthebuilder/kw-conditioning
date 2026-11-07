/**
 * The session for a date: template walk over programme_config, one
 * prescription per slot from the class modules (A.7, A.21, A.22).
 *
 * Pure: the date and the optional day are passed in; no clock.
 */
import type { IsoDate, LiftId, Mesocycle, ProgrammeConfig, SessionTemplate, SlotId, SlotItem, State, Template } from '../config/types';
import { prescribeAccessory } from './accessory';
import { isCarrySlot, prescribeExplosive } from './explosive';
import { opensBlock, prescribeLift } from './barbell';
import { mesocycleOn, programmeWeek } from './calendar';
import { prescribeFixed, weekSpanValue } from './fixed';
import { prescribeRdl } from './rdl';
import { prescribeTempo } from './tempo';
import type { Session, SessionBlock, SessionDay, SessionResult, SessionSlotItem, SessionTemplateFields } from './types';

function later(a: IsoDate | undefined, b: IsoDate | undefined): IsoDate | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return b > a ? b : a;
}

/** A.22 with A.32: the date a lift last counted as its day's main lift (logged, or swapped). */
export function mainLiftDate(state: State, lift: LiftId): IsoDate | undefined {
  return later(state.lifts[lift].last_logged, state.swapped_main?.[lift]);
}

/**
 * A.22: Day 2 if the front squat was last done later than the deadlift,
 * otherwise Day 1 (including when neither has a date). A.32: a swap
 * logged on a primary lift counts as that lift being done, for this
 * choice only.
 */
export function defaultDay(state: State): SessionDay {
  const fs = mainLiftDate(state, 'front_squat');
  const dl = mainLiftDate(state, 'deadlift');
  if (fs !== undefined && (dl === undefined || fs > dl)) return 2;
  return 1;
}

/** A.37: the template a date is planned from; sessions before config.templates_before.date use the earlier templates. */
export function templateFor(config: ProgrammeConfig, meso: Mesocycle, date: IsoDate): Template | undefined {
  if (meso.template === null) return undefined;
  const before = config.templates_before;
  if (before && date < before.date) {
    const t = before.templates[meso.template];
    if (t) return t;
  }
  return config.templates[meso.template];
}

/** A.21: the rsi_ladder item stands in on the listed weeks and day. */
export function isLadderDay(config: ProgrammeConfig, week: number, day: SessionDay): boolean {
  return config.ladder !== undefined && config.ladder.day === day && config.ladder.weeks.includes(week);
}

function templateFields(it: SlotItem, week: number, path: string): SessionTemplateFields {
  const tf: SessionTemplateFields = {};
  if (it.sets !== undefined) tf.sets = it.sets;
  if (it.reps !== undefined) tf.reps = it.reps;
  // v1.9: reps by programme-week span override the item's reps in those weeks.
  if (it.reps_by_week !== undefined) {
    const r = weekSpanValue(it.reps_by_week, week, path, true);
    if (r !== undefined) tf.reps = r;
  }
  if (it.note !== undefined) tf.note = it.note;
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
    // A.33: a template item's reps is the rep target of a class B or C streak rule.
    case 'B':
      return slotId === 'rdl'
        ? { ...base, log_kind: 'rdl', prescription: prescribeRdl(state, config) }
        : { ...base, log_kind: 'slot', prescription: prescribeTempo(state, config, slotId, template.reps) };
    case 'C':
      return { ...base, log_kind: 'slot', prescription: prescribeAccessory(state, config, slotId, template.reps) };
    default: {
      if (isCarrySlot(slot)) return { ...base, log_kind: 'explosive', prescription: prescribeExplosive(state, config, slotId) };
      const p = prescribeFixed(state, config, slotId, date);
      // A template item may fix the contacts (TAPER).
      if (template.contacts !== undefined) p.contacts = template.contacts;
      return { ...base, log_kind: 'fixed', prescription: p };
    }
  }
}

/** A.35: the record-only phase-start test, placed by config.phase_tests. */
function phaseTestItem(state: State, config: ProgrammeConfig, slotId: SlotId, date: IsoDate): SessionSlotItem {
  const slot = config.slots[slotId];
  if (!slot) throw new Error(`config.phase_tests names unknown slot ${slotId}`);
  const p = prescribeFixed(state, config, slotId, date);
  if (slot.cue) p.text = slot.cue;
  p.notes.push('Record only: nothing moves.');
  return { kind: 'slot', slot: slotId, cls: slot.cls, name: slot.name, log_kind: 'phase_test', template: {}, prescription: p };
}

function slotItems(b: SessionBlock): SessionSlotItem[] {
  return b.items.filter((it): it is SessionSlotItem => it.kind === 'slot');
}

/** A.34: cap one item's template sets (and the top of its range) at `max`. */
function capSets(it: SessionSlotItem, max: number): void {
  const t = it.template;
  const top = t.sets_max ?? t.sets;
  if (top === undefined || top <= max) return;
  t.trimmed_from = t.sets ?? top;
  if (t.sets !== undefined && t.sets > max) t.sets = max;
  if (t.sets_max !== undefined) {
    t.sets_max = Math.min(t.sets_max, max);
    if (t.sets === undefined || t.sets_max <= t.sets) delete t.sets_max;
  }
}

export function prescribe(state: State, config: ProgrammeConfig, date: IsoDate, day?: SessionDay): SessionResult {
  const meso = mesocycleOn(config, date);
  if (!meso) return { kind: 'refer', date, reason: `no mesocycle covers ${date}` };
  const template = templateFor(config, meso, date);
  if (meso.template === null || !template) return { kind: 'refer', date, reason: `${meso.id} has no template in the config; refer to project` };
  const week = programmeWeek(config, date);
  const d: SessionDay = day ?? defaultDay(state);
  const st: SessionTemplate = template.both_days ?? (d === 1 ? template.day1 : template.day2);
  const ladder = isLadderDay(config, week, d) ? config.ladder : undefined;
  let ladderPlaced = false;

  const blocks: SessionBlock[] = [];
  st.blocks.forEach((b, bi) => {
    const items: SessionBlock['items'] = [];
    b.items.forEach((it, ii) => {
      if (typeof it === 'string') {
        items.push({ kind: 'warmup', name: it });
        return;
      }
      if (template.both_days && it.day !== undefined && it.day !== d) return;
      if (it.until_week !== undefined && week > it.until_week) return;
      let slotId = it.slot;
      let tf = templateFields(it, week, `template ${meso.template} block ${bi + 1} item ${ii + 1}.reps_by_week`);
      if (ladder && ladder.replaces.includes(slotId)) {
        if (ladderPlaced) return; // every other replaced item is dropped
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
    });
    if (items.length === 0) return;
    const block: SessionBlock = { items };
    if (b.min !== undefined) block.min = b.min;
    if (b.superset !== undefined) block.superset = b.superset;
    if (b.contrast !== undefined) block.contrast = b.contrast;
    if (b.rounds !== undefined) block.rounds = b.rounds;
    if (b.upper !== undefined) block.upper = b.upper;
    blocks.push(block);
  });

  // The day's main lift: the session's class A item.
  const mainItem = blocks.flatMap(slotItems).find((it) => it.cls === 'A');
  const main = mainItem ? (mainItem.slot as LiftId) : undefined;
  const opens = main !== undefined && opensBlock(state, main, meso, date, config);

  // A.34: on the session that opens a block with a boundary test single, cap the listed slots and the last upper block.
  const trims = config.audit_trims;
  const audit = trims !== undefined && opens && config.boundary_singles_on_entering.includes(meso.id);
  if (audit && trims) {
    const listed = new Set(trims.slots_by_day[String(d) as '1' | '2'] ?? []);
    const upper = trims.final_upper_block ? [...blocks].reverse().find((b) => b.upper) : undefined;
    for (const b of blocks) for (const it of slotItems(b)) if (listed.has(it.slot) || b === upper) capSets(it, trims.max_sets);
  }

  // A.35: the phase-start test, on the first Day 1 of the listed blocks, just before the named slot.
  const pt = config.phase_tests;
  if (pt && d === pt.day && opens && pt.mesocycles.includes(meso.id)) {
    const test = phaseTestItem(state, config, pt.slot, date);
    const at = blocks.findIndex((b) => slotItems(b).some((it) => it.slot === pt.before_slot));
    if (at >= 0) {
      const b = blocks[at]!;
      b.items.splice(b.items.findIndex((it) => it.kind === 'slot' && it.slot === pt.before_slot), 0, test);
    } else {
      const first = blocks.findIndex((b) => slotItems(b).length > 0);
      blocks.splice(first === -1 ? blocks.length : first, 0, { items: [test] });
    }
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
  if (audit) notes.push(`First session of ${meso.id} for the ${main === 'front_squat' ? 'front squat' : 'deadlift'}: the test-single day, so some sets are capped at ${trims!.max_sets}.`);

  const out: Session = {
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
  if (opens) out.opens_block = true;
  if (audit) out.audit_trims = true;
  return out;
}
