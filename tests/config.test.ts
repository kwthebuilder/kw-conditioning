import { describe, expect, it } from 'vitest';
import configJson from '../spec/programme_config_v1_5.json';
import configV14 from '../spec/programme_config_v1_4.json';
import configV13 from '../spec/programme_config_v1_3.json';
import stateJson from '../spec/initial_state_v1_1.json';
import vectorsJson from '../spec/engine_test_vectors_v1_5.json';
import vectorsV14 from '../spec/engine_test_vectors_v1_4.json';
import {
  CONFIG_VERSION,
  INITIAL_STATE,
  PROGRAMME_CONFIG,
  STATE_SCHEMA,
  TEST_VECTORS,
  VECTORS_VERSION,
} from '../src/config/load';
import { ConfigError, parseProgrammeConfig, parseState, parseTestVectors } from '../src/config/validate';

const files: Record<string, unknown> = {
  'programme_config_v1_5.json': configJson,
  'programme_config_v1_4.json': configV14,
  'programme_config_v1_3.json': configV13,
  'initial_state_v1_1.json': stateJson,
  'engine_test_vectors_v1_5.json': vectorsJson,
  'engine_test_vectors_v1_4.json': vectorsV14,
};
const raw = (name: string): unknown => files[name];

describe('spec loader', () => {
  it('loads and validates all three files', () => {
    expect(PROGRAMME_CONFIG.version).toBe('1.5');
    expect(TEST_VECTORS.version).toBe('1.5');
    expect(INITIAL_STATE.schema).toBe(1);
    expect(CONFIG_VERSION).toBe('1.5');
    expect(VECTORS_VERSION).toBe('1.5');
    expect(STATE_SCHEMA).toBe(1);
  });

  it('returns values structurally identical to the files (nothing dropped or coerced)', () => {
    expect(PROGRAMME_CONFIG).toEqual(raw('programme_config_v1_5.json'));
    expect(INITIAL_STATE).toEqual(raw('initial_state_v1_1.json'));
    expect(TEST_VECTORS).toEqual(raw('engine_test_vectors_v1_5.json'));
  });

  it('carries the shapes the types promise', () => {
    expect(Object.keys(PROGRAMME_CONFIG.templates).sort()).toEqual(['M1', 'M2', 'M34', 'TAPER']);
    expect(PROGRAMME_CONFIG.templates.TAPER.both_days).toBeDefined();
    expect(PROGRAMME_CONFIG.templates.M1.day1).toBeDefined();
    expect(PROGRAMME_CONFIG.slots.depth_jump?.contacts).toMatchObject({ M2: 6, M4: { '20-22': 12 } });
    expect(PROGRAMME_CONFIG.boundary_singles_on_entering).toEqual(['M2', 'M3', 'M4']);
    expect(INITIAL_STATE.lifts.front_squat.tm).toBe(92);
    expect(TEST_VECTORS.barbell.length).toBeGreaterThan(0);
    expect(TEST_VECTORS.rounding.length).toBeGreaterThan(0);
  });
});

describe('config v1.4 (SPEC_QUESTIONS Q18)', () => {
  it('records the dumbbell rack as 2 to 40 kg in 2 kg steps', () => {
    expect(PROGRAMME_CONFIG.equipment).toMatchObject({ db_min_kg: 2, db_max_kg: 40, db_step_kg: 2 });
  });

  it('changes nothing else: no dose, rep, rest or slot differs from v1.3', () => {
    const strip = (c: unknown): Record<string, unknown> => {
      const o = structuredClone(c) as Record<string, unknown> & { equipment: Record<string, unknown> };
      delete o.version;
      delete o.date;
      delete o.equipment.db_min_kg;
      return o;
    };
    expect(strip(raw('programme_config_v1_4.json'))).toEqual(strip(raw('programme_config_v1_3.json')));
  });
});

describe('config v1.5 (ui_spec_v1_3.md §13A test 20)', () => {
  it('confirms the trap bar and empties the ladder schedule', () => {
    expect(PROGRAMME_CONFIG.equipment.trap_bar_kg_confirmed).toBe(true);
    expect(PROGRAMME_CONFIG.equipment.trap_bar_kg).toBe(24);
    expect(PROGRAMME_CONFIG.ladder?.weeks).toEqual([]);
  });

  it('differs from v1.4 only in trap_bar_kg_confirmed and the ladder weeks', () => {
    const strip = (c: unknown): Record<string, unknown> => {
      const o = structuredClone(c) as Record<string, unknown> & { equipment: Record<string, unknown>; ladder: Record<string, unknown> };
      delete o.version;
      delete o.date;
      delete o.equipment.trap_bar_kg_confirmed;
      delete o.ladder.weeks;
      return o;
    };
    expect(strip(raw('programme_config_v1_5.json'))).toEqual(strip(raw('programme_config_v1_4.json')));
    expect((raw('programme_config_v1_4.json') as { equipment: { trap_bar_kg_confirmed: boolean } }).equipment.trap_bar_kg_confirmed).toBe(false);
  });
});

describe('test vectors v1.5 (ui_spec_v1_3.md §13A test 19)', () => {
  it('changes only the ladder cases that expected rsi_ladder', () => {
    const a = structuredClone(raw('engine_test_vectors_v1_5.json')) as Record<string, unknown> & { session: { ladder: { date: string; expect: string }[] } };
    const b = structuredClone(raw('engine_test_vectors_v1_4.json')) as typeof a;
    const changed = a.session.ladder.filter((c, i) => c.expect !== b.session.ladder[i]!.expect).map((c) => c.date);
    expect(changed).toEqual(['2026-09-21', '2026-11-09']);
    for (const c of b.session.ladder.filter((x) => changed.includes(x.date))) expect(c.expect).toMatch(/rsi_ladder (present|\()/);
    for (const c of a.session.ladder) expect(c.expect).not.toMatch(/rsi_ladder present|holds rsi_ladder/);
    for (const o of [a, b]) {
      delete (o as Record<string, unknown>).version;
      delete (o as Record<string, unknown>).date;
      delete (o as Record<string, unknown>).notes;
      o.session.ladder = [];
    }
    expect(a).toEqual(b);
  });

  it('keeps the golden sessions pinned to the config in force on 21 Sep', () => {
    expect(TEST_VECTORS.golden_sessions).toContain('programme_config_v1_3.json');
  });
});

describe('validators reject malformed input with a JSON path', () => {
  const state = (): Record<string, unknown> => structuredClone(raw('initial_state_v1_1.json')) as Record<string, unknown>;
  const config = (): Record<string, unknown> => structuredClone(raw('programme_config_v1_5.json')) as Record<string, unknown>;
  const vectors = (): Record<string, unknown> => structuredClone(raw('engine_test_vectors_v1_5.json')) as Record<string, unknown>;

  it('rejects a non-object', () => {
    expect(() => parseState(null)).toThrow(ConfigError);
    expect(() => parseProgrammeConfig([])).toThrow(/^config: expected object/);
  });

  it('rejects a bad state schema version', () => {
    const s = state();
    s.schema = 2;
    expect(() => parseState(s)).toThrow(/^state\.schema: expected one of \[1\]/);
  });

  it('rejects a rounded-looking but wrong-typed TM', () => {
    const s = state();
    (s.lifts as Record<string, Record<string, unknown>>).front_squat!.tm = '92.0';
    expect(() => parseState(s)).toThrow(/^state\.lifts\.front_squat\.tm: expected finite number/);
  });

  it('rejects an unknown mesocycle template', () => {
    const c = config();
    (c.mesocycles as Record<string, unknown>[])[0]!.template = 'M9';
    expect(() => parseProgrammeConfig(c)).toThrow(/^config\.mesocycles\[0\]\.template: expected one of/);
  });

  it('rejects a template item that names a slot the config does not define', () => {
    const c = config();
    const m1 = (c.templates as Record<string, Record<string, Record<string, unknown>>>).M1!.day1!;
    const blocks = m1.blocks as Record<string, unknown>[];
    (blocks[1]!.items as Record<string, unknown>[])[0]!.slot = 'nope';
    expect(() => parseProgrammeConfig(c)).toThrow(/templates\.M1\.day1\.blocks\[1\]\.items\[0\]\.slot: unknown slot "nope"/);
  });

  it('rejects an unknown slot field, so typos in a config revision surface', () => {
    const c = config();
    (c.slots as Record<string, Record<string, unknown>>).rdl!.startkg = 100;
    expect(() => parseProgrammeConfig(c)).toThrow(/^config\.slots\.rdl\.startkg: unknown slot field/);
  });

  it('rejects a vector with a bad position', () => {
    const v = vectors();
    ((v.barbell as Record<string, unknown>[])[0]!.input as Record<string, unknown>).pos = 4;
    expect(() => parseTestVectors(v)).toThrow(/^vectors\.barbell\[0\]\.input\.pos: expected one of \[1,2,3\]/);
  });
});
