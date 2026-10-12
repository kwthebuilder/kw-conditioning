/**
 * App bootstrap and actions. The clock lives here and nowhere else.
 * Live logging goes through update(); corrections, added and removed
 * sessions through amend(), previewed first (engine A.23, A.28;
 * ui_spec_v1_3.md).
 */
import { INITIAL_STATE, PROGRAMME_CONFIG } from '../config/load';
import type { IsoDate, LiftId, State } from '../config/types';
import { amend, AmendError, defaultDay, planSnapshot, prescribe, roundLoad, sameTarget, update } from '../engine';
import type { AnyLog, BarbellOutcome, CorrectionAction, CorrectionLog, ReplayStep, SessionDay } from '../engine';
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
  didText,
  displayName,
  isOpen,
  kg,
  lastSessionOfDay,
  minutesSince,
  nextFor,
  openSession,
  outcomeLine,
  plannedText,
  prettyDate,
  recordOf,
  sessionRemoval,
  sessionsFrom,
  stateAtInsert,
  stateBeforeSession,
  stateDiff,
  type History,
  type RecordView,
  type SessionGroup,
} from './model';
import { renderApp, WHOLE_SESSION, type AddView, type App, type Ctx, type Draft, type FinishView, type LiveView, type Screen, type TodayState } from './view';

const cfg = PROGRAMME_CONFIG;
const BASE = INITIAL_STATE;
/** §11A: the first day a session can be added. */
const FIRST_DATE: IsoDate = cfg.mesocycles[0]!.start;
/** §5.5: the one drop-jump box (SPEC_QUESTIONS Q32). */
const BOX_CM = 51;

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
// preferences kept on the phone; not engine state
// ---------------------------------------------------------------------

function pref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function setPref(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* preference only */
  }
}

/** Set ticks (ui_spec §14.2), kept for a few days. */
const TICKS_KEY = 'acro-base-sc/ticks';
function loadTicks(): Map<string, boolean[]> {
  try {
    const raw = pref(TICKS_KEY);
    if (!raw) return new Map();
    const cutoff = addDays(isoToday(), -3);
    const o = JSON.parse(raw) as Record<string, boolean[]>;
    return new Map(Object.entries(o).filter(([k]) => k.slice(0, 10) >= cutoff));
  } catch {
    return new Map();
  }
}
function saveTicks(m: Map<string, boolean[]>): void {
  setPref(TICKS_KEY, JSON.stringify(Object.fromEntries(m)));
}

/** The next session's day as switched, so a reload shows the same day. */
function rememberDay(date: string, day: SessionDay | undefined): void {
  setPref(`acro-base-sc/day/${date}`, day === undefined ? null : String(day));
}
function recallDay(date: string): SessionDay | undefined {
  const v = pref(`acro-base-sc/day/${date}`);
  return v === '1' ? 1 : v === '2' ? 2 : undefined;
}

/** §9: the earlier session made live by Carry on, as "<session id>@<date>". */
const CARRY_KEY = 'acro-base-sc/carry';
function carryKey(g: SessionGroup): string {
  return `${g.id}@${g.date}`;
}

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const app: App = {
  state: store.load() ?? INITIAL_STATE,
  today: isoToday(),
  screen: { kind: 'today' },
  carry: pref(CARRY_KEY),
  startToday: false,
  showEarlier: false,
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

function setCarry(g: SessionGroup | null): void {
  app.carry = g ? carryKey(g) : null;
  setPref(CARRY_KEY, app.carry);
}

// ---------------------------------------------------------------------
// history and sessions, cached per state object
// ---------------------------------------------------------------------

let cache: { state: State; h: History; sessions: SessionGroup[]; records: Map<string, RecordView> } | null = null;
function cached(): NonNullable<typeof cache> {
  if (!cache || cache.state !== app.state) {
    const h = buildHistory(BASE, app.state, cfg);
    cache = { state: app.state, h, sessions: sessionsFrom(h, cfg), records: new Map() };
  }
  return cache;
}
const history = (): History => cached().h;
const sessions = (): SessionGroup[] => cached().sessions;
function recordOfGroup(g: SessionGroup): RecordView {
  const c = cached();
  let v = c.records.get(g.id);
  if (!v) {
    v = recordOf(c.h, BASE, app.state, cfg, g);
    c.records.set(g.id, v);
  }
  return v;
}
const findSession = (id: string): SessionGroup | undefined => sessions().find((g) => g.id === id);

// ---------------------------------------------------------------------
// what Today shows (ui_spec §3, §4.4, §9)
// ---------------------------------------------------------------------

/** The session being logged: today's open session, or an earlier one carried on. */
function liveGroup(): SessionGroup | undefined {
  const g = openSession(sessions(), app.today);
  if (!g) return undefined;
  if (g.date === app.today || app.carry === carryKey(g)) return g;
  return undefined;
}

/** §9: an earlier session still open and not carried on. */
function unfinishedGroup(): SessionGroup | undefined {
  const g = openSession(sessions(), app.today);
  return g && g.date < app.today && app.carry !== carryKey(g) ? g : undefined;
}

function doneTodayGroup(): SessionGroup | undefined {
  return sessions().filter((g) => g.date === app.today && g.end !== undefined).at(-1);
}

/** Ticks, forms and focus key: the date and the session's place among that date's sessions. */
function sessionKey(date: IsoDate, g?: SessionGroup): string {
  const ofDate = sessions().filter((x) => x.date === date);
  const i = g ? ofDate.indexOf(g) : ofDate.length;
  return `${date}#${i}`;
}

function nextDay(): SessionDay {
  return app.day ?? recallDay(app.today) ?? defaultDay(app.state);
}

function computeLive(): { todayState: TodayState; live: LiveView } {
  const g = liveGroup();
  if (g) {
    const day = g.day ?? 1;
    return { todayState: 'live', live: { date: g.date, day, session: prescribe(app.state, cfg, g.date, day), group: g, steps: g.steps, carried: g.date !== app.today, key: sessionKey(g.date, g) } };
  }
  const blocked = unfinishedGroup() !== undefined;
  const done = !blocked && doneTodayGroup() !== undefined && !app.startToday;
  const day = done ? defaultDay(app.state) : nextDay();
  const live: LiveView = { date: app.today, day, session: prescribe(app.state, cfg, app.today, day), steps: [], carried: false, key: sessionKey(app.today) };
  return { todayState: blocked ? 'blocked' : done ? 'done' : 'next', live };
}

// ---------------------------------------------------------------------
// state changes
// ---------------------------------------------------------------------

function setState(next: State): void {
  app.state = next;
  store.save(next);
  app.banner = null;
  requestBackup();
}

/**
 * §5.5 and §13A: one drop-jump box. If the stored height is not 51 cm,
 * log it once as a depth-jump height entry (engine A.23); the export
 * shows it like any other entry.
 */
function ensureBox(): void {
  if (app.state.depth_jump.height_cm === BOX_CM) return;
  try {
    setState(update(app.state, { kind: 'depth_jump_height', date: app.today, height_cm: BOX_CM }, cfg).state);
  } catch {
    /* a state the engine refuses is shown as it is; the box text falls back to none */
  }
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

/**
 * Live logging (ui_spec §4.1): logging the first item of the next session
 * starts it, saving the plan as shown (A.27). Entries carry the session's
 * date, so a session carried on from yesterday keeps its own (§9).
 */
function logLive(logs: AnyLog[], label: string): void {
  const prev = app.state;
  const prevStart = app.startToday;
  const prevDay = app.day;
  const { todayState, live } = computeLive();
  if (todayState !== 'live' && todayState !== 'next') return;
  let s = app.state;
  try {
    if (!live.group) {
      const sess = live.session;
      if (sess.kind === 'session') {
        s = update(s, { kind: 'session_start', date: live.date, day: sess.day, at: new Date().toISOString(), plan: planSnapshot(sess, cfg) }, cfg).state;
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
  app.startToday = false;
  // The session's day is fixed by its start; a later session today offers the rotation's day again.
  if (!live.group) {
    app.day = undefined;
    rememberDay(app.today, undefined);
  }
  setState(s);
  render();
  showToast(`Logged: ${label}`, () => {
    setState(prev);
    app.startToday = prevStart;
    app.day = prevDay;
    rememberDay(app.today, prevDay);
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

function previewCorrection(on: IsoDate, actions: CorrectionAction[], changes?: string[]): void {
  const correction: CorrectionLog = { kind: 'correction', date: app.today, on, actions };
  try {
    const r = amend(BASE, app.state, correction, cfg);
    pendingCorrection = { correction };
    app.sheet = { kind: 'preview', changes: changes ?? changeLines(actions), effects: stateDiff(app.state, r.state, cfg, app.today) };
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
  const prevScreen = app.screen;
  try {
    const r = amend(BASE, app.state, correction, cfg);
    pendingCorrection = null;
    app.sheet = null;
    for (const k of [...app.open]) if (k.startsWith('edit|') || k.startsWith('change|')) app.open.delete(k);
    setState(r.state);
    // Back to the record after an edit, unless the session was removed; to Today after adding a session.
    const sc = app.screen;
    if (sc.kind === 'edit') app.screen = findSession(sc.id) ? { kind: 'record', id: sc.id } : { kind: 'today' };
    else if (sc.kind === 'add') app.screen = { kind: 'today' };
    render();
    window.scrollTo({ top: 0 });
    showToast('Correction saved', () => {
      setState(prev);
      app.screen = prevScreen.kind === 'edit' ? { kind: 'record', id: prevScreen.id } : app.screen;
      render();
      showToast('Undone');
    });
  } catch (e) {
    app.sheet = { kind: 'preview', changes: [], effects: [], error: e instanceof Error ? e.message : String(e) };
    render();
  }
}

// ---------------------------------------------------------------------
// Add a missed session (ui_spec §11A)
// ---------------------------------------------------------------------

function rotationDayOn(date: IsoDate): SessionDay {
  try {
    return defaultDay(stateAtInsert(BASE, app.state.log, cfg, date));
  } catch {
    return defaultDay(app.state);
  }
}

function addView(sc: Extract<Screen, { kind: 'add' }>): AddView {
  const rotationDay = rotationDayOn(sc.date);
  const dayLines = { 1: '', 2: '' } as Record<SessionDay, string>;
  for (const d of [1, 2] as SessionDay[]) {
    if (d === rotationDay) dayLines[d] = `Next in your rotation on ${prettyDate(sc.date)}`;
    else {
      const last = lastSessionOfDay(sessions(), d, sc.date);
      dayLines[d] = last ? `Your last Day ${d} was ${prettyDate(last.date)}` : `No Day ${d} logged before this date`;
    }
  }
  const v: AddView = { rotationDay, dayLines, existing: sessions().filter((g) => g.date === sc.date), firstDate: FIRST_DATE };
  if (sc.step === 2) {
    try {
      const s = prescribe(stateAtInsert(BASE, app.state.log, cfg, sc.date), cfg, sc.date, sc.day);
      if (s.kind === 'session') v.plan = planSnapshot(s, cfg);
    } catch (e) {
      app.banner = `Can't rebuild the plan for that date: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return v;
}

function setDrafts(drafts: Draft[]): void {
  const sc = app.screen;
  if (sc.kind === 'edit' || sc.kind === 'add') app.screen = { ...sc, drafts };
}
function currentDrafts(): Draft[] {
  const sc = app.screen;
  return sc.kind === 'edit' || sc.kind === 'add' ? sc.drafts : [];
}

// ---------------------------------------------------------------------
// render
// ---------------------------------------------------------------------

function render(): void {
  const h = history();
  const groups = sessions();
  const { todayState, live } = computeLive();
  const unf = unfinishedGroup();
  const done = todayState === 'done' ? doneTodayGroup() : undefined;
  let record: Ctx['record'];
  const sc = app.screen;
  if (sc.kind === 'record' || sc.kind === 'edit') {
    const g = findSession(sc.id);
    if (g) record = { group: g, view: recordOfGroup(g), open: isOpen(g, app.today) };
    else app.screen = { kind: 'today' };
  }
  const add = app.screen.kind === 'add' ? addView(app.screen) : undefined;
  const tissueDue = !unf ? checkInDue(h, app.today) : undefined;
  const finishFor = app.sheet?.kind === 'finish' ? findSession(app.sheet.id) : undefined;
  const ctx: Ctx = {
    config: cfg,
    base: BASE,
    history: h,
    sessions: groups,
    todayState,
    live,
    ...(unf ? { unfinished: { group: unf, view: recordOfGroup(unf) } } : {}),
    ...(done ? { doneToday: { group: done, view: recordOfGroup(done) } } : {}),
    ...(record ? { record } : {}),
    ...(add ? { add } : {}),
    ...(app.state.depth_jump.height_cm != null ? { boxCm: app.state.depth_jump.height_cm } : {}),
    ...(finishFor ? { finishView: finishView(finishFor) } : {}),
    ...(tissueDue && !tissueDismissed(tissueDue) ? { tissueDue } : {}),
    tissueProtocol: !unf && (h.byDate.get(app.today) ?? []).some((st) => st.item.log.kind === 'tissue_check' && Object.values(st.item.log.scores).some((v) => (v ?? 0) > 3)),
    recordOf: recordOfGroup,
    isOpen: (g) => isOpen(g, app.today),
    rerender: render,
    setDay: (day) => {
      app.day = day;
      rememberDay(app.today, day);
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
    openRecord: (id) => {
      app.screen = { kind: 'record', id };
      app.banner = null;
      render();
      window.scrollTo({ top: 0 });
    },
    goToday: () => {
      app.screen = { kind: 'today' };
      app.banner = null;
      render();
      window.scrollTo({ top: 0 });
    },
    startEdit: () => {
      const s = app.screen;
      if (s.kind !== 'record') return;
      app.screen = { kind: 'edit', id: s.id, drafts: [] };
      render();
    },
    cancelEdit: () => {
      const s = app.screen;
      if (s.kind !== 'edit') return;
      if (s.drafts.length && !window.confirm('Discard the changes you have not saved?')) return;
      for (const k of [...app.open]) if (k.startsWith('edit|')) app.open.delete(k);
      app.screen = { kind: 'record', id: s.id };
      render();
    },
    setDraft: (d) => {
      setDrafts([...currentDrafts().filter((x) => x.slot !== d.slot && x.slot !== WHOLE_SESSION), d]);
      render();
    },
    dropDraft: (slot) => {
      setDrafts(currentDrafts().filter((x) => x.slot !== slot));
      render();
    },
    removeSession: () => {
      const s = app.screen;
      const g = s.kind === 'edit' ? findSession(s.id) : undefined;
      if (!g) return;
      setDrafts([{ slot: WHOLE_SESSION, actions: sessionRemoval(g), after: null }]);
      render();
    },
    reviewEdit: () => {
      const s = app.screen;
      const g = s.kind === 'edit' ? findSession(s.id) : undefined;
      if (s.kind !== 'edit' || !g) return;
      if (!s.drafts.length) {
        app.banner = 'No changes yet. Use Change, Remove, Add or Skip on an item first.';
        render();
        return;
      }
      const actions = s.drafts.flatMap((d) => d.actions);
      const whole = s.drafts.some((d) => d.slot === WHOLE_SESSION);
      previewCorrection(g.date, actions, whole ? [`${prettyDate(g.date)} · ${g.day !== undefined ? `Day ${g.day}` : 'Session'} removed`] : undefined);
    },
    openAdd: () => {
      const date = addDays(app.today, -1) < FIRST_DATE ? app.today : addDays(app.today, -1);
      app.screen = { kind: 'add', step: 1, date, day: rotationDayOn(date), separate: false, drafts: [] };
      app.banner = null;
      render();
      window.scrollTo({ top: 0 });
    },
    addDate: (date) => {
      const s = app.screen;
      if (s.kind !== 'add') return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < FIRST_DATE || date > app.today) {
        app.screen = { ...s, error: `Choose a day from ${prettyDate(FIRST_DATE)} up to today.` };
      } else {
        const { error: _drop, ...rest } = s;
        void _drop;
        app.screen = { ...rest, date, day: rotationDayOn(date), separate: false };
      }
      render();
    },
    addDay: (day) => {
      const s = app.screen;
      if (s.kind === 'add') app.screen = { ...s, day };
      render();
    },
    addNext: () => {
      const s = app.screen;
      if (s.kind !== 'add') return;
      app.screen = { ...s, step: 2, drafts: [] };
      render();
      window.scrollTo({ top: 0 });
    },
    addToExisting: (id) => {
      app.screen = { kind: 'edit', id, drafts: [] };
      render();
      window.scrollTo({ top: 0 });
    },
    addSeparate: () => {
      const s = app.screen;
      if (s.kind === 'add') app.screen = { ...s, separate: true };
      render();
    },
    addBack: () => {
      const s = app.screen;
      if (s.kind !== 'add') return;
      if (s.drafts.length && !window.confirm('Discard what you have entered?')) return;
      app.screen = { ...s, step: 1, drafts: [] };
      render();
    },
    cancelAdd: () => {
      const s = app.screen;
      if (s.kind === 'add' && s.drafts.length && !window.confirm('Discard what you have entered?')) return;
      for (const k of [...app.open]) if (k.startsWith('edit|')) app.open.delete(k);
      app.screen = { kind: 'today' };
      app.banner = null;
      render();
    },
    reviewAdd: () => {
      const s = app.screen;
      if (s.kind !== 'add') return;
      const v = addView(s);
      if (!v.plan) return;
      if (!s.drafts.length) {
        app.banner = 'Nothing entered yet. Use Add or Skip on an item first.';
        render();
        return;
      }
      // §11A: one correction: the start with the plan as shown, the entries in plan order, then the end.
      const order = ['cmj', ...v.plan.items.map((i) => i.slot)];
      const drafts = [...s.drafts].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
      const actions: CorrectionAction[] = [
        { op: 'insert', entry: { kind: 'session_start', date: s.date, day: s.day, plan: v.plan } },
        ...drafts.flatMap((d) => d.actions),
        { op: 'insert', entry: { kind: 'session_end', date: s.date, day: s.day } },
      ];
      const skipped = drafts.filter((d) => d.after?.kind === 'skip').length;
      const doneN = drafts.length - skipped;
      const counts = [doneN ? `${doneN} done` : '', skipped ? `${skipped} skipped` : ''].filter(Boolean).join(', ');
      previewCorrection(s.date, actions, [`${prettyDate(s.date)} · Day ${s.day} added · ${counts}`]);
    },
    carryOn: () => {
      const g = unfinishedGroup();
      if (g) setCarry(g);
      render();
    },
    closeIt: () => {
      const g = unfinishedGroup();
      if (g) askToFinish(g);
    },
    startToday: () => {
      app.startToday = true;
      app.day = undefined;
      render();
    },
    showEarlier: () => {
      app.showEarlier = true;
      render();
    },
    finishNow: () => {
      const g = app.sheet?.kind === 'finish' ? findSession(app.sheet.id) : undefined;
      if (g) finishSession(g);
    },
    skipRest: (slots) => {
      const g = app.sheet?.kind === 'finish' ? findSession(app.sheet.id) : undefined;
      if (!g) return;
      let s = app.state;
      try {
        for (const slot of slots) s = update(s, { kind: 'skip', slot, date: g.date }, cfg).state;
      } catch (e) {
        app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
        render();
        return;
      }
      setState(s);
      const again = sessions().find((x) => x.id === g.id);
      if (again) finishSession(again);
    },
    backToSession: (slot) => {
      const g = app.sheet?.kind === 'finish' ? findSession(app.sheet.id) : undefined;
      app.sheet = null;
      // Close it, then Log them: the session becomes live (Carry on).
      if (g && g.date < app.today) setCarry(g);
      app.screen = { kind: 'today' };
      const { live } = computeLive();
      const sess = live.session;
      if (sess.kind === 'session') {
        const i = sess.blocks.findIndex((b) => b.items.some((it) => it.kind === 'slot' && it.slot === slot));
        app.focus = slot === 'cmj' ? { key: live.key, block: 0 } : i >= 0 ? { key: live.key, block: i + 1 } : null;
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
      app.focus = { key: computeLive().live.key, block };
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
      setPref(`acro-base-sc/tissue-dismissed/${forDate}`, '1');
      render();
    },
    openTm: (lift) => {
      app.sheet = { kind: 'tm', lift };
      render();
    },
    saveTm: (lift: LiftId, tm: number, note: string) => {
      const prev = app.state;
      try {
        const s = update(app.state, { kind: 'tm_override', date: app.today, lift, tm, ...(note ? { note } : {}) }, cfg).state;
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
      const g = liveGroup();
      if (g) askToFinish(g);
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
// live preview, finish (ui_spec §10, §14.3, §14.6)
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

/** A live session is open on Today (for the rest bar and the screen staying awake). */
function sessionOpen(): boolean {
  return app.screen.kind === 'today' && liveGroup() !== undefined;
}

/** The date a lift is likely next done, for which block its next load comes from. */
function nextDateFor(lift: 'front_squat' | 'deadlift', day: SessionDay | undefined): string {
  const own = lift === 'front_squat' ? 1 : 2;
  if (day === undefined) return addDays(app.today, 1);
  if (day === own) return addDays(app.today, 7);
  return addDays(app.today, own === 2 ? 3 : 4);
}

const backupOk = (): boolean => app.backup.settings !== null && backupError === null;

function finishView(g: SessionGroup): FinishView {
  const rec = recordOfGroup(g);
  const unrecorded = rec.rows.filter((r) => r.status === 'not_logged').map((r) => ({ slot: r.item.slot, name: displayName(r.item.slot, cfg), plan: r.item.slot === 'cmj' ? 'Before the warm-up' : plannedText(r.item) }));
  const start = g.start?.item.log;
  const end = g.end?.item.log;
  let minutes: number | undefined;
  if (end && end.kind === 'session_end') minutes = end.minutes;
  else if (start && start.kind === 'session_start') minutes = minutesSince(start.at, Date.now());
  let moved: string[] = [];
  try {
    moved = stateDiff(stateBeforeSession(BASE, app.state.log, cfg, g), app.state, cfg, app.today).filter((l) => !l.includes('next session'));
  } catch {
    moved = [];
  }
  const next = (['front_squat', 'deadlift'] as const).map((lift) => `${displayName(lift, cfg)}: ${nextFor(app.state, lift, cfg, nextDateFor(lift, g.day))}`);
  const v: FinishView = { unrecorded, finished: g.end !== undefined, moved, next, backupOk: backupOk() };
  if (minutes !== undefined) v.minutes = minutes;
  return v;
}

/** §10: Finish (or Close it) asks about items not recorded first; with none, it finishes. */
function askToFinish(g: SessionGroup): void {
  document.querySelector('.toast')?.remove();
  if (recordOfGroup(g).rows.some((r) => r.status === 'not_logged') && !g.end) {
    app.sheet = { kind: 'finish', id: g.id };
    render();
    return;
  }
  finishSession(g);
}

/** §10: one session_end per session, with the length when the start time is known; then the summary and a copy. */
function finishSession(g: SessionGroup): void {
  if (!g.end) {
    const start = g.start?.item.log;
    const at = new Date();
    const minutes = start && start.kind === 'session_start' ? minutesSince(start.at, at.getTime()) : undefined;
    try {
      setState(update(app.state, { kind: 'session_end', date: g.date, day: g.day ?? 1, at: at.toISOString(), ...(minutes !== undefined ? { minutes } : {}) }, cfg).state);
    } catch (e) {
      app.banner = `Not logged: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  if (app.carry === carryKey(g)) setCarry(null);
  rest = null;
  document.querySelector('.toast')?.remove();
  app.sheet = { kind: 'finish', id: g.id };
  // §14.6: the save-a-copy panel opens by itself when the automatic backup is off or failing.
  if (!backupOk()) app.showExport = true;
  render();
}

function tissueDismissed(forDate: string): boolean {
  return pref(`acro-base-sc/tissue-dismissed/${forDate}`) === '1';
}

// ---------------------------------------------------------------------
// rest timer, session clock, screen awake (ui_spec §14.5)
// ---------------------------------------------------------------------

let rest: { since: number; label: string; slot: string; buzzed: boolean } | null = null;
const REST_TARGETS = [0, 90, 120, 180];

function restTarget(slot: string): number {
  return Number(pref(`acro-base-sc/rest/${slot}`) ?? 0) || 0;
}
function setRestTarget(slot: string, secs: number): void {
  setPref(`acro-base-sc/rest/${slot}`, secs ? String(secs) : null);
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
  const onToday = app.screen.kind === 'today' && !app.showExport;
  const open = onToday && sessionOpen();
  const showRest = onToday && rest !== null && Date.now() - rest.since < 20 * 60_000;
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
    const start = liveGroup()?.start?.item.log;
    const at = start && start.kind === 'session_start' && start.at ? Date.parse(start.at) : NaN;
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
  const want = sessionOpen() && document.visibilityState === 'visible';
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
  app.screen = { kind: 'today' };
  app.sheet = null;
  app.forms.clear();
  app.errors.clear();
  app.open.clear();
  app.day = undefined;
  app.startToday = false;
  setCarry(null);
  if (backup) requestBackup();
}

// ---------------------------------------------------------------------
// the date moves on (ui_spec §9)
// ---------------------------------------------------------------------

/**
 * Today is the phone's date when the app opens and whenever it comes back
 * to the screen. A live session on screen when the date turns stays live
 * and keeps its own date; opening the app later shows the card instead.
 */
function refreshClock(): void {
  const t = isoToday();
  if (t === app.today) return;
  const live = liveGroup();
  app.today = t;
  app.day = undefined;
  app.startToday = false;
  if (live && isOpen(live, t) && live.date < t) setCarry(live);
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

// After the backup state above exists: logging the box asks for a backup.
ensureBox();
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
