/**
 * Import: rebuild state exactly from an exported markdown file, or
 * refuse. Never touches a store; the caller saves the returned state.
 */
import type { State } from '../config/types';
import { ConfigError, parseState } from '../config/validate';

export type ImportResult = { ok: true; state: State } | { ok: false; reason: string };

/** The last fenced ```json block in the text, or null. */
export function lastJsonBlock(text: string): string | null {
  const re = /```json[ \t]*\r?\n([\s\S]*?)\r?\n```/g;
  let last: string | null = null;
  for (const m of text.matchAll(re)) last = m[1] ?? null;
  return last;
}

export function importMarkdown(text: string): ImportResult {
  const block = lastJsonBlock(text);
  if (block === null) return { ok: false, reason: 'no fenced json block found; this is not an export from this app' };
  let json: unknown;
  try {
    json = JSON.parse(block);
  } catch (e) {
    return { ok: false, reason: `state block is not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    return { ok: true, state: parseState(json) };
  } catch (e) {
    if (e instanceof ConfigError) return { ok: false, reason: `state does not match the schema at ${e.path}: ${e.message}` };
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
