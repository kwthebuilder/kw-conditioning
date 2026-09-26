/**
 * Explosive slots that carry a load (engine_spec_v1_6.md A.24): jump
 * shrug, landmine clean and push press, explosive DB push press.
 *
 * The first logged session sets the load (the athlete works up to the
 * heaviest load that stays fast). After that, slots with increment_kg
 * and streak step up after `streak` consecutive sessions at the stored
 * load with no stop-rule cut. A logged load that differs from the
 * stored one replaces it and resets the streak. A.10: no upward step
 * after the freeze week.
 *
 * Pure: no clock, no I/O.
 */
import type { ExplosiveState, ProgrammeConfig, Slot, SlotId, State } from '../config/types';
import { programmeWeek } from './calendar';
import { explainStep, f1 } from './explain';
import type { ExplanationStep, ExplosiveLog, ExplosiveOutcome, ExplosivePrescription, ExplosiveUpdateResult } from './types';

export function isCarrySlot(slot: Slot | undefined): boolean {
  return slot !== undefined && slot.load_rule === 'carry';
}

function carrySlot(config: ProgrammeConfig, slotId: SlotId): Slot {
  const slot = config.slots[slotId];
  if (!slot) throw new Error(`unknown slot ${slotId}`);
  if (!isCarrySlot(slot)) throw new Error(`${slotId} is not a carry-load slot (A.24)`);
  return slot;
}

/** The step rule, or undefined when the slot never steps. */
function stepRule(slot: Slot): { increment: number; streak: number } | undefined {
  if (slot.increment_kg === undefined || slot.streak === undefined) return undefined;
  return { increment: slot.increment_kg, streak: slot.streak };
}

export function prescribeExplosive(state: State, config: ProgrammeConfig, slotId: SlotId): ExplosivePrescription {
  const slot = carrySlot(config, slotId);
  const cur: ExplosiveState | undefined = state.explosive?.[slotId];
  const rule = stepRule(slot);
  const notes: string[] = ['Stop rule: the first visibly slower rep ends the set.'];
  if (!cur) {
    notes.push('First session: no load yet. Work up in small jumps until a rep slows, then log the heaviest load that stayed fast.');
  } else if (rule) {
    notes.push(`${cur.clean_streak} of ${rule.streak} clean sessions banked; at ${rule.streak} the load goes up ${rule.increment} kg.`);
  } else {
    notes.push('Load stays put inside a block. Log a different weight to change it.');
  }
  const p: ExplosivePrescription = {
    kind: 'explosive',
    slot: slotId,
    name: slot.name,
    load: cur ? cur.load : null,
    clean_streak: cur ? cur.clean_streak : 0,
    notes,
  };
  if (rule) {
    p.increment_kg = rule.increment;
    p.streak_needed = rule.streak;
  }
  return p;
}

export function updateExplosive(state: State, config: ProgrammeConfig, log: ExplosiveLog): ExplosiveUpdateResult {
  const slot = carrySlot(config, log.slot);
  const next = structuredClone(state);
  const map = (next.explosive ??= {});
  const cur = map[log.slot];
  const rule = stepRule(slot);
  const week = programmeWeek(config, log.date);
  const frozen = week > config.freeze.no_upward_steps_after_week;
  const steps: ExplanationStep[] = [];
  const setText = `${f1(log.load)} kg, ${log.sets_done} sets${log.cut ? ', a set was cut by the stop rule' : ''}.`;

  let rule_: ExplosiveOutcome['rule'];
  let load = log.load;
  let streak = 0;

  if (!cur) {
    rule_ = 'first';
    steps.push(explainStep('first', `${setText} First logged session sets the load: ${f1(load)} kg.`, { load }));
  } else if (log.load !== cur.load) {
    rule_ = 'changed';
    steps.push(
      explainStep('changed', `${setText} Load changed from ${f1(cur.load)} to ${f1(log.load)} kg, so that is the new load and the clean-session count restarts.`, {
        from: cur.load,
        to: log.load,
      }),
    );
    (next.overrides ??= []).push({ kind: 'load', date: log.date, slot: log.slot, from: cur.load, to: log.load });
  } else if (!rule) {
    rule_ = 'fixed';
    steps.push(explainStep('fixed', `${setText} Load stays ${f1(load)} kg; this slot does not step inside a block.`, { load }));
  } else if (log.cut) {
    rule_ = 'cut';
    steps.push(explainStep('cut', `${setText} The stop rule cut a set, so the clean-session count restarts. Load stays ${f1(load)} kg.`, { load, clean_streak: 0 }));
  } else {
    streak = cur.clean_streak + 1;
    if (streak >= rule.streak) {
      streak = 0;
      if (frozen) {
        rule_ = 'withheld';
        steps.push(
          explainStep('withheld', `${setText} ${rule.streak} clean sessions in a row, but week ${week} is past week ${config.freeze.no_upward_steps_after_week}: no upward step. Load stays ${f1(load)} kg.`, {
            load,
            week,
          }),
        );
      } else {
        rule_ = 'step';
        load = cur.load + rule.increment;
        steps.push(
          explainStep('step', `${setText} ${rule.streak} clean sessions in a row: load goes up ${rule.increment} kg, ${f1(cur.load)} → ${f1(load)} kg.`, {
            from: cur.load,
            to: load,
          }),
        );
      }
    } else {
      rule_ = 'clean';
      steps.push(explainStep('clean', `${setText} Clean session: ${streak} of ${rule.streak}. Load stays ${f1(load)} kg.`, { load, clean_streak: streak }));
    }
  }

  map[log.slot] = { load, clean_streak: streak };
  const outcome: ExplosiveOutcome = { rule: rule_, load_before: cur ? cur.load : null, load_after: load, clean_streak: streak };
  const summary = `${slot.name}: ${cur ? f1(cur.load) : 'unset'} → ${f1(load)} kg (${rule_}).`;
  return { state: next, outcome, explanation: { summary, steps } };
}
