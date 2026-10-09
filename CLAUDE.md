# CLAUDE.md — Acro Base S&C training app

Version 1.6 | 9 October 2026

## What this is
A phone-first, offline web app that prescribes and logs a two-day-a-week strength programme. The engine computes every load from the athlete's logged sets. The interface is governed by `spec/ui_spec_v1_1.md`: plain, fast, legible with one hand in a gym, and honest about time (a past date is a record, today is live, a future date is a preview).

## Non-negotiables
1. `/spec` is read-only. It holds the engine spec, test vectors, programme config, initial state and the golden log. Never edit these files and never change what a rule means.
2. If the spec is unclear or seems wrong, append the question to `SPEC_QUESTIONS.md` with the section reference, skip that item, and carry on. Do not guess.
3. `spec/engine_test_vectors_v1_4.json` is the acceptance contract. Where prose and vectors disagree, the vectors win and the disagreement goes in `SPEC_QUESTIONS.md`.
4. The engine is a pure TypeScript module: no UI, storage, network, clock or randomness. Dates are passed in. Public surface: `prescribe(state, config, date, day?)` and `update(state, log)`, the latter returning the new state and a plain-language explanation of every step with its numbers. Corrections go through `amend(base, state, correction, config)`, which rebuilds state by replaying the corrected log through `update` (A.28).
5. State holds unrounded floats. Rounding happens only when a load is displayed (nearest 2.5 kg, ties down).
6. No backend, accounts or analytics. The only network call after load is the optional backup to the athlete's own private GitHub repo (`spec/engine_spec_v1_8.md` §12 Backup). No training data in this repo, ever: it is public.
7. Device storage is losable. Prompt an export at the end of every session. Import must restore state exactly or refuse without touching state.
8. Bugs: write the failing test first. Interface changes come with a phone-screen smoke test in `e2e/` (synthetic data only); `npm run e2e` runs them, and every pull request runs them.
9. Work one phase at a time. Start each phase in plan mode; end it by running the full test suite and reporting: test output, open spec questions, decisions taken.

## Scope
This is a straightforward programme giver. Build only what `spec/engine_spec_v1_8.md` lists as in the app, with the screens and words in `spec/ui_spec_v1_1.md`. No flags, flare logic, time cuts, gap rules or auto-progression for jumps and prehab, except the explosive carry-load slots in A.24. Every prescribed number is editable by the athlete.

## Yours to choose
Framework, styling, storage mechanism, hosting, file layout, component design. Prefer fewer dependencies.

## Domain glossary
TM: training max. RIR: reps in reserve, counted to technical failure. Wave position: 1/2/3 = 80/85/90% of TM. Rep-out: last set taken to RIR 2, positions 2 and 3 only. Par: reps at which the raw estimate equals the TM. β: per-position scale factor set at calibration. Single: ramp single at RIR 2 that resets TM and rescales β. Site: patellar or gluteal tendon, for the flare ladder. Skip: a log entry that moves nothing (A.26). Correction: an entry that replaces, removes or inserts logged entries; state is rebuilt by replay (A.28).
