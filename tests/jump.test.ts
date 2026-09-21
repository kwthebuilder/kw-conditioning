import { describe, expect, it } from 'vitest';
import { flightTime, jumpFromFrames, jumpHeightCm, mean, roundHeight, roundRsi, rsi } from '../src/engine/jump';

describe('jump metrics from frame counts', () => {
  it('128 air frames at 240 fps is 34.9 cm', () => {
    const flight = flightTime(128, 240);
    expect(flight).toBeCloseTo(128 / 240, 12);
    expect(roundHeight(jumpHeightCm(flight))).toBe(34.9);
  });

  it('with 48 ground frames the RSI is 2.67', () => {
    const m = jumpFromFrames({ fps: 240, air: 128, ground: 48 });
    expect(roundHeight(m.height_cm)).toBe(34.9);
    expect(m.contact_s).toBeCloseTo(0.2, 12);
    expect(roundRsi(m.rsi!)).toBe(2.67);
    expect(roundRsi(rsi(128 / 240, 48 / 240))).toBe(2.67);
  });

  it('no ground frames, no RSI', () => {
    const m = jumpFromFrames({ fps: 240, air: 128 });
    expect(m.rsi).toBeUndefined();
    expect(m.contact_s).toBeUndefined();
  });

  it('other frame rates scale the same way', () => {
    // 64 frames at 120 fps is the same flight time as 128 at 240.
    expect(roundHeight(jumpFromFrames({ fps: 120, air: 64 }).height_cm)).toBe(34.9);
    expect(roundHeight(jumpFromFrames({ fps: 60, air: 30 }).height_cm)).toBe(30.7);
  });

  it('rejects impossible inputs', () => {
    expect(() => flightTime(10, 0)).toThrow();
    expect(() => flightTime(-1, 240)).toThrow();
    expect(() => rsi(0.5, 0)).toThrow();
  });

  it('mean ignores blanks', () => {
    expect(mean([2.5, null, 2.7, undefined])).toBeCloseTo(2.6, 12);
    expect(mean([null, undefined])).toBeNull();
  });
});
