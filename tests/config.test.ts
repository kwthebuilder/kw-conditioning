import { describe, expect, it } from 'vitest';
import configJson from '../spec/programme_config_v1.json';
import stateJson from '../spec/initial_state_v1.json';
import vectorsJson from '../spec/engine_test_vectors_v1.json';
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
  'programme_config_v1.json': configJson,
  'initial_state_v1.json': stateJson,
  'engine_test_vectors_v1.json': vectorsJson,
};
const raw = (name: string): unknown => files[name];

describe('spec loader', () => {
  it('loads and validates all three files', () => {
    expect(PROGRAMME_CONFIG.version).toBe('1.0');
    expect(TEST_VECTORS.version).toBe('1.0');
    expect(INITIAL_STATE.schema).toBe(1);
    expect(CONFIG_VERSION).toBe('1.0');
    expect(VECTORS_VERSION).toBe('1.0');
    expect(STATE_SCHEMA).toBe(1);
  });

  it('returns values structurally identical to the files (nothing dropped or coerced)', () => {
    expect(PROGRAMME_CONFIG).toEqual(raw('programme_config_v1.json'));
    expect(INITIAL_STATE).toEqual(raw('initial_state_v1.json'));
    expect(TEST_VECTORS).toEqual(raw('engine_test_vectors_v1.json'));
  });

  it('carries the shapes the types promise', () => {
    expect(Object.keys(PROGRAMME_CONFIG.templates).sort()).toEqual(['M1', 'M2', 'M34', 'TAPER']);
    expect(PROGRAMME_CONFIG.templates.TAPER.both_days).toBeDefined();
    expect(PROGRAMME_CONFIG.templates.M1.day1).toBeDefined();
    expect(PROGRAMME_CONFIG.slots.depth_jump?.contacts).toMatchObject({ M2: [6, 9], M4: { '20-22': 12 } });
    expect(INITIAL_STATE.lifts.front_squat.tm).toBe(92);
    expect(TEST_VECTORS.barbell.length).toBeGreaterThan(0);
    expect(TEST_VECTORS.rounding.length).toBeGreaterThan(0);
  });
});

describe('validators reject malformed input with a JSON path', () => {
  const state = (): Record<string, unknown> => structuredClone(raw('initial_state_v1.json')) as Record<string, unknown>;
  const config = (): Record<string, unknown> => structuredClone(raw('programme_config_v1.json')) as Record<string, unknown>;
  const vectors = (): Record<string, unknown> => structuredClone(raw('engine_test_vectors_v1.json')) as Record<string, unknown>;

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
