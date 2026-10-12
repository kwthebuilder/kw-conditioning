/**
 * The phone-screen smoke tests load e2e/fixtures/athlete-shaped.json.
 * It must be exactly the state the synthetic builder produces, and that
 * state must replay. Regenerate with WRITE_FIXTURES=1 npx vitest run tests/fixture.test.ts.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../e2e/fixtures/athlete-shaped.json';
import { INITIAL_STATE, PROGRAMME_CONFIG as cfg } from '../src/config/load';
import { parseState } from '../src/config/validate';
import { replayMatches } from '../src/engine';
import { athleteShapedState } from './fixtures/athleteShaped';

const FILE = 'e2e/fixtures/athlete-shaped.json';
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

describe('athlete-shaped fixture (ui_spec_v1_3.md §13A)', async () => {
  const state = athleteShapedState();
  if (env?.WRITE_FIXTURES) {
    const fsName = 'node:fs';
    const fs = (await import(/* @vite-ignore */ fsName)) as { writeFileSync: (f: string, t: string) => void };
    fs.writeFileSync(FILE, `${JSON.stringify(state, null, 1)}\n`);
  }

  it('replays to itself', () => expect(replayMatches(INITIAL_STATE, state, cfg)).toBe(true));

  it('matches the file the smoke tests load', () => {
    if (env?.WRITE_FIXTURES) return;
    expect(parseState(fixture as unknown)).toEqual(state);
  });

  it('has the shape test 2 describes', () => {
    expect(state.lifts.front_squat.tm).toBeCloseTo(97.65, 2);
    expect(state.depth_jump.height_cm).toBe(51);
    expect(state.lifts.deadlift.last_logged).toBe('2026-10-08');
  });
});
