/**
 * Device store. One key, the whole state as JSON. Storage is assumed
 * losable (CLAUDE.md rule 7): the export is the record of truth.
 */
import type { State } from '../config/types';
import { parseState } from '../config/validate';

export interface Store {
  /** The saved state, or null when nothing valid is stored. Never throws. */
  load(): State | null;
  save(state: State): void;
  clear(): void;
}

/** The subset of the Web Storage interface the store needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_KEY = 'acro-base-sc/state';

/** Backed by localStorage (or any StorageLike). A malformed record loads as null and is left in place. */
export function localStorageStore(storage: StorageLike, key = DEFAULT_KEY): Store {
  return {
    load() {
      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch {
        return null;
      }
      if (raw === null) return null;
      try {
        return parseState(JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    save(state) {
      storage.setItem(key, JSON.stringify(state));
    },
    clear() {
      storage.removeItem(key);
    },
  };
}

/** In-memory store with the same contract, for tests and as a fallback when storage is unavailable. */
export function memoryStore(): Store {
  let raw: string | null = null;
  return {
    load() {
      if (raw === null) return null;
      try {
        return parseState(JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    save(state) {
      raw = JSON.stringify(state);
    },
    clear() {
      raw = null;
    },
  };
}
