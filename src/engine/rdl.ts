/**
 * RDL, class B table (§3). Start 100 kg, 3 × 6 to 8, last set AMRAP
 * capped at RIR 2 or tempo break. Next load from the table by last-set
 * reps; the +10 kg row is open for the first three sessions (L10).
 * A.10: no upward step after the freeze week.
 */
import type { ProgrammeConfig, RdlTableRow, State } from '../config/types';
import { programmeWeek } from './calendar';
import { explainStep, f1 } from './explain';
import type { ExplanationStep, RdlLog, RdlPrescription, RdlUpdateResult } from './types';

/** L10: the wide seek window lasts three logged sessions. */
export const WIDE_WINDOW_SESSIONS = 3;

function rdlSlot(config: ProgrammeConfig) {
  const slot = config.slots.rdl;
  if (!slot) throw new Error('config.slots.rdl missing');
  if (!slot.table || !slot.rep_range || slot.rir_cap === undefined) throw new Error('config.slots.rdl needs table, rep_range and rir_cap');
  return { slot, table: slot.table, rep_range: slot.rep_range, rir_cap: slot.rir_cap };
}

/** A row carrying a note is the windowed row. */
function isWindowRow(row: RdlTableRow): boolean {
  return row.length === 3;
}

/** The table row that fires for this session, or null. */
export function rdlRow(table: RdlTableRow[], reps: number, sessionsLogged: number): RdlTableRow | null {
  const wide = sessionsLogged < WIDE_WINDOW_SESSIONS;
  for (const row of table) {
    if (isWindowRow(row) && !wide) continue;
    if (reps >= row[0]) return row;
  }
  return null;
}

export function prescribeRdl(state: State, config: ProgrammeConfig): RdlPrescription {
  const { slot, rep_range, rir_cap } = rdlSlot(config);
  const wide = state.rdl.sessions_logged < WIDE_WINDOW_SESSIONS;
  const notes = [
    `3 s lowering. Sets of ${rep_range[0]} to ${rep_range[1]}; last set to RIR ${rir_cap} or tempo break, log its reps.`,
  ];
  if (wide) notes.push(`Session ${state.rdl.sessions_logged + 1} of ${WIDE_WINDOW_SESSIONS} in the wide window: 12 or more reps steps +10 kg.`);
  return {
    kind: 'rdl',
    slot: 'rdl',
    name: slot.name,
    load: state.rdl.load_kg,
    rep_range,
    rir_cap,
    amrap: true,
    session_number: state.rdl.sessions_logged + 1,
    wide_window: wide,
    notes,
  };
}

export function updateRdl(state: State, config: ProgrammeConfig, log: RdlLog): RdlUpdateResult {
  const { slot, table } = rdlSlot(config);
  const next = structuredClone(state);
  const steps: ExplanationStep[] = [];
  const sessionNumber = next.rdl.sessions_logged + 1;
  const before = log.load;
  const reps = log.last_set.reps;
  const week = programmeWeek(config, log.date);
  const frozen = week > config.freeze.no_upward_steps_after_week;

  if (log.load !== next.rdl.load_kg) {
    steps.push(explainStep('load_change', `${slot.name}: lifted ${f1(log.load)} kg against ${f1(next.rdl.load_kg)} prescribed; the table steps from the load lifted.`, { prescribed: next.rdl.load_kg, lifted: log.load }));
  }

  const row = rdlRow(table, reps, next.rdl.sessions_logged);
  let delta = row ? row[1] : 0;
  let withheld: 'freeze' | undefined;
  const rowText = row ? `${reps} reps is ${row[0]} or more${row.length === 3 ? ` (${row[2]})` : ''}: ${delta >= 0 ? '+' : ''}${delta} kg.` : `${reps} reps matches no row: hold.`;
  if (frozen && delta > 0) {
    withheld = 'freeze';
    steps.push(explainStep('freeze', `Session ${sessionNumber}. ${rowText} Week ${week} is past week ${config.freeze.no_upward_steps_after_week}: upward step withheld.`, { reps, delta, week }));
    delta = 0;
  } else {
    steps.push(explainStep('rdl_table', `Session ${sessionNumber}, last set ${reps} reps at RIR ${log.last_set.rir}${log.last_set.tempo_break ? ' (tempo broke)' : ''}. ${rowText} Next: ${f1(before + delta)} kg.`, { reps, delta, from: before, to: before + delta }));
  }

  next.rdl.load_kg = before + delta;
  next.rdl.sessions_logged += 1;

  if (log.override) {
    const rec = { kind: 'load' as const, date: log.date, slot: 'rdl', from: log.override.from, to: log.load };
    (next.overrides ??= []).push(log.override.note !== undefined ? { ...rec, note: log.override.note } : rec);
    steps.push(explainStep('override', `Load overridden by the athlete: ${f1(log.override.from)} → ${f1(log.load)} kg${log.override.note ? ` (${log.override.note})` : ''}.`, { from: log.override.from, to: log.load }));
  }

  const outcome = {
    delta_kg: delta,
    load_before: before,
    load_after: next.rdl.load_kg,
    session_number: sessionNumber,
    row: row ? [...row] : null,
    ...(withheld ? { withheld } : {}),
  };
  return {
    state: next,
    outcome,
    explanation: { summary: `${slot.name}: ${f1(before)} → ${f1(next.rdl.load_kg)} kg (${delta >= 0 ? '+' : ''}${delta}).`, steps },
  };
}
