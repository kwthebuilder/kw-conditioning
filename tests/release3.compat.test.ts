/**
 * Programme config v1.6 against what is already on the phone: existing
 * exported logs and state (schema 1) import unchanged and replay to the same
 * derived numbers for every existing slot; sessions dated before 19 Oct keep
 * the plans they were shown; the interface's new lines (ui_spec_v1_4.md).
 * Synthetic data only.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../e2e/fixtures/athlete-shaped.json';
import configV15 from '../spec/programme_config_v1_5.json';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import type { State } from '../src/config/types';
import { parseProgrammeConfig, parseState } from '../src/config/validate';
import { amend, defaultDay, derivedEqual, planSnapshot, prescribe, replay, replayMatches, update } from '../src/engine';
import type { AnyLog, Session } from '../src/engine';
import { exportMarkdown, importMarkdown } from '../src/storage';
import { buildHistory, didText, lightWeekText, minutesText, outcomeLine, plannedText, recordOf, sessionCheckDue, sessionsFrom } from '../src/ui/model';
import { ATHLETE_SHAPED_LOGS, athleteShapedState } from './fixtures/athleteShaped';

const v15 = parseProgrammeConfig(configV15 as unknown);
const ATHLETE = athleteShapedState();

function apply(logs: AnyLog[], from: State = INITIAL_STATE, config = cfg): State {
  let s = structuredClone(from);
  for (const l of logs) s = update(s, l, config).state;
  return s;
}

describe('existing state and logs under config v1.6', () => {
  it('the stored fixture (schema 1) parses unchanged', () => {
    expect(parseState(fixture as unknown)).toEqual(ATHLETE);
    expect(ATHLETE.schema).toBe(1);
  });

  it('replays to exactly the numbers config v1.5 gave, for every existing slot', () => {
    const before = apply(ATHLETE_SHAPED_LOGS, INITIAL_STATE, v15);
    const after = apply(ATHLETE_SHAPED_LOGS, INITIAL_STATE, cfg);
    expect(derivedEqual(before, after)).toBe(true);
    expect(replayMatches(INITIAL_STATE, before, cfg)).toBe(true);
    expect({ ...replay(INITIAL_STATE, before.log, cfg).state, log: [] }).toEqual({ ...before, log: [] });
  });

  it('every entry keeps its explanation: the same summaries under both configs', () => {
    const a = replay(INITIAL_STATE, ATHLETE.log, v15).steps.map((s) => s.explanation.summary);
    const b = replay(INITIAL_STATE, ATHLETE.log, cfg).steps.map((s) => s.explanation.summary);
    expect(b).toEqual(a);
  });

  it('an export made before v1.6 imports unchanged and corrections still save', () => {
    const md = exportMarkdown(ATHLETE, v15, '2026-10-10').markdown;
    const r = importMarkdown(md);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toEqual(ATHLETE);
    const idx = (r.state.log as { log: AnyLog }[]).findIndex((e) => e.log.kind === 'rdl' && e.log.date === '2026-09-29');
    const a = amend(INITIAL_STATE, r.state, { kind: 'correction', date: '2026-10-19', on: '2026-09-29', actions: [{ op: 'replace', target: idx, entry: { kind: 'skip', slot: 'rdl', date: '2026-09-29' } }] }, cfg);
    expect(replayMatches(INITIAL_STATE, a.state, cfg)).toBe(true);
  });

  it('the two new state fields (swap date, block-entry date) survive export, import and the device store exactly', () => {
    const s = apply([
      { kind: 'swap', slot: 'front_squat', date: '2026-10-19', to: 'Belt squat' },
      { kind: 'single', lift: 'deadlift', date: '2026-11-12', load: 160, rir: 2 },
    ], ATHLETE);
    expect(s.swapped_main).toEqual({ front_squat: '2026-10-19' });
    expect(s.lifts.deadlift.entered_on).toBe('2026-11-12');
    const r = importMarkdown(exportMarkdown(s, cfg, '2026-11-12').markdown);
    expect(r.ok && r.state).toEqual(s);
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(replayMatches(INITIAL_STATE, s, cfg)).toBe(true);
  });

  it('a Block 1 log never writes the block-entry date, so older states keep their shape', () => {
    for (const lift of ['front_squat', 'deadlift'] as const) expect(ATHLETE.lifts[lift].entered_on).toBeUndefined();
  });
});

describe('sessions dated before 19 Oct keep the plans they were shown (engine A.37)', () => {
  const h = buildHistory(INITIAL_STATE, ATHLETE, cfg);
  const groups = sessionsFrom(h, cfg);

  it('a rebuilt plan for 6 Oct is the v1.5 Block 1 Day 1, unchanged', () => {
    const g = groups.find((x) => x.date === '2026-10-06')!;
    const r = recordOf(h, INITIAL_STATE, ATHLETE, cfg, g);
    expect(r.source).toBe('rebuilt');
    const old = recordOf(buildHistory(INITIAL_STATE, ATHLETE, v15), INITIAL_STATE, ATHLETE, v15, g);
    expect(r.plan).toEqual(old.plan);
    expect(r.plan!.items.map((i) => i.slot)).toContain('nordic');
    expect(r.counts).toEqual(old.counts);
  });

  it('the 8 Oct row still reads "Day 2 · 2 done · 6 not recorded"', () => {
    const g = groups.find((x) => x.date === '2026-10-08')!;
    const r = recordOf(h, INITIAL_STATE, ATHLETE, cfg, g);
    expect(r.counts).toMatchObject({ done: 2, notRecorded: 6 });
  });

  it('from 19 Oct the new Block 1 template applies', () => {
    const s = prescribe(ATHLETE, cfg, '2026-10-19', 1) as Session;
    expect(s.blocks.flatMap((b) => b.items).map((i) => (i.kind === 'slot' ? i.slot : i.name))).toEqual(['warmup_glute_shoulder', 'depth_jump', 'trap_bar_jump', 'front_squat', 'db_rdl', 'db_pp_strength', 'pull_up']);
    const before = prescribe(ATHLETE, cfg, '2026-10-18', 1) as Session;
    expect(before.target_min).toBe(72);
  });
});

describe('the session-start tendon question (engine A.36, ui_spec_v1_4.md §20)', () => {
  it('is due for a session date until a check-in for that date is logged', () => {
    const date = '2026-10-19';
    const h0 = buildHistory(INITIAL_STATE, ATHLETE, cfg);
    expect(sessionCheckDue(h0, date)).toBe(true);
    const s = apply([{ kind: 'tissue_check', date, for_date: date, above_3: false, scores: {} }], ATHLETE);
    expect(sessionCheckDue(buildHistory(INITIAL_STATE, s, cfg), date)).toBe(false);
    expect(derivedEqual(s, ATHLETE)).toBe(true);
  });

  it('reads in plain words', () => {
    const s = apply([{ kind: 'tissue_check', date: '2026-10-19', for_date: '2026-10-19', above_3: false, scores: {} }], ATHLETE);
    const step = buildHistory(INITIAL_STATE, s, cfg).steps.at(-1)!;
    expect(didText(step.item.log, cfg)).toBe('No tendon pain above 3/10');
    expect(step.explanation.summary).toBe('Tissue check for 2026-10-19: no tendon pain above 3/10 in the last 48 hours.');
  });
});

describe('interface lines (ui_spec_v1_4.md)', () => {
  it('the light-week line, from the config', () => {
    expect(lightWeekText(cfg, 3, 4)).toBe('Light week: 3 sets of 4 at this load. Stop at 4, even if you have more.');
    expect(lightWeekText(v15, 3, 4)).toBe("3 × 4 and stop. Light weeks don't change your max.");
  });

  it('target minutes, with the 80-minute ceiling', () => {
    for (const [date, day, text] of [
      ['2026-10-19', 1, 'about 70 min, 80 max'],
      ['2026-10-22', 2, 'about 63 min, 80 max'],
      ['2026-11-16', 1, 'about 72 min, 80 max'],
      ['2026-11-19', 2, 'about 71 min, 80 max'], // config v1.11: Block 2 Day 2 rebuilt to fit (rationale v3.8)
      ['2026-12-28', 1, 'about 68 min, 80 max'], // config v1.9: the push press stays in Blocks 3 and 4
      ['2026-12-31', 2, 'about 66 min, 80 max'],
      ['2027-03-04', 1, 'about 40 min, 80 max'],
    ] as const) {
      const s = prescribe(INITIAL_STATE, cfg, date, day) as Session;
      expect(minutesText(cfg, s.target_min, s.audit_trims), date).toBe(text);
    }
  });

  it('a swap reads "Swapped to …", nothing moves, and a swapped main lift says the other day comes next', () => {
    const s = apply([
      { kind: 'swap', slot: 'pull_up', date: '2026-10-19', to: 'Chest-supported row', load: 30, sets_done: 3, last_set: { reps: 10, rir: 2 } },
      { kind: 'swap', slot: 'front_squat', date: '2026-10-19', to: 'Belt squat' },
    ], ATHLETE);
    const steps = buildHistory(INITIAL_STATE, s, cfg).steps.slice(-2);
    expect(didText(steps[0]!.item.log, cfg)).toBe('Swapped to Chest-supported row · 30 kg · 3 sets · last set 10, 2 left');
    expect(outcomeLine(steps[0]!, cfg)).toBe('Nothing moves.');
    expect(outcomeLine(steps[1]!, cfg)).toBe("Nothing moves. It counts as today's main lift, so the other day comes next.");
    expect(defaultDay(s)).toBe(2);
    const md = exportMarkdown(s, cfg, '2026-10-19').markdown;
    expect(md).toContain('- 2026-10-19 Weighted pull-up: swapped to Chest-supported row, 3 sets, last set 30.0 × 10 @ RIR 2');
    expect(md).toContain('- 2026-10-19 Front squat: swapped to Belt squat');
  });

  it('a swap on a past session is part of its record and counts as done, marked swapped', () => {
    const date = '2026-10-19';
    const plan = planSnapshot(prescribe(ATHLETE, cfg, date, 1) as Session, cfg);
    const s = apply([{ kind: 'session_start', date, day: 1, plan }, { kind: 'swap', slot: 'pull_up', date, to: 'Chest-supported row' }], ATHLETE);
    const h = buildHistory(INITIAL_STATE, s, cfg);
    const g = sessionsFrom(h, cfg).at(-1)!;
    const row = recordOf(h, INITIAL_STATE, s, cfg, g).rows.find((r) => r.item.slot === 'pull_up')!;
    expect(row).toMatchObject({ status: 'done', swapped: true });
  });

  it('the phase-start test plans as one line and records its numbers', () => {
    const s = prescribe(INITIAL_STATE, cfg, '2026-11-09', 1) as Session;
    const pt = planSnapshot(s, cfg).items.find((i) => i.slot === 'phase_test')!;
    expect(plannedText(pt)).toBe('Film 3 depth jumps and 1 trap-bar jump set');
    const after = apply([{ kind: 'phase_test', date: '2026-11-09', rsi: 2.14, trap_bar_cm: 41.5 }]);
    const step = buildHistory(INITIAL_STATE, after, cfg).steps.at(-1)!;
    expect(didText(step.item.log, cfg)).toBe('Reactive strength index 2.14 · trap-bar jump 41.5 cm');
    expect(outcomeLine(step, cfg)).toBe('Recorded. Nothing moves.');
    expect(exportMarkdown(after, cfg, '2026-11-09').markdown).toContain('- 2026-11-09 Phase-start test: best reactive strength index 2.14, best trap-bar jump 41.5 cm');
  });
});
