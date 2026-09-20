/**
 * The Today screen. Builds DOM from the session and the state; every
 * action goes back through ctx.commit, which is the one door (A.23).
 */
import type { LiftId, State } from '../config/types';
import type {
  AnyLog,
  BarbellPrescription,
  FixedPrescription,
  LogEntry,
  RdlPrescription,
  Session,
  SessionBlock,
  SessionDay,
  SessionResult,
  SessionSlotItem,
  SlotPrescription,
} from '../engine';

export interface App {
  state: State;
  date: string;
  day?: SessionDay;
  /** Item keys whose explanation is expanded. */
  open: Set<string>;
  offlineReady: boolean;
  banner: string | null;
  showExport: boolean;
  lastExport: string | null;
}

export interface Ctx {
  session: SessionResult;
  liftName: (id: string) => string;
  commit: (log: AnyLog) => void;
  setDate: (date: string) => void;
  setDay: (day: SessionDay) => void;
  toggleOpen: (key: string) => void;
  openExport: () => void;
  closeExport: () => void;
  exportNow: () => void;
  importFile: (file: File) => void;
  editTm: (lift: LiftId) => void;
}

// ---------------------------------------------------------------------
// tiny DOM helpers
// ---------------------------------------------------------------------

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'checked' || k === 'required' || k === 'disabled' || k === 'open') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const f1 = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function numberInput(label: string, opts: { value?: number | null; step?: number; placeholder?: string; required?: boolean; integer?: boolean }): { wrap: HTMLElement; input: HTMLInputElement } {
  const input = h('input', {
    type: 'number',
    inputmode: opts.integer ? 'numeric' : 'decimal',
    step: opts.step ?? (opts.integer ? 1 : 0.5),
    min: 0,
    placeholder: opts.placeholder ?? '',
    required: opts.required ?? false,
    value: opts.value === null || opts.value === undefined ? '' : String(opts.value),
  });
  return { wrap: h('label', { class: 'f' }, label, input), input };
}

function readNumber(input: HTMLInputElement): number | null {
  if (input.value.trim() === '') return null;
  const n = Number(input.value);
  return Number.isFinite(n) ? n : null;
}

/** Marks empty required inputs and returns whether all are filled. */
function requireFilled(inputs: HTMLInputElement[]): boolean {
  let ok = true;
  for (const i of inputs) {
    const missing = readNumber(i) === null;
    i.classList.toggle('missing', missing);
    if (missing) ok = false;
  }
  return ok;
}

// ---------------------------------------------------------------------
// logged-today lookup
// ---------------------------------------------------------------------

function entriesOn(state: State, date: string): LogEntry[] {
  return state.log.filter((e): e is LogEntry => typeof e === 'object' && e !== null && (e as LogEntry).date === date && 'log' in (e as object));
}

function loggedSlot(state: State, date: string, slot: string): LogEntry | undefined {
  return entriesOn(state, date).find((e) => {
    const l = e.log;
    return (l.kind === 'barbell' && l.lift === slot) || ((l.kind === 'rdl' || l.kind === 'slot' || l.kind === 'fixed') && l.slot === slot);
  });
}

function singleLoggedToday(state: State, date: string, lift: LiftId): boolean {
  return entriesOn(state, date).some((e) => e.log.kind === 'single' && e.log.lift === lift);
}

// ---------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------

function doneLine(app: App, ctx: Ctx, key: string, entry: LogEntry): HTMLElement {
  const open = app.open.has(key);
  const steps = (entry as LogEntry & { steps?: string[] }).steps;
  return h(
    'div',
    { class: 'done' },
    h('button', { class: 'ghost', onclick: () => ctx.toggleOpen(key) }, `✓ ${entry.summary}${open ? ' ▾' : ' ▸'}`),
    open && steps ? h('ul', { class: 'steps' }, ...steps.map((s) => h('li', {}, s))) : null,
  );
}

function barbellItem(app: App, ctx: Ctx, item: SessionSlotItem, p: BarbellPrescription): HTMLElement {
  const lift = item.slot as LiftId;
  const head = h('div', { class: 'row' }, h('h2', { class: 'grow' }, item.name), h('button', { class: 'ghost', onclick: () => ctx.editTm(lift) }, `TM ${app.state.lifts[lift].tm.toFixed(1)} ✎`));
  const logged = loggedSlot(app.state, app.date, lift);
  if (logged) return h('div', { class: 'item' }, head, doneLine(app, ctx, lift, logged));
  if (p.kind === 'refer') return h('div', { class: 'item' }, head, h('p', { class: 'refer' }, `Refer to project: ${p.reason}`));

  const children: Child[] = [head];
  for (const n of p.notes) children.push(h('p', { class: 'note' }, n));

  // Suggested single, not yet taken.
  if (p.single_suggested && !p.single_suggested.taken && !singleLoggedToday(app.state, app.date, lift)) {
    const single = numberInput('single kg', { step: 2.5, required: true, placeholder: 'kg' });
    children.push(
      h(
        'div',
        { class: 'row' },
        single.wrap,
        h('button', {
          onclick: () => {
            const load = readNumber(single.input);
            if (!requireFilled([single.input]) || load === null) return;
            ctx.commit({ kind: 'single', lift, date: app.date, load, rir: 2 });
          },
        }, 'Log single'),
        h('button', { onclick: () => ctx.commit({ kind: 'single_skipped', date: app.date, lift }) }, 'Skip'),
      ),
    );
  }

  if (p.ramp.length) children.push(h('p', { class: 'note' }, `Ramp: ${p.ramp.map((r) => `${f1(r.load)} × ${r.reps}`).join(' · ')}`));
  const line = `${p.sets} × ${p.reps} at ${f1(p.load)} kg (${Math.round(p.pct * 100)}% of TM ${p.tm.toFixed(1)})` + (p.amrap ? `. Last set rep-out to RIR 2${p.par !== undefined ? `, par ${p.par}` : ''}.` : '.');
  children.push(h('p', {}, line));

  const load = numberInput('load kg', { value: p.load, step: 2.5 });
  const reps = numberInput('reps', { value: p.amrap ? null : p.reps, integer: true, required: p.amrap, placeholder: p.amrap ? 'rep-out' : '' });
  const rir = numberInput('RIR', { value: 2, integer: true, step: 1 });
  const missed = h('input', { type: 'checkbox' });
  const log = h('button', {
    class: 'primary',
    onclick: () => {
      if (!requireFilled([load.input, reps.input, rir.input])) return;
      const l = readNumber(load.input)!;
      const r = readNumber(reps.input)!;
      const ri = readNumber(rir.input)!;
      const entry: AnyLog = {
        kind: 'barbell',
        lift,
        date: app.date,
        mode: p.mode,
        prescribed: { load: l, reps: p.reps, sets: p.sets },
        last_set: { load: l, reps: r, rir: ri },
        missed: missed.checked,
      };
      if (p.position !== undefined) entry.position = p.position;
      if (l !== p.load) entry.override = { from: p.load };
      ctx.commit(entry);
    },
  }, 'Log');
  children.push(h('div', { class: 'row' }, load.wrap, reps.wrap, rir.wrap, h('label', { class: 'f' }, 'missed a set', missed), log));
  return h('div', { class: 'item' }, ...children);
}

function progressionItem(app: App, ctx: Ctx, item: SessionSlotItem, p: RdlPrescription | SlotPrescription): HTMLElement {
  const head = h('h2', {}, item.name);
  const logged = loggedSlot(app.state, app.date, item.slot);
  if (logged) return h('div', { class: 'item' }, head, doneLine(app, ctx, item.slot, logged));
  const children: Child[] = [head];
  for (const n of p.notes) children.push(h('p', { class: 'note' }, n));
  const sets = item.template.sets ?? 3;
  const line =
    p.kind === 'rdl'
      ? `${sets} × ${p.rep_range[0]}-${p.rep_range[1]} at ${f1(p.load)} kg. Last set to RIR ${p.rir_cap} or tempo break.`
      : `${sets} × ${p.reps}${item.template.per_side ? '/side' : ''}${p.load !== null ? ` at ${f1(p.load)} kg` : ''}. Last set to RIR ${p.rir_cap}.`;
  children.push(h('p', {}, line));
  const prefill = p.kind === 'rdl' ? p.load : (p.load ?? p.start_hint_kg ?? null);
  const load = numberInput('load kg', { value: prefill, step: p.kind === 'rdl' ? 2.5 : 0.5, required: true, placeholder: 'kg' });
  const reps = numberInput('reps', { value: null, integer: true, required: true, placeholder: 'rep-out' });
  const rir = numberInput('RIR', { value: p.rir_cap, integer: true, step: 1 });
  const tempo = p.kind === 'rdl' || p.cls === 'B' ? h('input', { type: 'checkbox' }) : null;
  const log = h('button', {
    class: 'primary',
    onclick: () => {
      if (!requireFilled([load.input, reps.input, rir.input])) return;
      const l = readNumber(load.input)!;
      const r = readNumber(reps.input)!;
      const ri = readNumber(rir.input)!;
      const last = { reps: r, rir: ri, ...(tempo && tempo.checked ? { tempo_break: true } : {}) };
      const prescribedLoad = p.kind === 'rdl' ? p.load : p.load;
      const override = prescribedLoad !== null && prescribedLoad !== undefined && l !== prescribedLoad ? { from: prescribedLoad } : undefined;
      const entry: AnyLog =
        p.kind === 'rdl'
          ? { kind: 'rdl', slot: 'rdl', date: app.date, load: l, sets_done: sets, last_set: last, ...(override ? { override } : {}) }
          : { kind: 'slot', slot: item.slot, date: app.date, load: l, sets_done: sets, last_set: last, ...(override ? { override } : {}) };
      ctx.commit(entry);
    },
  }, 'Log');
  children.push(h('div', { class: 'row' }, load.wrap, reps.wrap, rir.wrap, tempo ? h('label', { class: 'f' }, 'tempo broke', tempo) : null, log));
  return h('div', { class: 'item' }, ...children);
}

function fixedItem(app: App, ctx: Ctx, item: SessionSlotItem, p: FixedPrescription): HTMLElement {
  const head = h('h2', {}, item.name);
  const logged = loggedSlot(app.state, app.date, item.slot);
  if (logged) return h('div', { class: 'item' }, head, doneLine(app, ctx, item.slot, logged));
  const t = item.template;
  const bits: string[] = [];
  if (t.sets !== undefined) bits.push(`${t.sets} × ${t.reps ?? t.secs !== undefined ? `${t.reps ?? ''}${t.secs !== undefined ? `${t.secs} s` : ''}` : '?'}${t.per_side ? '/side' : ''}`);
  else if (t.reps !== undefined) bits.push(`${t.reps} reps${t.per_side ? '/side' : ''}`);
  if (p.contacts !== undefined) bits.push(`${p.contacts} contacts`);
  if (p.load_kg !== undefined) bits.push(`${f1(p.load_kg)} kg`);
  if (t.variant) bits.push(t.variant);
  const isLadder = item.slot === 'rsi_ladder';
  const value = numberInput(isLadder ? 'winning height cm' : 'number (optional)', { value: null, step: 1, integer: !isLadder });
  const done = (didIt: boolean) => () => {
    const v = readNumber(value.input);
    const entry: AnyLog = { kind: 'fixed', slot: item.slot, date: app.date, done: didIt };
    if (v !== null) entry.value = v;
    ctx.commit(entry);
    if (isLadder && didIt && v !== null) ctx.commit({ kind: 'depth_jump_height', date: app.date, height_cm: v });
  };
  return h(
    'div',
    { class: 'item' },
    head,
    h('p', {}, bits.join(' · ') || p.text),
    bits.length ? h('p', { class: 'note' }, p.text) : null,
    ...p.notes.map((n) => h('p', { class: 'note' }, n)),
    h('div', { class: 'row' }, value.wrap, h('button', { class: 'primary', onclick: done(true) }, 'Done'), h('button', { onclick: done(false) }, 'Skip')),
  );
}

function itemView(app: App, ctx: Ctx, item: SessionSlotItem): HTMLElement {
  const p = item.prescription;
  switch (p.kind) {
    case 'lift':
    case 'refer':
      return barbellItem(app, ctx, item, p);
    case 'rdl':
    case 'slot':
      return progressionItem(app, ctx, item, p);
    case 'fixed':
      return fixedItem(app, ctx, item, p);
  }
}

function blockView(app: App, ctx: Ctx, b: SessionBlock): HTMLElement {
  const tags: string[] = [];
  if (b.min !== undefined) tags.push(`${b.min} min`);
  if (b.superset) tags.push('alternate');
  if (b.contrast) tags.push(`contrast${b.rounds ? `, rounds ${Array.isArray(b.rounds) ? b.rounds.join('-') : b.rounds}` : ''}`);
  return h(
    'section',
    { class: 'block' },
    tags.length ? h('div', { class: 'tag' }, tags.join(' · ')) : null,
    ...b.items.map((it) => (it.kind === 'warmup' ? h('p', { class: 'warmup' }, it.name.replace(/_/g, ' ')) : itemView(app, ctx, it))),
  );
}

function cmjRow(app: App, ctx: Ctx): HTMLElement {
  const logged = entriesOn(app.state, app.date).find((e) => e.log.kind === 'cmj');
  if (logged) return h('div', { class: 'item' }, doneLine(app, ctx, 'cmj', logged));
  const v = numberInput('CMJ cm (avg of 3)', { value: null, step: 0.1, required: true, placeholder: 'cm' });
  return h(
    'div',
    { class: 'item row' },
    v.wrap,
    h('button', {
      onclick: () => {
        const n = readNumber(v.input);
        if (!requireFilled([v.input]) || n === null) return;
        ctx.commit({ kind: 'cmj', date: app.date, value: n });
      },
    }, 'Log CMJ'),
  );
}

function historyView(app: App): HTMLElement {
  const entries = (app.state.log as LogEntry[]).filter((e) => e && typeof e === 'object' && 'summary' in e).slice(-60).reverse();
  return h(
    'details',
    {},
    h('summary', {}, `History (${app.state.log.length})`),
    entries.length ? h('ul', { class: 'hist' }, ...entries.map((e) => h('li', {}, `${e.date} · ${e.summary}`))) : h('p', { class: 'note' }, 'Nothing logged yet.'),
  );
}

function exportPanel(app: App, ctx: Ctx): HTMLElement {
  const file = h('input', { type: 'file', accept: '.md,text/markdown,text/plain' });
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) ctx.importFile(f);
  });
  return h(
    'div',
    { class: 'panel' },
    h('h2', {}, 'Export your log'),
    h('p', {}, 'Storage on the phone can be lost. The exported file is the record; importing it restores everything exactly.'),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: ctx.exportNow }, 'Export now')),
    app.lastExport ? h('p', { class: 'note' }, app.lastExport) : null,
    h('h2', { style: 'margin-top:20px' }, 'Import'),
    h('p', {}, 'Pick an exported .md file. It replaces the current state only if it is valid.'),
    h('div', { class: 'row' }, file),
    h('div', { class: 'row', style: 'margin-top:20px' }, h('button', { onclick: ctx.closeExport }, 'Close')),
  );
}

// ---------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------

export function renderApp(app: App, ctx: Ctx, appVersion: string): HTMLElement {
  const s = ctx.session;
  const day = s.kind === 'session' ? s.day : (app.day ?? 1);
  const dateInput = h('input', { type: 'date', value: app.date });
  dateInput.addEventListener('change', () => ctx.setDate(dateInput.value));

  const bar = h(
    'div',
    { class: 'bar' },
    h('h1', {}, 'Acro S&C'),
    dateInput,
    h('button', { class: day === 1 ? 'on' : '', onclick: () => ctx.setDay(1) }, 'Day 1'),
    h('button', { class: day === 2 ? 'on' : '', onclick: () => ctx.setDay(2) }, 'Day 2'),
    h('span', { class: 'grow' }),
    h('button', { class: 'ghost', onclick: ctx.openExport }, 'Export / Import'),
    h('span', { class: `dot ${app.offlineReady ? 'ok' : ''}` }, app.offlineReady ? '● offline ready' : '○ online only'),
  );

  const tm = h(
    'div',
    { class: 'tm' },
    ...(['front_squat', 'deadlift'] as LiftId[]).map((id) =>
      h('button', { class: 'ghost', onclick: () => ctx.editTm(id) }, `${ctx.liftName(id)} TM ${app.state.lifts[id].tm.toFixed(1)} kg ✎`),
    ),
  );

  const body: Child[] = [bar, app.banner ? h('div', { class: 'banner' }, app.banner) : null, tm];
  if (s.kind === 'refer') {
    body.push(h('p', { class: 'refer' }, `No session: ${s.reason}`));
  } else {
    body.push(h('p', { class: 'note' }, `${s.notes.join(' ')} Target ${s.target_min} min.`));
    if (s.pre.includes('cmj')) body.push(cmjRow(app, ctx));
    body.push(...s.blocks.map((b) => blockView(app, ctx, b)));
  }
  body.push(historyView(app));
  body.push(h('p', { class: 'note' }, `App ${appVersion}`));

  const endBar = h(
    'div',
    { class: 'end' },
    h('button', {
      class: 'primary',
      onclick: () => {
        ctx.commit({ kind: 'session_end', date: app.date, day });
        ctx.openExport();
      },
    }, 'End session · export'),
  );

  return h('div', {}, ...body, endBar, app.showExport ? exportPanel(app, ctx) : null);
}

export type { Session };
