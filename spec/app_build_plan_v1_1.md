# App Build Plan v1.1

**Version 1.1 | 19 September 2026 | Supersedes v1.** Roles, the spec-upstream rule, architecture constraints and change control are unchanged from v1. Scope is cut per `engine_spec_v1_4.md`: a straightforward programme giver.

## Phases from here

| # | Phase | Scope | Gate |
|---|---|---|---|
| 1 | Barbell engine | Built. Apply rulings A.14 to A.18 | `barbell`, `rounding`, `audit_rescale`, `downward_trigger`, `singles`, `override` vectors pass; property tests green. **Test output must be shown to the orchestrator; not yet seen.** |
| 2 | RDL, tempo slots, accessories | `rdl.ts`, `tempo.ts`, `accessory.ts`, week-22 freeze | `rdl` and `accessory` vectors pass |
| 3 | Prescription | Session for a date from config + state; fixed text for classes D, E, F; par and ramp sets; single suggestions | Week 2 Day 1 and Day 2 reproduce the r3 log for every computed load |
| 4 | Persistence | State store, export to markdown with JSON footer, exact import, overrides in the export | Export → wipe → import → identical prescription |
| 5 | Interface and offline | Today screen, last-set entry, edit any load, edit TM, skip or tick a slot, history, export prompt; installable, works offline | A full session logged on the phone in airplane mode with under a minute of entry |
| 6 | Shadow run | Two weeks alongside hand-computed loads | App matches hand calculation two weeks running |

## Process rule restated
A phase is accepted on test output, not on a plan. Plans are approved; outputs are accepted. No phase starts until the previous phase's output has been seen.
