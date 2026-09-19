# Spec Questions

One entry per question. The builder appends; the orchestrator answers. Never edit or delete an answered entry; supersede it with a new one.

Format:

## Q1 — short title
- **Raised:** YYYY-MM-DD, phase N
- **Where:** engine_spec_v1_3.md §X / vectors block Y
- **Question:** what is ambiguous or appears contradictory
- **Blocked:** what was skipped because of it
- **Ruling:** (orchestrator) 
- **Spec revision:** (orchestrator) none, or the new version issued

## Q1 — accessory vector slot ids do not match programme_config slot ids
- **Raised:** 2026-09-19, phase 0
- **Where:** engine_test_vectors_v1.json `accessory` block / programme_config_v1.json `slots`
- **Question:** The accessory vectors name slots `db_push_press_strength`, `weighted_pull_up` and `bulgarian_split_squat`. The config defines these slots as `db_pp_strength`, `pull_up` and `bss` (`hack_squat` matches in both). Is the config id authoritative, so the vectors should be read with an alias map, or should the vectors file be revised to use the config ids?
- **Blocked:** Nothing in phase 0. The loader does not cross-check vector slot ids against config slot ids because of this. Phase 2 needs the ruling before the accessory vectors can be bound to config slots.
- **Ruling:** (orchestrator) Interim, phase 2: the engine uses config ids only. The accessory vector test keeps a three-line alias map from vector id to config id until vectors v1.1 is issued.
- **Spec revision:** (orchestrator) vectors v1.1 pending

## Q2 — downward trigger: what "restores" means when the forced session is at position 1
- **Raised:** 2026-09-19, phase 1
- **Where:** engine_spec_v1_3.md §2.7 / Appendix A.6
- **Question:** §2.7 restores "after one session with a non-negative step", but A.6 says position 1 sessions "neither count nor reset" the streak, and the forced session is at position 1. Read literally the trigger can never clear. Also: does the forced session advance the wave pointer, and what happens if the forced session itself ends in a failure signal?
- **Blocked:** Nothing; implemented under the ruling below.
- **Ruling:** (orchestrator) The forced position-1 session, completed without a failure signal, resets the streak and the wave resumes at the position that was due. If the position due was already 1, the forced 2-set session is that session and the pointer advances to 2. If a forced session ends in a failure signal, apply the 2.5% cut and force one more. After a second failure signal, return "refer to project".
- **Spec revision:** (orchestrator) none

## Q3 — week 22 freeze and singles
- **Raised:** 2026-09-19, phase 1
- **Where:** engine_spec_v1_3.md Appendix A.10 / §2.8
- **Question:** A.10 says no slot takes an upward step after week 22. Does an audit or scheduled single that comes out higher still reset the TM upward?
- **Blocked:** Nothing; implemented as: yes, a single is a measurement under 2.8, not a step. Rep-based upward steps are withheld after week 22.
- **Ruling:** (orchestrator) Accepted as implemented.
- **Spec revision:** (orchestrator) none

## Q4 — which mesocycle boundaries fire an audit single
- **Raised:** 2026-09-19, phase 1
- **Where:** engine_spec_v1_3.md §2.8 / §2.9 / programme_config_v1.json `mesocycles`, `boundary_events`
- **Question:** §2.8 says "first session of each mesocycle". §2.9 names only the 9 Nov and 21 Dec audits. Does entering M4, TAPER or INTENSIVE fire one, and what does the initial state (no last mesocycle recorded) count as?
- **Blocked:** Nothing; implemented under the ruling below.
- **Ruling:** (orchestrator) Boundary singles fire only on entering M2, M3 and M4. Never for TAPER or INTENSIVE. An absent last mesocycle means M1, so no single.
- **Spec revision:** (orchestrator) none

## Q5 — work sets on a day that opens with a single
- **Raised:** 2026-09-19, phase 1
- **Where:** engine_spec_v1_3.md §2.8 / Appendix A.8 / A.2
- **Question:** A.8 says the day's loads are computed from the TM the single produced. Do the work sets that follow still run the rep-out and the A.2 update (calibration, big gap, matched) against the freshly reset TM?
- **Blocked:** Nothing; implemented under the ruling below.
- **Ruling:** (orchestrator) On any session that opens with a single, the work sets are straight sets: no rep-out, no calibration, no matched or big-gap update. The failure signal still applies and the position still advances.
- **Spec revision:** (orchestrator) none

## Q6 — increment size for the class B streak slots
- **Raised:** 2026-09-19, phase 2
- **Where:** engine_spec_v1_3.md §3 / programme_config_v1.json `slots.hack_squat`, `slots.abductor_hsr`
- **Question:** The config gives `up_at`, `down_below` and `streak` for hack squat and abductor HSR but no increment. What size is "one increment"?
- **Blocked:** Nothing; implemented under the ruling below.
- **Ruling:** (orchestrator) Hack squat steps 5 kg. Slots whose increment is text (abductor HSR on the cable stack, chest-supported row "one plate or 2 kg/hand") show "go up one plate" until a heavier load is logged; the engine then reads the load lifted.
- **Spec revision:** (orchestrator) none

## Q7 — phase 2 scope cut
- **Raised:** 2026-09-19, phase 2
- **Where:** app_build_plan_v1.md §4 phase 2 / engine_test_vectors_v1.json `trap_bar_jump`, `cmj`, `flare_ladder`, `gap`
- **Question:** Recorded for traceability: which of the phase 2 rules are built in this pass.
- **Blocked:** Flare ladder, session flags, time pre-cuts, gap rules, trap-bar height progression, jump shrug and Nordic progression, contact caps, CMJ flag and baseline. Classes D, E and F carry no logic: prescriptions are read from the config as fixed text and numbers (trap-bar jump at `equipment.trap_bar_kg`; depth-jump contacts by mesocycle, 6 for the M2 range) and are logged done / not done with an optional number. CMJ stores the value and shows the running mean only.
- **Ruling:** (orchestrator) Scope cut by the athlete. The `trap_bar_jump`, `cmj`, `flare_ladder` and `gap` vector blocks are out of scope and will be removed in vectors v1.1. Added instead: a manual override on every prescribed load and on each training max, recorded with an optional note and carried in the export; scheduled and boundary singles are a skippable suggestion, never forced.
- **Spec revision:** (orchestrator) vectors v1.1 pending
