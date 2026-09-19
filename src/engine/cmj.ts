/**
 * CMJ under the phase 2 scope cut: store the Day 1 value and show the
 * running mean. No flag, no baseline, no threshold.
 */
import type { State } from '../config/types';
import type { CmjSummary } from './types';

export function cmjSummary(state: State): CmjSummary {
  const s = state.cmj.series;
  const count = s.length;
  const last = count ? (s[count - 1] ?? null) : null;
  const mean = count ? s.reduce((a, b) => a + b, 0) / count : null;
  return { count, last, mean };
}

export function recordCmj(state: State, value: number): { state: State; summary: CmjSummary } {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`CMJ value must be a positive number, got ${value}`);
  const next = structuredClone(state);
  next.cmj.series.push(value);
  return { state: next, summary: cmjSummary(next) };
}
