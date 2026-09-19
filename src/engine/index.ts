/**
 * Engine public surface.
 *
 * Pure module by contract (CLAUDE.md rule 4): nothing in src/engine may
 * import from src/ui, src/storage, the DOM, Date.now, Math.random, or
 * the network. Dates are passed in.
 *
 * Phase 1: per-lift building blocks for class A. Phase 3 composes them
 * into prescribe(state, config, date) → session and update(state, log).
 */
export { roundLoad } from './rounding';
export { daysBetween, mesocycleOn, programmeWeek } from './calendar';
export { prescribeLift, updateLift, tmFromSingle, rawEstimate, failureSignal, SEED_FACTOR } from './barbell';
export type * from './types';
