/**
 * One-tap export: a human-readable markdown log with the full state as
 * a fenced JSON block at the foot. Pure; the date is passed in.
 */
import { CONFIG_VERSION, VECTORS_VERSION } from '../config/load';
import type { LiftId, OverrideRecord, ProgrammeConfig, State } from '../config/types';
import { programmeWeek } from '../engine/calendar';
import { describeLog } from '../engine/describe';
import { effectiveLog } from '../engine/replay';
import type { LogEntry } from '../engine/types';
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

/** Raw index → " (corrected 2026-10-09)" or " (removed 2026-10-09)" for original entries a correction touched. */
function correctionMarks(log: readonly unknown[]): Map<number, string> {
  const marks = new Map<number, string>();
  for (const item of effectiveLog(log)) {
    if (typeof item.origin !== 'number') continue;
    if (item.removed) marks.set(item.origin, ` (removed ${item.removed.date})`);
    else if (item.corrections.length) marks.set(item.origin, ` (corrected ${item.corrections[item.corrections.length - 1]!.date})`);
  }
  return marks;
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
  // v1.8: every entry as logged; entries a correction replaced or removed are marked (A.28).
  let marks = new Map<number, string>();
  try {
    marks = correctionMarks(state.log);
  } catch {
    /* an unreadable correction leaves the entries unmarked; the JSON below is still exact */
  }
  const corrections: string[] = [];
  state.log.forEach((e, i) => {
    if (!isLogEntry(e)) {
      lines.push(`- ${JSON.stringify(e)}`);
      return;
    }
    if (e.log.kind === 'correction') {
      corrections.push(`- ${e.date} ${e.summary}`);
      return;
    }
    if (e.log.kind === 'session_start') return;
    lines.push(`- ${e.date} ${describeLog(e.log, config)}${marks.get(i) ?? ''}`);
  });
  if (corrections.length) {
    lines.push('');
    lines.push('## Corrections');
    lines.push('');
    lines.push(...corrections);
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
