/**
 * Class A engine: front squat and conventional deadlift.
 * engine_spec_v1_5.md §2, §10 and Appendix A; vectors in the
 * barbell, rounding, audit_rescale and downward_trigger blocks.
 *
 * Pure: no clock, no randomness, no I/O. Dates come in on the log.
 */
import type { LiftId, LiftState, Mesocycle, Position, ProgrammeConfig, State } from '../config/types';
import { mesocycleOn, programmeWeek } from './calendar';
import { roundLoad } from './rounding';
import type {
  BarbellLog,
  BarbellOutcome,
  BarbellPrescription,
  BarbellRule,
  Explanation,
  ExplanationStep,
  LiftPrescription,
  RampSet,
  SingleLog,
  SingleReason,
  UpdateResult,
} from './types';

// ---------------------------------------------------------------------
// constants from the spec (numbers the config does not carry)
// ---------------------------------------------------------------------

/** 2.1: TM = 0.90 × single ÷ 0.93. Kept exact; 0.968 is the prose approximation. */
export const SEED_FACTOR = 0.9 / 0.93;
/** 2.3 raw estimate divisor. */
const ESTIMATE_DIVISOR = 30;
/** 2.4 / 2.5: target is 90% of the (scaled) estimate. */
const TARGET_FRACTION = 0.9;
/** 2.5: damping gain once calibrated. */
const GAIN = 0.5;
/** 2.5: per-session cap once calibrated. */
const MATCHED_CAP = 0.025;
/** 2.5a: big-gap threshold and undamped cap. */
const BIG_GAP = 0.07;
const BIG_GAP_CAP = 0.05;
/** 2.6: failure signal cut. */
const FAILURE_CUT = 0.025;
/** 2.7: consecutive negative steps that trigger the downward session. */
const DOWNWARD_STREAK = 2;
const DOWNWARD_SETS = 2;
/** 2.9 M2 band. */
const BAND_LOW = 0.87;
const BAND_HIGH = 0.9;
const BAND_PROMOTE_RIR = 3;
const BAND_PROMOTE_SESSIONS = 2;
/** 2.9 M3/M4 and taper. */
const PRIMER_PCT = 0.9;
const SINGLE_REASON_TEXT: Record<SingleReason, string> = {
  big_gap: 'Last session disagreed with the TM by 7% or more.',
  boundary: 'First session of a new mesocycle.',
};

// ---------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------

/** 2.1 / 2.8. */
export function tmFromSingle(single: number): number {
  return single * SEED_FACTOR;
}

/** 2.3. */
export function rawEstimate(load: number, reps: number, rir: number): number {
  return load * (1 + (reps + rir) / ESTIMATE_DIVISOR);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function advance(p: Position): Position {
  return p === 3 ? 1 : ((p + 1) as Position);
}

function isRepOutPosition(p: Position | undefined): p is 2 | 3 {
  return p === 2 || p === 3;
}

const f1 = (n: number): string => n.toFixed(1);
const f3 = (n: number): string => n.toFixed(3);
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${f1(n)}`;

function liftName(config: ProgrammeConfig, lift: LiftId): string {
  return config.slots[lift]?.name ?? lift;
}

function calCap(config: ProgrammeConfig, lift: LiftId): number {
  const cap = config.slots[lift]?.cal_cap;
  if (cap === undefined) throw new Error(`config.slots.${lift}.cal_cap missing`);
  return cap;
}

function roundStep(config: ProgrammeConfig): number {
  return config.equipment.barbell_round_kg;
}

/** Downward trigger live (2.7): two consecutive negative steps. */
function downwardActive(ls: LiftState): boolean {
  return ls.neg_streak >= DOWNWARD_STREAK;
}

/** A.20: ramp loads are percentages of the day's displayed load, rounded by the one barbell rule. */
export function rampSets(dayLoad: number, config: ProgrammeConfig): RampSet[] {
  const step = roundStep(config);
  return config.wave.ramp.map(([frac, reps]) => ({ load: roundLoad(dayLoad * frac, step), reps }));
}

/**
 * 2.8 / A.8: reset the TM from a ramp single and rescale every set β.
 * Mutates `ls`; returns the explanation step.
 */
export function applySingle(ls: LiftState, single: { load: number; rir: number }): ExplanationStep {
  const tmOld = ls.tm;
  const tmNew = tmFromSingle(single.load);
  const ratio = tmNew / tmOld;
  const betaText: string[] = [];
  for (const p of ['2', '3'] as const) {
    const b = ls.beta[p];
    if (b !== null) {
      ls.beta[p] = b * ratio;
      betaText.push(`β${p} ${f3(b)} → ${f3(b * ratio)}`);
    }
  }
  ls.tm = tmNew;
  ls.single_scheduled = false;
  return explainStep(
    'single',
    `Ramp single ${f1(single.load)} kg at RIR ${single.rir}. TM = 0.90 × ${f1(single.load)} ÷ 0.93 = ${f1(tmNew)} kg (was ${f1(tmOld)}). Every β scales by ${f3(ratio)}${betaText.length ? ': ' + betaText.join(', ') : ''}.`,
    { single: single.load, tm_before: tmOld, tm_after: tmNew, ratio },
  );
}

// ---------------------------------------------------------------------
// prescribe
// ---------------------------------------------------------------------

/** A.15: big-gap flag, or entering a mesocycle listed in config.boundary_singles_on_entering. */
function singleReason(ls: LiftState, config: ProgrammeConfig, meso: Mesocycle): SingleReason | undefined {
  if (ls.single_scheduled) return 'big_gap';
  const last = ls.last_mesocycle ?? 'M1';
  if (config.boundary_singles_on_entering.includes(meso.id) && last !== meso.id) return 'boundary';
  return undefined;
}

/**
 * Prescription for one lift on one date.
 *
 * `singleLoad`: when the session opened with a ramp single and the
 * athlete has logged it, pass the load here and the work sets are
 * computed from the TM that single produces (A.8) without touching
 * state. `updateLift` applies the single for real when the session is
 * logged.
 */
export function prescribeLift(
  state: State,
  config: ProgrammeConfig,
  lift: LiftId,
  date: string,
  singleLoad?: number,
): BarbellPrescription {
  const ls = state.lifts[lift];
  const meso = mesocycleOn(config, date);
  if (!meso) return { kind: 'refer', lift, reason: `no mesocycle covers ${date}` };
  if (meso.barbell_mode === null) {
    return { kind: 'refer', lift, reason: `${meso.id} has no barbell mode in the config` };
  }
  if ((ls.forced_failures ?? 0) >= 2) {
    return {
      kind: 'refer',
      lift,
      reason: 'two consecutive failure signals on forced position-1 sessions',
    };
  }

  // A.23: a single already logged today (state) or previewed (singleLoad) makes this a single day.
  const takenToday = ls.single_taken?.date === date ? ls.single_taken : undefined;
  const reason = takenToday ? takenToday.reason : singleReason(ls, config, meso);
  const taken = takenToday !== undefined || (reason !== undefined && singleLoad !== undefined);
  const notes: string[] = [];
  const tm = !takenToday && reason !== undefined && singleLoad !== undefined ? tmFromSingle(singleLoad) : ls.tm;
  if (reason && !taken) {
    notes.push(`${SINGLE_REASON_TEXT[reason]} A ramp single at RIR 2 is suggested before the work sets. Skip it and the session runs as normal.`);
  }
  const step = roundStep(config);
  const base: Omit<LiftPrescription, 'pct' | 'load' | 'sets' | 'reps' | 'amrap' | 'ramp'> = {
    kind: 'lift',
    lift,
    mode: meso.barbell_mode,
    tm,
    notes,
  };
  if (reason) base.single_suggested = { reason, rir: 2, taken };

  switch (meso.barbell_mode) {
    case 'wave': {
      const forced = downwardActive(ls);
      const position: Position = forced ? 1 : ls.next_position;
      const wp = config.wave.positions[String(position) as '1' | '2' | '3'];
      const load = roundLoad(tm * wp.pct, step);
      const amrap = wp.amrap && !taken;
      const ramp = rampSets(load, config);
      if (forced) notes.push(`Downward trigger: two consecutive negative steps, so position 1 with ${DOWNWARD_SETS} sets.`);
      if (taken && wp.amrap) notes.push('Session opened with a single: straight sets, no rep-out.');
      const p: LiftPrescription = {
        ...base,
        position,
        pct: wp.pct,
        load,
        sets: forced ? DOWNWARD_SETS : config.wave.sets,
        reps: wp.reps,
        amrap,
        ramp,
      };
      if (amrap && wp.par !== undefined) p.par = wp.par;
      return p;
    }
    case 'band_87_90': {
      const bandPct = ls.band?.pct ?? BAND_LOW;
      return {
        ...base,
        pct: bandPct,
        load: roundLoad(tm * bandPct, step),
        // Rounds come from the template (3 to 4); phase 3 overrides this.
        sets: 3,
        reps: 2,
        amrap: false,
        ramp: [],
      };
    }
    case 'primer_2x2_90':
      return { ...base, pct: PRIMER_PCT, load: roundLoad(tm * PRIMER_PCT, step), sets: 2, reps: 2, amrap: false, ramp: [] };
    case 'single_1x2_90':
      return { ...base, pct: PRIMER_PCT, load: roundLoad(tm * PRIMER_PCT, step), sets: 1, reps: 2, amrap: false, ramp: [] };
  }
}

// ---------------------------------------------------------------------
// update
// ---------------------------------------------------------------------

/** 2.6: any set short, or the last set at prescribed reps below RIR 2. */
export function failureSignal(log: BarbellLog): boolean {
  const { reps, rir } = log.last_set;
  const presc = log.prescribed.reps;
  return log.missed || reps < presc || (reps === presc && rir < 2);
}

interface Work {
  rule: BarbellRule;
  step: number;
  E?: number;
  T?: number;
  gap?: number;
  scheduleSingle: boolean;
  steps: ExplanationStep[];
}

function explainStep(rule: string, text: string, numbers: Record<string, number | boolean | null>): ExplanationStep {
  return { rule, text, numbers };
}

/** Wave-mode evaluation per A.2, first match wins. Mutates β on `ls` only. */
function evaluateWave(
  ls: LiftState,
  config: ProgrammeConfig,
  lift: LiftId,
  log: BarbellLog,
  frozen: boolean,
  singleDay: boolean,
): Work {
  const tm = ls.tm;
  const pos = log.position;
  if (pos === undefined) throw new Error('wave log needs a position');
  const { load, reps, rir } = log.last_set;
  const setText = `Position ${pos}, ${f1(load)} kg × ${reps} at RIR ${rir} (prescribed ${log.prescribed.reps}).`;

  // 1. Failure signal
  if (failureSignal(log)) {
    const step = -FAILURE_CUT * tm;
    const why = log.missed
      ? 'a set was missed'
      : reps < log.prescribed.reps
        ? `${reps} reps is short of the prescribed ${log.prescribed.reps}`
        : `prescribed reps reached but RIR ${rir} is below 2`;
    return {
      rule: 'failure',
      step,
      scheduleSingle: false,
      steps: [
        explainStep(
          'failure',
          `${setText} Failure signal: ${why}. TM drops 2.5% with no damping: ${f1(tm)} − ${f1(-step)} = ${f1(tm + step)} kg.`,
          { tm_before: tm, cut_pct: FAILURE_CUT, step, tm_after: tm + step },
        ),
      ],
    };
  }

  // Straight sets on a single day (A.16): no calibration or update.
  if (singleDay) {
    return {
      rule: 'single',
      step: 0,
      scheduleSingle: false,
      steps: [explainStep('straight_sets', `${setText} Straight sets after a single: no rep-out update. TM stays ${f1(tm)} kg.`, { tm })],
    };
  }

  // 2. Position 1
  if (pos === 1) {
    return {
      rule: 'position1',
      step: 0,
      scheduleSingle: false,
      steps: [explainStep('position1', `${setText} Position 1 is straight sets: no TM update. TM stays ${f1(tm)} kg.`, { tm })],
    };
  }

  const E = rawEstimate(load, reps, rir);
  const beta = ls.beta[String(pos) as '2' | '3'];
  const eText = `Estimate E = ${f1(load)} × (1 + (${reps} + ${rir}) / 30) = ${f1(E)}.`;

  // 3. Calibration
  if (beta === null) {
    const T = TARGET_FRACTION * E;
    const gap = (T - tm) / tm;
    const cap = calCap(config, lift);
    let step = 0;
    let scheduleSingle = false;
    let text: string;
    if (Math.abs(gap) >= BIG_GAP) {
      scheduleSingle = true;
      if (gap > 0) {
        step = Math.min(T - tm, BIG_GAP_CAP * tm);
        text = `Gap ${pct(gap)} is at or past 7%: step up by min(${f1(T - tm)}, 5% cap ${f1(BIG_GAP_CAP * tm)}) = ${signed(step)} kg, undamped, and a ramp single is scheduled for the next session.`;
      } else {
        text = `Gap ${pct(gap)} is at or past 7% downward during calibration: no step, because both known biases point down; a ramp single is scheduled for the next session.`;
      }
    } else if (T > tm) {
      step = Math.min(T - tm, cap * tm);
      text = `First exposure at this position, so calibrate: T is above TM, step up by min(${f1(T - tm)}, ${pct(cap)} cap ${f1(cap * tm)}) = ${signed(step)} kg.`;
    } else {
      text = `First exposure at this position, so calibrate: T is at or below TM, so TM holds (downward steps are suppressed during calibration).`;
    }
    if (frozen && step > 0) {
      text += ` Week is past the freeze, so the upward step is withheld.`;
      step = 0;
    }
    const tmAfter = tm + step;
    const newBeta = tmAfter / T;
    ls.beta[String(pos) as '2' | '3'] = newBeta;
    return {
      rule: 'calibration',
      step,
      E,
      T,
      gap,
      scheduleSingle,
      steps: [
        explainStep(
          'calibration',
          `${setText} ${eText} Target T = 0.90 × E = ${f1(T)}. Gap (T − TM) / TM = ${pct(gap)} of TM ${f1(tm)}. ${text} TM ${f1(tmAfter)} kg. β${pos} = ${f1(tmAfter)} ÷ ${f1(T)} = ${f3(newBeta)}.`,
          { E, T, gap, cap, step, tm_before: tm, tm_after: tmAfter, beta: newBeta, single_scheduled: scheduleSingle },
        ),
      ],
    };
  }

  // 4. Big gap, 5. Matched
  const T = TARGET_FRACTION * beta * E;
  const gap = (T - tm) / tm;
  const tText = `Target T = 0.90 × β${pos} ${f3(beta)} × E = ${f1(T)}. Gap ${pct(gap)} of TM ${f1(tm)}.`;
  let rule: BarbellRule;
  let step: number;
  let scheduleSingle = false;
  let text: string;
  if (Math.abs(gap) >= BIG_GAP) {
    rule = 'biggap';
    scheduleSingle = true;
    step = clamp(T - tm, -BIG_GAP_CAP * tm, BIG_GAP_CAP * tm);
    text = `Gap is at or past 7%: step = clamp(${signed(T - tm)}, ±5% = ${f1(BIG_GAP_CAP * tm)}) = ${signed(step)} kg, undamped, and a ramp single is scheduled for the next session.`;
  } else {
    rule = 'matched';
    step = clamp(GAIN * (T - tm), -MATCHED_CAP * tm, MATCHED_CAP * tm);
    text = `Matched update: step = clamp(0.5 × ${signed(T - tm)}, ±2.5% = ${f1(MATCHED_CAP * tm)}) = ${signed(step)} kg.`;
  }
  if (frozen && step > 0) {
    text += ` Week is past the freeze, so the upward step is withheld.`;
    step = 0;
  }
  return {
    rule,
    step,
    E,
    T,
    gap,
    scheduleSingle,
    steps: [
      explainStep(rule, `${setText} ${eText} ${tText} ${text} TM ${f1(tm + step)} kg.`, {
        E,
        T,
        gap,
        beta,
        step,
        tm_before: tm,
        tm_after: tm + step,
        single_scheduled: scheduleSingle,
      }),
    ],
  };
}

/** M2, M3/M4 and taper (2.9, A.9): only the failure signal moves the TM. */
function evaluateHeld(ls: LiftState, log: BarbellLog, frozen: boolean, singleDay: boolean): Work {
  const tm = ls.tm;
  const { load, reps, rir } = log.last_set;
  const setText = `${f1(load)} kg × ${reps} at RIR ${rir} (prescribed ${log.prescribed.reps}).`;
  if (failureSignal(log)) {
    const step = -FAILURE_CUT * tm;
    const steps = [
      explainStep('failure', `${setText} Failure signal. TM drops 2.5%: ${f1(tm)} → ${f1(tm + step)} kg.`, {
        tm_before: tm,
        step,
        tm_after: tm + step,
      }),
    ];
    if (log.mode === 'band_87_90') {
      ls.band = { pct: BAND_LOW, high_rir_streak: 0 };
      steps.push(explainStep('band', 'Band returns to 87% of TM.', { band_pct: BAND_LOW }));
    }
    return { rule: 'failure', step, scheduleSingle: false, steps };
  }
  const steps: ExplanationStep[] = [];
  if (log.mode === 'band_87_90' && !singleDay) {
    const band = ls.band ?? { pct: BAND_LOW, high_rir_streak: 0 };
    if (rir >= BAND_PROMOTE_RIR) {
      const streak = band.high_rir_streak + 1;
      if (band.pct === BAND_LOW && streak >= BAND_PROMOTE_SESSIONS && !frozen) {
        ls.band = { pct: BAND_HIGH, high_rir_streak: 0 };
        steps.push(explainStep('band', `${setText} Last double at RIR ${rir} for the second consecutive session: band moves to 90% of TM.`, { band_pct: BAND_HIGH, streak }));
      } else {
        ls.band = { pct: band.pct, high_rir_streak: streak };
        steps.push(explainStep('band', `${setText} Last double at RIR ${rir}: ${streak} of ${BAND_PROMOTE_SESSIONS} sessions towards 90%. Band stays ${pct(band.pct)}.`, { band_pct: band.pct, streak }));
      }
    } else {
      ls.band = { pct: band.pct, high_rir_streak: 0 };
      steps.push(explainStep('band', `${setText} Last double at RIR ${rir}, below 3: band stays ${pct(band.pct)}, streak reset.`, { band_pct: band.pct, streak: 0 }));
    }
  } else {
    steps.push(explainStep('hold', `${setText} TM is held in this phase: ${f1(tm)} kg.`, { tm }));
  }
  return { rule: singleDay ? 'single' : 'hold', step: 0, scheduleSingle: false, steps };
}

/**
 * Apply a ramp single: TM reset, β rescale, and mark the day so the work
 * sets that follow are straight sets computed from the new TM (A.8, A.16).
 */
export function updateSingle(state: State, config: ProgrammeConfig, log: SingleLog): { state: State; explanation: Explanation } {
  const next = structuredClone(state);
  const ls = next.lifts[log.lift];
  const meso = mesocycleOn(config, log.date);
  const reason: 'boundary' | 'big_gap' = ls.single_scheduled ? 'big_gap' : 'boundary';
  const step = applySingle(ls, { load: log.load, rir: log.rir });
  ls.single_taken = { date: log.date, reason };
  if (meso) ls.last_mesocycle = meso.id;
  const summary = `${liftName(config, log.lift)}: single ${f1(log.load)} kg → TM ${f1(ls.tm)} kg. Today's work sets are straight sets from the new TM.`;
  return { state: next, explanation: { summary, steps: [step] } };
}

/**
 * Apply one logged session on one lift. Returns the new state, a
 * machine-readable outcome and a plain-language explanation of every
 * step with its numbers. Never mutates the input state.
 */
export function updateLift(state: State, config: ProgrammeConfig, log: BarbellLog): UpdateResult {
  const next = structuredClone(state);
  const ls = next.lifts[log.lift];
  const name = liftName(config, log.lift);
  const steps: ExplanationStep[] = [];
  const tmStart = ls.tm;
  const week = programmeWeek(config, log.date);
  const frozen = week > config.freeze.no_upward_steps_after_week;
  const forced = log.mode === 'wave' && downwardActive(ls);
  const duePosition = ls.next_position;

  // Single first (2.8, A.8), either on this log or already applied today through update() (A.23).
  const singleDay = log.single !== undefined || ls.single_taken?.date === log.date;
  if (log.single) steps.push(applySingle(ls, log.single));
  // A.17: a suggested single that was not taken is cleared, not carried.
  const skippedSingle = !singleDay && ls.single_scheduled;
  const tmBefore = ls.tm;
  const work = log.mode === 'wave' ? evaluateWave(ls, config, log.lift, log, frozen, singleDay) : evaluateHeld(ls, log, frozen, singleDay);
  delete ls.single_taken;
  ls.tm = tmBefore + work.step;
  steps.push(...work.steps);
  if (work.scheduleSingle) {
    ls.single_scheduled = true;
  } else if (skippedSingle) {
    ls.single_scheduled = false;
    steps.push(explainStep('single_skipped', 'The suggested ramp single was skipped, so the suggestion is cleared.', { single_scheduled: false }));
  }

  // Streak (A.6) and downward trigger bookkeeping (2.7, Q2 ruling).
  if (log.mode === 'wave') {
    const pos = log.position;
    if (isRepOutPosition(pos)) {
      ls.neg_streak = work.step < 0 ? ls.neg_streak + 1 : 0;
    }
    if (forced) {
      if (work.rule === 'failure') {
        ls.forced_failures = (ls.forced_failures ?? 0) + 1;
        steps.push(
          explainStep(
            'downward',
            ls.forced_failures >= 2
              ? 'Second failure signal on a forced position-1 session: refer to project.'
              : 'Failure signal on the forced position-1 session: one more forced session.',
            { forced_failures: ls.forced_failures },
          ),
        );
      } else {
        ls.neg_streak = 0;
        ls.forced_failures = 0;
        steps.push(explainStep('downward', 'Forced position-1 session completed: downward trigger cleared.', { neg_streak: 0 }));
      }
    }
    // Position advance (A.7). A forced session advances the pointer only
    // when position 1 was due anyway, or when it cleared the trigger.
    if (!forced) {
      ls.next_position = advance(duePosition);
    } else if (duePosition === 1) {
      ls.next_position = advance(duePosition);
    }
    if (frozen) steps.push(explainStep('freeze', `Week ${week} is past week ${config.freeze.no_upward_steps_after_week}: no upward steps.`, { week }));
  }

  ls.sessions_logged += 1;
  ls.last_logged = log.date;
  const meso = mesocycleOn(config, log.date);
  if (meso) ls.last_mesocycle = meso.id;

  if (log.override) {
    const rec = { kind: 'load' as const, date: log.date, slot: log.lift, from: log.override.from, to: log.prescribed.load };
    (next.overrides ??= []).push(log.override.note !== undefined ? { ...rec, note: log.override.note } : rec);
    steps.push(
      explainStep(
        'override',
        `Load overridden by the athlete: ${f1(log.override.from)} → ${f1(log.prescribed.load)} kg${log.override.note ? ` (${log.override.note})` : ''}. The update reads the load lifted.`,
        { from: log.override.from, to: log.prescribed.load },
      ),
    );
  }

  const posKey = isRepOutPosition(log.position) ? (String(log.position) as '2' | '3') : null;
  const outcome: BarbellOutcome = {
    rule: work.rule,
    step: work.step,
    tm_before: tmBefore,
    tm_after: ls.tm,
    beta: posKey ? ls.beta[posKey] : null,
    single_scheduled: ls.single_scheduled,
  };
  if (work.E !== undefined) outcome.E = work.E;
  if (work.T !== undefined) outcome.T = work.T;
  if (work.gap !== undefined) outcome.gap = work.gap;
  if (ls.band) outcome.band_pct = ls.band.pct;

  const summary = `${name}: TM ${f1(tmStart)} → ${f1(ls.tm)} kg (${work.rule}${ls.single_scheduled ? ', single scheduled' : ''}).`;
  return { state: next, outcome, explanation: { summary, steps } };
}
