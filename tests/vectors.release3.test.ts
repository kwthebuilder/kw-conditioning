/**
 * engine_test_vectors_v1_6.json blocks added for programme config v1.6
 * (engine_spec_v1_9.md A.32 to A.37): swaps, the template rep target,
 * first-session loads on the new slots, audit-day trims, the phase-start
 * test, record-only entries, the template of every block, and the slots
 * that leave every template. Base state: initial_state_v1_1.json.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg, TEST_VECTORS as V } from '../src/config/load';
import type { State, StatePatch, VectorExpect } from '../src/config/types';
import { amend, defaultDay, effectiveLog, incrementText, prescribe, update } from '../src/engine';
import type { AnyLog, CorrectionAction, CorrectionLog, Session, SessionSlotItem, SlotLog, SlotPrescription } from '../src/engine';
import { closeTo } from './helpers';

/** Deep-merge a patch into a copy of the initial state. */
export function patched(patch?: StatePatch): State {
  const s = structuredClone(INITIAL_STATE) as unknown as Record<string, unknown>;
  const merge = (into: Record<string, unknown>, from: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(from)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v) && into[k] !== null && typeof into[k] === 'object' && !Array.isArray(into[k])) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
      else into[k] = structuredClone(v);
    }
  };
  if (patch) merge(s, patch);
  return s as unknown as State;
}

function session(state: State, date: string, day: 1 | 2): Session {
  const s = prescribe(state, cfg, date, day);
  if (s.kind !== 'session') throw new Error(`refer: ${s.reason}`);
  return s;
}
const slotItems = (s: Session): SessionSlotItem[] => s.blocks.flatMap((b) => b.items).filter((i): i is SessionSlotItem => i.kind === 'slot');
const order = (s: Session): string[] => s.blocks.flatMap((b) => b.items.map((i) => (i.kind === 'slot' ? i.slot : i.name)));

function run(logs: AnyLog[], from: State = INITIAL_STATE): State[] {
  const out: State[] = [structuredClone(from)];
  for (const l of logs) out.push(update(out[out.length - 1]!, l, cfg).state);
  return out;
}
const noLog = (s: State, drop: string[] = []): Record<string, unknown> => {
  const o = structuredClone({ ...s, log: [] }) as unknown as Record<string, unknown>;
  for (const k of drop) delete o[k];
  return o;
};

function check(s: State, e: VectorExpect & { accessory_unset?: string[] }): void {
  for (const [lift, tm] of Object.entries(e.tm ?? {})) expect(closeTo(s.lifts[lift as 'front_squat'].tm, tm, V.tolerance.tm), `${lift} tm ${s.lifts[lift as 'front_squat'].tm} vs ${tm}`).toBe(true);
  for (const [lift, p] of Object.entries(e.next_position ?? {})) expect(s.lifts[lift as 'front_squat'].next_position, `${lift} next position`).toBe(p);
  for (const [lift, n] of Object.entries(e.sessions_logged ?? {})) expect(s.lifts[lift as 'front_squat'].sessions_logged).toBe(n);
  for (const [lift, d] of Object.entries(e.last_logged ?? {})) expect(s.lifts[lift as 'front_squat'].last_logged).toBe(d);
  for (const [slot, a] of Object.entries(e.accessory ?? {})) {
    expect(s.accessories[slot]?.load).toBe(a.load);
    expect(s.accessories[slot]?.streak_up).toBe(a.streak_up);
  }
  for (const slot of e.accessory_unset ?? []) expect(s.accessories[slot]?.load ?? null).toBeNull();
  if (e.swapped_main !== undefined) expect(s.swapped_main ?? {}).toEqual(e.swapped_main);
  if (e.day !== undefined) expect(defaultDay(s)).toBe(e.day);
}

describe('pinned configs (vectors v1.7 `pinned`)', () => {
  it('names the config each template-dependent block is read against', () => {
    expect(V.pinned).toMatchObject({ golden_sessions: 'programme_config_v1_3.json', 'session.ladder': 'programme_config_v1_5.json', rounds: 'programme_config_v1_5.json', default: 'programme_config_v1_10.json' });
    expect(cfg.version).toBe('1.10');
  });
});

describe('swap vectors (A.32)', () => {
  for (const v of V.swap!) {
    it(v.name, () => {
      const logs = v.logs as unknown as AnyLog[];
      const states = run(logs);
      let s = states[states.length - 1]!;
      const e = v.expect as VectorExpect & { accessory_unset?: string[] };
      if (e.identical_at !== undefined) {
        // The swap changes nothing but the log (and, on a main lift, swapped_main).
        expect(noLog(states[e.identical_at + 1]!, e.identical_apart_from)).toEqual(noLog(states[e.identical_at]!, e.identical_apart_from));
        if (e.explanation) expect(update(states[e.identical_at]!, logs[e.identical_at]!, cfg).explanation.summary).toBe(e.explanation);
      }
      v.corrections.forEach((actions, k) => {
        const c: CorrectionLog = { kind: 'correction', date: '2026-10-30', on: logs[0]!.date, actions: actions as unknown as CorrectionAction[] };
        s = amend(INITIAL_STATE, s, c, cfg).state;
        expect(s.log.length).toBe(logs.length + k + 1);
      });
      check(s, e);
      if (e.effective_length !== undefined) expect(effectiveLog(s.log).filter((x) => !x.removed)).toHaveLength(e.effective_length);
    });
  }
});

/** "+2 kg/hand" → up 2; "-2 kg/hand" → down 2; "hold"; "prompt 'go up one stack plate'". */
function parseExpect(text: string): { direction: 'hold' } | { direction: 'up' | 'down'; kg: number } | { direction: 'prompt'; dir: 'up' | 'down'; text: string } {
  if (/^hold/.test(text)) return { direction: 'hold' };
  const p = /^prompt '(go (up|down) ([^']+))'/.exec(text);
  if (p) return { direction: 'prompt', dir: p[2] as 'up' | 'down', text: p[3]! };
  const m = /^([+-])(\d+(?:\.\d+)?) kg/.exec(text);
  if (!m) throw new Error(`cannot read "${text}"`);
  return { direction: m[1] === '+' ? 'up' : 'down', kg: Number(m[2]) };
}

describe('template rep target vectors (A.33)', () => {
  for (const v of V.rep_override!) {
    it(v.name, () => {
      let state = patched({ accessories: { [v.slot]: { load: v.seed_load, streak_up: 0, streak_down: 0 } } });
      const item = slotItems(session(state, v.date, v.day)).find((i) => i.slot === v.slot)!;
      expect(item, `${v.slot} on ${v.date}`).toBeDefined();
      const p = item.prescription as SlotPrescription;
      expect(p.reps).toBe(v.expect_prescribed.reps);
      expect(p.target_reps ?? null).toBe(v.expect_prescribed.target_reps);
      let last: ReturnType<typeof update> | undefined;
      for (const reps of v.history_last_set_reps) {
        const log: SlotLog = { slot: v.slot, date: v.date, load: state.accessories[v.slot]!.load!, sets_done: 3, last_set: { reps, rir: 2 } };
        if (p.target_reps !== undefined && !v.omit_target) log.target_reps = p.target_reps;
        last = update(state, { kind: 'slot', ...log }, cfg);
        state = last.state;
      }
      const out = last!.outcome as { direction: string; delta_kg?: number; load_after: number | null; pending?: string };
      // The rule the explanation used: up at, down below.
      const text = last!.explanation.steps.map((s) => s.text).join(' ');
      expect(text).toContain(`prescribed ${v.rule.reps}`);
      const want = parseExpect(v.expect);
      if (want.direction === 'hold') {
        expect(out.direction).toBe('hold');
        expect(out.load_after).toBe(v.seed_load);
      } else if (want.direction === 'prompt') {
        expect(out.pending).toBe(want.dir);
        expect(out.load_after).toBe(v.seed_load);
        expect(incrementText({ kind: 'text', text: cfg.slots[v.slot]!.increment! })).toBe(want.text);
      } else {
        expect(out.direction).toBe(want.direction);
        expect(out.delta_kg).toBe(want.direction === 'up' ? want.kg : -want.kg);
      }
      if (want.direction === 'up') expect(text).toContain(`At or above ${v.rule.up_at}`);
      if (want.direction === 'down' || (want.direction === 'prompt' && want.dir === 'down')) expect(text).toContain(`Below ${v.rule.down_below}`);
    });
  }
});

describe('first-session load vectors', () => {
  for (const v of V.first_load!) {
    it(v.name, () => {
      const state = patched(v.state_patch);
      const p = slotItems(session(state, v.date, v.day)).find((i) => i.slot === v.slot)!.prescription as SlotPrescription;
      expect(p.load).toBeNull();
      const after = update(state, { kind: 'slot', slot: v.slot, date: v.date, load: v.load, sets_done: 3, last_set: { reps: v.reps, rir: 2 }, ...(p.target_reps !== undefined ? { target_reps: p.target_reps } : {}) }, cfg).state;
      expect(after.accessories[v.slot]).toEqual({ load: v.expect_load, streak_up: 0, streak_down: 0 });
      const next = slotItems(session(after, v.date, v.day)).find((i) => i.slot === v.slot)!.prescription as SlotPrescription;
      expect(next.load).toBe(v.expect_load);
      // Nothing else moved.
      for (const [id, a] of Object.entries(state.accessories)) if (id !== v.slot) expect(after.accessories[id]).toEqual(a);
    });
  }
});

describe('audit-day trim vectors (A.34)', () => {
  for (const v of V.audit_trims!) {
    it(v.name, () => {
      const s = session(patched(v.state_patch), v.date, v.day);
      expect(s.audit_trims ?? false).toBe(v.audit);
      const items = slotItems(s);
      for (const [slot, sets] of Object.entries(v.expect_sets ?? {})) {
        const it = items.find((i) => i.slot === slot);
        expect(it, `${slot} present`).toBeDefined();
        const got = it!.prescription.kind === 'lift' ? it!.prescription.sets : it!.template.sets;
        expect(got, `${slot} sets`).toBe(sets);
      }
      for (const [slot, max] of Object.entries(v.expect_sets_max ?? {})) {
        const it = items.find((i) => i.slot === slot)!;
        const got = it.prescription.kind === 'lift' ? it.prescription.sets_max : it.template.sets_max;
        expect(got ?? null, `${slot} sets_max`).toBe(max);
      }
    });
  }

  it('the trim records what it cut, and changes no load, rep or rule', () => {
    const trimmed = session(INITIAL_STATE, '2026-11-09', 1);
    const later = session(patched({ lifts: { front_squat: { last_mesocycle: 'M2', entered_on: '2026-11-09' } } }), '2026-11-16', 1);
    const rdl = slotItems(trimmed).find((i) => i.slot === 'db_rdl')!;
    expect(rdl.template).toMatchObject({ sets: 2, trimmed_from: 3, reps: 6 });
    const plain = slotItems(later).find((i) => i.slot === 'db_rdl')!;
    expect(rdl.prescription).toEqual(plain.prescription);
  });
});

describe('phase-start test vectors (A.35)', () => {
  for (const v of V.phase_tests!) {
    it(v.name, () => {
      const s = session(patched(v.state_patch), v.date, v.day);
      const ids = order(s);
      const i = ids.indexOf(cfg.phase_tests!.slot);
      if (v.expect === 'absent') {
        expect(i).toBe(-1);
        return;
      }
      expect(i).toBeGreaterThan(-1);
      expect(ids[i + 1]).toBe(v.expect_before);
      const it = slotItems(s).find((x) => x.slot === 'phase_test')!;
      expect(it.log_kind).toBe('phase_test');
      expect(it.prescription.kind === 'fixed' && it.prescription.text).toBe(cfg.slots.phase_test!.cue);
    });
  }
});

describe('record-only vectors (A.29, A.35, A.36)', () => {
  for (const v of V.record_only!) {
    it(`${v.name}: changes nothing but the log`, () => {
      const before = patched({ lifts: { front_squat: { last_mesocycle: 'M2', entered_on: '2026-11-09' } } });
      const r = update(before, v.log as unknown as AnyLog, cfg);
      expect(noLog(r.state)).toEqual(noLog(before));
      expect(r.state.log).toHaveLength(1);
      expect(r.outcome).toBeNull();
    });
  }
});

describe('template vectors: every block, in order (config v1.6)', () => {
  for (const v of V.templates!) {
    it(v.name, () => {
      const s = session(patched(v.state_patch), v.date, v.day);
      expect(s.target_min).toBe(v.target_min);
      expect(s.pre).toEqual(v.pre);
      expect(order(s)).toEqual(v.order);
      expect(s.blocks.some((b) => b.contrast)).toBe(false);
      for (const [slot, want] of Object.entries(v.items)) {
        const it = slotItems(s).find((i) => i.slot === slot);
        expect(it, `${slot} present`).toBeDefined();
        const p = it!.prescription;
        const t = it!.template;
        const got: Record<string, unknown> = {
          sets: p.kind === 'lift' ? p.sets : t.sets,
          sets_max: p.kind === 'lift' ? p.sets_max : t.sets_max,
          reps: t.reps ?? (p.kind === 'lift' || p.kind === 'slot' ? p.reps : undefined),
          secs: t.secs,
          per_side: t.per_side,
          contacts: p.kind === 'fixed' ? p.contacts : undefined,
          variant: t.variant,
          mode: p.kind === 'lift' ? p.mode : undefined,
          note: t.note,
        };
        for (const [k, val] of Object.entries(want)) expect(got[k], `${slot}.${k}`).toEqual(val);
      }
    });
  }
});

describe('removed slots (config v1.6)', () => {
  const removed = V.removed_slots!.slots;
  it('stay defined in the config, so older logs replay and export', () => {
    for (const id of removed) expect(cfg.slots[id], id).toBeDefined();
  });
  it('appear in no template of config v1.6', () => {
    for (const t of Object.values(cfg.templates)) {
      const days = t.both_days ? [t.both_days] : [t.day1, t.day2];
      for (const d of days) for (const b of d.blocks) for (const it of b.items) if (typeof it !== 'string') expect(removed).not.toContain(it.slot);
    }
  });
  it('are never prescribed on any date from 19 Oct 2026 to the end of the taper, on either day', () => {
    const start = Date.UTC(2026, 9, 19);
    const end = Date.UTC(2027, 2, 7);
    for (let t = start; t <= end; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      for (const day of [1, 2] as const) {
        const s = prescribe(INITIAL_STATE, cfg, date, day);
        if (s.kind !== 'session') continue;
        for (const id of order(s)) expect(removed, `${date} Day ${day}`).not.toContain(id);
      }
    }
  });
});
