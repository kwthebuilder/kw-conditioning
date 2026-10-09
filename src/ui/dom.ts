/**
 * Tiny DOM helpers and the shared input controls (ui_spec_v1_1.md §5):
 * plus/minus steppers, a row of choice buttons, and the frame-count calculator.
 */
import { jumpFromFrames, mean, roundHeight, roundRsi } from '../engine';

export type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'checked' || k === 'required' || k === 'disabled' || k === 'open' || k === 'value') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * Plus and minus around a typable number. `value` null shows a dash; the
 * first plus from a dash goes to `start`. Calls `onChange` on every change.
 */
export function stepper(opts: {
  label: string;
  value: number | null;
  step: number;
  start?: number;
  min?: number;
  unit?: string;
  integer?: boolean;
  onChange: (v: number | null) => void;
  invalid?: boolean;
}): { el: HTMLElement; input: HTMLInputElement } {
  const min = opts.min ?? 0;
  const input = h('input', {
    type: 'number',
    inputmode: opts.integer ? 'numeric' : 'decimal',
    step: opts.integer ? 1 : 'any',
    min,
    placeholder: '–',
    'aria-label': opts.label,
    class: opts.invalid ? 'missing' : '',
  });
  input.value = opts.value === null ? '' : fmt(opts.value);
  const read = (): number | null => {
    if (input.value.trim() === '') return null;
    const n = Number(input.value);
    return Number.isFinite(n) ? n : null;
  };
  const set = (v: number | null) => {
    input.value = v === null ? '' : fmt(v);
    input.classList.remove('missing');
    opts.onChange(v);
  };
  input.addEventListener('input', () => {
    input.classList.remove('missing');
    opts.onChange(read());
  });
  const minus = h('button', { type: 'button', class: 'step', 'aria-label': `${opts.label}: less`, onclick: () => {
    const v = read();
    if (v === null) return set(opts.start !== undefined ? Math.max(min, opts.start - opts.step) : min);
    set(Math.max(min, Math.round((v - opts.step) * 100) / 100));
  } }, '−');
  const plus = h('button', { type: 'button', class: 'step', 'aria-label': `${opts.label}: more`, onclick: () => {
    const v = read();
    if (v === null) return set(opts.start ?? min);
    set(Math.round((v + opts.step) * 100) / 100);
  } }, '+');
  const el = h('div', { class: 'stepper' }, h('span', { class: 'lab' }, opts.unit ? `${opts.label}, ${opts.unit}` : opts.label), h('div', { class: 'ctl' }, minus, input, plus));
  return { el, input };
}

/** A row of buttons, one chosen. Nothing is pre-selected unless `value` is set. */
export function choices<T extends string | number>(opts: {
  label: string;
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (v: T) => void;
  invalid?: boolean;
}): HTMLElement {
  const row = h('div', { class: `choices${opts.invalid ? ' missing' : ''}`, role: 'radiogroup', 'aria-label': opts.label });
  for (const o of opts.options) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === opts.value), class: o.value === opts.value ? 'on' : '' }, o.text);
    b.addEventListener('click', () => {
      for (const x of row.querySelectorAll('button')) {
        x.classList.remove('on');
        x.setAttribute('aria-checked', 'false');
      }
      b.classList.add('on');
      b.setAttribute('aria-checked', 'true');
      row.classList.remove('missing');
      opts.onChange(o.value);
    });
    row.append(b);
  }
  return h('div', { class: 'choice-wrap' }, h('span', { class: 'lab' }, opts.label), row);
}

export function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const box = h('input', { type: 'checkbox', checked });
  box.addEventListener('change', () => onChange(box.checked));
  return h('label', { class: 'check' }, box, label);
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

function num(label: string, value: number | null, integer = true): { wrap: HTMLElement; input: HTMLInputElement } {
  const input = h('input', { type: 'number', inputmode: integer ? 'numeric' : 'decimal', step: integer ? 1 : 'any', min: 0, placeholder: '0' });
  if (value !== null) input.value = String(value);
  return { wrap: h('label', { class: 'f' }, label, input), input };
}
function readNum(input: HTMLInputElement): number | null {
  if (input.value.trim() === '') return null;
  const n = Number(input.value);
  return Number.isFinite(n) ? n : null;
}

/**
 * "Calculate" beside a field. `height` returns jump height; `rsi`
 * reactive strength; `ladder` takes three jumps at each of 20, 30 and
 * 40 cm and returns the winning height.
 */
export function calculator(mode: 'height' | 'rsi' | 'ladder', onResult: (v: number) => void): HTMLElement {
  const panel = h('div', { class: 'calc' });
  panel.hidden = true;
  const toggle = h('button', { type: 'button', class: 'subtle', onclick: () => (panel.hidden = !panel.hidden) }, 'Calculate from video');
  const fps = num('frames per second', recallFps());
  const out = h('p', { class: 'calc-out' }, 'Count the frames in a slow-motion clip.');
  const use = h('button', { type: 'button', class: 'primary' }, 'Use');
  use.disabled = true;
  const fpsValue = (): number | null => {
    const v = readNum(fps.input);
    return v && v > 0 ? v : null;
  };
  fps.input.addEventListener('input', () => {
    const v = fpsValue();
    if (v) rememberFps(v);
  });
  let result: number | null = null;
  if (mode !== 'ladder') {
    const air = num('frames in the air', null);
    const ground = mode === 'rsi' ? num('frames on the ground', null) : null;
    const recompute = () => {
      const f = fpsValue();
      const a = readNum(air.input);
      const g = ground ? readNum(ground.input) : undefined;
      result = null;
      if (!f || a === null || a <= 0 || (mode === 'rsi' && (g === null || g === undefined || g <= 0))) {
        out.textContent = 'Count the frames in a slow-motion clip.';
        use.disabled = true;
        return;
      }
      const m = jumpFromFrames(mode === 'rsi' && g ? { fps: f, air: a, ground: g } : { fps: f, air: a });
      const parts = [`Flight ${m.flight_s.toFixed(3)} s`, `height ${roundHeight(m.height_cm).toFixed(1)} cm`];
      if (m.rsi !== undefined && m.contact_s !== undefined) parts.push(`on the floor ${m.contact_s.toFixed(3)} s`, `reactive strength ${roundRsi(m.rsi).toFixed(2)}`);
      out.textContent = parts.join(' · ');
      result = mode === 'height' ? roundHeight(m.height_cm) : roundRsi(m.rsi!);
      use.disabled = false;
    };
    for (const i of [fps.input, air.input, ground?.input]) i?.addEventListener('input', recompute);
    panel.append(h('div', { class: 'row' }, fps.wrap, air.wrap, ground ? ground.wrap : null), out);
  } else {
    const rows = LADDER_HEIGHTS_CM.map((cm) => ({
      cm,
      attempts: [0, 1, 2].map(() => ({ air: num('air', null), ground: num('ground', null) })),
      meanEl: h('span', { class: 'calc-mean' }, '–'),
    }));
    const recompute = () => {
      const f = fpsValue();
      let best: { cm: number; rsi: number } | null = null;
      const summary: string[] = [];
      for (const r of rows) {
        const values = r.attempts.map((a) => {
          const air = readNum(a.air.input);
          const ground = readNum(a.ground.input);
          if (!f || air === null || ground === null || air <= 0 || ground <= 0) return null;
          return jumpFromFrames({ fps: f, air, ground }).rsi ?? null;
        });
        const m = mean(values);
        r.meanEl.textContent = m === null ? '–' : `mean reactive strength ${roundRsi(m).toFixed(2)}`;
        if (m !== null) {
          summary.push(`${r.cm} cm ${roundRsi(m).toFixed(2)}`);
          if (!best || m > best.rsi) best = { cm: r.cm, rsi: m };
        }
      }
      result = best ? (best as { cm: number }).cm : null;
      out.textContent = best ? `${summary.join(' · ')}. Best: ${(best as { cm: number }).cm} cm.` : 'Enter air and ground frames for each jump.';
      use.disabled = result === null;
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
    panel.append(h('div', { class: 'row' }, fps.wrap), grid, out);
  }
  use.addEventListener('click', () => {
    if (result === null) return;
    onResult(result);
    panel.hidden = true;
  });
  panel.append(h('div', { class: 'row' }, h('span', { class: 'spacer' }), use));
  return h('div', { class: 'calc-wrap' }, toggle, panel);
}
