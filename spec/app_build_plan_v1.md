# App Build Plan and Orchestration Scheme v1

**Version 1 | 19 September 2026**
**Purpose:** how the training app gets built in Claude Code, who does what, in what order, and what has to be true before each step is accepted. Visual design is unimportant; correctness of the engine is everything.

---

## 1. Roles

| Role | Who | Owns | Never does |
|---|---|---|---|
| **Athlete** | You | Runs Claude Code, pastes phase prompts, tests on the phone, makes go/no-go calls | Interpret the spec for the builder |
| **Orchestrator** | A new chat in this project, started with `orchestrator_kickoff_prompt_v1.md` | The spec, the config, the test vectors, phase prompts, acceptance review, rulings on spec questions | Write app code; change programme structure |
| **Builder** | Claude Code in the repo | All code, tests, tooling, UI choices, deployment | Change the meaning of any rule; edit files in `/spec` |

One rule governs the whole build: **the spec is upstream of the code.** If behaviour needs to change, the orchestrator bumps the spec version, then the vectors, and only then does the builder touch code. If the builder finds the spec unclear, it writes the question to `SPEC_QUESTIONS.md` and stops that item; the orchestrator rules and, where needed, issues a spec revision. The builder never resolves an ambiguity by guessing.

## 2. Contracts handed to the builder

Placed read-only in the repo under `/spec`:

| File | What it is |
|---|---|
| `engine_spec_v1_3.md` | The rules. Appendix A removes the ambiguities. |
| `engine_test_vectors_v1.json` | The acceptance contract. Numbers here beat prose. |
| `programme_config_v1.json` | Every template M1 to taper, slot classes, increments, site mapping, dates. |
| `initial_state_v1.json` | State as of 19 Sep: both lifts entering position 2, nothing calibrated. |
| `training_log_2026_w01_w02_r3.md` | The golden session: `prescribe()` must reproduce week 2 from the state and config. |

`CLAUDE.md` at the repo root carries the standing rules (supplied).

## 3. Architecture constraints (everything else is the builder's choice)

- Static, offline-capable web app, installable to the phone home screen. No backend, accounts, analytics or network calls after load.
- TypeScript. The engine is a pure module: no UI, storage, clock or random imports; date is passed in. `prescribe(state, config, date)` and `update(state, log)` only.
- State is schema-versioned with a migration path. Storage on the device is assumed losable: the app prompts an export at the end of every session, and import of that export restores state exactly. Whether phone browsers evict storage for home-screen apps was not verified; the design does not depend on the answer.
- Config is bundled and replaceable by import, so a template revision never needs a rebuild.
- Free static hosting over HTTPS (builder proposes; athlete approves). The repo contains programme config but no training data.

## 4. Phases and gates

Each phase is one Claude Code session started in plan mode with the phase prompt from the orchestrator. A phase is accepted only when its gate passes; the orchestrator checks the gate independently (cloning the repo if it is public, or from pasted test output and a zip if not).

| # | Phase | Scope | Gate |
|---|---|---|---|
| 0 | Scaffold | Repo, tooling, test runner, `/spec` in place, `CLAUDE.md`, empty deploy | Tests run; a placeholder page loads on the phone |
| 1 | Barbell engine | Types, rounding, seed, wave, calibration, matched update, big gap, failure signal, downward trigger, audit rescale, phase modes | Every `barbell`, `rounding`, `audit_rescale`, `downward_trigger` vector passes; property tests: step never exceeds its cap, state never holds a rounded TM, position 1 never changes TM |
| 2 | Other classes and flags | RDL table, classes B/C/D/E/F, CMJ rule, flare ladder, catch flag, time pre-cuts, gap rules, week-22 freeze | Remaining vectors pass |
| 3 | Prescription | Config loader, mesocycle by date, template assembly, ladder days, audit days, flag consequences, par display | Golden sessions: week 2 Day 1 and Day 2 match the r3 log line for line; spot checks for one session in each of M2, M3, M4, taper reviewed by the orchestrator against the rationale |
| 4 | Persistence | State store, schema version, export to markdown with JSON footer, import | Round trip: export → wipe → import → identical `prescribe()` output; corrupted import is rejected without touching state |
| 5 | Interface | Today screen, last-set entry (prefilled, one tap if hit), flags at open, step explanation, history, settings (equipment, config import), export | Athlete logs a dry-run session with under a minute of total entry |
| 6 | Offline and deploy | Installable, works in airplane mode, versioned release | Full session logged offline on the phone |
| 7 | Shadow run | Real sessions logged in the app while the paper sheet still governs | App's next-week prescription equals the orchestrator's hand calculation for two consecutive weeks; then the app becomes the programme giver |

Phases 1 and 2 are the product. If time is short, phases 5 and 6 can be crude; phases 1 to 4 cannot.

## 5. Timeline

The app does not need to exist on Monday and should not be rushed to. Week 2 (21 and 24 Sep) runs from `training_log_2026_w01_w02_r3.md` and is back-entered when phase 5 lands. Target: phases 0 to 4 by Sun 27 Sep, 5 to 6 by Sun 4 Oct, shadow run weeks 4 and 5, app governs from week 6 (19 Oct). The orchestrator issues weekly loads by hand from the spec until then. This reverses my earlier push to build before Monday: with Claude Code and a gated build, correctness is worth more than two sessions of convenience.

## 6. Change control after release

| Change | Path |
|---|---|
| Template, exercise, dates, increments | New `programme_config_vN.json` from the project → imported in the app |
| Any rule or number in the engine | Spec version → vectors version → builder → gate → release |
| Training max by judgement (e.g. after physio input) | Logged as a manual audit in the app with a reason; appears in the export |
| Bug | Builder adds a failing vector first, then fixes |

Every release carries the spec, config and vectors versions on its settings screen and in every export.

## 7. Weekly operating loop once live

Athlete trains from the app → exports at session end → drops the week's log into the project → the project chat reads logs at the wavelet reviews and mesocycle boundaries, and on any "refer to project" message. The project no longer issues loads.

## 8. Risks

| Risk | Control |
|---|---|
| Builder "improves" a rule | Read-only `/spec`, vectors as gate, `SPEC_QUESTIONS.md` |
| Silent data loss on the phone | Export prompt every session; import restores exactly |
| Spec and config drift from the rationale | Only the orchestrator edits them; versions shown in the app |
| Config prose in later mesocycles is thinner than M1 | Phase 3 spot checks; M2 config re-reviewed at the 9 Nov boundary before it governs |
| The trap bar is not 24 kg | One settings field; no code change |

## 9. Phase prompts

The orchestrator writes each phase prompt when the previous gate passes, so it can carry what was learned. Phase 0 and 1 prompts are in `orchestrator_kickoff_prompt_v1.md` as the pattern: scope, files to read, what to build, what not to touch, the gate, and what to report back (test output, open spec questions, decisions taken).
