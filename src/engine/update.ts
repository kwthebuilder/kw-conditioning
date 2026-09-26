/**
 * A.23: one door for state. Every change goes through update(), which
 * dispatches to the class modules and appends one entry to state.log.
 *
 * CLAUDE.md names the surface as update(state, log); bindConfig()
 * closes both functions over the bundled config for callers that do
 * not want to pass it.
 */
import type { ProgrammeConfig, State } from '../config/types';
import { updateAccessory } from './accessory';
import { updateLift, updateSingle } from './barbell';
import { cmjSummary, recordCmj } from './cmj';
import { explainStep } from './explain';
import { updateExplosive } from './explosive';
import { overrideTm } from './overrides';
import { updateRdl } from './rdl';
import { prescribe } from './session';
import { updateTempo } from './tempo';
import type { AnyLog, EngineUpdateResult, Explanation, LogEntry, SessionDay, SessionResult } from './types';

function plain(state: State, summary: string): EngineUpdateResult {
  const explanation: Explanation = { summary, steps: [explainStep('record', summary, {})] };
  return { state, explanation, outcome: null };
}

export function update(state: State, log: AnyLog, config: ProgrammeConfig): EngineUpdateResult {
  let r: EngineUpdateResult;
  switch (log.kind) {
    case 'barbell': {
      const u = updateLift(state, config, log);
      r = { state: u.state, explanation: u.explanation, outcome: u.outcome };
      break;
    }
    case 'single': {
      const u = updateSingle(state, config, log);
      r = { state: u.state, explanation: u.explanation, outcome: null };
      break;
    }
    case 'single_skipped': {
      // A.17: skipping clears the flag and changes nothing else.
      const next = structuredClone(state);
      const was = next.lifts[log.lift].single_scheduled;
      next.lifts[log.lift].single_scheduled = false;
      r = plain(next, `${config.slots[log.lift]?.name ?? log.lift}: suggested single skipped${was ? '; the suggestion is cleared' : ''}.`);
      break;
    }
    case 'rdl': {
      const u = updateRdl(state, config, log);
      r = { state: u.state, explanation: u.explanation, outcome: u.outcome };
      break;
    }
    case 'slot': {
      const slot = config.slots[log.slot];
      if (!slot) throw new Error(`unknown slot ${log.slot}`);
      if (log.slot === 'rdl') throw new Error('log the RDL with kind "rdl"');
      const u = slot.cls === 'B' ? updateTempo(state, config, log) : updateAccessory(state, config, log);
      r = { state: u.state, explanation: u.explanation, outcome: u.outcome };
      break;
    }
    case 'fixed': {
      const name = config.slots[log.slot]?.name ?? log.slot;
      r = plain(structuredClone(state), `${name}: ${log.done ? 'done' : 'not done'}${log.value !== undefined ? ` (${log.value})` : ''}${log.note ? `, ${log.note}` : ''}.`);
      break;
    }
    case 'explosive': {
      const u = updateExplosive(state, config, log);
      r = { state: u.state, explanation: u.explanation, outcome: u.outcome };
      break;
    }
    case 'cmj': {
      const { state: next, summary } = recordCmj(state, log.value);
      r = plain(next, `CMJ ${log.value} cm recorded. Running mean of ${summary.count}: ${summary.mean?.toFixed(1)} cm.`);
      break;
    }
    case 'depth_jump_height': {
      const next = structuredClone(state);
      const from = next.depth_jump.height_cm;
      next.depth_jump.height_cm = log.height_cm;
      r = plain(next, `Depth-jump height set to ${log.height_cm} cm (was ${from ?? 'unset'}).`);
      break;
    }
    case 'tm_override': {
      const u = overrideTm(state, log.lift, log.tm, log.date, log.note);
      r = { state: u.state, explanation: u.explanation, outcome: null };
      break;
    }
    case 'session_end': {
      r = plain(structuredClone(state), `Day ${log.day} session ended${log.minutes !== undefined ? ` after ${log.minutes} min` : ''}${log.note ? `: ${log.note}` : ''}. Export now.`);
      break;
    }
  }
  const entry: LogEntry = { kind: log.kind, date: log.date, summary: r.explanation.summary, log };
  r.state.log.push(entry);
  return r;
}

/** The CLAUDE.md two-argument surface, closed over a config. */
export function bindConfig(config: ProgrammeConfig): {
  prescribe: (state: State, date: string, day?: SessionDay) => SessionResult;
  update: (state: State, log: AnyLog) => EngineUpdateResult;
} {
  return {
    prescribe: (state, date, day) => prescribe(state, config, date, day),
    update: (state, log) => update(state, log, config),
  };
}

export { cmjSummary };
