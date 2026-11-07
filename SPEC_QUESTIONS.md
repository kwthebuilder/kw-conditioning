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

## Q22 — release 1.1 was specified to ship before release 2, which had already shipped
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md v1.2 change note, §10, §13A ("ships before release 2") / app_build_plan_v1_3.md phase 8
- **Question:** Release 2 was merged and deployed on 9 Oct (pull request 4), before release 1.1 was specified. The patch cannot ship before it. How should the two be ordered?
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: release 1.1 is placed between releases 1 and 2 in the build plan, noting that release 2's code shipped first, and is built on top of it. Release 2 shows as "merged 9 Oct, acceptance open"; the athlete judges its gate (a full Day 1 logged in under a minute of entry) on the next Day 1.
- **Spec revision:** app_build_plan_v1_4.md

## Q23 — Finish: release 2's not-logged step against §10's two buttons
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md §10, §14.6
- **Question:** Release 2's finish summary already opened with a not-logged step with three buttons (Log them, Skip them and finish, Finish without them). §10 and §14.6 give two: Log them and Skip the rest.
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: release 2's summary stays; its first step takes §10's words and each item's plan, with two buttons, Log them and Skip the rest. "Finish without them" is dropped. Close it (§9) opens the same step. Built with it: Finish with nothing left to record logs the end at once (release 2 showed the summary without logging the end), and the save-a-copy panel opens by itself when the automatic backup is off or failing (§14.6).
- **Spec revision:** none

## Q24 — Carry on writes entries dated D after entries dated D + 1
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md §13A "Before building" / engine_spec_v1_8.md A.28
- **Question:** If the replay assumes entries arrive in date order, Carry on would need to write A.28 inserts, or other logging would be held while an earlier session is open.
- **Blocked:** Nothing.
- **Ruling:** Neither fix is needed. A.28 replays original entries in the order they were logged; only inserted entries are placed by date. No rule compares an entry's date with the one before it. Carry on logs through update() as usual. Proved in tests/release11.model.test.ts (a max set by hand on D + 1, then more of D's session: replay matches, a correction saves, removing the session keeps the max).
- **Spec revision:** none

## Q25 — release 1's "7 of 10 logged, 2 skipped"
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md §13A test 2
- **Question:** Were the skips inside the 7?
- **Blocked:** Nothing.
- **Ruling:** No. Release 1 counted as "logged" only items done; "7 of 10 logged, 2 skipped" meant 7 done, 2 skipped, 1 not recorded. Release 1.1 writes "7 done · 2 skipped · 1 not recorded".
- **Spec revision:** none

## Q26 — the 21 Sep golden session under config v1.5
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** engine_test_vectors_v1_4.json `golden_sessions` / training_log_2026_w01_w02_r4.md item 3 / ui_spec_v1_3.md §13A test 19
- **Question:** The golden case says 21 Sep's Day 1 shows the ladder, as the golden log does. With the ladder schedule emptied it no longer would.
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: the golden case stays pinned to the config in force on 21 Sep (v1.3); tests/golden.test.ts loads that config. Only the day-by-day ladder cases change, as test 19 says.
- **Spec revision:** engine_test_vectors_v1_5.json

## Q27 — the 21 Sep record after the ladder leaves
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md §4.2, §5.5 / engine_spec_v1_8.md A.27
- **Question:** Sessions before 9 Oct have no saved plan, so their plan is rebuilt from the current config. Under config v1.5, 21 Sep's rebuilt plan shows a drop jump as not recorded, and the ladder entry actually logged (6 jumps from the 51 cm box) falls under "Also logged".
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: on a record whose plan is rebuilt, when the plan has a drop jump and no ladder, a logged ladder entry counts as that day's drop jump, tagged "Logged on the ladder item". Screen only; the log and the engine are untouched; records with a saved plan are unaffected.
- **Spec revision:** none

## Q28 — which sessions are "from before release 1.1"
- **Raised:** 2026-10-10, release 1.1 build
- **Where:** ui_spec_v1_3.md §9, §13A test 13
- **Question:** Nothing in the log records which app version logged a session.
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: sessions dated before 11 Oct 2026 are never treated as open on the day after, so they never produce the unfinished-session card. A session dated today is the live one whatever its date.
- **Spec revision:** none

## Q29 — "Depth jump" in ui_spec_v1_3.md
- **Raised:** 2026-10-10, release 1.1 build
- **Where:** ui_spec_v1_3.md §5.5, §13A test 19
- **Question:** The spec writes "Depth jump · 6 jumps · 51 cm box"; the app has called the item "Drop jump" since release 1.
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: keep "Drop jump" everywhere. Where ui_spec_v1_3.md says "Depth jump", read "Drop jump": the item reads "Drop jump · 6 jumps · 51 cm box".
- **Spec revision:** none

## Q30 — which loads the dumbbell range holds
- **Raised:** 2026-10-10, release 1.1 build
- **Where:** ui_spec_v1_3.md §5.1 / programme_config_v1_5.json `db_min_kg`, `db_max_kg`
- **Question:** Which slots are "dumbbell slots"? The chest-supported row increments by "one plate or 2 kg/hand".
- **Blocked:** Nothing.
- **Ruling:** Athlete 10 Oct 2026: 2 to 40 kg on both dumbbell push presses and the Bulgarian split squat; not the chest-supported row, which keeps 2 kg steps with no range. Supersedes Q18's "impose no limit" for those three slots.
- **Spec revision:** none

## Q31 — the plan for an added session on a date that already has one
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md §11A step 5 / engine_spec_v1_8.md A.27, A.28
- **Question:** §11A builds the plan by replaying "up to that date". A.28 places an added separate session after that date's existing entries, so the replay would compute its numbers from a later state than the one shown.
- **Blocked:** Nothing.
- **Ruling:** The plan (and the pre-selected day) come from the log up to where the new entries will land: replay stopping before the first entry dated later. On a date with no session the two readings are the same.
- **Spec revision:** none

## Q32 — the stored drop-jump height
- **Raised:** 2026-10-10, release 1.1 pre-build check
- **Where:** ui_spec_v1_3.md §13A "Config v1.5 and test vectors" / engine_spec_v1_8.md A.21, A.23
- **Question:** Is the stored height already 51 cm? The repo holds no training data, so it cannot be checked from here. The app on the phone on 21 Sep stored whatever was typed on the ladder item as the height.
- **Blocked:** Nothing.
- **Ruling:** The app checks on start: if the stored height is not 51 cm it logs one depth-jump height entry of 51 cm (A.23), which the export shows; otherwise it logs nothing.
- **Spec revision:** none

## Q33 — programme 1.6: the content of every session from 19 Oct 2026
- **Raised:** 2026-10-19, programme 1.6 release (programme owner's brief)
- **Where:** programme_config_v1_5.json `templates`, `slots`, `budget_min` / programme_design_rationale_v3_3.md (kept in the project, not in this repo)
- **Question:** What does each block's Day 1 and Day 2 now hold, in what order, with which new slots, and what leaves the programme?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026. New templates for Block 1 (to 8 Nov), Block 2 (9 Nov to 20 Dec), Blocks 3 and 4 (21 Dec to 28 Feb) and the taper (1 to 7 Mar), exactly as the brief lists them: explosive work first, then the main lift, then the rest. Block dates unchanged. Target minutes: Block 1 Day 1 70, Day 2 63; Block 2 72 and 68; Blocks 3 and 4 64 and 66; taper 40; the session ceiling (`budget_min`) is 80 minutes, normal and test-single days alike. No block alternates a heavy set with a jump ("contrast" rounds are gone); Block 2's main lifts are plain doubles, 3 to 4 sets, with no pull-ups inside the rests. Two new slots: `db_rdl`, a dumbbell Romanian deadlift with a 3-second lowering (class B, 2 kg per hand steps, load set by the first logged session, rep target 8 in Block 1 and 6 from Block 2), and `seated_abduction`, a seated hip abduction machine with a 3-second lowering (the cable abductor's rule; its load does not carry over because the machine is a different implement). Nine slots leave every template but stay defined so older logs replay and export: Nordic curl, hip abduction hold, Y-raise, Pallof press, hack squat (now only a swap target), drop landing, barbell Romanian deadlift, cable hip abduction, drop-jump ladder. The split squat's on-screen name gains "3 s lowering"; its rule is unchanged. New on-screen words (warm-up, jump test, light week, running-long note, four item cues) as the brief gives them.
- **Spec revision:** programme_config_v1_6.json; engine_spec_v1_9.md §3, A.38, A.39; ui_spec_v1_4.md §18

## Q34 — who may write spec files for this release
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** CLAUDE.md v1.7 rule 1 ("/spec is read-only")
- **Question:** The release needs new versions of the engine spec, interface spec, config, test vectors and build plan. CLAUDE.md forbids the builder to edit /spec.
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026 (programme owner): for this release only, the builder writes new versioned files beside the old ones and never edits or deletes an existing spec file. Every implementation choice the builder makes is recorded here (Q35 to Q47) for the coordinating chat and the athlete to review before merge.
- **Spec revision:** CLAUDE.md v1.8; app_build_plan_v1_5.md v1.5 note

## Q35 — swaps: what moves, and how a swapped main lift turns the rotation
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md A.22 (day selection reads each lift's `last_logged`), A.26 (skip)
- **Question:** A swap must move nothing, as a skip does, yet a swapped front squat or deadlift must count as that day's main lift so the Day 1 / Day 2 rotation still advances. A.22 reads `last_logged`, which a swap must not change. And should a swap count as the lift's first session in a new block?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: a swap is logged as `{ kind: "swap", slot, date, to, load?, sets_done?, last_set?, note? }` and moves nothing, with the one day-selection exception. Builder, 19 Oct 2026, under the programme owner's brief: a swap on a main lift writes its date into a new state field, `swapped_main` (one date per lift, absent when none), and A.22 reads the later of that date and `last_logged`. Nothing else reads it, so the lift keeps its training max, week type, load, block and session count. A swap does not count as entering a new block, so on a block's first day a swapped main lift leaves the test single, the set caps (Q38) and the phase-start test (Q39) due again next time that lift comes up. The engine accepts any non-empty `to` text (the interface offers only the config's list), so a correction can never be refused over it. Corrections replace, remove or insert swaps like any other entry; the replay rebuilds `swapped_main`. A state from before this version has no `swapped_main`, which means no lift swapped, so it imports unchanged.
- **Spec revision:** engine_spec_v1_9.md A.32; engine_test_vectors_v1_6.json `swap`

## Q36 — the template's rep target on a streak slot
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md §3, §4 / programme_config_v1_6.json `db_rdl`
- **Question:** The dumbbell Romanian deadlift is 8 reps in Block 1 and 6 from Block 2, but a slot has one `reps`. How does the streak rule follow the template, and does a replay of an old log depend on which template is in force?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: when a template item gives `reps` for a class B or C slot, the rule uses it: up at item reps + (slot up_at − slot reps), down below item reps; slots without item reps behave as before. Builder, 19 Oct 2026, under the programme owner's brief: the prescription carries the number as `target_reps` and the log echoes it, and `update` takes the rule from the log, so a replay never consults a template. A log without `target_reps` (every log made before this version) uses the slot's own rule, unchanged. In config v1.6 only `db_rdl` items give reps; the other class B and C items (split squat, abduction, presses, pull-up, row) deliberately give none, so their logs and rules are exactly as before. `db_rdl`'s own values (reps 8, up at 10, down below 8) apply only to a log made without a target.
- **Spec revision:** engine_spec_v1_9.md A.33; engine_test_vectors_v1_6.json `rep_override`

## Q37 — first-session loads on the new slots
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md A.11
- **Question:** Do `db_rdl` and `seated_abduction` start from a load, or from the barbell Romanian deadlift and cable abductor they replace?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: the first logged session sets each load (A.11, unchanged). Neither carries a load over: the dumbbell lift is loaded per hand and the machine is a different implement. On screen, `db_rdl` is a dumbbell item (2 to 40 kg in 2 kg steps, "kg per hand"); `seated_abduction` steps 2.5 kg and shows "go up one stack plate" when a step is owed.
- **Spec revision:** engine_spec_v1_9.md §3; engine_test_vectors_v1_6.json `first_load`

## Q38 — set caps on the test-single day: which session
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md A.8, A.15 / programme_config_v1_6.json `audit_trims`
- **Question:** "On any session that opens with a boundary single" the Day 1 dumbbell Romanian deadlift, the Day 2 split squat and every item in the day's last upper block drop to 2 sets. The single is a suggestion that can be skipped, and the plan is fixed when the session's first item is logged, before the single. Which session is it, and how does the rest of that day read once the lift is logged?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: the caps, the slots and 2 sets. Builder, 19 Oct 2026, under the programme owner's brief: it is the session on which that day's main lift enters Block 2, 3 or 4 (the session that is offered the boundary single), whether the single is taken or skipped. To keep that day reading the same after the lift is logged, each lift now records `entered_on`, the date of its first log in its current block; only logs dated after Block 1 write it, so no existing state or log changes. The taper has no boundary single and is not capped; a big-gap single (Block 1 only) does not cap. "The last upper block" is marked in the config (`upper: true`). Each capped item keeps the sets it was cut from, and the screen says "test-single day: 3 sets cut to 2". No load, rep, rule or order changes. In Blocks 3 and 4 Day 1 the last block with upper-body work is the Romanian deadlift and pull-up superset, so the pull-up drops to 2 and the Romanian deadlift is already 2.
- **Spec revision:** engine_spec_v1_9.md A.34; engine_test_vectors_v1_6.json `audit_trims`

## Q39 — the phase-start test: where, when, and what it logs
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** programme_config_v1_6.json `phase_tests`, slot `phase_test`
- **Question:** Where exactly does the test sit, what counts as "the first Day 1 session" of a block, and how is it logged?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: on the first Day 1 of Blocks 2, 3, 4 and the taper, a record-only item at the start of the explosive block asks for the best reactive strength index (two decimals) and the best trap-bar jump height in centimetres; skippable like every item; in the export. Builder, 19 Oct 2026, under the programme owner's brief: "the first Day 1" is the Day 1 on which the front squat enters the block (the same test as Q38), so it stays on offer until the front squat is logged in the block, and once the front squat is logged it stays on that day's plan only. It sits immediately before the drop jump. A new config slot, `phase_test` (class F, never in a template), carries the text; the log is `{ kind: "phase_test", date, rsi?, trap_bar_cm?, note? }`; a skip uses slot `phase_test`. The screen needs at least one number to log it; otherwise Skip.
- **Spec revision:** engine_spec_v1_9.md A.35; ui_spec_v1_4.md §19; engine_test_vectors_v1_6.json `phase_tests`, `record_only`

## Q40 — the tendon question at the start of every session
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md A.29 / ui_spec_v1_3.md §14.9 (the morning-after card)
- **Question:** The brief changes "only the prompt": the question is asked at the start of every session, with No as one tap. Does the morning-after card stay as well?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: record only; asked at the start of every session, Day 1 and Day 2: "Any tendon pain above 3/10 in the last 48 hours?"; No is one tap; site and score only after Yes; never blocks logging. Builder, 19 Oct 2026, under the programme owner's brief: the new question replaces the morning-after card (asking both would be the same question twice in 48 hours). No logs a check-in with `above_3: false` and no scores; Yes logs the three scores with `above_3: true`; both are dated and tagged with the session's date, and the question is not asked again for that date. The flare protocol still shows on a day any score is above 3. Check-ins logged before keep their wording. The phone-screen check for numeric dates now sets aside pain scores written "N/10".
- **Spec revision:** engine_spec_v1_9.md A.29, A.36; ui_spec_v1_4.md §20

## Q41 — which template a past date is planned from
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md A.27 (a plan rebuilt by replay for sessions with no saved plan) / ui_spec_v1_3.md §11A (Add a missed session)
- **Question:** "The new Block 1 templates apply from merge." Sessions logged before 9 Oct have no saved plan; their record is rebuilt from the current templates. Under the new templates the 6 Oct record would show a dumbbell Romanian deadlift that was never planned, and an added missed session for an October date would show the new sessions.
- **Blocked:** Nothing.
- **Ruling:** Builder, 19 Oct 2026, under the programme owner's brief (the conservative choice: every existing record reads exactly as before). Config v1.6 carries `templates_before`: the v1.5 Block 1 templates, unchanged, used for any date before 19 Oct 2026. A session with a saved plan always shows its saved plan. The cut-over date is the approval date, 19 Oct, because the merge date is not known when the config is written. If the merge is later, sessions logged in between keep their saved plans; only a missed session added for those few days would be planned from the new templates. Changing the date is a one-value config change.
- **Spec revision:** engine_spec_v1_9.md A.37; programme_config_v1_6.json `templates_before`; engine_test_vectors_v1_6.json `templates` (last case)

## Q42 — retired slots, contrast blocks and the drop-landing note
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_spec_v1_8.md A.21, A.25 / ui_spec_v1_3.md §14.8, §17 (note on Block 2's drop landings)
- **Question:** What happens to the retired slots' rules, the contrast grid and the round ranges, and to the open note that Block 2's drop landings needed adapting for the single 51 cm box?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: remove contrast everywhere; the nine slots leave every template. Builder, 19 Oct 2026, under the programme owner's brief: the slots and their rules stay in config v1.6 unchanged so older logs replay, export and can be corrected. A.21 and A.25 are unchanged; v1.6 has no ladder weeks and no contrast block, and uses a round range only to give Block 2's main lifts 3 to 4 plain sets, the fourth shown as optional. The contrast grid code stays for a config that asks for it. The §17 drop-landing note is closed: drop landings leave the programme.
- **Spec revision:** engine_spec_v1_9.md A.38; ui_spec_v1_4.md §21

## Q43 — the light-week line on a two-set light day
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** ui_spec_v1_3.md §14.7 / engine_spec_v1_8.md 2.7 (after two negative steps the light week is 2 sets)
- **Question:** The approved line reads "Light week: 3 sets of 4 at this load. Stop at 4, even if you have more." On the forced light day after two consecutive downward steps the prescription is 2 sets, so the line would contradict the card.
- **Blocked:** Nothing.
- **Ruling:** Builder, 19 Oct 2026, under the programme owner's brief: the config holds the line with the numbers as placeholders and the screen fills in the day's sets and reps, so every normal light week reads exactly as approved and a forced light day reads "2 sets of 4". It never blocks logging, and the extra line after more than 2 extra reps stays.
- **Spec revision:** programme_config_v1_6.json `text.light_week`; engine_spec_v1_9.md A.39; ui_spec_v1_4.md §18.6

## Q44 — on-screen words, target minutes and the 80-minute ceiling
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** programme_config_v1_5.json `budget_min` (never read by the app) / ui_spec_v1_3.md §4.4 ("about 72 min")
- **Question:** Where do the new words live, and how is "about N min, 80 max" built?
- **Blocked:** Nothing.
- **Ruling:** Athlete 19 Oct 2026: the words as the brief gives them. Builder, 19 Oct 2026, under the programme owner's brief: config v1.6 carries them as display text the engine never reads (`text`, each slot's `cue` and `swaps`, a template item's `note`). The next-session heading reads "Day 1 · about 70 min, 80 max", the 80 from `budget_min`; while a session is live the same words sit at its top; a record keeps "about N min" from its saved plan. The running-long note is display only and shows on every session.
- **Spec revision:** programme_config_v1_6.json; engine_spec_v1_9.md A.39; ui_spec_v1_4.md §18

## Q45 — which tests and vectors stay pinned to older configs
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** engine_test_vectors_v1_5.json `session.ladder`, `rounds` / tests/session.test.ts, tests/plan.block2.test.ts, e2e/release2.e2e.ts, e2e/release11.e2e.ts
- **Question:** Several existing tests and vector cases describe the v1.5 templates (Block 2 drop landings, the contrast block, round ranges on the trap-bar jump and jump shrug, the Block 3 barbell Romanian deadlift). Under config v1.6 they no longer hold.
- **Blocked:** Nothing.
- **Ruling:** Builder, 19 Oct 2026, under the programme owner's brief: as with the golden sessions (Q26), these stay pinned to the config they describe. Vectors v1.6 keep every v1.5 block unchanged and name the config each template-dependent block is read against (`pinned`: golden sessions v1.3; `session.ladder` and `rounds` v1.5; everything else v1.6). The unit tests for those blocks load config v1.5 and pass unchanged. Three phone-screen tests described screens that no longer exist and were replaced: the Block 2 contrast grid (now Block 2 plain doubles, 3 ticked plus the last logs 4 sets), the morning-after check-in (now the flare protocol from a session-start answer), and test 15's drop-landing dose (now checks drop landings are gone and the skater bound reads 2 × 4 each side).
- **Spec revision:** engine_test_vectors_v1_6.json `pinned`

## Q46 — the Block 2 drop-jump note: 8 or 9 jumps
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** programme_config_v1_5.json `slots.depth_jump.note` ("the design intent for late M2 is 8") / the brief ("keep the existing note that the athlete may take up to 9 by judgement") / engine_spec_v1_8.md §6 ("6 to 9" in Block 2)
- **Question:** The existing config note names 8 as the design intent for late Block 2; the brief asks to keep a note saying up to 9. Which is the programme's?
- **Blocked:** Nothing. Built as the brief says.
- **Ruling:** Builder, 19 Oct 2026, under the programme owner's brief: the Block 2 Day 1 drop jump shows "You may take up to 9 jumps by judgement." (the brief's words, and §6's top of range); the slot's own descriptive note, which the screen never shows, is left unchanged. The prescription stays 6 jumps. For the coordinating chat to confirm with the rationale v3.3: if the late-Block 2 intent is 8, the shown line needs one word changed.
- **Spec revision:** programme_config_v1_6.json `templates.M2.day1`

## Q47 — "Swapped to…" on items with no alternatives
- **Raised:** 2026-10-19, programme 1.6 release
- **Where:** brief "every item gets a 'Swapped to…' action next to Skip, listing that slot's swaps" / programme_config_v1_6.json `swaps` (11 slots)
- **Question:** Seven items in the new templates have no approved alternative (the jump test, the kettlebell swing, the skater bound, the explosive dumbbell push press, the dumbbell push press, the seated abduction, the chest-supported row), plus the deadlift and the phase-start test. Should they show an empty "Swapped to…"?
- **Blocked:** Nothing.
- **Ruling:** Builder, 19 Oct 2026, under the programme owner's brief: the button shows only on items whose slot has a `swaps` list, because an empty list has nothing to pick. Adding an alternative later is a config change only (one more `swaps` entry); no code changes. Skip stays on every item.
- **Spec revision:** ui_spec_v1_4.md §18.1

## Q48 — release 3.1: who writes the spec files
- **Raised:** 2026-11-07, release 3.1
- **Where:** CLAUDE.md rule 1 ("/spec is read-only")
- **Question:** Release 3.1 needs new spec versions. Who may write them?
- **Blocked:** Nothing.
- **Ruling:** Athlete 7 Nov 2026: approved the changes and asked the coordinating chat to push them. New versioned files sit beside the old ones (`programme_config_v1_7.json`, `engine_spec_v1_10.md`, `ui_spec_v1_5.md`, `engine_test_vectors_v1_7.json`, `app_build_plan_v1_6.md`); no existing spec file is edited. CLAUDE.md itself is left for the athlete to update to name the new files.
- **Spec revision:** the files above

## Q49 — accessory loads that never step when sets stop at the target
- **Raised:** 2026-11-07, programme and app review
- **Where:** engine_spec_v1_9.md §3, §4, A.33 / src/engine/accessory.ts
- **Question:** From 24 Sep to 6 Nov the row, split squat, hack squat, landmine press and cable abduction never moved: 18 of 19 last sets ended exactly at the target, and the rule only counts reps past it. The design accepts sets stopped 2 to 4 short of failure (rationale v3.3 P3).
- **Blocked:** Nothing.
- **Ruling:** Athlete 7 Nov 2026: a last set at or above the target and below `up_at`, with 4 or more reps in reserve, counts towards a step up, for logs dated on or after 7 Nov 2026 (config `rir_step`), so older logs replay unchanged.
- **Spec revision:** engine_spec_v1_10.md A.40; programme_config_v1_7.json `rir_step`; engine_test_vectors_v1_7.json `rir_step`

## Q50 — the jump shrug start of "about 70% of your max" came back
- **Raised:** 2026-11-07, programme and app review
- **Where:** programme_config_v1_6.json `slots.jump_shrug.cue` / Q10 (withdrawn 26 Sep)
- **Question:** Q10 withdrew the 70%-of-deadlift start; the v1.6 cue reintroduced it beside the speed rule on the same card.
- **Blocked:** Nothing.
- **Ruling:** Athlete 7 Nov 2026: load by speed; the cue no longer gives a percentage.
- **Spec revision:** programme_config_v1_7.json

## Q51 — the seated abduction has no swap; the taper has no jump test
- **Raised:** 2026-11-07, programme and app review
- **Where:** programme_config_v1_6.json `slots.seated_abduction`, `templates.TAPER` / rationale v3.3 §6
- **Ruling:** Athlete 7 Nov 2026: swap "Standing cable hip abduction, 3 s lowering"; taper `pre: ["cmj"]` on Day 1 only (`pre_days`, engine A.41); vectors v1.7 update the taper Day 1 template case.
- **Spec revision:** programme_config_v1_7.json; engine_spec_v1_10.md A.41; engine_test_vectors_v1_7.json

## Q52 — session length: the clock is not the session
- **Raised:** 2026-11-07, programme and app review
- **Where:** `session_end.minutes`
- **Ruling:** Athlete 7 Nov 2026: the finish sheet asks the length, door to door, and logs `session_length` (record only, engine A.42, interface §24). The clock stays in `session_end.minutes`.
- **Spec revision:** engine_spec_v1_10.md A.42; ui_spec_v1_5.md §24

## Q53 — the Plan card, the backup log and the footer
- **Raised:** 2026-11-07, programme and app review
- **Ruling:** Athlete 7 Nov 2026: Plan card per interface §23; the exported log reads as corrected (§25), Corrections list and JSON block unchanged; app version 3.1.0.
- **Spec revision:** ui_spec_v1_5.md §23, §25, §26; engine_spec_v1_10.md §12
