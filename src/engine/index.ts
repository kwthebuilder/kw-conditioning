/**
 * Engine entry point.
 *
 * Pure module by contract (CLAUDE.md rule 4): nothing in src/engine may
 * import from src/ui, src/storage, the DOM, Date.now, Math.random, or
 * the network. Dates are passed in. Config and state types come from
 * src/config/types, which is also import-free.
 *
 * Phase 0 exports nothing. Phase 1 adds prescribe(state, config, date)
 * and update(state, log) here, and this file becomes a re-export hub
 * once the engine splits into barbell.ts, rdl.ts, accessory.ts, etc.
 */
export {};
