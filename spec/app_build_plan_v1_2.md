# App Build Plan v1.2

**Version 1.2 | 9 October 2026 | Supersedes v1.1.** Phases 1 to 5 are built and in use. Phase 6 (shadow run) is replaced by the 8 October audit: the athlete's log replayed through the engine reproduced the app's state exactly. Three interface releases are added under `ui_spec_v1_0.md`, with the engine rulings they need in `engine_spec_v1_8.md` (A.26 to A.31). Roles, the spec-upstream rule, architecture constraints and change control are unchanged.

## Phases

| # | Phase | Scope | Gate |
|---|---|---|---|
| 1 to 5 | Engine, persistence, interface, offline | Built | Accepted |
| 6 | Shadow run | Replaced by the 8 Oct replay audit | Accepted: replay reproduced the exported state exactly |
| 7 | Interface release 1: trust | ui_spec_v1_0.md §4 to §13; engine A.26 to A.28, A.30, A.31 | §13 acceptance tests pass on a phone-width browser; full suite green including `skip` and `amend` vectors; the athlete merges the pull request |
| 8 | Interface release 2: gym floor | ui_spec_v1_0.md §14 | Before 9 Nov (Block 2 contrast rounds). A full Day 1 logged in under a minute of entry |
| 9 | Interface release 3: the season | ui_spec_v1_0.md §15; engine A.29 | Plan and Progress tabs from the replayed log; tissue check-in recorded |

## Process rule restated
A phase is accepted on test output, not on a plan. Plans are approved; outputs are accepted. Code reaches the phone only when the athlete merges to `main`, which deploys.
