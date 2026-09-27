/**
 * Backup to GitHub (engine_spec_v1_7.md §12), against an in-memory fake
 * of the GitHub contents API. No network.
 */
import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../src/config/load';
import { update } from '../src/engine';
import { exportMarkdown, importMarkdown } from '../src/storage';
import {
  base64ToUtf8,
  checkRepo,
  gitBlobSha,
  LATEST_PATH,
  pullLatest,
  pushExport,
  SyncError,
  utf8ToBase64,
  type SyncDeps,
  type SyncSettings,
} from '../src/storage/sync';

const S: SyncSettings = { owner: 'kwthebuilder', repo: 'kw-conditioning-logs', token: 'github_pat_test' };
const sha1 = async (b: Uint8Array): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-1', new Uint8Array(b)))].map((x) => x.toString(16).padStart(2, '0')).join('');

interface Fake {
  deps: SyncDeps;
  files: Map<string, string>;
  calls: { method: string; path: string; body?: Record<string, string> }[];
  opts: { private: boolean; status?: number; offline?: boolean; conflictOnce?: boolean };
}

function fakeGitHub(opts: Fake['opts'] = { private: true }): Fake {
  const files = new Map<string, string>();
  const calls: Fake['calls'] = [];
  let conflicted = false;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    if (opts.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    const method = init?.method ?? 'GET';
    const hdrs = (init?.headers ?? {}) as Record<string, string>;
    expect(hdrs.Authorization).toBe(`Bearer ${S.token}`);
    expect(init?.cache).toBe('no-store');
    if (opts.status) return new Response('{}', { status: opts.status });
    const repoPrefix = `/repos/${S.owner}/${S.repo}`;
    if (u.pathname === repoPrefix) return json({ private: opts.private });
    const path = decodeURIComponent(u.pathname.slice(`${repoPrefix}/contents/`.length));
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : undefined;
    calls.push(body ? { method, path, body } : { method, path });
    const text = files.get(path);
    if (method === 'GET') {
      if (text === undefined) return json({ message: 'Not Found' }, 404);
      if (hdrs.Accept === 'application/vnd.github.raw+json') return new Response(text, { status: 200 });
      return json({ type: 'file', sha: await gitBlobSha(text, sha1) });
    }
    if (method === 'PUT' && body) {
      if (opts.conflictOnce && !conflicted) {
        conflicted = true;
        return json({ message: 'sha mismatch' }, 409);
      }
      const current = text === undefined ? undefined : await gitBlobSha(text, sha1);
      if (current !== body.sha) return json({ message: 'sha mismatch' }, 409);
      files.set(path, base64ToUtf8(body.content!));
      return json({}, text === undefined ? 201 : 200);
    }
    return json({}, 405);
  };
  return { deps: { fetch, sha1 }, files, calls, opts };
}

const cfg = PROGRAMME_CONFIG;
const DATE = '2026-09-28';

function stateAfterOneLog() {
  return update(INITIAL_STATE, { kind: 'cmj', date: DATE, value: 38.2 }, cfg).state;
}

describe('encoding', () => {
  it('base64 round-trips non-ASCII text (β, ×, –)', () => {
    const t = 'β2 1.015 · 77.5 × 9 @ RIR 2 – ok';
    expect(base64ToUtf8(utf8ToBase64(t))).toBe(t);
  });

  it('git blob sha matches git hash-object', async () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(await gitBlobSha('hello\n', sha1)).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
});

describe('pushExport', () => {
  it('first backup creates latest.md and the week file', async () => {
    const gh = fakeGitHub();
    const file = exportMarkdown(stateAfterOneLog(), cfg, DATE);
    const r = await pushExport(gh.deps, S, file);
    expect(r.written).toEqual([LATEST_PATH, `logs/${file.filename}`]);
    expect(gh.files.get(LATEST_PATH)).toBe(file.markdown);
    expect(gh.files.get(`logs/${file.filename}`)).toBe(file.markdown);
    expect(gh.calls.filter((c) => c.method === 'PUT').every((c) => c.body?.sha === undefined)).toBe(true);
  });

  it('an unchanged state makes no commit', async () => {
    const gh = fakeGitHub();
    const file = exportMarkdown(stateAfterOneLog(), cfg, DATE);
    await pushExport(gh.deps, S, file);
    const puts = gh.calls.filter((c) => c.method === 'PUT').length;
    const r = await pushExport(gh.deps, S, file);
    expect(r.written).toEqual([]);
    expect(gh.calls.filter((c) => c.method === 'PUT').length).toBe(puts);
  });

  it('a changed state replaces the files, sending the current sha', async () => {
    const gh = fakeGitHub();
    const s1 = stateAfterOneLog();
    await pushExport(gh.deps, S, exportMarkdown(s1, cfg, DATE));
    const s2 = update(s1, { kind: 'cmj', date: DATE, value: 38.9 }, cfg).state;
    const f2 = exportMarkdown(s2, cfg, DATE);
    const r = await pushExport(gh.deps, S, f2);
    expect(r.written).toHaveLength(2);
    expect(gh.files.get(LATEST_PATH)).toBe(f2.markdown);
    const lastPut = gh.calls.filter((c) => c.method === 'PUT').at(-1)!;
    expect(lastPut.body?.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('retries once on a sha conflict', async () => {
    const gh = fakeGitHub({ private: true, conflictOnce: true });
    const file = exportMarkdown(stateAfterOneLog(), cfg, DATE);
    const r = await pushExport(gh.deps, S, file);
    expect(r.written).toHaveLength(2);
  });

  it('no signal is a retryable error', async () => {
    const gh = fakeGitHub({ private: true, offline: true });
    const err = await pushExport(gh.deps, S, exportMarkdown(INITIAL_STATE, cfg, DATE)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect((err as SyncError).retryable).toBe(true);
  });

  it('a bad token is not retryable and says so in plain words', async () => {
    const gh = fakeGitHub({ private: true, status: 401 });
    const err = (await pushExport(gh.deps, S, exportMarkdown(INITIAL_STATE, cfg, DATE)).catch((e: unknown) => e)) as SyncError;
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/token/);
  });
});

describe('restore', () => {
  it('pullLatest returns what was pushed, and it imports to the identical state', async () => {
    const gh = fakeGitHub();
    const state = stateAfterOneLog();
    await pushExport(gh.deps, S, exportMarkdown(state, cfg, DATE));
    const text = await pullLatest(gh.deps, S);
    const r = importMarkdown(text!);
    expect(r.ok && r.state).toEqual(state);
  });

  it('pullLatest is null before the first backup', async () => {
    expect(await pullLatest(fakeGitHub().deps, S)).toBeNull();
  });
});

describe('checkRepo', () => {
  it('accepts a private repo', async () => {
    await expect(checkRepo(fakeGitHub({ private: true }).deps, S)).resolves.toBeUndefined();
  });

  it('refuses a public repo', async () => {
    const err = (await checkRepo(fakeGitHub({ private: false }).deps, S).catch((e: unknown) => e)) as SyncError;
    expect(err).toBeInstanceOf(SyncError);
    expect(err.message).toMatch(/public/);
    expect(err.retryable).toBe(false);
  });
});
