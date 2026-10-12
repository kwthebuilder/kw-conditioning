# App Build Plan v1.4

**Version 1.4 | 10 October 2026 | Supersedes v1.3.** Interface release 1.1, the date-free patch, is added as phase 7a, between release 1 and release 2. The interface spec moves to `ui_spec_v1_3.md`, the config to `programme_config_v1_5.json` and the test vectors to `engine_test_vectors_v1_5.json`. No engine rule changes.

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
| 9 | Interface release 3: the season | ui_spec_v1_3.md §15 | Plan and Progress tabs from the replayed log; log checkpoints before any engine rule change |

## Process rule restated
A phase is accepted on test output, not on a plan. Plans are approved; outputs are accepted. Code reaches the phone only when the athlete merges to `main`, which deploys.
