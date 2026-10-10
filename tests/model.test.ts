/**
 * Interface view model (ui_spec_v1_3.md). Synthetic logs only.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import { amend, planSnapshot, prescribe, update } from '../src/engine';
import type { AnyLog, Session } from '../src/engine';
import type { State } from '../src/config/types';
import { buildHistory, dayFor, didText, lastLogged, outcomeLine, plannedText, recordFor, stateDiff } from '../src/ui/model';

function fs(date: string, position: 1 | 2 | 3, load: number, reps: number, rir: number, presc: number, extra: Record<string, unknown> = {}): AnyLog {
  return { kind: 'barbell', lift: 'front_squat', date, mode: 'wave', position, prescribed: { load, reps: presc, sets: 3 }, last_set: { load, reps, rir }, missed: false, ...extra } as AnyLog;
}
function apply(logs: AnyLog[], from: State = INITIAL_STATE): State {
  let s = structuredClone(from);
  for (const l of logs) s = update(s, l, cfg).state;
  return s;
}

// Shape of the athlete's weeks 2 to 4, with different numbers.
const LOGS: AnyLog[] = [
  { kind: 'cmj', date: '2026-09-21', value: 47 },
  fs('2026-09-21', 2, 77.5, 8, 2, 3),
  { kind: 'rdl', slot: 'rdl', date: '2026-09-21', load: 60, sets_done: 3, last_set: { reps: 9, rir: 2 }, override: { from: 100 } },
  { kind: 'session_end', date: '2026-09-21', day: 1 },
  fs('2026-09-28', 3, 82.5, 5, 2, 2),
  { kind: 'rdl', slot: 'rdl', date: '2026-09-28', load: 62.5, sets_done: 3, last_set: { reps: 0, rir: 2 } },
  { kind: 'session_end', date: '2026-09-28', day: 1 },
  fs('2026-10-05', 1, 80, 7, 1, 4, { override: { from: 75 } }),
  { kind: 'slot', slot: 'pull_up', date: '2026-10-05', load: 0, sets_done: 3, last_set: { reps: 8, rir: 2 } },
];

describe('record of a past date (ui_spec §4.2, Q17)', () => {
  const state = apply(LOGS);
  const h = buildHistory(INITIAL_STATE, state, cfg);

  it('replays to the stored state', () => expect(h.ok).toBe(true));

  it("shows the plan the day was prescribed from, not the next session's", () => {
    const r = recordFor(h, INITIAL_STATE, state, cfg, '2026-10-05');
    expect(r.day).toBe(1);
    expect(r.source).toBe('rebuilt');
    const row = r.rows.find((x) => x.item.slot === 'front_squat')!;
    expect(row.item).toMatchObject({ position: 1, load: 75, sets: 3, reps: 4 });
    expect(plannedText(row.item)).toBe('Light week · 75 kg · 3 × 4');
    expect(row.status).toBe('done');
    expect(didText(row.step!.item.log, cfg)).toBe('80 kg · last set 7, 1 left');
    // 7 reps against 4 prescribed: more than 2 over, so the light-week line is added (ui_spec §14.7).
    expect(outcomeLine(row.step!, cfg)).toBe("Light week: max unchanged at 93.0 kg. Light weeks are for recovery; extra reps here don't count towards your max.");
    // The next Day 1 is a medium week; never shown under 5 Oct.
    const next = prescribe(state, cfg, '2026-10-12', 1) as Session;
    const p = planSnapshot(next, cfg).items.find((i) => i.slot === 'front_squat')!;
    expect(p).toMatchObject({ position: 2, reps: 3 });
  });

  it('marks items not logged and counts them', () => {
    const r = recordFor(h, INITIAL_STATE, state, cfg, '2026-10-05');
    expect(r.rows.find((x) => x.item.slot === 'rdl')!.status).toBe('not_logged');
    expect(r.rows.find((x) => x.item.slot === 'cmj')!.status).toBe('not_logged');
    expect(r.counts.done).toBe(2);
    expect(r.counts.planned).toBeGreaterThan(5);
  });

  it('a date with nothing logged has no day and no rows', () => {
    const r = recordFor(h, INITIAL_STATE, state, cfg, '2026-10-01');
    expect(r.day).toBeUndefined();
    expect(r.rows).toHaveLength(0);
  });

  it('a correction to a skip reads as skipped everywhere and restores the load', () => {
    const idx = (state.log as { log: AnyLog }[]).findIndex((e) => e.log.kind === 'rdl' && e.log.date === '2026-09-28');
    const a = amend(INITIAL_STATE, state, { kind: 'correction', date: '2026-10-09', on: '2026-09-28', actions: [{ op: 'replace', target: idx, entry: { kind: 'skip', slot: 'rdl', date: '2026-09-28', reason: 'time' } }] }, cfg);
    expect(stateDiff(state, a.state, cfg, '2026-10-12')).toContain('Romanian deadlift next load 57.5 → 62.5 kg');
    const h2 = buildHistory(INITIAL_STATE, a.state, cfg);
    const row = recordFor(h2, INITIAL_STATE, a.state, cfg, '2026-09-28').rows.find((x) => x.item.slot === 'rdl')!;
    expect(row.status).toBe('skipped');
    expect(row.step!.item.corrections).toHaveLength(1);
    expect(didText(row.step!.item.log, cfg)).toBe('Skipped · Time');
  });
});

describe('outcome lines (ui_spec §12)', () => {
  it('says what a rep-out did to the max', () => {
    const state = apply(LOGS.slice(0, 2));
    const h = buildHistory(INITIAL_STATE, state, cfg);
    const step = h.byDate.get('2026-09-21')!.find((s) => s.item.log.kind === 'barbell')!;
    expect(outcomeLine(step, cfg)).toBe('Max 92.0 → 93.0 kg (+1.0).');
  });
  it('accessory streak toward the next load', () => {
    const state = apply([{ kind: 'slot', slot: 'pull_up', date: '2026-09-21', load: 0, sets_done: 3, last_set: { reps: 7, rir: 2 } }]);
    const h = buildHistory(INITIAL_STATE, state, cfg);
    expect(outcomeLine(h.steps[0]!, cfg)).toBe('Load set at 0 kg. 1 of 2 towards 2.5 kg.');
  });
});

describe('day and last time (ui_spec §4)', () => {
  it('day from the logged lift', () => {
    const h = buildHistory(INITIAL_STATE, apply(LOGS), cfg);
    expect(dayFor(h.byDate.get('2026-09-28')!, '2026-09-28', cfg)).toBe(1);
  });
  it('last like-for-like session for a lift', () => {
    const h = buildHistory(INITIAL_STATE, apply(LOGS), cfg);
    const last = lastLogged(h, 'front_squat', '2026-10-12', 2);
    expect(last?.item.log.date).toBe('2026-09-21');
  });
});

describe('release 2 helpers (ui_spec §14)', () => {
  it('a check-in is due one or two days after a session, once', async () => {
    const { checkInDue } = await import('../src/ui/model');
    const s = apply([fs('2026-09-21', 2, 77.5, 8, 2, 3)]);
    const h = buildHistory(INITIAL_STATE, s, cfg);
    expect(checkInDue(h, '2026-09-21')).toBeUndefined();
    expect(checkInDue(h, '2026-09-22')).toBe('2026-09-21');
    expect(checkInDue(h, '2026-09-23')).toBe('2026-09-21');
    expect(checkInDue(h, '2026-09-24')).toBeUndefined();
    const done = apply([{ kind: 'tissue_check', date: '2026-09-22', for_date: '2026-09-21', scores: { patellar: 0, gluteal: 2, shoulder: 0 } }], s);
    const h2 = buildHistory(INITIAL_STATE, done, cfg);
    expect(checkInDue(h2, '2026-09-22')).toBeUndefined();
  });
  it('tags the items that load a sore site', async () => {
    const { tissueTags } = await import('../src/ui/model');
    const s = apply([fs('2026-09-21', 2, 77.5, 8, 2, 3), { kind: 'tissue_check', date: '2026-09-22', for_date: '2026-09-21', scores: { patellar: 0, gluteal: 2, shoulder: 4 } }]);
    const h = buildHistory(INITIAL_STATE, s, cfg);
    expect(tissueTags(h, '2026-09-23', 'rdl', cfg)).toEqual(['Gluteal 2/10 yesterday']);
    expect(tissueTags(h, '2026-09-23', 'pull_up', cfg)).toEqual([]);
    expect(tissueTags(h, '2026-09-26', 'rdl', cfg)).toEqual([]);
  });
  it('clock text', async () => {
    const { clockText } = await import('../src/ui/model');
    expect(clockText(65_000)).toBe('1:05');
    expect(clockText(3_723_000)).toBe('1:02:03');
  });
});
