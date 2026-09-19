/**
 * Engine public surface.
 *
 * Pure module by contract (CLAUDE.md rule 4): nothing in src/engine may
 * import from src/ui, src/storage, the DOM, Date.now, Math.random, or
 * the network. Dates are passed in.
 *
 * Phases 1 and 2: per-slot building blocks. Phase 3 composes them into
 * prescribe(state, config, date) → session and update(state, log).
 */
export { roundLoad } from './rounding';
export { daysBetween, mesocycleOn, programmeWeek } from './calendar';
// Class A
export { prescribeLift, updateLift, tmFromSingle, rawEstimate, failureSignal, SEED_FACTOR } from './barbell';
// Class B
export { prescribeRdl, updateRdl, rdlRow, WIDE_WINDOW_SESSIONS } from './rdl';
export { prescribeTempo, updateTempo, ruleForClassB } from './tempo';
// Class C (and the shared streak engine)
export {
  prescribeAccessory,
  updateAccessory,
  prescribeProgression,
  updateProgression,
  parseIncrement,
  incrementText,
  ruleForClassC,
  type ProgressionRule,
} from './accessory';
// Classes D, E, F: fixed prescriptions
export { prescribeFixed, contactsFor } from './fixed';
// CMJ, stored only
export { recordCmj, cmjSummary } from './cmj';
// Manual overrides
export { overrideLoad, overrideTm } from './overrides';
export type * from './types';
