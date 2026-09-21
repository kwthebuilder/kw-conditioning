/**
 * App bootstrap: load state, render the Today screen, route every action
 * through update(), save after each change, register the service worker.
 * The clock lives here and nowhere else.
 */
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../config/load';
import type { LiftId } from '../config/types';
import { prescribe, update } from '../engine';
import type { AnyLog, LogEntry, SessionDay } from '../engine';
import { exportMarkdown, importMarkdown, localStorageStore, memoryStore, type Store } from '../storage';
import { APP_VERSION } from '../version';
import { readTextFile, shareOrDownload } from './io';
import { renderApp, type App, type Ctx } from './view';

const cfg = PROGRAMME_CONFIG;

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickStore(): Store {
  try {
    const s = window.localStorage;
    s.getItem('probe');
    return localStorageStore(s);
  } catch {
    return memoryStore();
  }
}

const store = pickStore();
const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const app: App = {
  state: store.load() ?? INITIAL_STATE,
  date: isoToday(),
  open: new Set(),
  offlineReady: false,
  banner: null,
  showExport: false,
  lastExport: null,
};

/** The day chosen for a date, kept in the browser so a reload mid-session shows the same day. Not engine state. */
function rememberDay(date: string, day: SessionDay | undefined): void {
  try {
    if (day === undefined) window.localStorage.removeItem(`acro-base-sc/day/${date}`);
    else window.localStorage.setItem(`acro-base-sc/day/${date}`, String(day));
  } catch {
    /* preference only */
  }
}
function recallDay(date: string): SessionDay | undefined {
  try {
    const v = window.localStorage.getItem(`acro-base-sc/day/${date}`);
    return v === '1' ? 1 : v === '2' ? 2 : undefined;
  } catch {
    return undefined;
  }
}

function render(): void {
  // A.22 picks the default once per date; logging must not flip the day mid-session, nor a reload.
  if (app.day === undefined) {
    app.day = recallDay(app.date);
    if (app.day === undefined) {
      const first = prescribe(app.state, cfg, app.date);
      if (first.kind === 'session') app.day = first.day;
    }
    rememberDay(app.date, app.day);
  }
  const ctx: Ctx = {
    session: prescribe(app.state, cfg, app.date, app.day),
    config: cfg,
    liftName: (id) => cfg.slots[id]?.name ?? id,
    commit,
    setDate: (date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      app.date = date;
      app.day = undefined;
      render();
    },
    setDay: (day: SessionDay) => {
      app.day = day;
      rememberDay(app.date, day);
      render();
    },
    toggleOpen: (key) => {
      if (app.open.has(key)) app.open.delete(key);
      else app.open.add(key);
      render();
    },
    openExport: () => {
      app.showExport = true;
      render();
    },
    closeExport: () => {
      app.showExport = false;
      app.lastExport = null;
      render();
    },
    exportNow: () => {
      void (async () => {
        try {
          const file = exportMarkdown(app.state, cfg, app.date);
          const how = await shareOrDownload(file);
          app.lastExport = `${file.filename} ${how === 'shared' ? 'shared' : 'downloaded'}.`;
        } catch (e) {
          app.banner = `Export failed: ${e instanceof Error ? e.message : String(e)}`;
        }
        render();
      })();
    },
    importFile: (file) => {
      void (async () => {
        const text = await readTextFile(file);
        const r = importMarkdown(text);
        if (!r.ok) {
          app.banner = `Import refused, nothing changed: ${r.reason}`;
        } else if (window.confirm(`Replace the current state with ${file.name}? This cannot be undone except by importing another file.`)) {
          app.state = r.state;
          store.save(r.state);
          app.banner = null;
          app.showExport = false;
          app.lastExport = null;
        }
        render();
      })();
    },
    editTm: (lift: LiftId) => {
      const current = app.state.lifts[lift].tm;
      const raw = window.prompt(`${cfg.slots[lift]?.name ?? lift} training max (kg, unrounded)`, current.toFixed(1));
      if (raw === null) return;
      const tm = Number(raw);
      if (!Number.isFinite(tm) || tm <= 0) {
        app.banner = `Not a training max: "${raw}"`;
        render();
        return;
      }
      if (tm === current) return;
      const note = window.prompt('Reason (optional)', '') ?? undefined;
      commit({ kind: 'tm_override', date: app.date, lift, tm, ...(note ? { note } : {}) });
    },
  };
  root!.replaceChildren(renderApp(app, ctx, APP_VERSION));
}

function commit(log: AnyLog): void {
  try {
    const r = update(app.state, log, cfg);
    // Keep the explanation steps on the log entry so the screen can show them.
    const entry = r.state.log[r.state.log.length - 1] as LogEntry & { steps?: string[] };
    entry.steps = r.explanation.steps.map((s) => s.text);
    app.state = r.state;
    store.save(r.state);
    app.banner = null;
  } catch (e) {
    app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
  }
  render();
}

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      app.offlineReady = navigator.serviceWorker.controller !== null;
      render();
    })
    .catch(() => {
      /* no offline support in this context; the app still runs */
    });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    app.offlineReady = true;
    render();
  });
}
