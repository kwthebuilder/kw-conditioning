/**
 * App bootstrap and actions. The clock lives here and nowhere else.
 * Live logging goes through update(); corrections through amend(),
 * previewed first (engine A.23, A.28; ui_spec_v1_1.md).
 */
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../config/load';
import type { IsoDate, LiftId, State } from '../config/types';
import { amend, AmendError, defaultDay, planSnapshot, prescribe, roundLoad, sameTarget, stateBefore, update } from '../engine';
import type { AnyLog, BarbellOutcome, CorrectionAction, CorrectionLog, ReplayStep, SessionDay, SessionResult } from '../engine';
import { exportMarkdown, importMarkdown, localStorageStore, memoryStore, type Store } from '../storage';
import { checkRepo, pullLatest, pushExport, SyncError, type SyncSettings } from '../storage/sync';
import { browserDeps, lastBackup, loadSettings, pending, saveSettings, whenText } from './backup';
import { APP_VERSION } from '../version';
import { readTextFile, shareOrDownload } from './io';
import {
  addDays,
  buildHistory,
  checkInDue,
  clockText,
  dayFor,
  didText,
  displayName,
  kg,
  liveDate,
  minutesSince,
  nextFor,
  outcomeLine,
  prettyDate,
  recordFor,
  stateDiff,
  type History,
} from './model';
import { renderApp, type App, type Ctx, type FinishView, type Mode } from './view';

const cfg = PROGRAMME_CONFIG;
const BASE = INITIAL_STATE;

function isoToday(): IsoDate {
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

// ---------------------------------------------------------------------
// set ticks (ui_spec §14.2), kept on the phone for a few days; not engine state
// ---------------------------------------------------------------------

const TICKS_KEY = 'acro-base-sc/ticks';
function loadTicks(): Map<string, boolean[]> {
  try {
    const raw = window.localStorage.getItem(TICKS_KEY);
    if (!raw) return new Map();
    const cutoff = addDays(isoToday(), -3);
    const o = JSON.parse(raw) as Record<string, boolean[]>;
    return new Map(Object.entries(o).filter(([k]) => k.slice(0, 10) >= cutoff));
  } catch {
    return new Map();
  }
}
function saveTicks(m: Map<string, boolean[]>): void {
  try {
    window.localStorage.setItem(TICKS_KEY, JSON.stringify(Object.fromEntries(m)));
  } catch {
    /* preference only */
  }
}
const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const today0 = isoToday();
const app: App = {
  state: store.load() ?? INITIAL_STATE,
  date: today0,
  live: today0,
  today: today0,
  editing: null,
  ticks: loadTicks(),
  focus: null,
  setsAsk: null,
  tissueOpen: false,
  open: new Set(),
  forms: new Map(),
  skipOpen: null,
  zeroAsk: null,
  errors: new Map(),
  sheet: null,
  offlineReady: false,
  banner: null,
  showExport: false,
  lastExport: null,
  backup: { settings: loadSettings(), status: '' },
};

// ---------------------------------------------------------------------
// history, cached per state object
// ---------------------------------------------------------------------

let cache: { state: State; h: History } | null = null;
function history(): History {
  if (!cache || cache.state !== app.state) cache = { state: app.state, h: buildHistory(BASE, app.state, cfg) };
  return cache.h;
}

app.live = liveDate(app.today, Date.now(), history());
app.date = app.live;

/** The day chosen for a date, kept in the browser so a reload shows the same day. Not engine state. */
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

function currentMode(): Mode {
  if (app.editing && app.editing.date === app.date) return 'edit';
  if (app.date === app.live) return 'live';
  return app.date < app.live ? 'record' : 'preview';
}

/** The day for a live or preview date: what was logged, else the athlete's choice, else A.22. */
function liveDay(): SessionDay | undefined {
  const logged = dayFor(history().byDate.get(app.date) ?? [], app.date, cfg);
  if (logged) return logged;
  return app.day ?? recallDay(app.date);
}

// ---------------------------------------------------------------------
// state changes
// ---------------------------------------------------------------------

function setState(next: State): void {
  app.state = next;
  store.save(next);
  app.banner = null;
  app.live = liveDate(app.today, Date.now(), history());
  requestBackup();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(text: string, undo?: () => void): void {
  document.querySelector('.toast')?.remove();
  if (toastTimer) clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = text;
  el.append(span);
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Undo';
    b.addEventListener('click', () => {
      el.remove();
      if (toastTimer) clearTimeout(toastTimer);
      undo();
    });
    el.append(b);
  }
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), 10_000);
}

/** Live logging (ui_spec §4.1): the first item of a session also saves the plan as shown (A.27). */
function logLive(logs: AnyLog[], label: string): void {
  const prev = app.state;
  let s = app.state;
  try {
    const steps = history().byDate.get(app.live) ?? [];
    if (!steps.some((x) => x.item.log.kind === 'session_start')) {
      const sess = prescribe(s, cfg, app.live, liveDay());
      if (sess.kind === 'session') {
        s = update(s, { kind: 'session_start', date: app.live, day: sess.day, at: new Date().toISOString(), plan: planSnapshot(sess, cfg) }, cfg).state;
        rememberDay(app.live, sess.day);
      }
    }
    for (const l of logs) s = update(s, l, cfg).state;
  } catch (e) {
    app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
    render();
    return;
  }
  app.skipOpen = null;
  app.zeroAsk = null;
  app.setsAsk = null;
  app.focus = null;
  setState(s);
  render();
  showToast(`Logged: ${label}`, () => {
    setState(prev);
    render();
    showToast('Undone');
  });
}

let pendingCorrection: { correction: CorrectionLog } | null = null;

/** Plain lines for what a correction changes (ui_spec §7). */
function changeLines(actions: CorrectionAction[]): string[] {
  const h = history();
  const name = (log: AnyLog): string => {
    const slot = 'slot' in log ? log.slot : 'lift' in log ? log.lift : log.kind === 'cmj' ? 'cmj' : '';
    return slot ? displayName(String(slot), cfg) : didText(log, cfg);
  };
  const out: string[] = [];
  for (const a of actions) {
    if (a.op === 'insert') {
      if (a.entry.kind === 'session_start' || a.entry.kind === 'session_end') continue;
      out.push(`${prettyDate(a.entry.date)} · ${name(a.entry)}: add ${didText(a.entry, cfg)}`);
      continue;
    }
    const before = h.steps.find((s) => sameTarget(s.item.origin, a.target))?.item.log;
    if (!before) {
      out.push('An entry that no longer exists');
      continue;
    }
    if (a.op === 'remove') out.push(`${prettyDate(before.date)} · ${name(before)}: remove ${didText(before, cfg)}`);
    else out.push(`${prettyDate(before.date)} · ${name(before)}: ${didText(before, cfg)} → ${didText(a.entry, cfg)}`);
  }
  return out;
}

function previewCorrection(on: IsoDate, actions: CorrectionAction[]): void {
  const correction: CorrectionLog = { kind: 'correction', date: app.today, on, actions };
  try {
    const r = amend(BASE, app.state, correction, cfg);
    pendingCorrection = { correction };
    app.sheet = { kind: 'preview', changes: changeLines(actions), effects: stateDiff(app.state, r.state, cfg, app.live) };
  } catch (e) {
    pendingCorrection = null;
    app.sheet = { kind: 'preview', changes: [], effects: [], error: e instanceof AmendError || e instanceof Error ? e.message : String(e) };
  }
  render();
}

function saveCorrection(note: string): void {
  if (!pendingCorrection) return;
  const correction: CorrectionLog = { ...pendingCorrection.correction, ...(note ? { note } : {}) };
  const prev = app.state;
  try {
    const r = amend(BASE, app.state, correction, cfg);
    pendingCorrection = null;
    app.sheet = null;
    app.editing = null;
    for (const k of [...app.open]) if (k.startsWith('edit|') || k.startsWith('change|')) app.open.delete(k);
    setState(r.state);
    render();
    showToast('Correction saved', () => {
      setState(prev);
      render();
      showToast('Undone');
    });
  } catch (e) {
    app.sheet = { kind: 'preview', changes: [], effects: [], error: e instanceof Error ? e.message : String(e) };
    render();
  }
}

// ---------------------------------------------------------------------
// render
// ---------------------------------------------------------------------

function render(): void {
  const mode = currentMode();
  const h = history();
  let session: SessionResult | undefined;
  let record: ReturnType<typeof recordFor> | undefined;
  if (mode === 'live' || mode === 'preview') {
    session = prescribe(app.state, cfg, app.date, liveDay());
  } else {
    const hint = app.editing?.date === app.date ? app.editing.day : undefined;
    record = recordFor(h, BASE, app.state, cfg, app.date, hint);
  }
  const tissueDue = mode === 'live' && app.live === app.today ? checkInDue(h, app.today) : undefined;
  const ctx: Ctx = {
    config: cfg,
    base: BASE,
    history: h,
    mode,
    ...(app.sheet?.kind === 'finish' ? { finishView: finishView(h, session) } : {}),
    ...(tissueDue && !tissueDismissed(tissueDue) ? { tissueDue } : {}),
    tissueProtocol: mode === 'live' && app.live === app.today && (h.byDate.get(app.today) ?? []).some((st) => st.item.log.kind === 'tissue_check' && Object.values(st.item.log.scores).some((v) => (v ?? 0) > 3)),
    finishNow,
    skipRest: (slots) => {
      let s = app.state;
      try {
        for (const slot of slots) s = update(s, { kind: 'skip', slot, date: app.live }, cfg).state;
      } catch (e) {
        app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
        render();
        return;
      }
      setState(s);
      finishNow();
    },
    backToSession: (slot) => {
      app.sheet = null;
      const sess = prescribe(app.state, cfg, app.live, liveDay());
      if (sess.kind === 'session') {
        const i = sess.blocks.findIndex((b) => b.items.some((it) => it.kind === 'slot' && it.slot === slot));
        app.focus = slot === 'cmj' ? { date: app.live, block: 0 } : i >= 0 ? { date: app.live, block: i + 1 } : null;
      }
      render();
      document.querySelector('.card.focus')?.scrollIntoView({ block: 'start' });
    },
    tick: (key, index, on, label, slot) => {
      const t = [...(app.ticks.get(key) ?? [])];
      t[index] = on;
      for (let i = 0; i < t.length; i++) t[i] = t[i] ?? false;
      app.ticks.set(key, t);
      saveTicks(app.ticks);
      if (on) startRest(label, slot);
    },
    focusBlock: (block) => {
      app.focus = { date: app.date, block };
      render();
      document.querySelector('.card.focus')?.scrollIntoView({ block: 'start' });
    },
    previewLift,
    saveTissue: (forDate, scores) => {
      const prev = app.state;
      try {
        setState(update(app.state, { kind: 'tissue_check', date: app.today, for_date: forDate, scores }, cfg).state);
      } catch (e) {
        app.banner = `Not saved: ${e instanceof Error ? e.message : String(e)}`;
        render();
        return;
      }
      app.tissueOpen = false;
      render();
      showToast('Check-in saved', () => {
        setState(prev);
        render();
        showToast('Undone');
      });
    },
    dismissTissue: (forDate) => {
      try {
        window.localStorage.setItem(`acro-base-sc/tissue-dismissed/${forDate}`, '1');
      } catch {
        /* preference only */
      }
      render();
    },
    ...(session ? { session } : {}),
    ...(record ? { record } : {}),
    rerender: render,
    setDate: (date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (app.editing && app.editing.drafts.length && date !== app.editing.date && !window.confirm('Discard the changes you have not saved?')) return;
      if (app.editing && date !== app.editing.date) app.editing = null;
      app.date = date;
      app.day = undefined;
      app.skipOpen = null;
      app.zeroAsk = null;
      render();
      window.scrollTo({ top: 0 });
    },
    setDay: (day) => {
      app.day = day;
      if (app.editing) app.editing.day = day;
      if (currentMode() === 'live') rememberDay(app.date, day);
      render();
    },
    logLive,
    previewCorrection,
    saveCorrection,
    closeSheet: () => {
      app.sheet = null;
      pendingCorrection = null;
      render();
    },
    startEdit: () => {
      const v = recordFor(history(), BASE, app.state, cfg, app.date);
      const day = v.day ?? defaultDay(stateBefore(BASE, app.state.log, cfg, app.date));
      app.editing = { date: app.date, day, drafts: [] };
      render();
    },
    cancelEdit: () => {
      if (app.editing?.drafts.length && !window.confirm('Discard the changes you have not saved?')) return;
      app.editing = null;
      for (const k of [...app.open]) if (k.startsWith('edit|')) app.open.delete(k);
      render();
    },
    setDraft: (d) => {
      if (!app.editing) return;
      app.editing.drafts = [...app.editing.drafts.filter((x) => x.slot !== d.slot), d];
      render();
    },
    dropDraft: (slot) => {
      if (!app.editing) return;
      app.editing.drafts = app.editing.drafts.filter((x) => x.slot !== slot);
      render();
    },
    reviewEdit: () => {
      const ed = app.editing;
      if (!ed || ed.drafts.length === 0) {
        app.banner = 'No changes yet. Use Change, Add or Remove on an item first.';
        render();
        return;
      }
      let actions: CorrectionAction[] = ed.drafts.flatMap((d) => d.actions);
      // A session added to an empty date gets its start (with the plan) and its end (A.27).
      if (!(history().byDate.get(ed.date)?.length) && ed.day !== undefined) {
        const v = recordFor(history(), BASE, app.state, cfg, ed.date, ed.day);
        if (v.plan) actions = [{ op: 'insert', entry: { kind: 'session_start', date: ed.date, day: ed.day, plan: v.plan } }, ...actions, { op: 'insert', entry: { kind: 'session_end', date: ed.date, day: ed.day } }];
      }
      previewCorrection(ed.date, actions);
    },
    openTm: (lift) => {
      app.sheet = { kind: 'tm', lift };
      render();
    },
    saveTm: (lift: LiftId, tm: number, note: string) => {
      const prev = app.state;
      try {
        const s = update(app.state, { kind: 'tm_override', date: app.live, lift, tm, ...(note ? { note } : {}) }, cfg).state;
        app.sheet = null;
        setState(s);
        render();
        showToast(`${displayName(lift, cfg)} max set to ${tm.toFixed(1)} kg`, () => {
          setState(prev);
          render();
          showToast('Undone');
        });
      } catch (e) {
        app.banner = `Not saved: ${e instanceof Error ? e.message : String(e)}`;
        render();
      }
    },
    finish: () => {
      document.querySelector('.toast')?.remove();
      app.sheet = { kind: 'finish' };
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
          const file = exportMarkdown(app.state, cfg, isoToday());
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
          replaceState(r.state);
          app.showExport = false;
          app.lastExport = null;
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
            replaceState(r.state, false);
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
          replaceState(r.state, false);
          pending.set(false);
          lastBackup.set(new Date().toISOString());
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
  };
  root!.replaceChildren(renderApp(app, ctx, APP_VERSION));
  refreshBackupStatus();
  drawRestBar();
  void syncWakeLock();
}

// ---------------------------------------------------------------------
// live preview, finish summary (ui_spec §14.3, §14.6)
// ---------------------------------------------------------------------

/** What logging this barbell set would do, computed by the engine without saving. */
function previewLift(log: AnyLog): string {
  try {
    const r = update(app.state, log, cfg);
    const o = r.outcome as BarbellOutcome | null;
    if (!o) return '';
    const step = { item: { origin: -1, log, corrections: [] }, entry: r.state.log[r.state.log.length - 1], explanation: r.explanation, outcome: o } as unknown as ReplayStep;
    let line = `If you log this: ${outcomeLine(step, cfg)}`;
    if (log.kind === 'barbell' && log.mode === 'wave' && o.rule !== 'position1') {
      line += ` Next heavy week ${kg(roundLoad(o.tm_after * cfg.wave.positions['3'].pct, cfg.equipment.barbell_round_kg))} kg.`;
    }
    return line;
  } catch (e) {
    return `Can't preview: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function sessionSteps(): ReturnType<History['byDate']['get']> {
  return history().byDate.get(app.live) ?? [];
}

function sessionOpen(): boolean {
  const steps = sessionSteps() ?? [];
  return steps.some((s) => s.item.log.kind === 'session_start') && !steps.some((s) => s.item.log.kind === 'session_end');
}

/** The date a lift is likely next done, for which block its next load comes from. */
function nextDateFor(lift: 'front_squat' | 'deadlift', day: SessionDay | undefined): string {
  const own = lift === 'front_squat' ? 1 : 2;
  if (day === undefined) return addDays(app.live, 1);
  if (day === own) return addDays(app.live, 7);
  return addDays(app.live, own === 2 ? 3 : 4);
}

function finishView(h: History, session: SessionResult | undefined): FinishView {
  const steps = h.byDate.get(app.live) ?? [];
  const day = liveDay() ?? (session?.kind === 'session' ? session.day : undefined);
  const end = [...steps].reverse().find((s) => s.item.log.kind === 'session_end');
  const finished = end !== undefined;
  const rec = recordFor(h, BASE, app.state, cfg, app.live, day);
  const unlogged = rec.rows.filter((r) => r.status === 'not_logged').map((r) => ({ slot: r.item.slot, name: displayName(r.item.slot, cfg) }));
  const start = steps.find((s) => s.item.log.kind === 'session_start');
  let minutes: number | undefined;
  if (end && end.item.log.kind === 'session_end') minutes = end.item.log.minutes;
  else if (start && start.item.log.kind === 'session_start') minutes = minutesSince(start.item.log.at, Date.now());
  let moved: string[] = [];
  try {
    moved = stateDiff(stateBefore(BASE, app.state.log, cfg, app.live), app.state, cfg, app.live).filter((l) => !l.includes('next session'));
  } catch {
    moved = [];
  }
  const next = (['front_squat', 'deadlift'] as const).map((lift) => `${displayName(lift, cfg)}: ${nextFor(app.state, lift, cfg, nextDateFor(lift, day))}`);
  const v: FinishView = { unlogged, finished, moved, next, backupOk: app.backup.settings !== null && backupError === null };
  if (minutes !== undefined) v.minutes = minutes;
  return v;
}

function finishNow(): void {
  const steps = sessionSteps() ?? [];
  const day = liveDay() ?? 1;
  if (!steps.some((s) => s.item.log.kind === 'session_end')) {
    const start = steps.find((s) => s.item.log.kind === 'session_start');
    const at = new Date();
    const minutes = start && start.item.log.kind === 'session_start' ? minutesSince(start.item.log.at, at.getTime()) : undefined;
    try {
      setState(update(app.state, { kind: 'session_end', date: app.live, day, at: at.toISOString(), ...(minutes !== undefined ? { minutes } : {}) }, cfg).state);
    } catch (e) {
      app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  rest = null;
  document.querySelector('.toast')?.remove();
  app.sheet = { kind: 'finish' };
  render();
}

function tissueDismissed(forDate: string): boolean {
  try {
    return window.localStorage.getItem(`acro-base-sc/tissue-dismissed/${forDate}`) === '1';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// rest timer, session clock, screen awake (ui_spec §14.5)
// ---------------------------------------------------------------------

let rest: { since: number; label: string; slot: string; buzzed: boolean } | null = null;
const REST_TARGETS = [0, 90, 120, 180];

function restTarget(slot: string): number {
  try {
    return Number(window.localStorage.getItem(`acro-base-sc/rest/${slot}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function setRestTarget(slot: string, secs: number): void {
  try {
    if (secs) window.localStorage.setItem(`acro-base-sc/rest/${slot}`, String(secs));
    else window.localStorage.removeItem(`acro-base-sc/rest/${slot}`);
  } catch {
    /* preference only */
  }
}

function startRest(label: string, slot: string): void {
  rest = { since: Date.now(), label, slot, buzzed: false };
  drawRestBar();
}

const restBar = document.createElement('div');
restBar.className = 'restbar';
restBar.hidden = true;
document.body.append(restBar);

/** Builds the bar when what it shows changes; tickRestBar() updates the times each second. */
function drawRestBar(): void {
  const live = currentMode() === 'live' && !app.showExport;
  const open = live && sessionOpen();
  const showRest = live && rest !== null && Date.now() - rest.since < 20 * 60_000;
  restBar.hidden = !open && !showRest;
  restBar.replaceChildren();
  if (restBar.hidden) return;
  const line = document.createElement('div');
  line.className = 'restline';
  if (open) {
    const clock = document.createElement('span');
    clock.className = 'session-clock';
    line.append(clock);
  }
  if (showRest && rest) {
    const r = document.createElement('span');
    r.className = 'rest-clock';
    line.append(r);
  }
  if (showRest && rest) {
    // One button cycles the athlete's target for this exercise: none, 1:30, 2:00, 3:00.
    const cur = restTarget(rest.slot);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rest-target';
    b.textContent = cur ? `Target ${clockText(cur * 1000)}` : 'Set target';
    b.setAttribute('aria-label', `Rest target for ${rest.label}: ${cur ? clockText(cur * 1000) : 'none'}. Tap to change.`);
    b.addEventListener('click', () => {
      if (!rest) return;
      const i = REST_TARGETS.indexOf(restTarget(rest.slot));
      setRestTarget(rest.slot, REST_TARGETS[(i + 1) % REST_TARGETS.length]!);
      rest.buzzed = false;
      drawRestBar();
    });
    line.append(b);
  }
  restBar.append(line);
  tickRestBar();
}

function tickRestBar(): void {
  if (restBar.hidden) return;
  const now = Date.now();
  const clock = restBar.querySelector('.session-clock');
  if (clock) {
    const start = (sessionSteps() ?? []).find((s) => s.item.log.kind === 'session_start');
    const at = start && start.item.log.kind === 'session_start' && start.item.log.at ? Date.parse(start.item.log.at) : NaN;
    clock.textContent = Number.isFinite(at) ? `Session ${clockText(now - at)}` : '';
  }
  const rc = restBar.querySelector('.rest-clock');
  if (rc && rest) {
    const el = now - rest.since;
    const target = restTarget(rest.slot);
    rc.textContent = `Rest ${clockText(el)}${target ? ` of ${clockText(target * 1000)}` : ''} · ${rest.label}`;
    const due = target > 0 && el >= target * 1000;
    restBar.classList.toggle('due', due);
    if (due && !rest.buzzed) {
      rest.buzzed = true;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* not supported */
      }
    }
  } else restBar.classList.remove('due');
}
setInterval(tickRestBar, 1000);

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void };
let wakeLock: WakeLockSentinelLike | null = null;
async function syncWakeLock(): Promise<void> {
  const want = currentMode() === 'live' && sessionOpen() && document.visibilityState === 'visible';
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
  if (!wl) return;
  try {
    if (want && !wakeLock) {
      wakeLock = await wl.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!want && wakeLock) {
      const w = wakeLock;
      wakeLock = null;
      await w.release();
    }
  } catch {
    /* the browser said no; the session runs as normal */
  }
}

/** A whole new state from a file or the backup: reset everything on screen. */
function replaceState(s: State, backup = true): void {
  app.state = s;
  store.save(s);
  app.banner = null;
  app.editing = null;
  app.sheet = null;
  app.forms.clear();
  app.errors.clear();
  app.open.clear();
  app.live = liveDate(app.today, Date.now(), history());
  app.date = app.live;
  app.day = undefined;
  if (backup) requestBackup();
}

// ---------------------------------------------------------------------
// the date moves on (ui_spec §9)
// ---------------------------------------------------------------------

function refreshClock(): void {
  const t = isoToday();
  const live = liveDate(t, Date.now(), history());
  if (t === app.today && live === app.live) return;
  const wasOnLive = app.date === app.live;
  app.today = t;
  app.live = live;
  if (wasOnLive && !app.editing) {
    app.date = live;
    app.day = undefined;
  }
  render();
}

// ---------------------------------------------------------------------
// GitHub backup (engine_spec_v1_8.md §12)
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
  const pill = document.querySelector('.pill');
  if (pill) {
    const cls = !app.backup.settings ? 'off' : /waiting|failed/i.test(text) ? 'wait' : 'ok';
    pill.className = `pill ${cls}`;
    pill.textContent = !app.backup.settings ? 'Backup off' : cls === 'wait' ? 'Backup waiting' : 'Backed up';
    pill.setAttribute('title', text);
  }
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
  if (document.visibilityState !== 'visible') return;
  refreshClock();
  void syncWakeLock();
  if (pending.get()) void runBackup();
});
window.addEventListener('focus', refreshClock);
setInterval(refreshClock, 60_000);

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
