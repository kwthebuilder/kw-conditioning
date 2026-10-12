/**
 * A log shaped like the athlete's weeks 2 to 4 (ui_spec_v1_3.md §13A
 * test 2): sessions on 21 Sep, 24 Sep, 29 Sep, 2 Oct, 3 Oct, 6 Oct and
 * 8 Oct, all logged before release 1, so none has a saved plan. Every
 * number is invented; no training data lives in this repo.
 *
 * e2e/fixtures/athlete-shaped.json is this state, for the phone-screen
 * smoke tests; tests/fixture.test.ts keeps the two identical.
 */
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../../src/config/load';
import type { State } from '../../src/config/types';
import { update } from '../../src/engine';
import type { AnyLog } from '../../src/engine';

type Pos = 1 | 2 | 3;

function lift(lift: 'front_squat' | 'deadlift', date: string, position: Pos, planned: number, reps: number, did: { load: number; reps: number; rir: number }): AnyLog {
  const log: AnyLog = { kind: 'barbell', lift, date, mode: 'wave', position, prescribed: { load: did.load, reps, sets: 3 }, last_set: did, missed: false };
  if (did.load !== planned) log.override = { from: planned };
  return log;
}
const slot = (s: string, date: string, load: number, reps: number, rir = 2): AnyLog => ({ kind: 'slot', slot: s, date, load, sets_done: 3, last_set: { reps, rir } });
const done = (s: string, date: string, value?: number): AnyLog => ({ kind: 'fixed', slot: s, date, done: true, ...(value !== undefined ? { value } : {}) });

export const ATHLETE_SHAPED_LOGS: AnyLog[] = [
  // Mon 21 Sep, Day 1. The drop jumps were logged on the ladder item with 51 (cm), as the athlete was told.
  { kind: 'cmj', date: '2026-09-21', value: 46 },
  done('rsi_ladder', '2026-09-21', 51),
  { kind: 'depth_jump_height', date: '2026-09-21', height_cm: 51 },
  done('trap_bar_jump', '2026-09-21'),
  lift('front_squat', '2026-09-21', 2, 77.5, 3, { load: 77.5, reps: 8, rir: 2 }),
  slot('db_pp_strength', '2026-09-21', 20, 8),
  slot('pull_up', '2026-09-21', 0, 6),
  { kind: 'rdl', slot: 'rdl', date: '2026-09-21', load: 60, sets_done: 3, last_set: { reps: 9, rir: 2 }, override: { from: 100 } },
  done('nordic', '2026-09-21'),
  done('abd_iso', '2026-09-21'),
  { kind: 'session_end', date: '2026-09-21', day: 1 },
  // Thu 24 Sep, Day 2.
  done('kb_swing', '2026-09-24'),
  lift('deadlift', '2026-09-24', 2, 122.5, 3, { load: 122.5, reps: 7, rir: 2 }),
  slot('landmine_press', '2026-09-24', 15, 7),
  slot('cs_row', '2026-09-24', 30, 11),
  slot('abductor_hsr', '2026-09-24', 15, 9),
  slot('bss', '2026-09-24', 16, 9, 3),
  slot('hack_squat', '2026-09-24', 40, 9),
  { kind: 'session_end', date: '2026-09-24', day: 2 },
  // Tue 29 Sep, Day 1, with a 0-rep Romanian deadlift.
  { kind: 'cmj', date: '2026-09-29', value: 47 },
  done('depth_jump', '2026-09-29'),
  done('trap_bar_jump', '2026-09-29'),
  lift('front_squat', '2026-09-29', 3, 82.5, 2, { load: 82.5, reps: 8, rir: 2 }),
  slot('db_pp_strength', '2026-09-29', 20, 8),
  slot('pull_up', '2026-09-29', 0, 8),
  { kind: 'rdl', slot: 'rdl', date: '2026-09-29', load: 62.5, sets_done: 3, last_set: { reps: 0, rir: 2 } },
  done('nordic', '2026-09-29'),
  { kind: 'session_end', date: '2026-09-29', day: 1 },
  // Fri 2 Oct and Sat 3 Oct: one Day 2 split over two dates, never finished.
  done('kb_swing', '2026-10-02'),
  lift('deadlift', '2026-10-02', 3, 130, 2, { load: 130, reps: 5, rir: 2 }),
  slot('landmine_press', '2026-10-02', 15, 8),
  slot('cs_row', '2026-10-02', 30, 12),
  slot('abductor_hsr', '2026-10-03', 15, 10),
  slot('bss', '2026-10-03', 16, 10, 3),
  // Tue 6 Oct, Day 1: light week taken past 4 reps at a raised load.
  { kind: 'cmj', date: '2026-10-06', value: 46.5 },
  lift('front_squat', '2026-10-06', 1, 77.5, 4, { load: 80, reps: 8, rir: 1 }),
  slot('db_pp_strength', '2026-10-06', 22, 6),
  slot('pull_up', '2026-10-06', 2.5, 6),
  { kind: 'rdl', slot: 'rdl', date: '2026-10-06', load: 57.5, sets_done: 3, last_set: { reps: 8, rir: 2 } },
  { kind: 'session_end', date: '2026-10-06', day: 1 },
  // Thu 8 Oct, Day 2: two items logged.
  done('kb_swing', '2026-10-08'),
  lift('deadlift', '2026-10-08', 1, 115, 4, { load: 117.5, reps: 8, rir: 2 }),
  { kind: 'session_end', date: '2026-10-08', day: 2 },
];

export function athleteShapedState(): State {
  let s = structuredClone(INITIAL_STATE);
  for (const l of ATHLETE_SHAPED_LOGS) s = update(s, l, PROGRAMME_CONFIG).state;
  return s;
}
