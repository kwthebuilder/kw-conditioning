import { describe, expect, it } from 'vitest';
import { APP_VERSION, SPEC_NAME } from '../src/version';

describe('phase 0 placeholder', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('exposes an app version and spec name', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(SPEC_NAME).toBe('engine_spec_v1_6');
  });
});
