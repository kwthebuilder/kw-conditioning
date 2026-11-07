/**
 * Release 3.1 interface rules (ui_spec_v1_5.md §23 to §25), synthetic data only:
 * the Plan card reads each lift's next session in its own block's terms, the
 * finished session's length comes from the athlete, and the backup log reads
 * as corrected.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import type { State } from '../src/config/types';
import { amend, update } from '../src/engine';
import type { AnyLog } from '../src/engine';
import { exportMarkdown } from '../src/storage';
import { buildHistory, planLiftText, recordOf, sessionsFrom } from '../src/ui/model';

function apply(logs: AnyLog[], from: State = INITIAL_STATE): State {
  let s = structuredClone(from);
  for (const l of logs) s = update(s, l, cfg).state;
  return s;
}
const logSection = (md: string): string => md.split('## Log')[1]!.split(/## (Corrections|State)/)[0]!;

describe('§23 the Plan card line for each lift', () => {
  it('reads the wave in Block 1', () => {
    expect(planLiftText(INITIAL_STATE, 'front_squat', cfg, '2026-10-20')).toMatch(/^(test single, then )?(light|medium|heavy) week \d+(\.5)? kg$/);
  });
  it('reads the test single and the doubles on entering Block 2, never "heavy week"', () => {
    const t = planLiftText(INITIAL_STATE, 'front_squat', cfg, '2026-11-09');
    expect(t).toMatch(/^test single, then 3 to 4 × 2 at \d+(\.5)? kg$/);
    expect(t).not.toMatch(/week/);
  });
  it('reads 2 × 2 in Blocks 3 and 4, and 1 × 2 in the taper', () => {
    expect(planLiftText(INITIAL_STATE, 'deadlift', cfg, '2027-01-05')).toMatch(/2 × 2 at \d+(\.5)? kg$/);
    expect(planLiftText(INITIAL_STATE, 'deadlift', cfg, '2027-03-02')).toMatch(/^1 × 2 at \d+(\.5)? kg$/);
  });
});

describe('§24 session length from the athlete', () => {
  it('the record shows the saved length, not the logging clock', () => {
    const s = apply([
      { kind: 'slot', slot: 'bss', date: '2026-11-12', load: 16, sets_done: 3, last_set: { reps: 8, rir: 2 } },
      { kind: 'session_end', date: '2026-11-12', day: 2, minutes: 415 },
      { kind: 'session_length', date: '2026-11-12', day: 2, minutes: 74 },
    ]);
    const h = buildHistory(INITIAL_STATE, s, cfg);
    const g = sessionsFrom(h, cfg).find((x) => x.date === '2026-11-12')!;
    const r = recordOf(h, INITIAL_STATE, s, cfg, g);
    expect(r.minutes).toBe(74);
    expect(r.extras.some((x) => x.item.log.kind === 'session_length')).toBe(false);
  });
});

describe('§25 the backup log reads as corrected', () => {
  const base = apply([
    { kind: 'slot', slot: 'pull_up', date: '2026-11-09', load: 2.5, sets_done: 3, last_set: { reps: 5, rir: 2 } },
    { kind: 'slot', slot: 'cs_row', date: '2026-11-12', load: 28, sets_done: 3, last_set: { reps: 10, rir: 2 } },
  ]);
  const replaced = amend(INITIAL_STATE, base, { kind: 'correction', date: '2026-11-13', on: '2026-11-09', actions: [{ op: 'replace', target: 0, entry: { kind: 'slot', slot: 'pull_up', date: '2026-11-09', load: 2.5, sets_done: 3, last_set: { reps: 5, rir: 3 } } }] }, cfg).state;
  const added = amend(INITIAL_STATE, replaced, { kind: 'correction', date: '2026-11-14', on: '2026-11-09', actions: [{ op: 'insert', entry: { kind: 'fixed', slot: 'skater_bound', date: '2026-11-09', done: true } }] }, cfg).state;
  const removed = amend(INITIAL_STATE, added, { kind: 'correction', date: '2026-11-15', on: '2026-11-12', actions: [{ op: 'remove', target: 1 }] }, cfg).state;
  const md = exportMarkdown(removed, cfg, '2026-11-15').markdown;
  const log = logSection(md);

  it('shows the corrected numbers and what they were', () => {
    expect(log).toMatch(/2026-11-09 Weighted pull-up: 3 sets, last set 2\.5 × 5 @ RIR 3 \(corrected 2026-11-13; was: Weighted pull-up: 3 sets, last set 2\.5 × 5 @ RIR 2\)/);
  });
  it('lists an added entry under its own date', () => {
    expect(log).toMatch(/2026-11-09 Skater bound: done \(added 2026-11-14\)/);
  });
  it('leaves a removed entry out of the log, while the Corrections list keeps it', () => {
    expect(log).not.toMatch(/Chest-supported row/);
    expect(md.split('## Corrections')[1]).toMatch(/removed 2026-11-12 Chest-supported row/);
  });
  it('keeps the state block exact', () => {
    expect(md).toContain(JSON.stringify(removed, null, 1));
  });
});
