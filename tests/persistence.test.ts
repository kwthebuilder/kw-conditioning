import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../src/config/load';
import type { State } from '../src/config/types';
import { overrideLoad, prescribe, prescribeLift, programmeWeek, update } from '../src/engine';
import type { AnyLog } from '../src/engine';
import { exportMarkdown, importMarkdown, lastJsonBlock, localStorageStore, memoryStore } from '../src/storage';
import { M1_DATE, stateWith } from './helpers';

const cfg = PROGRAMME_CONFIG;
const DAY2 = '2026-09-24';

/** A state with a few sessions, a load override, a TM override and a CMJ value behind it. */
function workedState(): State {
  const p = prescribeLift(INITIAL_STATE, cfg, 'front_squat', M1_DATE);
  if (p.kind !== 'lift') throw new Error();
  const p2 = overrideLoad(p, cfg, 80, 'felt light');
  const logs: AnyLog[] = [
    { kind: 'cmj', date: M1_DATE, value: 38.2 },
    { kind: 'barbell', lift: 'front_squat', date: M1_DATE, mode: 'wave', position: 2, prescribed: { load: p2.load, reps: p2.reps, sets: p2.sets }, last_set: { load: 80, reps: 7, rir: 2 }, missed: false, override: p2.override! },
    { kind: 'rdl', slot: 'rdl', date: M1_DATE, load: 100, sets_done: 3, last_set: { reps: 10, rir: 2 } },
    { kind: 'slot', slot: 'pull_up', date: M1_DATE, load: 10, sets_done: 3, last_set: { reps: 7, rir: 2 } },
    { kind: 'fixed', slot: 'trap_bar_jump', date: M1_DATE, done: true, value: 24 },
    { kind: 'session_end', date: M1_DATE, day: 1, minutes: 70 },
    { kind: 'tm_override', date: '2026-09-22', lift: 'deadlift', tm: 150.3, note: 'physio' },
  ];
  let s = INITIAL_STATE;
  for (const log of logs) s = update(s, log, cfg).state;
  return s;
}

function roundTrip(state: State, date: string, day?: 1 | 2): void {
  const store = memoryStore();
  store.save(state);
  const before = prescribe(state, cfg, date, day);
  const file = exportMarkdown(state, cfg, date);

  store.clear();
  expect(store.load()).toBeNull();

  const imported = importMarkdown(file.markdown);
  expect(imported.ok).toBe(true);
  if (!imported.ok) return;
  store.save(imported.state);
  const restored = store.load();
  expect(restored).toEqual(state);
  expect(prescribe(restored!, cfg, date, day)).toEqual(before);
}

describe('gate: export, wipe, import, identical prescription', () => {
  it('initial state', () => roundTrip(INITIAL_STATE, M1_DATE));
  it('worked state with overrides and a log', () => roundTrip(workedState(), DAY2));
  it('state with a single logged through the door today', () => {
    const s = stateWith('front_squat', { tm: 96, beta: { '2': 1, '3': 1.02 }, next_position: 2 });
    s.lifts.front_squat.single_scheduled = true;
    const after = update(s, { kind: 'single', lift: 'front_squat', date: M1_DATE, load: 102.5, rir: 2 }, cfg).state;
    roundTrip(after, M1_DATE, 1);
  });
  it('the round trip is exact through JSON, not just through prescribe', () => {
    const s = workedState();
    const r = importMarkdown(exportMarkdown(s, cfg, DAY2).markdown);
    expect(r.ok && JSON.stringify(r.state)).toBe(JSON.stringify(s));
  });
});

describe('import refuses without touching the store', () => {
  const s = workedState();
  const good = exportMarkdown(s, cfg, DAY2).markdown;
  const cases: [string, string][] = [
    ['no json block', good.slice(0, good.indexOf('```json'))],
    ['truncated file', good.slice(0, good.length - 40)],
    ['invalid json', good.replace('"schema": 1', '"schema": 1,,')],
    ['wrong schema version', good.replace('"schema": 1', '"schema": 2')],
    ['string training max', good.replace(/"tm": ([\d.]+)/, '"tm": "$1"')],
    ['empty text', ''],
  ];
  for (const [name, text] of cases) {
    it(name, () => {
      const store = memoryStore();
      store.save(s);
      const r = importMarkdown(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
      expect(store.load()).toEqual(s);
    });
  }
});

describe('export content', () => {
  const s = workedState();
  const file = exportMarkdown(s, cfg, DAY2);
  const md = file.markdown;

  it('is named by year and programme week', () => {
    expect(file.filename).toBe(`training_log_2026_w${String(programmeWeek(cfg, DAY2)).padStart(2, '0')}.md`);
    expect(file.filename).toBe('training_log_2026_w02.md');
  });

  it('carries the versions and the training maxes', () => {
    expect(md).toMatch(/spec engine_spec_v1_6 \| config 1\.3 \| vectors 1\.3 \| state schema 1/);
    expect(md).toContain('| Conventional deadlift | 150.3 |');
  });

  it('lists every override with from, to and note', () => {
    expect(md).toContain('| load | 2026-09-21 | front_squat | 77.5 | 80.0 | felt light |');
    expect(md).toContain('| training max | 2026-09-22 | deadlift | 145.2 | 150.3 | physio |');
  });

  it('shows each set as load × reps @ RIR, with prescribed and performed when overridden', () => {
    expect(md).toContain('- 2026-09-21 Front squat: position 2, last set 80.0 × 7 @ RIR 2 (prescribed 77.5, performed 80.0)');
    expect(md).toContain('- 2026-09-21 Romanian deadlift, 3 s lowering: 3 sets, last set 100.0 × 10 @ RIR 2');
    expect(md).toContain('- 2026-09-21 Weighted pull-up: 3 sets, last set 10.0 × 7 @ RIR 2');
    expect(md).toContain('- 2026-09-21 Trap-bar jump: done (24)');
    expect(md).toContain('- 2026-09-21 CMJ 38.2 cm');
    expect(md).toContain('- 2026-09-22 Conventional deadlift: training max set to 150.3 (physio)');
  });

  it('ends with the state as the last fenced json block', () => {
    const block = lastJsonBlock(md);
    expect(block).not.toBeNull();
    expect(JSON.parse(block!)).toEqual(JSON.parse(JSON.stringify(s)));
    expect(md.trimEnd().endsWith('```')).toBe(true);
  });

  it('a single in a barbell log is shown', () => {
    const st = stateWith('front_squat', { tm: 96, next_position: 2 });
    st.lifts.front_squat.single_scheduled = true;
    const after = update(st, { kind: 'barbell', lift: 'front_squat', date: M1_DATE, mode: 'wave', position: 2, single: { load: 102.5, rir: 2 }, prescribed: { load: 85, reps: 3, sets: 3 }, last_set: { load: 85, reps: 3, rir: 3 }, missed: false }, cfg).state;
    expect(exportMarkdown(after, cfg, M1_DATE).markdown).toContain('Front squat: single 102.5 @ RIR 2; position 2, last set 85.0 × 3 @ RIR 3');
  });
});

describe('device store', () => {
  function fakeStorage(): { map: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
  }

  it('saves, loads and clears under one key', () => {
    const storage = fakeStorage();
    const store = localStorageStore(storage);
    expect(store.load()).toBeNull();
    const s = workedState();
    store.save(s);
    expect(storage.map.size).toBe(1);
    expect(store.load()).toEqual(s);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('a corrupt record loads as null, without throwing, and is left in place for inspection', () => {
    const storage = fakeStorage();
    const store = localStorageStore(storage, 'k');
    storage.setItem('k', '{not json');
    expect(store.load()).toBeNull();
    storage.setItem('k', JSON.stringify({ schema: 2 }));
    expect(store.load()).toBeNull();
    expect(storage.map.has('k')).toBe(true);
  });

  it('a storage that throws reads as empty', () => {
    const store = localStorageStore({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    expect(store.load()).toBeNull();
  });
});
