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
import { checkRepo, pullLatest, pushExport, SyncError, type SyncSettings } from '../storage/sync';
import { browserDeps, lastBackup, loadSettings, pending, saveSettings, whenText } from './backup';
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
  backup: { settings: loadSettings(), status: '' },
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
          requestBackup();
        }
        render();
      })();
    },
    saveBackup: (settings: SyncSettings) => {
      void (async () => {
        setBackupStatus('Checking the repo…');
        try {
          await checkRepo(deps, settings);
        } catch (e) {
          setBackupStatus(errorText(e));
          return;
        }
        // Never let a blank or older phone overwrite a fuller backup (a wiped phone being set up again).
        let remote: string | null;
        try {
          remote = await pullLatest(deps, settings);
        } catch (e) {
          setBackupStatus(errorText(e));
          return;
        }
        const r = remote === null ? null : importMarkdown(remote);
        const here = app.state.log.length;
        if (r?.ok && r.state.log.length > here) {
          const there = r.state.log.length;
          if (window.confirm(`GitHub already has a backup with ${there} log entries; this phone has ${here}. Restore the backup onto this phone?`)) {
            app.state = r.state;
            store.save(r.state);
            saveSettings(settings);
            app.backup.settings = settings;
            backupError = null;
            pending.set(false);
            lastBackup.set(new Date().toISOString());
            render();
            return;
          }
          if (!window.confirm(`Overwrite the GitHub backup (${there} entries) with this phone's ${here}? Older versions stay in the repo's history.`)) {
            setBackupStatus('Backup not set up. Nothing was changed on GitHub or on this phone.');
            return;
          }
        }
        saveSettings(settings);
        app.backup.settings = settings;
        backupError = null;
        pending.set(true);
        render();
        await runBackup();
      })();
    },
    backupNow: () => {
      pending.set(true);
      void runBackup();
    },
    restoreFromGitHub: () => {
      const s = app.backup.settings;
      if (!s) return;
      void (async () => {
        setBackupStatus('Fetching the backup…');
        let text: string | null;
        try {
          text = await pullLatest(deps, s);
        } catch (e) {
          setBackupStatus(errorText(e));
          return;
        }
        if (text === null) {
          setBackupStatus('Nothing backed up on GitHub yet.');
          return;
        }
        const r = importMarkdown(text);
        if (!r.ok) {
          app.banner = `Restore refused, nothing changed: ${r.reason}`;
        } else if (window.confirm(`Replace what is on this phone with the backup on GitHub (${r.state.log.length} log entries)?`)) {
          app.state = r.state;
          store.save(r.state);
          pending.set(false);
          lastBackup.set(new Date().toISOString());
          app.banner = null;
          app.showExport = false;
        }
        render();
        refreshBackupStatus();
      })();
    },
    forgetBackup: () => {
      if (!window.confirm('Remove the GitHub token from this phone? Automatic backup stops until you paste one again.')) return;
      saveSettings(null);
      app.backup.settings = null;
      backupError = null;
      render();
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
  refreshBackupStatus();
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
    requestBackup();
  } catch (e) {
    app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
  }
  render();
}

// ---------------------------------------------------------------------
// GitHub backup (engine_spec_v1_7.md §12)
// ---------------------------------------------------------------------

const deps = browserDeps();
let backupTimer: ReturnType<typeof setTimeout> | undefined;
let backupRunning = false;
let backupAgain = false;
let backupError: string | null = null;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * The status line is patched in place, never by a full render, so a
 * backup finishing in the background cannot wipe a half-typed set.
 */
function setBackupStatus(text: string): void {
  app.backup.status = text;
  for (const el of document.querySelectorAll('.backup-status')) el.textContent = text;
}

/** One place that decides the status line from the facts. */
function refreshBackupStatus(): void {
  if (!app.backup.settings) return setBackupStatus('Automatic backup is off. Tap Backup to set it up.');
  if (backupRunning) return setBackupStatus('Backing up…');
  if (backupError) return setBackupStatus(backupError);
  const last = lastBackup.get();
  const lastText = last ? `Last backed up ${whenText(last)}.` : 'Nothing sent yet.';
  setBackupStatus(pending.get() ? `Backup waiting to send. ${lastText}` : `Backed up to GitHub. ${lastText}`);
}

/** Called after every change to state: mark it unsent and back up a few seconds later. */
function requestBackup(): void {
  pending.set(true);
  if (!app.backup.settings) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => void runBackup(), 3000);
}

async function runBackup(): Promise<void> {
  const s = app.backup.settings;
  if (!s) return;
  if (backupRunning) {
    backupAgain = true;
    return;
  }
  backupRunning = true;
  refreshBackupStatus();
  try {
    // Named by today's date, not the date being viewed.
    await pushExport(deps, s, exportMarkdown(app.state, cfg, isoToday()));
    pending.set(false);
    lastBackup.set(new Date().toISOString());
    backupError = null;
  } catch (e) {
    const retry = e instanceof SyncError ? e.retryable : true;
    backupError = retry ? `Backup waiting: ${errorText(e)}` : `Backup failed: ${errorText(e)}`;
  } finally {
    backupRunning = false;
    refreshBackupStatus();
    if (backupAgain) {
      backupAgain = false;
      void runBackup();
    }
  }
}

render();

// Anything left unsent from last time goes now, and again whenever signal returns.
if (app.backup.settings && pending.get()) void runBackup();
window.addEventListener('online', () => {
  if (pending.get()) void runBackup();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pending.get()) void runBackup();
});

// Ask the browser not to evict saved state. WebKit grants this on
// heuristics such as running as a Home Screen web app; a refusal changes
// nothing, and the export stays the record of truth (CLAUDE.md rule 7).
void navigator.storage?.persist?.().catch(() => false);

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
