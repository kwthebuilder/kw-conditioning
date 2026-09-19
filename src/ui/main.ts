/**
 * Phase 0 placeholder page: today's date and the version stack.
 * The clock lives here, in the UI layer, never in the engine.
 */
import { APP_VERSION, SPEC_NAME } from '../version';

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function row(dt: string, dd: string): string {
  return `<dt>${dt}</dt><dd>${dd}</dd>`;
}

async function render(root: HTMLElement): Promise<void> {
  const today = new Date();
  const rows: string[] = [
    row('Date', `<time datetime="${isoDate(today)}">${isoDate(today)}</time>`),
    row('App', APP_VERSION),
    row('Spec', SPEC_NAME),
  ];
  let error: string | null = null;
  try {
    const cfg = await import('../config/load');
    rows.push(
      row('Config', cfg.CONFIG_VERSION),
      row('Vectors', cfg.VECTORS_VERSION),
      row('State schema', String(cfg.STATE_SCHEMA)),
    );
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  root.innerHTML =
    `<h1>Acro Base S&amp;C</h1><dl>${rows.join('')}</dl>` +
    (error ? `<p class="error">Config failed to load:\n${error}</p>` : '');
}

const root = document.getElementById('app');
if (root) void render(root);
