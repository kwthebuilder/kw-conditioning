/**
 * Engine public surface.
 *
 * Pure module by contract (CLAUDE.md rule 4): nothing in src/engine may
 * import from src/ui, src/storage, the DOM, Date.now, Math.random, or
 * the network. Dates are passed in.
 *
 * prescribe(state, config, date, day?) and update(state, log, config)
 * are the surface; bindConfig(config) gives the two-argument forms.
 * The per-slot functions below are what they compose.
 */
export { prescribe, defaultDay, isLadderDay } from './session';
export { update, bindConfig } from './update';
export { roundLoad } from './rounding';
export { daysBetween, mesocycleOn, programmeWeek } from './calendar';
// Class A
export { prescribeLift, updateLift, updateSingle, applySingle, rampSets, tmFromSingle, rawEstimate, failureSignal, SEED_FACTOR } from './barbell';
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
