/**
 * Automatic backup to the athlete's own private GitHub repo
 * (engine_spec_v1_8.md §12). The only network call the app makes after
 * load. Two files are written on every backup:
 *
 *   latest.md             the newest export; "Restore from GitHub" reads it
 *   logs/<export name>    one file per programme week, same content
 *
 * Pure with respect to the browser: fetch and SHA-1 are passed in so
 * the module runs under test without a network. No clock.
 */
import type { ExportFile } from './export';

export interface SyncSettings {
  owner: string;
  repo: string;
  /** Fine-grained personal access token limited to this one repo, Contents read and write. */
  token: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type Sha1 = (bytes: Uint8Array) => Promise<string>;

export interface SyncDeps {
  fetch: FetchLike;
  sha1: Sha1;
}

export const LATEST_PATH = 'latest.md';
export const LOGS_DIR = 'logs';
const API = 'https://api.github.com';

export class SyncError extends Error {
  constructor(
    message: string,
    /** True when retrying later can help (no signal, GitHub down); false for a wrong token or repo. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

// ---------------------------------------------------------------------
// encoding
// ---------------------------------------------------------------------

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Git's blob id for a file's content: SHA-1 of "blob <length>\0<bytes>". Lets an unchanged file be skipped. */
export async function gitBlobSha(text: string, sha1: Sha1): Promise<string> {
  const body = new TextEncoder().encode(text);
  const header = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(header.length + body.length);
  all.set(header, 0);
  all.set(body, header.length);
  return sha1(all);
}

// ---------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------

function headers(s: SyncSettings, raw = false): Record<string, string> {
  return {
    Authorization: `Bearer ${s.token}`,
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function contentsUrl(s: SyncSettings, path: string): string {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  return `${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${enc}`;
}

async function call(deps: SyncDeps, url: string, init: RequestInit): Promise<Response> {
  try {
    return await deps.fetch(url, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncError('No connection to GitHub. The backup will retry when you are back online.', true);
  }
}

function httpError(res: Response, what: string): SyncError {
  switch (res.status) {
    case 401:
      return new SyncError('GitHub refused the token (401). It may be mistyped or expired: make a new one and save it again.', false);
    case 403:
      return new SyncError(`GitHub refused ${what} (403). The token needs "Contents: Read and write" on this repo.`, false);
    case 404:
      return new SyncError('GitHub cannot see that repo (404). Check the owner and repo name, and that the token was given access to it.', false);
    default:
      return new SyncError(`GitHub answered ${res.status} to ${what}. The backup will retry.`, res.status >= 500 || res.status === 429);
  }
}

/** The file's blob sha on GitHub, or null if it does not exist yet. */
async function remoteSha(deps: SyncDeps, s: SyncSettings, path: string): Promise<string | null> {
  const res = await call(deps, contentsUrl(s, path), { method: 'GET', headers: headers(s) });
  if (res.status === 404) return null;
  if (!res.ok) throw httpError(res, `reading ${path}`);
  const body = (await res.json()) as { sha?: unknown; type?: unknown };
  if (body.type !== 'file' || typeof body.sha !== 'string') throw new SyncError(`${path} on GitHub is not a file.`, false);
  return body.sha;
}

/**
 * Create or replace one file. Returns false when GitHub already holds
 * exactly this content (no commit made). One retry on a sha conflict,
 * which happens if two backups race.
 */
export async function putFile(deps: SyncDeps, s: SyncSettings, path: string, text: string, message: string): Promise<boolean> {
  const local = await gitBlobSha(text, deps.sha1);
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await remoteSha(deps, s, path);
    if (sha === local) return false;
    const payload: Record<string, string> = { message, content: utf8ToBase64(text) };
    if (sha !== null) payload.sha = sha;
    const res = await call(deps, contentsUrl(s, path), {
      method: 'PUT',
      headers: { ...headers(s), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
    if ((res.status === 409 || res.status === 422) && attempt === 0) continue;
    throw httpError(res, `writing ${path}`);
  }
  throw new SyncError(`Could not write ${path} after a retry.`, true);
}

export interface PushResult {
  /** Paths committed; empty when GitHub was already up to date. */
  written: string[];
}

/** Back up one export: latest.md and the week's file under logs/. */
export async function pushExport(deps: SyncDeps, s: SyncSettings, file: ExportFile): Promise<PushResult> {
  const written: string[] = [];
  const message = `Backup: ${file.filename}`;
  for (const path of [LATEST_PATH, `${LOGS_DIR}/${file.filename}`]) {
    if (await putFile(deps, s, path, file.markdown, message)) written.push(path);
  }
  return { written };
}

/** latest.md as text, or null if nothing has been backed up yet. */
export async function pullLatest(deps: SyncDeps, s: SyncSettings): Promise<string | null> {
  const res = await call(deps, contentsUrl(s, LATEST_PATH), { method: 'GET', headers: headers(s, true) });
  if (res.status === 404) return null;
  if (!res.ok) throw httpError(res, 'reading the backup');
  return res.text();
}

/**
 * Checks before the first backup: the token works and the repo is
 * private. A public repo is refused, because the log holds health data
 * and anyone could read it.
 */
export async function checkRepo(deps: SyncDeps, s: SyncSettings): Promise<void> {
  const res = await call(deps, `${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}`, { method: 'GET', headers: headers(s) });
  if (!res.ok) throw httpError(res, 'opening the repo');
  const body = (await res.json()) as { private?: unknown };
  if (body.private !== true) {
    throw new SyncError(`${s.owner}/${s.repo} is public, so anyone could read your log. Make it private on GitHub (Settings, then Change visibility) and try again.`, false);
  }
}
