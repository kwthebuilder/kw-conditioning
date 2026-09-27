/**
 * Browser glue for the GitHub backup (engine_spec_v1_7.md §12).
 *
 * The token and repo name live in their own storage key, outside the
 * engine state, so they never appear in an export or in the backup
 * itself. Losing browser storage loses the token too; the athlete
 * pastes it again from their password manager.
 */
import type { SyncDeps, SyncSettings } from '../storage/sync';

const SETTINGS_KEY = 'acro-base-sc/sync';
const PENDING_KEY = 'acro-base-sc/sync/pending';
const LAST_KEY = 'acro-base-sc/sync/last';

export const DEFAULT_OWNER = 'kwthebuilder';
export const DEFAULT_REPO = 'kw-conditioning-logs';

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: backup settings last for this visit only */
  }
}

export function loadSettings(): SyncSettings | null {
  const raw = get(SETTINGS_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<SyncSettings>;
    if (typeof o.owner === 'string' && typeof o.repo === 'string' && typeof o.token === 'string' && o.token) {
      return { owner: o.owner, repo: o.repo, token: o.token };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function saveSettings(s: SyncSettings | null): void {
  set(SETTINGS_KEY, s === null ? null : JSON.stringify(s));
}

export const pending = {
  get: (): boolean => get(PENDING_KEY) === '1',
  set: (on: boolean): void => set(PENDING_KEY, on ? '1' : null),
};

export const lastBackup = {
  get: (): string | null => get(LAST_KEY),
  set: (iso: string): void => set(LAST_KEY, iso),
};

export function browserDeps(): SyncDeps {
  return {
    fetch: (url, init) => window.fetch(url, init),
    sha1: async (bytes) => {
      const digest = await crypto.subtle.digest('SHA-1', new Uint8Array(bytes));
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
  };
}

/** Short local time for the status line, e.g. "Sun 14:32". */
export function whenText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
