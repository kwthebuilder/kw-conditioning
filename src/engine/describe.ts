/**
 * One line per log entry, in the words the export and the correction
 * summaries use. Pure: reads the config for slot names only.
 */
import type { ProgrammeConfig } from '../config/types';
import { f1 } from './explain';
import type { AnyLog, CorrectionAction, RecordLog, SkipReason } from './types';

const SKIP_TEXT: Record<SkipReason, string> = {
  time: 'time',
  tissue: 'tissue',
  equipment: 'equipment',
  fatigue: 'fatigue',
  other: 'other',
};

export function skipReasonText(reason: SkipReason | undefined): string {
  return reason ? SKIP_TEXT[reason] : '';
}

function setText(load: number, reps: number, rir: number, override?: { from: number }): string {
  const set = `${f1(load)} × ${reps} @ RIR ${rir}`;
  return override ? `${set} (prescribed ${f1(override.from)}, performed ${f1(load)})` : set;
}

/** The slot or lift an entry belongs to, if any. */
export function slotOfLog(log: RecordLog): string | undefined {
  switch (log.kind) {
    case 'barbell':
    case 'single':
    case 'single_skipped':
    case 'tm_override':
      return log.lift;
    case 'rdl':
    case 'slot':
    case 'fixed':
    case 'explosive':
    case 'skip':
      return log.slot;
    case 'cmj':
      return 'cmj';
    default:
      return undefined;
  }
}

export function describeLog(log: RecordLog, config: ProgrammeConfig): string {
  const name = (id: string): string => (id === 'cmj' ? 'CMJ' : (config.slots[id]?.name ?? id));
  switch (log.kind) {
    case 'barbell': {
      const parts: string[] = [];
      if (log.single) parts.push(`single ${f1(log.single.load)} @ RIR ${log.single.rir}`);
      const where = log.position !== undefined ? `position ${log.position}` : log.mode;
      parts.push(`${where}, last set ${setText(log.last_set.load, log.last_set.reps, log.last_set.rir, log.override)}`);
      if (log.missed) parts.push('a set was missed');
      return `${name(log.lift)}: ${parts.join('; ')}`;
    }
    case 'single':
      return `${name(log.lift)}: single ${f1(log.load)} @ RIR ${log.rir}`;
    case 'single_skipped':
      return `${name(log.lift)}: suggested single skipped`;
    case 'rdl':
    case 'slot':
      return `${name(log.slot)}: ${log.sets_done} sets, last set ${setText(log.load, log.last_set.reps, log.last_set.rir, log.override)}${log.last_set.tempo_break ? ', tempo broke' : ''}`;
    case 'fixed':
      return `${name(log.slot)}: ${log.done ? 'done' : 'not done'}${log.value !== undefined ? ` (${log.value})` : ''}${log.note ? `, ${log.note}` : ''}`;
    case 'explosive':
      return `${name(log.slot)}: ${log.sets_done} sets at ${f1(log.load)} kg${log.cut ? ', stop rule cut a set' : ', no cut'}`;
    case 'cmj':
      return `CMJ ${log.value} cm`;
    case 'depth_jump_height':
      return `depth-jump height ${log.height_cm} cm`;
    case 'tm_override':
      return `${name(log.lift)}: training max set to ${f1(log.tm)}${log.note ? ` (${log.note})` : ''}`;
    case 'session_end':
      return `Day ${log.day} ended${log.minutes !== undefined ? `, ${log.minutes} min` : ''}${log.note ? `: ${log.note}` : ''}`;
    case 'skip':
      return `${name(log.slot)}: skipped${log.reason ? ` (${skipReasonText(log.reason)})` : ''}${log.note ? `, ${log.note}` : ''}`;
    case 'session_start':
      return `Day ${log.day} started (${log.plan.items.length} items planned)`;
    case 'tissue_check': {
      const s = log.scores;
      const parts = (['patellar', 'gluteal', 'shoulder'] as const).filter((k) => s[k] !== undefined).map((k) => `${k} ${s[k]}/10`);
      return `Tissue check${log.for_date ? ` for ${log.for_date}` : ''}: ${parts.join(', ') || 'no scores'}${log.note ? `, ${log.note}` : ''}`;
    }
    case 'correction':
      return `Correction to ${log.on}: ${log.actions.length} change${log.actions.length === 1 ? '' : 's'}${log.note ? ` (${log.note})` : ''}`;
  }
}

/** One action of a correction in words, given the content it replaces or removes. */
export function describeAction(action: CorrectionAction, before: AnyLog | undefined, config: ProgrammeConfig): string {
  switch (action.op) {
    case 'replace':
      return `${before ? `${before.date} ${describeLog(before, config)}` : 'entry'} → ${describeLog(action.entry, config)}`;
    case 'remove':
      return `removed ${before ? `${before.date} ${describeLog(before, config)}` : 'entry'}`;
    case 'insert':
      return `added ${action.entry.date} ${describeLog(action.entry, config)}`;
  }
}
