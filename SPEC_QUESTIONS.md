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

## Q8 — ramp-set rounding: golden log 40 kg versus §10's 37.5 kg
- **Raised:** 2026-09-20, phase 3
- **Where:** training_log_2026_w01_w02_r3.md week 2 Day 1 item 5 / engine_spec_v1_4.md §2.2, §10
- **Question:** 50% of the 77.5 kg top set is 38.75, an exact tie, which §10 rounds down to 37.5. The r3 log shows 40. Which rule governs ramp sets?
- **Blocked:** Nothing; raised at plan time.
- **Ruling:** (orchestrator) The 40 was a hand error. Spec v1.5 A.20: ramp loads are a percentage of the day's displayed load rounded by the one barbell rule, nearest 2.5 ties down. Golden log r4 shows 37.5; vectors v1.2 add a `ramp` block and the 38.75 → 37.5 rounding case.
- **Spec revision:** (orchestrator) engine_spec_v1_5.md, training_log_2026_w01_w02_r4.md, engine_test_vectors_v1_2.json

## Q9 — week 2 RSI ladder substitution existed only as prose
- **Raised:** 2026-09-20, phase 3
- **Where:** training_log_2026_w01_w02_r3.md week 2 Day 1 item 3 / programme_config_v1_1.json `slots.rsi_ladder.when`
- **Question:** The golden Day 1 shows the RSI ladder in place of the depth jump, but the config carried the schedule only as a prose `when` field. Should the session substitute it, and from which config field?
- **Blocked:** Nothing; raised at plan time.
- **Ruling:** (orchestrator) Spec v1.5 A.21 and config v1.2 top-level `ladder`: on the listed weeks and day, the `rsi_ladder` item takes the place of the first slot named in `replaces` and the others are dropped. Fixed text, no ladder logic. A.22 fixes day selection (explicit day wins; else Day 2 if front squat `last_logged` is later than the deadlift's, else Day 1) and A.23 routes every state change through `update`.
- **Spec revision:** (orchestrator) engine_spec_v1_5.md, programme_config_v1_2.json

## Q10 — M2 explosive slots show no load; jump shrug start of 70% of deadlift TM
- **Raised:** 2026-09-26, review before M2
- **Where:** engine_spec_v1_5.md §5, A.19 / programme_config_v1_2.json `slots.jump_shrug.start_pct_dl_tm`
- **Question:** Under the v1.4 scope cut the jump shrug, landmine clean and push press, and explosive DB push press are fixed text with no load. From 9 Nov the athlete would get no number for three slots. Separately, §5's jump shrug start of 70% of deadlift TM traces to science §5.2's pull-class optimum "at or above 70% of 1RM", which is a percentage of the power clean or hang power clean 1RM, not the deadlift. For the jump shrug, peak power was highest at 30% of hang power clean 1RM (Suchomel and Sole 2017).
- **Blocked:** Nothing; ruled below.
- **Ruling:** Athlete decision 26 Sep 2026: the first logged session sets each load by speed; the app carries it. Jump shrug and landmine step +2.5 kg after two sessions with no stop-rule cut; explosive DB never steps inside a block. The 70% of deadlift TM start is withdrawn.
- **Spec revision:** engine_spec_v1_6.md (A.24), programme_config_v1_3.json, engine_test_vectors_v1_3.json (`explosive` block)

## Q11 — M2 contrast rounds hard-coded to 3 sets
- **Raised:** 2026-09-26, review before M2
- **Where:** src/engine/barbell.ts band mode / programme_config_v1_2.json M2 `rounds: [3, 4]`
- **Question:** The template gives 3 to 4 rounds but the band prescription always showed 3 sets, and the paired jump items showed no sets.
- **Blocked:** Nothing; ruled below.
- **Ruling:** A block's round range sets `sets` (low end) and `sets_max` (high end) on every item without its own sets, including the primary lift. The athlete chooses within the range.
- **Spec revision:** engine_spec_v1_6.md (A.25), engine_test_vectors_v1_3.json (`rounds` block)
