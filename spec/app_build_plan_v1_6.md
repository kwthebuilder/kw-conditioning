# App Build Plan v1.6

**Version 1.6 | 7 November 2026 | Supersedes v1.5.** Release 3 (phase 8a) was reviewed by the coordinating chat on 7 Nov 2026 and merged at the athlete's direction the same day (pull request 6). Adds phase 8b, release 3.1. Current files: `engine_spec_v1_10.md`, `ui_spec_v1_5.md`, `programme_config_v1_7.json`, `engine_test_vectors_v1_7.json`.

**v1.5 header, kept: Version 1.5 | 19 October 2026 | Supersedes v1.4.** Adds phase 8a, the programme 1.6 release: the athlete approved a new programme for every block on 19 Oct 2026, and the programme owner authorised the builder to write the spec versions that encode it. Current files: `engine_spec_v1_9.md`, `ui_spec_v1_4.md`, `programme_config_v1_6.json`, `engine_test_vectors_v1_6.json`. Every rule the app already had is unchanged; existing logs and state import unchanged and replay to the same numbers.

**v1.5 note: spec authoring by the builder.** For this release only, the programme owner authorised new spec versions written by the builder. No existing spec file was edited or deleted; each new file sits beside the one it supersedes. Programme content is the athlete's (19 Oct 2026); implementation rulings are the builder's under that brief, each recorded in `SPEC_QUESTIONS.md` (Q33 to Q47) for review before merge.

**v1.4 note, kept: Version 1.4 | 10 October 2026 | Supersedes v1.3.** Interface release 1.1, the date-free patch, is added as phase 7a, between release 1 and release 2. The interface spec moves to `ui_spec_v1_3.md`, the config to `programme_config_v1_5.json` and the test vectors to `engine_test_vectors_v1_5.json`. No engine rule changes.

**v1.4 note: release order.** The interface spec places release 1.1 before release 2. Release 2's code shipped first: it was merged and deployed on 9 Oct, before release 1.1 was specified. Release 1.1 is therefore built on top of release 2. Where the two overlap (the finish summary's not-logged step, the order of attention cards on Today, the bottom bar after a session), release 1.1's words and behaviour apply. Release 2's own acceptance gate stays open until the athlete judges it on a Day 1.

**v1.3 note.** Release 1 merged and deployed 9 Oct (phase 7 accepted). Release 2 gains the tissue check-in and the interface spec moves to v1.1. Pull requests now run every check, including phone-screen smoke tests, before merge.

**v1.2 note.** Phases 1 to 5 are built and in use. Phase 6 (shadow run) is replaced by the 8 October audit: the athlete's log replayed through the engine reproduced the app's state exactly. Three interface releases are added under `ui_spec_v1_0.md`, with the engine rulings they need in `engine_spec_v1_8.md` (A.26 to A.31). Roles, the spec-upstream rule, architecture constraints and change control are unchanged.

## Phases

| # | Phase | Scope | Gate |
|---|---|---|---|
| 1 to 5 | Engine, persistence, interface, offline | Built | Accepted |
| 6 | Shadow run | Replaced by the 8 Oct replay audit | Accepted: replay reproduced the exported state exactly |
| 7 | Interface release 1: trust | ui_spec_v1_0.md §4 to §13; engine A.26 to A.28, A.30, A.31 | Accepted 9 Oct: merged and deployed |
| 7a | Interface release 1.1: the date-free patch | ui_spec_v1_3.md §13A: one screen (Today, History by programme week, Plan); no date bar and no future dates; Add a missed session; the unfinished-session card (Carry on, Close it); the not-recorded question at Finish; Remove this session in Edit; dates written out; dumbbell loads 2 to 40 kg; one 51 cm drop-jump box with no ladder. Config v1.5 and test vectors v1.5. No engine rule changes; built on top of release 2 (see the v1.4 note) | Every §13A acceptance test passes, including the phone-screen smoke tests; the athlete merges |
| 8 | Interface release 2: gym floor | ui_spec_v1_1.md §14, including the tissue check-in (§14.9, engine A.29); carried unchanged into ui_spec_v1_3.md §14 except where marked v1.2 | Merged 9 Oct, acceptance open. Gate: smoke tests cover focus, set ticking, the finish summary, contrast rounds and the check-in; a full Day 1 logged in under a minute of entry, judged by the athlete on a Day 1; the athlete merges |
| 8a | Programme 1.6 release | programme_config_v1_6.json; engine_spec_v1_9.md A.32 to A.39; ui_spec_v1_4.md §18 to §22; engine_test_vectors_v1_6.json. New templates for every block (no contrast rounds), dumbbell Romanian deadlift and seated abduction, swaps, the template rep target, audit-day trims, the phase-start test, the tendon question at session start, the new on-screen words. Built on branch `release-3-programme-1-6` | Every unit test and phone-screen smoke test passes, including every vector in v1.6 and the compatibility tests (an existing log replays to the same numbers); the coordinating chat reviews; the athlete merges. Must be merged before 9 Nov 2026 (Block 2) for the Block 2 sessions to be the approved ones; the new Block 1 sessions apply from the day it is merged |
| 8b | Release 3.1 | config v1.7; engine spec v1.10 A.40 to A.42; ui spec v1.5 §23 to §27; vectors v1.7. Reserve-based step on streak slots from 7 Nov; jump shrug by speed; seated abduction swap; taper jump test; Plan card in each block's terms; session length at Finish; corrected backup log; footer version | Every unit and phone-screen test passes, including vectors v1.7 and the athlete's real log replaying to identical numbers; the athlete approved the changes on 7 Nov 2026 and directed the push |
| 9 | Interface release 3: the season | ui_spec_v1_4.md §15 (unchanged from v1.3) | Plan and Progress tabs from the replayed log; log checkpoints before any engine rule change |

## Process rule restated
A phase is accepted on test output, not on a plan. Plans are approved; outputs are accepted. Code reaches the phone only when the athlete merges to `main`, which deploys.
