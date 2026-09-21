/**
 * The Today screen. Builds DOM from the session and the state; every
 * action goes back through ctx.commit, which is the one door (A.23).
 */
import type { LiftId, ProgrammeConfig, State } from '../config/types';
import { jumpFromFrames, mean, mesocycleOn, programmeWeek, roundHeight, roundRsi } from '../engine';
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
  config: ProgrammeConfig;
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

const kg = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

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
// copy
// ---------------------------------------------------------------------

const WARMUP_NAMES: Record<string, string> = {
  warmup: 'Warm-up',
  warmup_glute_shoulder: 'Warm-up: glutes and shoulders',
};

const MODE_NAMES: Record<string, string> = {
  wave: 'wave',
  band_87_90: 'contrast doubles',
  primer_2x2_90: 'heavy doubles',
  single_1x2_90: 'taper',
};

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
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
    h('button', { onclick: () => ctx.toggleOpen(key) }, `✓ ${entry.summary}`),
    open && steps ? h('ul', { class: 'steps' }, ...steps.map((s) => h('li', {}, s))) : null,
  );
}

function barbellItem(app: App, ctx: Ctx, item: SessionSlotItem, p: BarbellPrescription): HTMLElement {
  const lift = item.slot as LiftId;
  const tm = app.state.lifts[lift].tm;
  const title = h(
    'div',
    { class: 'title' },
    h('h2', {}, item.name),
    h('button', { class: 'quiet tm', onclick: () => ctx.editTm(lift) }, 'TM ', h('b', {}, `${tm.toFixed(1)} kg`)),
  );
  const logged = loggedSlot(app.state, app.date, lift);
  if (logged) return h('div', { class: 'item' }, title, doneLine(app, ctx, lift, logged));
  if (p.kind === 'refer') return h('div', { class: 'item' }, title, h('p', { class: 'refer' }, `Ask the coach: ${p.reason}`));

  const children: Child[] = [title];

  // Suggested single, not yet taken.
  const suggest = p.single_suggested && !p.single_suggested.taken && !singleLoggedToday(app.state, app.date, lift);
  if (suggest && p.single_suggested) {
    const why = p.single_suggested.reason === 'boundary' ? 'new block' : 'last session disagreed with the TM';
    const single = numberInput('single kg', { step: 2.5, required: true, placeholder: 'kg' });
    children.push(
      h(
        'div',
        { class: 'callout warn' },
        h('div', {}, h('strong', {}, 'Ramp single suggested'), ` (${why}). Work up to one clean rep at RIR 2, log it, and today's sets are recomputed. Or skip it.`),
        h(
          'div',
          { class: 'row' },
          single.wrap,
          h('button', {
            class: 'primary',
            onclick: () => {
              const load = readNumber(single.input);
              if (!requireFilled([single.input]) || load === null) return;
              ctx.commit({ kind: 'single', lift, date: app.date, load, rir: 2 });
            },
          }, 'Log single'),
          h('button', { class: 'subtle', onclick: () => ctx.commit({ kind: 'single_skipped', date: app.date, lift }) }, 'Skip'),
        ),
      ),
    );
  }
  if (p.single_suggested?.taken) children.push(h('div', { class: 'callout info' }, 'Single logged. Straight sets today from the new training max.'));
  const forced = p.notes.some((n) => n.startsWith('Downward trigger'));
  if (forced) children.push(h('div', { class: 'callout info' }, 'Two sessions down in a row: light day, position 1, two sets.'));

  children.push(
    h(
      'div',
      { class: 'rx' },
      h('span', { class: 'big' }, kg(p.load)),
      h('span', { class: 'unit' }, 'kg'),
      h('span', { class: 'sets' }, `${p.sets} × ${p.reps}`),
      h('span', { class: 'unit' }, `${Math.round(p.pct * 100)}% of TM`),
    ),
  );
  children.push(h('p', { class: 'sub' }, p.amrap ? `Last set: as many clean reps as you can, stop at RIR 2.${p.par !== undefined ? ` Par ${p.par}.` : ''}` : 'Straight sets.'));
  if (p.ramp.length) children.push(h('p', { class: 'ramp' }, 'Ramp ', ...p.ramp.map((r) => h('span', {}, `${kg(r.load)} × ${r.reps}`))));

  const load = numberInput('load kg', { value: p.load, step: 2.5 });
  const reps = numberInput('reps', { value: p.amrap ? null : p.reps, integer: true, required: p.amrap, placeholder: p.amrap ? '–' : '' });
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
  children.push(h('div', { class: 'row' }, load.wrap, reps.wrap, rir.wrap, h('span', { class: 'spacer' }), log));
  children.push(h('label', { class: 'f check' }, missed, 'Missed a rep on an earlier set'));
  return h('div', { class: 'item' }, ...children);
}

function progressionItem(app: App, ctx: Ctx, item: SessionSlotItem, p: RdlPrescription | SlotPrescription): HTMLElement {
  const title = h('div', { class: 'title' }, h('h2', {}, item.name));
  const logged = loggedSlot(app.state, app.date, item.slot);
  if (logged) return h('div', { class: 'item' }, title, doneLine(app, ctx, item.slot, logged));
  const children: Child[] = [title];
  const sets = item.template.sets ?? 3;
  const side = item.template.per_side ? '/side' : '';
  const rx = h('div', { class: 'rx' });
  if (p.kind === 'rdl') {
    rx.append(h('span', { class: 'big' }, kg(p.load)), h('span', { class: 'unit' }, 'kg'), h('span', { class: 'sets' }, `${sets} × ${p.rep_range[0]}–${p.rep_range[1]}`));
  } else if (p.load !== null) {
    rx.append(h('span', { class: 'big' }, kg(p.load)), h('span', { class: 'unit' }, 'kg'), h('span', { class: 'sets' }, `${sets} × ${p.reps}${side}`));
  } else {
    rx.append(h('span', { class: 'sets' }, `${sets} × ${p.reps}${side}`), h('span', { class: 'unit' }, p.start_hint_kg !== undefined ? `pick a load, try ${p.start_hint_kg} kg` : 'pick a load'));
  }
  children.push(rx);
  const tempoSlot = p.kind === 'rdl' || p.cls === 'B';
  children.push(h('p', { class: 'sub' }, `${tempoSlot ? '3 s lowering. ' : ''}Last set: as many clean reps as you can, stop at RIR ${p.rir_cap}${tempoSlot ? ' or when the tempo breaks' : ''}.`));
  if (p.kind === 'slot' && p.pending) {
    const inc = p.increment.kind === 'kg' ? `${p.increment.kg} kg${p.increment.per_hand ? ' per hand' : ''}` : p.increment.text;
    children.push(h('div', { class: 'callout info' }, h('strong', {}, `Go ${p.pending} ${inc}`), ' this session. Log whatever you lift.'));
  }

  const prefill = p.kind === 'rdl' ? p.load : (p.load ?? p.start_hint_kg ?? null);
  const load = numberInput('load kg', { value: prefill, step: p.kind === 'rdl' ? 2.5 : 0.5, required: true, placeholder: 'kg' });
  const reps = numberInput('reps', { value: null, integer: true, required: true, placeholder: '–' });
  const rir = numberInput('RIR', { value: p.rir_cap, integer: true, step: 1 });
  const tempo = tempoSlot ? h('input', { type: 'checkbox' }) : null;
  const log = h('button', {
    class: 'primary',
    onclick: () => {
      if (!requireFilled([load.input, reps.input, rir.input])) return;
      const l = readNumber(load.input)!;
      const r = readNumber(reps.input)!;
      const ri = readNumber(rir.input)!;
      const last = { reps: r, rir: ri, ...(tempo && tempo.checked ? { tempo_break: true } : {}) };
      const prescribedLoad = p.load;
      const override = prescribedLoad !== null && l !== prescribedLoad ? { from: prescribedLoad } : undefined;
      const entry: AnyLog =
        p.kind === 'rdl'
          ? { kind: 'rdl', slot: 'rdl', date: app.date, load: l, sets_done: sets, last_set: last, ...(override ? { override } : {}) }
          : { kind: 'slot', slot: item.slot, date: app.date, load: l, sets_done: sets, last_set: last, ...(override ? { override } : {}) };
      ctx.commit(entry);
    },
  }, 'Log');
  children.push(h('div', { class: 'row' }, load.wrap, reps.wrap, rir.wrap, h('span', { class: 'spacer' }), log));
  if (tempo) children.push(h('label', { class: 'f check' }, tempo, 'Tempo broke on the last set'));
  return h('div', { class: 'item' }, ...children);
}

function fixedItem(app: App, ctx: Ctx, item: SessionSlotItem, p: FixedPrescription): HTMLElement {
  const title = h('div', { class: 'title' }, h('h2', {}, item.name));
  const logged = loggedSlot(app.state, app.date, item.slot);
  if (logged) return h('div', { class: 'item' }, title, doneLine(app, ctx, item.slot, logged));
  const t = item.template;
  const side = t.per_side ? '/side' : '';
  const rx = h('div', { class: 'rx' });
  if (p.load_kg !== undefined) rx.append(h('span', { class: 'big' }, kg(p.load_kg)), h('span', { class: 'unit' }, 'kg'));
  if (t.sets !== undefined && t.reps !== undefined) rx.append(h('span', { class: 'sets' }, `${t.sets} × ${t.reps}${side}`));
  else if (t.sets !== undefined && t.secs !== undefined) rx.append(h('span', { class: 'sets' }, `${t.sets} × ${t.secs} s${side}`));
  else if (t.sets !== undefined) rx.append(h('span', { class: 'sets' }, `${t.sets} sets`));
  else if (t.reps !== undefined) rx.append(h('span', { class: 'sets' }, `${t.reps} reps${side}`));
  if (p.contacts !== undefined) rx.append(h('span', { class: 'sets' }, `${p.contacts} contacts`));
  if (!rx.childElementCount) rx.append(h('span', { class: 'sets' }, 'As usual'));
  const isLadder = item.slot === 'rsi_ladder';
  const subs: string[] = [];
  if (t.variant) subs.push(t.variant[0]!.toUpperCase() + t.variant.slice(1));
  if (isLadder) subs.push('20, 30, 40 cm, three jumps each. Best RSI wins, then three more at that height.');
  if (item.slot === 'trap_bar_jump') subs.push('Empty bar.');
  const isDepthJump = item.slot === 'depth_jump';
  const value = numberInput(isLadder ? 'best RSI' : isDepthJump ? 'RSI, optional' : 'number, optional', { value: null, step: isLadder || isDepthJump ? 0.01 : 1, integer: !(isLadder || isDepthJump) });
  const height = isLadder ? numberInput('winning height cm', { value: null, step: 5, integer: true }) : null;
  const calc = isLadder ? calculator('ladder', value.input, height!.input) : isDepthJump ? calculator('rsi', value.input) : null;
  const done = (didIt: boolean) => () => {
    const v = readNumber(value.input);
    const entry: AnyLog = { kind: 'fixed', slot: item.slot, date: app.date, done: didIt };
    if (v !== null) entry.value = v;
    ctx.commit(entry);
    const hcm = height ? readNumber(height.input) : null;
    if (isLadder && didIt && hcm !== null) ctx.commit({ kind: 'depth_jump_height', date: app.date, height_cm: hcm });
  };
  return h(
    'div',
    { class: 'item' },
    title,
    rx,
    subs.length ? h('p', { class: 'sub' }, subs.join(' ')) : null,
    h('div', { class: 'row' }, value.wrap, height ? height.wrap : null, calc, h('span', { class: 'spacer' }), h('button', { class: 'subtle', onclick: done(false) }, 'Skip'), h('button', { class: 'primary', onclick: done(true) }, 'Done')),
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

function blockView(app: App, ctx: Ctx, b: SessionBlock, index: number): HTMLElement {
  const onlyWarmup = b.items.every((it) => it.kind === 'warmup');
  if (onlyWarmup) {
    return h('section', { class: 'card' }, ...b.items.map((it) => (it.kind === 'warmup' ? h('div', { class: 'title' }, h('h2', {}, WARMUP_NAMES[it.name] ?? it.name.replace(/_/g, ' ')), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null) : null)));
  }
  let kicker = `Block ${index}`;
  if (b.superset) kicker = 'Alternate sets';
  if (b.contrast) kicker = `Contrast${b.rounds ? ` · ${Array.isArray(b.rounds) ? b.rounds.join('–') : b.rounds} rounds` : ''}`;
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'head' }, h('span', { class: 'kicker' }, kicker), b.min !== undefined ? h('span', { class: 'tag' }, `${b.min} min`) : null),
    ...b.items.map((it) => (it.kind === 'warmup' ? h('p', { class: 'warm' }, WARMUP_NAMES[it.name] ?? it.name.replace(/_/g, ' ')) : itemView(app, ctx, it))),
  );
}

function cmjCard(app: App, ctx: Ctx): HTMLElement {
  const logged = entriesOn(app.state, app.date).find((e) => e.log.kind === 'cmj');
  if (logged) return h('section', { class: 'card' }, doneLine(app, ctx, 'cmj', logged));
  const v = numberInput('jump height cm', { value: null, step: 0.1, required: true, placeholder: 'cm' });
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'title' }, h('h2', {}, 'Countermovement jump'), h('span', { class: 'tag' }, 'before warm-up')),
    h('p', { class: 'sub' }, 'Average of three. Enter the height, or count frames and calculate.'),
    h(
      'div',
      { class: 'row' },
      v.wrap,
      calculator('height', v.input),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'primary',
        onclick: () => {
          const n = readNumber(v.input);
          if (!requireFilled([v.input]) || n === null) return;
          ctx.commit({ kind: 'cmj', date: app.date, value: n });
        },
      }, 'Log CMJ'),
    ),
  );
}

function historyView(app: App): HTMLElement {
  const entries = (app.state.log as LogEntry[]).filter((e) => e && typeof e === 'object' && 'summary' in e).slice(-60).reverse();
  return h(
    'details',
    { class: 'card hist' },
    h('summary', {}, `History (${app.state.log.length})`),
    entries.length ? h('ul', {}, ...entries.map((e) => h('li', {}, h('time', {}, e.date.slice(5)), h('span', {}, e.summary)))) : h('p', { class: 'sub' }, 'Nothing logged yet.'),
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
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Save a copy of your log'),
      h('p', {}, 'Phones can lose app data without warning. The exported file holds everything and restores it exactly.'),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: ctx.exportNow }, 'Export log')),
      app.lastExport ? h('p', { class: 'ok' }, app.lastExport) : null,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Restore from a file'),
      h('p', {}, 'Choose a file you exported earlier. Nothing changes unless the file is valid.'),
      h('div', { class: 'row' }, file),
    ),
    h('div', { class: 'row' }, h('button', { onclick: ctx.closeExport }, 'Back to today')),
  );
}

// ---------------------------------------------------------------------
// frame-count calculator (no video; the athlete counts frames in a slow-motion clip)
// ---------------------------------------------------------------------

const FPS_KEY = 'acro-base-sc/fps';
const LADDER_HEIGHTS_CM = [20, 30, 40];

function recallFps(): number {
  try {
    const v = Number(window.localStorage.getItem(FPS_KEY));
    return v > 0 ? v : 240;
  } catch {
    return 240;
  }
}
function rememberFps(v: number): void {
  try {
    window.localStorage.setItem(FPS_KEY, String(v));
  } catch {
    /* preference only */
  }
}

function setField(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.classList.remove('missing');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * "Calculate" beside a number field. `height` fills the field with jump
 * height; `rsi` with RSI; `ladder` takes three jumps at each of 20, 30
 * and 40 cm, shows the mean RSI per height, and fills the RSI field
 * with the best mean and the height field with its height.
 */
function calculator(mode: 'height' | 'rsi' | 'ladder', target: HTMLInputElement, heightTarget?: HTMLInputElement): HTMLElement {
  const panel = h('div', { class: 'calc' });
  panel.hidden = true;
  const toggle = h('button', { class: 'subtle', onclick: () => (panel.hidden = !panel.hidden) }, 'Calculate');
  const fps = numberInput('frames per second', { value: recallFps(), integer: true, step: 1 });
  const out = h('p', { class: 'calc-out' }, 'Count the frames in a slow-motion clip.');
  const use = h('button', { class: 'primary' }, 'Use');
  use.disabled = true;

  const fpsValue = (): number | null => {
    const v = readNumber(fps.input);
    return v && v > 0 ? v : null;
  };
  fps.input.addEventListener('input', () => {
    const v = fpsValue();
    if (v) rememberFps(v);
  });

  if (mode !== 'ladder') {
    const air = numberInput('frames in the air', { integer: true, placeholder: '0' });
    const ground = mode === 'rsi' ? numberInput('frames on the ground', { integer: true, placeholder: '0' }) : null;
    let result: number | null = null;
    const recompute = () => {
      const f = fpsValue();
      const a = readNumber(air.input);
      const g = ground ? readNumber(ground.input) : undefined;
      result = null;
      if (!f || a === null || a <= 0 || (mode === 'rsi' && (g === null || g === undefined || g <= 0))) {
        out.textContent = 'Count the frames in a slow-motion clip.';
        use.disabled = true;
        return;
      }
      const m = jumpFromFrames(mode === 'rsi' && g ? { fps: f, air: a, ground: g } : { fps: f, air: a });
      const parts = [`Flight ${m.flight_s.toFixed(3)} s`, `height ${roundHeight(m.height_cm).toFixed(1)} cm`];
      if (m.rsi !== undefined && m.contact_s !== undefined) parts.push(`contact ${m.contact_s.toFixed(3)} s`, `RSI ${roundRsi(m.rsi).toFixed(2)}`);
      out.textContent = parts.join(' · ');
      result = mode === 'height' ? roundHeight(m.height_cm) : roundRsi(m.rsi!);
      use.disabled = false;
    };
    for (const i of [fps.input, air.input, ground?.input]) i?.addEventListener('input', recompute);
    use.addEventListener('click', () => {
      if (result === null) return;
      setField(target, result);
      panel.hidden = true;
    });
    panel.append(h('div', { class: 'row' }, fps.wrap, air.wrap, ground ? ground.wrap : null), out, h('div', { class: 'row' }, h('span', { class: 'spacer' }), use));
  } else {
    // Three attempts per height: air and ground frames each.
    const rows = LADDER_HEIGHTS_CM.map((cm) => ({
      cm,
      attempts: [0, 1, 2].map(() => ({ air: numberInput('air', { integer: true, placeholder: '0' }), ground: numberInput('ground', { integer: true, placeholder: '0' }) })),
      meanEl: h('span', { class: 'calc-mean' }, '–'),
    }));
    let best: { cm: number; rsi: number } | null = null;
    const recompute = () => {
      const f = fpsValue();
      best = null;
      const summary: string[] = [];
      for (const r of rows) {
        const values = r.attempts.map((a) => {
          const air = readNumber(a.air.input);
          const ground = readNumber(a.ground.input);
          if (!f || air === null || ground === null || air <= 0 || ground <= 0) return null;
          return jumpFromFrames({ fps: f, air, ground }).rsi ?? null;
        });
        const m = mean(values);
        r.meanEl.textContent = m === null ? '–' : `mean RSI ${roundRsi(m).toFixed(2)}`;
        if (m !== null) {
          summary.push(`${r.cm} cm ${roundRsi(m).toFixed(2)}`);
          if (!best || m > best.rsi) best = { cm: r.cm, rsi: m };
        }
      }
      out.textContent = best ? `${summary.join(' · ')}. Best: ${best.cm} cm.` : 'Enter air and ground frames for each jump.';
      use.disabled = best === null;
    };
    fps.input.addEventListener('input', recompute);
    const grid = h('div', { class: 'calc-ladder' });
    for (const r of rows) {
      const line = h('div', { class: 'calc-height' }, h('div', { class: 'calc-label' }, h('b', {}, `${r.cm} cm`), r.meanEl));
      for (const a of r.attempts) {
        a.air.input.addEventListener('input', recompute);
        a.ground.input.addEventListener('input', recompute);
        line.append(h('div', { class: 'calc-pair' }, a.air.wrap, a.ground.wrap));
      }
      grid.append(line);
    }
    use.addEventListener('click', () => {
      if (!best) return;
      setField(target, roundRsi(best.rsi));
      if (heightTarget) setField(heightTarget, best.cm);
      panel.hidden = true;
    });
    panel.append(h('div', { class: 'row' }, fps.wrap), grid, out, h('div', { class: 'row' }, h('span', { class: 'spacer' }), use));
  }
  return h('div', { class: 'calc-wrap' }, toggle, panel);
}

// ---------------------------------------------------------------------
// plan (read-only, from config and state)
// ---------------------------------------------------------------------

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function planView(app: App, ctx: Ctx): HTMLElement {
  const cfg = ctx.config;
  const week = programmeWeek(cfg, app.date);
  const current = mesocycleOn(cfg, app.date);
  const fs = app.state.lifts.front_squat.next_position;
  const dl = app.state.lifts.deadlift.next_position;
  const rows = cfg.mesocycles.map((m) => {
    const now = current?.id === m.id;
    return h(
      'tr',
      { class: now ? 'now' : '' },
      h('td', {}, h('b', {}, m.id), now ? h('span', { class: 'now-tag' }, 'now') : null),
      h('td', {}, `${shortDate(m.start)} – ${shortDate(m.end)}`),
      h('td', {}, m.weeks[0] === m.weeks[1] ? `wk ${m.weeks[0]}` : `wk ${m.weeks[0]}–${m.weeks[1]}`),
      h('td', {}, m.barbell_mode ? (MODE_NAMES[m.barbell_mode] ?? m.barbell_mode) : 'not in the app'),
    );
  });
  const summary = week >= 1 && current ? `Week ${week} of the programme, ${current.id}.` : 'Outside the programme dates.';
  return h(
    'details',
    { class: 'card hist plan' },
    h('summary', {}, 'Plan'),
    h('p', { class: 'plan-now' }, `${summary} Next wave position: front squat ${fs}, deadlift ${dl}.`),
    h('table', { class: 'plan-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Block'), h('th', {}, 'Dates'), h('th', {}, 'Weeks'), h('th', {}, 'Barbell'))), h('tbody', {}, ...rows)),
  );
}

// ---------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------

export function renderApp(app: App, ctx: Ctx, appVersion: string): HTMLElement {
  const s = ctx.session;
  const day = s.kind === 'session' ? s.day : (app.day ?? 1);
  const dateInput = h('input', { type: 'date', value: app.date, 'aria-label': 'Session date' });
  dateInput.addEventListener('change', () => ctx.setDate(dateInput.value));

  const top = h(
    'div',
    { class: 'top' },
    h('h1', {}, 'Acro S&C'),
    h('span', { class: 'grow' }),
    h('span', { class: `status ${app.offlineReady ? 'ok' : ''}` }, app.offlineReady ? 'Works offline' : 'Not saved for offline yet'),
    h('button', { class: 'quiet', onclick: ctx.openExport }, 'Backup'),
  );
  const controls = h(
    'div',
    { class: 'top', style: 'margin-top:8px' },
    dateInput,
    h('div', { class: 'seg' }, h('button', { class: day === 1 ? 'on' : '', onclick: () => ctx.setDay(1) }, 'Day 1'), h('button', { class: day === 2 ? 'on' : '', onclick: () => ctx.setDay(2) }, 'Day 2')),
  );

  const chips = h(
    'div',
    { class: 'tms' },
    ...(['front_squat', 'deadlift'] as LiftId[]).map((id) =>
      h('button', { class: 'chip', onclick: () => ctx.editTm(id) }, ctx.liftName(id).replace('Conventional deadlift', 'Deadlift'), h('b', {}, `${app.state.lifts[id].tm.toFixed(1)} kg`), h('span', { class: 'pen' }, 'edit')),
    ),
  );

  const body: Child[] = [top, controls, app.banner ? h('div', { class: 'banner' }, app.banner) : null];
  if (s.kind === 'refer') {
    body.push(h('p', { class: 'refer', style: 'margin-top:16px' }, `No session for this date. ${s.reason}`));
  } else {
    const lift = s.blocks.flatMap((b) => b.items).find((it): it is SessionSlotItem => it.kind === 'slot' && it.prescription.kind === 'lift');
    const mode = lift && lift.prescription.kind === 'lift' ? MODE_NAMES[lift.prescription.mode] : undefined;
    body.push(
      h(
        'div',
        { class: 'context' },
        h('span', {}, h('strong', {}, `${prettyDate(s.date)} · Day ${s.day}`), ` · week ${s.programme_week}, ${s.mesocycle}`),
        h('span', {}, `${mode ? `${mode} · ` : ''}about ${s.target_min} min`),
      ),
    );
    body.push(chips);
    if (s.pre.includes('cmj')) body.push(cmjCard(app, ctx));
    let n = 0;
    body.push(...s.blocks.map((b) => blockView(app, ctx, b, ++n)));
  }
  body.push(historyView(app));
  body.push(planView(app, ctx));
  body.push(h('p', { class: 'foot' }, `Acro Base S&C · v${appVersion}`));

  const endBar = h(
    'div',
    { class: 'end' },
    h('button', {
      class: 'primary',
      onclick: () => {
        ctx.commit({ kind: 'session_end', date: app.date, day });
        ctx.openExport();
      },
    }, 'Finish session'),
  );

  return h('div', {}, ...body, endBar, app.showExport ? exportPanel(app, ctx) : null);
}

export type { Session };
