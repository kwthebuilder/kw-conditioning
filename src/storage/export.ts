/**
 * One-tap export: a human-readable markdown log with the full state as
 * a fenced JSON block at the foot. Pure; the date is passed in.
 */
import { CONFIG_VERSION, VECTORS_VERSION } from '../config/load';
import type { LiftId, OverrideRecord, ProgrammeConfig, State } from '../config/types';
import { programmeWeek } from '../engine/calendar';
import type { AnyLog, LogEntry } from '../engine/types';
import { APP_VERSION, SPEC_NAME } from '../version';

export interface ExportFile {
  filename: string;
  markdown: string;
}

const f1 = (n: number): string => n.toFixed(1);
const f3 = (n: number | null): string => (n === null ? '–' : n.toFixed(3));
const LIFTS: LiftId[] = ['front_squat', 'deadlift'];

function overrideRow(o: OverrideRecord): string {
  const target = o.kind === 'tm' ? o.lift : o.slot;
  return `| ${o.kind === 'tm' ? 'training max' : 'load'} | ${o.date} | ${target} | ${f1(o.from)} | ${f1(o.to)} | ${o.note ?? ''} |`;
}

/** A set as "load × reps @ RIR n", with prescribed and performed when the load was overridden. */
function setText(load: number, reps: number, rir: number, override?: { from: number }): string {
  const set = `${f1(load)} × ${reps} @ RIR ${rir}`;
  return override ? `${set} (prescribed ${f1(override.from)}, performed ${f1(load)})` : set;
}

function logLine(log: AnyLog, config: ProgrammeConfig): string {
  const name = (id: string) => config.slots[id]?.name ?? id;
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
  }
}

function isLogEntry(e: unknown): e is LogEntry {
  return typeof e === 'object' && e !== null && 'kind' in e && 'date' in e && 'log' in e && 'summary' in e;
}

export function exportMarkdown(state: State, config: ProgrammeConfig, date: string): ExportFile {
  const week = programmeWeek(config, date);
  const year = date.slice(0, 4);
  const filename = `training_log_${year}_w${String(Math.max(week, 0)).padStart(2, '0')}.md`;

  const lines: string[] = [];
  lines.push(`# Training log: export ${date} (programme week ${week})`);
  lines.push('');
  lines.push(`App ${APP_VERSION} | spec ${SPEC_NAME} | config ${CONFIG_VERSION} | vectors ${VECTORS_VERSION} | state schema ${state.schema}`);
  lines.push('');
  lines.push('## Training maxes');
  lines.push('');
  lines.push('| Lift | TM kg | β2 | β3 | Next position | Negative streak | Single scheduled |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const id of LIFTS) {
    const l = state.lifts[id];
    lines.push(`| ${config.slots[id]?.name ?? id} | ${f1(l.tm)} | ${f3(l.beta['2'])} | ${f3(l.beta['3'])} | ${l.next_position} | ${l.neg_streak} | ${l.single_scheduled ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('## Overrides');
  lines.push('');
  const overrides = state.overrides ?? [];
  if (overrides.length === 0) lines.push('None.');
  else {
    lines.push('| Kind | Date | Lift or slot | From | To | Note |');
    lines.push('|---|---|---|---|---|---|');
    for (const o of overrides) lines.push(overrideRow(o));
  }
  lines.push('');
  lines.push('## Log');
  lines.push('');
  if (state.log.length === 0) lines.push('Empty.');
  for (const e of state.log) {
    if (isLogEntry(e)) lines.push(`- ${e.date} ${logLine(e.log, config)}`);
    else lines.push(`- ${JSON.stringify(e)}`);
  }
  lines.push('');
  lines.push('## State');
  lines.push('');
  lines.push('Import this file to restore the state below exactly.');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(state, null, 1));
  lines.push('```');
  lines.push('');
  return { filename, markdown: lines.join('\n') };
}
