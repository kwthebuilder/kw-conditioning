/**
 * §10 / A.1: displayed loads round to the nearest step, ties down.
 * Only display code and prescriptions call this; state is never rounded.
 */
export function roundLoad(raw: number, step = 2.5): number {
  if (!Number.isFinite(raw)) throw new Error(`roundLoad: not a finite number: ${raw}`);
  if (step <= 0) throw new Error(`roundLoad: step must be positive: ${step}`);
  // ceil(x - 0.5) is "nearest integer, ties down".
  return Math.ceil(raw / step - 0.5) * step;
}
