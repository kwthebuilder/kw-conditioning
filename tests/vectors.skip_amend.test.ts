/**
 * engine_test_vectors_v1_5.json `skip` (A.26) and `amend` (A.28) blocks.
 * Base for both is initial_state_v1_1.json.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg, TEST_VECTORS as V } from '../src/config/load';
import { amend, effectiveLog, update } from '../src/engine';
import type { AnyLog, CorrectionAction, CorrectionLog } from '../src/engine';
import type { State } from '../src/config/types';
import type { VectorExpect } from '../src/config/types';
import { closeTo } from './helpers';

function run(logs: AnyLog[]): State {
  let s = structuredClone(INITIAL_STATE);
  for (const l of logs) s = update(s, l, cfg).state;
  return s;
}

function check(s: State, e: VectorExpect): void {
  for (const [lift, tm] of Object.entries(e.tm ?? {})) expect(closeTo(s.lifts[lift as 'front_squat'].tm, tm, V.tolerance.tm), `${lift} tm ${s.lifts[lift as 'front_squat'].tm} vs ${tm}`).toBe(true);
  for (const [lift, p] of Object.entries(e.next_position ?? {})) expect(s.lifts[lift as 'front_squat'].next_position).toBe(p);
  for (const [lift, n] of Object.entries(e.sessions_logged ?? {})) expect(s.lifts[lift as 'front_squat'].sessions_logged).toBe(n);
  for (const [lift, b] of Object.entries(e.beta ?? {})) {
    for (const [pos, val] of Object.entries(b)) {
      const got = s.lifts[lift as 'front_squat'].beta[pos as '2'];
      expect(got).not.toBeNull();
      expect(closeTo(got!, val, V.tolerance.beta), `${lift} β${pos} ${got} vs ${val}`).toBe(true);
    }
  }
  if (e.rdl_load !== undefined) expect(s.rdl.load_kg).toBe(e.rdl_load);
  if (e.rdl_sessions !== undefined) expect(s.rdl.sessions_logged).toBe(e.rdl_sessions);
  for (const [slot, a] of Object.entries(e.accessory ?? {})) {
    expect(s.accessories[slot]?.load).toBe(a.load);
    expect(s.accessories[slot]?.streak_up).toBe(a.streak_up);
  }
}

describe('skip vectors (A.26)', () => {
  for (const v of V.skip) {
    it(v.name, () => {
      const s = run(v.steps as unknown as AnyLog[]);
      check(s, v.expect);
      // A skip changes nothing but the log.
      for (const step of v.steps.filter((x) => x.kind === "skip")) {
        const i = v.steps.indexOf(step);
        const before = run(v.steps.slice(0, i) as unknown as AnyLog[]);
        const after = run(v.steps.slice(0, i + 1) as unknown as AnyLog[]);
        expect({ ...after, log: [] }).toEqual({ ...before, log: [] });
      }
    });
  }
});

describe('amend vectors (A.28)', () => {
  for (const v of V.amend) {
    it(v.name, () => {
      let s = run(v.logs as unknown as AnyLog[]);
      if (v.before) check(s, v.before);
      v.corrections.forEach((actions, k) => {
        const c: CorrectionLog = { kind: "correction", date: "2026-10-09", on: "2026-09-29", actions: actions as unknown as CorrectionAction[] };
        s = amend(INITIAL_STATE, s, c, cfg).state;
        expect(s.log.length).toBe(v.logs.length + k + 1);
      });
      check(s, v.expect);
      const eff = effectiveLog(s.log).filter((x) => !x.removed);
      if (v.expect.effective_length !== undefined) expect(eff.length).toBe(v.expect.effective_length);
      if (v.expect.effective_dates !== undefined) expect(eff.map((x) => x.log.date)).toEqual(v.expect.effective_dates);
    });
  }
});
