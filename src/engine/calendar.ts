/**
 * Calendar helpers. Pure: dates are ISO strings passed in.
 */
import type { IsoDate, Mesocycle, ProgrammeConfig } from '../config/types';

const DAY_MS = 86_400_000;

function utc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error(`bad date ${date}`);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `a` to `b`; positive when b is later. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** The mesocycle whose [start, end] contains the date, or undefined outside the programme. */
export function mesocycleOn(config: ProgrammeConfig, date: IsoDate): Mesocycle | undefined {
  return config.mesocycles.find((m) => m.start <= date && date <= m.end);
}

/** Programme week, 1-based from the first mesocycle's start (A.7, A.10). */
export function programmeWeek(config: ProgrammeConfig, date: IsoDate): number {
  const first = config.mesocycles[0];
  if (!first) throw new Error('config has no mesocycles');
  return Math.floor(daysBetween(first.start, date) / 7) + 1;
}
