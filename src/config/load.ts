/**
 * Bundled configuration. Vite inlines the three spec JSON files at build
 * time, so the shipped app carries them (app_build_plan_v1.md §3:
 * bundled and replaceable by import; phase 4 reuses the same parsers
 * for the import path). Validation runs once on module load and throws
 * a ConfigError naming the JSON path if a file is malformed.
 */
import configJson from '../../spec/programme_config_v1_1.json';
import stateJson from '../../spec/initial_state_v1_1.json';
import vectorsJson from '../../spec/engine_test_vectors_v1_1.json';
import { crossCheck, parseProgrammeConfig, parseState, parseTestVectors } from './validate';
import type { ProgrammeConfig, State, TestVectors } from './types';

// Cast to unknown on purpose: the parsers, not TypeScript's JSON
// inference, are what prove the files match src/config/types.ts.
export const PROGRAMME_CONFIG: ProgrammeConfig = parseProgrammeConfig(configJson as unknown);
export const INITIAL_STATE: State = parseState(stateJson as unknown);
export const TEST_VECTORS: TestVectors = parseTestVectors(vectorsJson as unknown);

crossCheck(INITIAL_STATE, PROGRAMME_CONFIG);

export const CONFIG_VERSION: string = PROGRAMME_CONFIG.version;
export const VECTORS_VERSION: string = TEST_VECTORS.version;
export const STATE_SCHEMA: number = INITIAL_STATE.schema;
