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

## Q12 — no network calls versus losing the log
- **Raised:** 2026-09-26, athlete, after the app became the programme giver
- **Where:** engine_spec_v1_6.md §12 Form and Export / CLAUDE.md rule 6 / app_build_plan_v1_1.md §3
- **Question:** The log lives only in the phone's browser storage, which can be wiped, and the only copy elsewhere is a manual export the athlete must remember after every session. Can the app back up by itself? Pushing into this repo was considered and rejected: the repo is public (GitHub Pages on the free plan requires that), a token able to write here could also change the app's code, and every push would redeploy the app.
- **Blocked:** Nothing; ruled below.
- **Ruling:** Athlete decision 26 Sep 2026: automatic backup to a separate private repo, `kwthebuilder/kw-conditioning-logs`, with a fine-grained token limited to that repo. Public repos refused. Token kept out of state and exports. Manual export retained.
- **Spec revision:** engine_spec_v1_7.md §12 Backup; CLAUDE.md v1.4 rule 6

## Q13 — does a skipped session break "two in a row"?
- **Raised:** 2026-10-08, interface audit
- **Where:** engine_spec_v1_7.md §3, §4, A.11, A.24
- **Question:** Accessory, tempo and explosive slots step after two consecutive qualifying sessions. The pull-up stepped on 6 Oct counting 21 Sep and 6 Oct as two in a row, with no pull-up logged on 29 Sep. Does a session where the slot was skipped or not logged break the run?
- **Blocked:** Nothing.
- **Ruling:** Athlete decision 9 Oct 2026: no. "Two consecutive sessions" means two consecutive logged sessions of that slot; a skip or an unlogged session neither counts nor resets, the same way light weeks are treated for the barbell downward rule (A.6). The 6 Oct pull-up step stands.
- **Spec revision:** engine_spec_v1_8.md A.26

## Q14 — correcting logged entries
- **Raised:** 2026-10-08, interface audit
- **Where:** engine_spec_v1_7.md A.18, A.23 / app_build_plan_v1_1.md phase 5
- **Question:** The app had no undo and no way to fix a logged entry. A 0-rep Romanian deadlift on 29 Sep (likely meant as "not done") cut the load 55 → 50 kg, and a backdated log could change which day the app opens on. How should corrections work, and how far back?
- **Blocked:** Nothing.
- **Ruling:** Athlete decision 9 Oct 2026: any date can be corrected; every correction stays visible in the log and the export. Engine ruling: entries are never edited in place; a correction is its own entry, and derived numbers are rebuilt by replaying the corrected log from the initial state, with the consequences previewed before saving. Undo within 10 seconds is an interface convenience and leaves no entry.
- **Spec revision:** engine_spec_v1_8.md A.28; ui_spec_v1_0.md §4.3, §7

## Q15 — tissue check-in
- **Raised:** 2026-10-08, interface review
- **Where:** engine_spec_v1_4.md scope cut (§8, §9 out of the app)
- **Question:** The programme judges tendon work on the 24 to 48 hour response, and the app records none of it. Should it, and should anything act on it?
- **Blocked:** Nothing; built in interface release 3.
- **Ruling:** Athlete decision 9 Oct 2026: record only. Above 3/10 the interface shows the athlete's flare protocol text, unchanged. No rule reads the score; the v1.4 scope cut stands.
- **Spec revision:** engine_spec_v1_8.md A.29; ui_spec_v1_0.md §15.4

## Q16 — light-week rep-outs
- **Raised:** 2026-10-08, review of week 4
- **Where:** engine_spec_v1_7.md §2.2 position 1 / programme_design_rationale_v3_2.md P3
- **Question:** In week 4 both lifts were taken well past the prescribed 4 reps on the light week, which is meant to be the low-fatigue week of the wavelet. Should the interface intervene?
- **Blocked:** Nothing.
- **Ruling:** Athlete decision 9 Oct 2026: one line of copy on the light-week card, and one line after logging more than 2 reps above the prescription. Never blocks logging. No rule change.
- **Spec revision:** ui_spec_v1_0.md §14.7 (release 2); the instruction line ships in release 1

## Q17 — what a past date shows
- **Raised:** 2026-10-08, athlete report ("Day 1 showed 3 × 4 on Monday and 3 × 3 today")
- **Where:** engine_spec_v1_7.md §12 / app_build_plan_v1_1.md phase 5
- **Question:** The app computed every date's session from the current state, so a past date showed the next prescription under the old date, and items not logged that day looked like blank forms. What should a past date show?
- **Blocked:** Nothing.
- **Ruling:** A past date is a read-only record: planned against done, skipped, or not logged. The plan is the snapshot saved when the session's first item was logged (new `session_start` entry); sessions logged before v1.8 have their plan rebuilt by replaying the log, labelled as rebuilt. Future dates are a labelled preview.
- **Spec revision:** engine_spec_v1_8.md A.27; ui_spec_v1_0.md §4

## Q18 — dumbbell range in the config
- **Raised:** 2026-10-09, interface build
- **Where:** programme_config_v1_3.json `equipment.db_min_kg` 24, `db_max_kg` 40 / engine_spec_v1_8.md §10
- **Question:** The config and §10 say dumbbells run 24 to 40 kg in 2 kg steps, but Bulgarian split squats were logged at 16 kg per hand. What is the real range?
- **Blocked:** Nothing. The load steppers use 2 kg steps on dumbbell slots with no range limit until answered.
- **Ruling:** Athlete 9 Oct 2026: the rack runs 2 to 40 kg in 2 kg steps. Config v1.4 changes `db_min_kg` from 24 to 2 and nothing else (a test proves every other value matches v1.3). The engine never reads the range, so no load, rule or replayed state changes. Read engine_spec_v1_8.md §10 "24 to 40" and ui_spec_v1_1.md §8.1 and §17.1 as answered by this ruling until their next revisions. Steppers keep 2 kg steps and impose no limit, because every prescribed number stays editable. Test vectors v1.4 still name config v1.3 for the golden sessions; they reproduce identically under v1.4.
- **Spec revision:** programme_config_v1_4.json

## Q19 — tissue check-in in release 2
- **Raised:** 2026-10-09, review before Block 2
- **Where:** ui_spec_v1_0.md §15.4 / engine_spec_v1_8.md A.29
- **Question:** Block 2 (from 9 Nov) adds contrast jumps, jump shrugs, skater bounds and drop landings, and the programme judges tendon work on the 24 to 48 hour response, yet no response has been recorded since week 1. Should the record-only check-in wait for release 3?
- **Blocked:** Nothing.
- **Ruling:** Athlete decision 9 Oct 2026: build it in release 2, before Block 2. Record only, as Q15. Engine A.29 is unchanged; its mention of release 3 is superseded by the interface spec.
- **Spec revision:** ui_spec_v1_1.md §14.9

## Q20 — rest timer target
- **Raised:** 2026-10-09, release 2 design
- **Where:** ui_spec_v1_0.md §14.5 ("vibrates at the end") / programme_config_v1_3.json (no rest periods)
- **Question:** The timer was to vibrate "at the end", but the programme sets no rest periods, and the interface must not invent programming.
- **Blocked:** Nothing.
- **Ruling:** The timer counts up. The athlete may set a target per exercise on the phone (1:30, 2:00, 3:00 or none); the phone vibrates at it. Rest periods remain the programme's to set.
- **Spec revision:** ui_spec_v1_1.md §14.5

## Q21 — unticked earlier sets
- **Raised:** 2026-10-09, release 2 design
- **Where:** ui_spec_v1_0.md §14.2 / engine_spec_v1_8.md §2.6
- **Question:** v1.0 let an unticked earlier set stand for "fell short". A forgotten tick would then log a failure signal and cut the training max 2.5%.
- **Blocked:** Nothing.
- **Ruling:** An unticked earlier set asks ("Was every earlier set done as prescribed?") and records "fell short" only on the athlete's answer.
- **Spec revision:** ui_spec_v1_1.md §14.2
