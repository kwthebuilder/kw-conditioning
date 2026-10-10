/**
 * Release 1.1, the date-free patch (ui_spec_v1_3.md §13A): sessions,
 * History by programme week, open sessions and Carry on, added and
 * removed sessions. Synthetic logs only.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import type { State } from '../src/config/types';
import { amend, defaultDay, derivedEqual, planSnapshot, prescribe, replayMatches, update } from '../src/engine';
import type { AnyLog, CorrectionAction, Session } from '../src/engine';
import {
  buildHistory,
  countsText,
  didText,
  historyLineText,
  historyLines,
  isOpen,
  lastSessionOfDay,
  loadRange,
  openSession,
  plannedText,
  rangeText,
  recordOf,
  sessionRemoval,
  sessionsFrom,
  stateAtInsert,
  stateDiff,
  type SessionGroup,
} from '../src/ui/model';
import { athleteShapedState } from './fixtures/athleteShaped';

function apply(logs: AnyLog[], from: State = INITIAL_STATE): State {
  let s = structuredClone(from);
  for (const l of logs) s = update(s, l, cfg).state;
  return s;
}
function groupsOf(state: State): SessionGroup[] {
  return sessionsFrom(buildHistory(INITIAL_STATE, state, cfg), cfg);
}
function startLog(state: State, date: string, day: 1 | 2, at?: string): AnyLog {
  const sess = prescribe(state, cfg, date, day) as Session;
  return { kind: 'session_start', date, day, ...(at ? { at } : {}), plan: planSnapshot(sess, cfg) };
}
const ATHLETE = athleteShapedState();

describe('sessions and History (§11, test 2)', () => {
  const h = buildHistory(INITIAL_STATE, ATHLETE, cfg);
  const groups = sessionsFrom(h, cfg);

  it('one session per day trained, with its day', () => {
    expect(groups.map((g) => `${g.date} D${g.day}`)).toEqual(['2026-09-21 D1', '2026-09-24 D2', '2026-09-29 D1', '2026-10-02 D2', '2026-10-03 D2', '2026-10-06 D1', '2026-10-08 D2']);
  });

  it('History on 10 Oct: weeks 4, 3 and 2 with 2, 3 and 2 sessions', () => {
    const { lines, more } = historyLines(groups, cfg, '2026-10-10', 4);
    expect(lines.map((l) => historyLineText(l))).toEqual([
      { left: 'Week 4 · 5 to 11 Oct', right: '2 sessions' },
      { left: 'Week 3 · 28 Sep to 4 Oct', right: '3 sessions' },
      { left: 'Week 2 · 21 to 27 Sep', right: '2 sessions' },
    ]);
    expect(more).toBe(false);
    // Newest first inside a week.
    const w4 = lines[0]!;
    expect(w4.kind === 'week' && w4.sessions.map((g) => g.date)).toEqual(['2026-10-08', '2026-10-06']);
  });

  it('the 8 Oct row reads "Day 2 · 2 done · 6 not recorded"', () => {
    const g = groups.find((x) => x.date === '2026-10-08')!;
    const r = recordOf(h, INITIAL_STATE, ATHLETE, cfg, g);
    expect(`Day ${r.day} · ${countsText(r.counts)}`).toBe('Day 2 · 2 done · 6 not recorded');
  });

  it('on every row, done, skipped and not recorded add up to the planned items', () => {
    for (const g of groups) {
      const r = recordOf(h, INITIAL_STATE, ATHLETE, cfg, g);
      expect(r.counts.done + r.counts.skipped + r.counts.notRecorded).toBe(r.counts.planned);
      expect(countsText(r.counts)).not.toMatch(/\b0 /);
    }
  });

  it('release 1 counted skips apart from "logged": 7 done, 2 skipped, 1 not recorded', () => {
    expect(countsText({ planned: 10, done: 7, skipped: 2, notRecorded: 1 })).toBe('7 done · 2 skipped · 1 not recorded');
    expect(countsText({ planned: 8, done: 2, skipped: 0, notRecorded: 6 })).toBe('2 done · 6 not recorded');
  });

  it('the 6 Oct record passes release 1 test 1', () => {
    const g = groups.find((x) => x.date === '2026-10-06')!;
    const r = recordOf(h, INITIAL_STATE, ATHLETE, cfg, g);
    expect(r.source).toBe('rebuilt');
    const row = r.rows.find((x) => x.item.slot === 'front_squat')!;
    expect(plannedText(row.item)).toBe('Light week · 77.5 kg · 3 × 4');
    expect(didText(row.step!.item.log, cfg)).toBe('80 kg · last set 8, 1 left');
  });

  it('Q27: on 21 Sep (rebuilt plan, no ladder) the ladder entry counts as the drop jump', () => {
    const g = groups.find((x) => x.date === '2026-09-21')!;
    const r = recordOf(h, INITIAL_STATE, ATHLETE, cfg, g);
    expect(r.source).toBe('rebuilt');
    expect(r.plan!.items.map((i) => i.slot)).toContain('depth_jump');
    const row = r.rows.find((x) => x.item.slot === 'depth_jump')!;
    expect(row.status).toBe('done');
    expect(row.viaLadder).toBe(true);
    expect(r.extras.map((s) => s.item.log.kind)).toEqual(['depth_jump_height']);
    expect(countsText(r.counts)).toBe('9 done · 1 not recorded');
  });

  it('Q27 applies only to rebuilt plans', () => {
    const date = '2026-10-12';
    const s = apply([startLog(ATHLETE, date, 1, '2026-10-12T10:00:00Z'), { kind: 'fixed', slot: 'rsi_ladder', date, done: true, value: 51 }], ATHLETE);
    const hh = buildHistory(INITIAL_STATE, s, cfg);
    const g = sessionsFrom(hh, cfg).at(-1)!;
    const r = recordOf(hh, INITIAL_STATE, s, cfg, g);
    expect(r.source).toBe('snapshot');
    expect(r.rows.find((x) => x.item.slot === 'depth_jump')!.status).toBe('not_logged');
  });
});

describe('weeks without sessions fold (§11, test 15)', () => {
  const groups = groupsOf(ATHLETE);
  it('empty weeks between sessions fold; the current week reads "no sessions yet"', () => {
    const s = apply([{ kind: 'cmj', date: '2026-11-03', value: 45 }, { kind: 'fixed', slot: 'depth_jump', date: '2026-11-03', done: true }], ATHLETE);
    const { lines } = historyLines(groupsOf(s), cfg, '2026-11-12');
    expect(lines.map((l) => historyLineText(l).left)).toEqual([
      'Week 9 · no sessions yet',
      'Week 8 · 2 to 8 Nov',
      'Weeks 5 to 7 · no sessions',
      'Week 4 · 5 to 11 Oct',
      'Week 3 · 28 Sep to 4 Oct',
      'Week 2 · 21 to 27 Sep',
    ]);
  });
  it('the four most recent weeks, then earlier weeks on request', () => {
    const { lines, more } = historyLines(groups, cfg, '2026-10-26', 4);
    expect(lines.map((l) => historyLineText(l).left)).toEqual(['Week 7 · no sessions yet', 'Weeks 5 to 6 · no sessions', 'Week 4 · 5 to 11 Oct']);
    expect(more).toBe(true);
  });
  it('a single empty week', () => {
    const s = apply([{ kind: 'cmj', date: '2026-10-19', value: 45 }], ATHLETE);
    const { lines } = historyLines(groupsOf(s), cfg, '2026-10-19');
    expect(lines.map((l) => historyLineText(l).left).slice(0, 2)).toEqual(['Week 6 · 19 to 25 Oct', 'Week 5 · no sessions']);
  });
});

describe('open sessions (§9, tests 6, 7 and 13)', () => {
  const D = '2026-10-15';
  const started = apply([startLog(ATHLETE, D, 2, '2026-10-15T11:05:00Z'), { kind: 'fixed', slot: 'kb_swing', date: D, done: true }], ATHLETE);

  it('open on D and D + 1, not on D + 2', () => {
    const g = groupsOf(started).at(-1)!;
    expect(isOpen(g, D)).toBe(true);
    expect(isOpen(g, '2026-10-16')).toBe(true);
    expect(isOpen(g, '2026-10-17')).toBe(false);
  });

  it('finished, or logged before release 1.1, is never open', () => {
    const ended = apply([{ kind: 'session_end', date: D, day: 2 }], started);
    expect(openSession(groupsOf(ended), '2026-10-16')).toBeUndefined();
    // A session dated before 11 Oct is live on its own day but never open the day after.
    const before = apply([startLog(ATHLETE, '2026-10-10', 1, '2026-10-10T10:00:00Z'), { kind: 'cmj', date: '2026-10-10', value: 44 }], ATHLETE);
    expect(openSession(groupsOf(before), '2026-10-10')?.date).toBe('2026-10-10');
    expect(openSession(groupsOf(before), '2026-10-11')).toBeUndefined();
    // No session from the athlete-shaped log (21 Sep to 8 Oct) is ever open.
    for (const today of ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']) expect(openSession(groupsOf(ATHLETE), today)).toBeUndefined();
  });

  it('Carry on logs entries dated D after something dated D + 1; the session stays one, replay holds', () => {
    // A max set by hand on the morning of D + 1, then the rest of D's session.
    const carried = apply(
      [
        { kind: 'tm_override', date: '2026-10-16', lift: 'front_squat', tm: 99 },
        { kind: 'slot', slot: 'landmine_press', date: D, load: 15, sets_done: 3, last_set: { reps: 8, rir: 2 } },
        { kind: 'skip', slot: 'pallof', date: D },
      ],
      started,
    );
    expect(replayMatches(INITIAL_STATE, carried, cfg)).toBe(true);
    const groups = groupsOf(carried);
    const ofD = groups.filter((g) => g.date === D);
    expect(ofD).toHaveLength(1);
    expect(ofD[0]!.steps.map((s) => s.item.log.kind)).toEqual(['session_start', 'fixed', 'slot', 'skip']);
    // A correction to that session still saves, and removing it keeps the max set by hand.
    const g = ofD[0]!;
    const fixedIdx = g.steps[1]!.item.origin as number;
    const a = amend(INITIAL_STATE, carried, { kind: 'correction', date: '2026-10-16', on: D, actions: [{ op: 'replace', target: fixedIdx, entry: { kind: 'skip', slot: 'kb_swing', date: D } }] }, cfg);
    expect(replayMatches(INITIAL_STATE, a.state, cfg)).toBe(true);
    const rm = amend(INITIAL_STATE, carried, { kind: 'correction', date: '2026-10-16', on: D, actions: sessionRemoval(g) }, cfg);
    expect(groupsOf(rm.state).filter((x) => x.date === D)).toHaveLength(0);
    expect(rm.state.lifts.front_squat.tm).toBe(99);
  });
});

describe('Add a missed session and Remove this session (§11A, §4.3; tests 10 to 12)', () => {
  function addSession(state: State, date: string, day: 1 | 2, entries: AnyLog[]): CorrectionAction[] {
    const at = stateAtInsert(INITIAL_STATE, state.log, cfg, date);
    const plan = planSnapshot(prescribe(at, cfg, date, day) as Session, cfg);
    return [{ op: 'insert', entry: { kind: 'session_start', date, day, plan } }, ...entries.map((entry) => ({ op: 'insert' as const, entry })), { op: 'insert', entry: { kind: 'session_end', date, day } }];
  }

  it('a Day 1 added after a log ending on Day 2: Day 1 pre-selected, the next session moves to Day 2', () => {
    const date = '2026-10-09';
    expect(defaultDay(stateAtInsert(INITIAL_STATE, ATHLETE.log, cfg, date))).toBe(1);
    const actions = addSession(ATHLETE, date, 1, [
      { kind: 'barbell', lift: 'front_squat', date, mode: 'wave', position: 2, prescribed: { load: 82.5, reps: 3, sets: 3 }, last_set: { load: 82.5, reps: 7, rir: 2 }, missed: false },
      { kind: 'skip', slot: 'rdl', date },
    ]);
    const a = amend(INITIAL_STATE, ATHLETE, { kind: 'correction', date: '2026-10-10', on: date, actions }, cfg);
    expect(stateDiff(ATHLETE, a.state, cfg, '2026-10-10')).toContain('Your next session: Day 1 → Day 2');
    expect(defaultDay(a.state)).toBe(2);
    const g = groupsOf(a.state).find((x) => x.date === date)!;
    expect(g.day).toBe(1);
    expect(g.end).toBeDefined();
    expect(isOpen(g, '2026-10-10')).toBe(false);
  });

  it('a separate session on a date that has one stays separate', () => {
    const date = '2026-10-08';
    const actions = addSession(ATHLETE, date, 1, [{ kind: 'cmj', date, value: 44 }]);
    const a = amend(INITIAL_STATE, ATHLETE, { kind: 'correction', date: '2026-10-10', on: date, actions }, cfg);
    const ofDate = groupsOf(a.state).filter((x) => x.date === date);
    expect(ofDate.map((g) => g.day)).toEqual([2, 1]);
    expect(ofDate[1]!.steps.map((s) => s.item.log.kind)).toEqual(['session_start', 'cmj', 'session_end']);
  });

  it('the plan for an added session comes from the log up to where it lands', () => {
    // Adding a Day 2 on 8 Oct after the existing Day 2: the deadlift has moved on to the medium week.
    const at = stateAtInsert(INITIAL_STATE, ATHLETE.log, cfg, '2026-10-08');
    const plan = planSnapshot(prescribe(at, cfg, '2026-10-08', 2) as Session, cfg);
    expect(plan.items.find((i) => i.slot === 'deadlift')!.position).toBe(2);
  });

  it('Remove this session: the session goes and the next session follows the rotation', () => {
    const groups = groupsOf(ATHLETE);
    const g = groups.find((x) => x.date === '2026-10-08')!;
    const a = amend(INITIAL_STATE, ATHLETE, { kind: 'correction', date: '2026-10-10', on: g.date, actions: sessionRemoval(g) }, cfg);
    expect(groupsOf(a.state).map((x) => x.date)).not.toContain('2026-10-08');
    // The front squat (6 Oct) is now later than the deadlift (2 Oct): Day 2 is next.
    expect(defaultDay(a.state)).toBe(2);
    expect(stateDiff(ATHLETE, a.state, cfg, '2026-10-10')).toContain('Your next session: Day 1 → Day 2');
  });

  it('"Your last Day 2 was"', () => {
    expect(lastSessionOfDay(groupsOf(ATHLETE), 2, '2026-10-10')?.date).toBe('2026-10-08');
    expect(lastSessionOfDay(groupsOf(ATHLETE), 1, '2026-10-06')?.date).toBe('2026-09-29');
  });
});

describe('Finish: Skip the rest moves nothing (§10, test 5)', () => {
  it('three skips with no reason leave every number as it was', () => {
    const date = '2026-10-12';
    const live = apply([startLog(ATHLETE, date, 1, '2026-10-12T10:00:00Z'), { kind: 'cmj', date, value: 45 }], ATHLETE);
    const after = apply(['nordic', 'abd_iso', 'y_raise'].map((slot) => ({ kind: 'skip' as const, slot, date })), live);
    expect(derivedEqual(live, after)).toBe(true);
    expect(after.log.slice(-3).map((e) => (e as { log: AnyLog }).log)).toEqual(['nordic', 'abd_iso', 'y_raise'].map((slot) => ({ kind: 'skip', slot, date })));
  });
});

describe('dumbbell range (§5.1, test 18)', () => {
  it('both dumbbell push presses and the Bulgarian split squat run 2 to 40 kg; the row does not', () => {
    for (const s of ['db_pp_strength', 'db_pp_explosive', 'bss']) expect(loadRange(s, cfg)).toEqual([2, 40]);
    for (const s of ['cs_row', 'pull_up', 'rdl', 'front_squat']) expect(loadRange(s, cfg)).toBeUndefined();
    expect(rangeText([2, 40])).toBe('Your dumbbells run 2 to 40 kg.');
  });
});
