# Engine Specification v1.11

**Version 1.11 | 12 November 2026 | Supersedes `engine_spec_v1_10.md`**

**v1.11 change note: release 3.4, heavy doubles and the effort rule.** Approved by the athlete on 10 and 12 Nov 2026 after the strength periodisation review (`claude/strength_periodisation_review_v2.md` in the project), written up in design rationale v3.7 (also in the project); added as a new file beside v1.10 under the precedent of v1.9 and v1.10, no existing file edited (SPEC_QUESTIONS Q58 to Q62). Companions: `programme_config_v1_10.json` and `engine_test_vectors_v1_10.json` (`pinned.default` is config v1.10). In plain words:
1. **Heavy doubles in Blocks 2, 3, 4 and the taper (A.43).** 3 doubles in Block 2, 2 in Blocks 3 and 4, 1 in the taper, at 87% of the estimated max (the TM ÷ 0.90, so 0.967 of the TM). The earlier doubles stop 2 to 3 reps short of technical failure; the last may go to 1 short, never to 0. The last double moves the TM by the Block 1 matched rule (2.5, 2.5a) without a scale factor, until week 22; after it no upward step (A.10). A failure is 0 left on a prescribed double, a short double, or a missed one. This replaces 2.9 for logs made under config v1.10; logs in the old modes (`band_87_90`, `primer_2x2_90`, `single_1x2_90`) replay by their own rules, unchanged.
2. **A test single is read by its reps left (A.44).** 0 to 3 left; the estimated max is the single ÷ 1.00, 0.955, 0.93 or 0.892. At 2 left this is 2.1 and 2.8 to the last bit, so every older log replays.
3. **Words and display only (A.45).** The interface shows the estimated max (TM ÷ 0.90) as the headline number; the engine still keeps the TM. Class B and C slots carry `rir_cap` 0, read only by explanation notes and the interface.

Everything else in v1.10 stands. Every log in the athlete's backup of 12 Nov 2026 replays to the same state under v1.11 (checked before release; the log itself is not in this repo).

**v1.10 change note: release 3.1.** Approved by the athlete on 7 Nov 2026 after the programme and app review (`claude/programme_app_review_v1.md` in the project); written by the coordinating chat as programme owner, as for v1.9 (SPEC_QUESTIONS Q48 to Q53). Three engine rulings, Appendix A items 40 to 42, and config v1.7. (1) A.40: on class B and C streak slots, a last set that reaches the rep target with 4 or more reps in reserve counts towards a step up, from 7 Nov 2026; every older log replays to the same numbers. (2) A.41: a both_days template may restrict its pre-session items to some days (`pre_days`); the taper's jump test runs on Day 1 only. (3) A.42: `session_length`, the athlete's own figure for a session, door to door, record only. Config v1.7 also loads the jump shrug by speed rather than "about 70% of max" (the start withdrawn in v1.6, A.24, had come back in the v1.6 cue) and gives the seated abduction an approved swap. Everything else in v1.9 stands; read `programme_config_v1_6.json` and `engine_test_vectors_v1_6.json` below as their v1.7 versions.

**v1.9 header, kept:** Version 1.9 | 19 October 2026 | Supersedes `engine_spec_v1_8.md`
**Status:** programme content approved by the athlete on 19 Oct 2026; implementation rulings taken by the builder under the programme owner's brief of the same day (SPEC_QUESTIONS Q33 to Q47). This is the build specification. Companions, which win over prose on any numeric conflict: `engine_test_vectors_v1_6.json`, `programme_config_v1_6.json`, `initial_state_v1_1.json`. Golden session: `training_log_2026_w01_w02_r4.md` (read with `programme_config_v1_3.json`, the config in force on 21 Sep). Programme structure is governed by `programme_design_rationale_v3_3.md`, which is kept in the project, not in this repo. The interface is governed by `ui_spec_v1_4.md`.

**v1.9 change note: programme 1.6.** No change to any existing progression rule, threshold or number; every log made before this version replays to the same training maxes, scale factors, wave positions, loads and streaks (proved in `tests/release3.compat.test.ts`). What changes is what is prescribed and what can be logged. In plain words:
1. **New templates for every block** (config v1.6). Explosive work first, then the main lift, then the rest. Nine slots leave every template but stay defined, so older logs still replay and export: the Nordic curl, the hip abduction hold, the Y-raise, the Pallof press, the hack squat (now only something the split squat can be swapped to), the drop landing, the barbell Romanian deadlift, the cable hip abduction and the drop-jump ladder. No block alternates a heavy set with a jump any more ("contrast" rounds are gone); Block 2's main lifts are plain doubles, 3 to 4 sets (A.25 still sets the range). Sessions dated before 19 Oct 2026 keep the Block 1 template they were shown (A.37).
2. **Two new slots.** A dumbbell Romanian deadlift with a 3-second lowering and a seated hip abduction machine, both class B, both loaded by the first logged session (§3, A.11).
3. **Swaps** (A.32). Each item may be logged as "swapped to" one of a short list of alternatives. A swap moves nothing, exactly like a skip, except that a swapped main lift still turns the Day 1 / Day 2 rotation.
4. **A rep target from the template** (A.33). The dumbbell Romanian deadlift is 8 reps in Block 1 and 6 from Block 2; the streak rule follows the template's number.
5. **Audit-day trims** (A.34). On the session that opens a block with a boundary test single (the one heavy rep that resets the training max on entering Blocks 2, 3 and 4), three named things drop to 2 sets.
6. **A phase-start test** (A.35), record only, on the first Day 1 of Blocks 2, 3, 4 and the taper.
7. **The tendon check-in is asked at the start of every session** (A.36), still record only.
8. **Words shown on screen come from the config** (A.39): the warm-up line, the jump-test line, the light-week line, the running-long note and each item's cue. No rule reads them.

**v1.8 change note: the record, skips and corrections.** No change to any progression rule, threshold or number. Found in the 8 October audit of the app against the athlete's log: the app could not show what was done on a past date, had no way to record "not done" except by typing numbers (a 0-rep entry on 29 Sep cut the Romanian deadlift by 5 kg), and no way to fix a logged entry. Six rulings, Appendix A items 26 to 31; SPEC_QUESTIONS Q13 to Q18. (1) A skip is a log entry that moves nothing, and a skipped or unlogged session neither counts towards nor breaks a "two in a row" streak (A.26, Q13). (2) The first item logged in a session records a snapshot of the plan as shown, so a past session can be shown as planned against done; older sessions are reconstructed by replay (A.27, Q17). (3) Logged entries are never edited in place. A correction is its own entry, and every derived number is rebuilt by replaying the corrected log through `update` from the initial state, with the consequences shown before saving (A.28, Q14). (4) A record-only tissue check-in is defined now and built in interface release 3 (A.29, Q15). (5) The Romanian deadlift explanation names the band the reps fall in (A.30). (6) A log carries the session's date, not the clock's (A.31).

**v1.7 change note: automatic backup to GitHub.** No change to any progression rule. §12 now allows one network destination: the athlete's own private GitHub repo, written through the GitHub contents API with a fine-grained token the athlete pastes on the phone. Reason: the app is already the programme giver and device storage can be lost without warning (§12 Import), so relying on a manual export after every session left the log one forgotten tap from loss. Rules are in §12 Backup. SPEC_QUESTIONS Q12.

**v1.6 change note: M2 explosive loads and contrast rounds.** Found in review before M2 (9 Nov) governs. (1) The jump shrug, landmine clean and push press, and explosive DB push press showed no load at all under the v1.4 scope cut. They now carry a load (A.24). (2) The jump shrug's starting load of 70% of deadlift TM is withdrawn. It came from the pull-class optimum "at or above 70% of 1RM" in science §5.2, but that figure is a percentage of the power clean or hang power clean 1RM, not the deadlift (Soriano et al. 2015). For the jump shrug itself, peak power was highest at 30% of hang power clean 1RM, the lightest load tested (Suchomel and Sole 2017, 30/45/65/80%). 70% of the current deadlift TM is about 100 kg, which is likely near or above this athlete's hang power clean max. With no clean max on record, the first session sets the load by speed. (3) Contrast blocks with a round range (M2, 3 to 4) now prescribe that range on every item instead of a hard-coded 3 sets (A.25). No other rule changes.

**v1.5 change note: phase 3 rulings.** No change to any progression rule. Appendix A items 20 to 23 added: ramp sets use the one barbell rounding rule (the r3 log's 40 kg was a hand error, corrected in r4); the RSI ladder schedule is data in config v1.2; Day 1 or Day 2 is chosen by which primary lift was logged last, never by weekday; every state change goes through `update`. §12 file names corrected.

**v1.4 change note: scope cut at the athlete's direction.** The app is a straightforward programme giver. It shows the session for the date, computes loads from logged sets, and lets the athlete edit anything. Judgement (tissue, fatigue, time, gaps) belongs to the athlete, with the project chat on call.

| In the app | Not in the app (sections kept below as coaching reference only) |
|---|---|
| §2 barbell engine, as built in phase 1, with the rulings in A.14 to A.17 | §5 trap-bar jump height progression |
| §3 RDL table; hack squat and abductor streak rule | §6 ladder logic, contact caps, halving |
| §4 accessory double progression | §7 Nordic auto-progression |
| §10 rounding | §8 every flag: CMJ, tissue, catch, time, gaps |
| Week-22 freeze on upward steps | §9 flare ladder |
| Manual override of any load and of each TM (A.18) | L8 site freezes on upward steps |
| Boundary and big-gap singles as skippable suggestions | |
| CMJ value stored, running mean shown, no rule | |
| Export after every session; exact import | |
| Explosive slot loads: jump shrug, landmine clean and push press, explosive DB push press (A.24) | |
| Contrast round ranges (A.25) | |
| Skip with a reason on every item (A.26) | |
| Record of past sessions: plan snapshot, or reconstruction by replay (A.27) | |
| Corrections by replay, previewed before saving (A.28) | |
| Tissue check-in, record only, interface release 3 (A.29) | |
| v1.9: swaps (A.32), template rep target (A.33), audit-day trims (A.34), phase-start test (A.35), tendon question at session start (A.36), earlier templates for earlier dates (A.37), retired slots kept for replay (A.38), on-screen words from the config (A.39) | v1.9: any rule that reads a swap's numbers, the phase-start test or the tendon answer |

Classes D, E and F are fixed prescriptions read from the config and logged as done / not done with an optional number, except the three explosive slots in A.24.

**v1.3 change note.** No change to progression logic. (1) Equipment and instruments fixed: trap bar 24 kg (athlete-reported, to be confirmed), so the trap-bar jump runs at the empty bar; RSI and CMJ from My Jump Lab. (2) CMJ baseline restarts at week 2 (week 1 value lost); flag rule written exactly. (3) Delivery changed from a Claude artifact to a standalone app built in Claude Code; §12 rewritten. (4) Appendix A added: implementation rulings that remove every ambiguity the prose left, so the builder never has to interpret. Structure (order, selection, mesocycles, taper) stays with `programme_design_rationale_v3_1.md`. The engine moves numbers inside that structure and nothing else.

**v1.2 change note (athlete-approved, 19 Sep).** (1) RIR is anchored to technical failure, defined per lift in §2.0; the anchor never changes. (2) The AMRAP at wave position 1 is removed: position 1 is straight sets, makes no TM update, and is the low-fatigue week of each wavelet. Reasons: rep variance is widest at the lightest load (§3.1), RIR is least accurate far from failure and on long sets (§3.2, SOLID), and a ~10-rep set breaches Design P3 on velocity loss (§5.5). (3) Big-gap rule: when a top set disagrees with the TM by 7% or more, the step widens to 5% undamped and a ramp single is scheduled for the next session on that lift. The threshold was floated at 7.5% in conversation; it is set at 7% so that a three-rep surplus at position 2 trips it, as the worked example given to the athlete assumed. (4) The v1.1 decisions (calibration and matched update, M3/M4 primer at 90% of TM, gain 0.5) are accepted and stand.

**v1.1 change note.** (1) Loading principles L1 to L10 stated up front; every rule below cites the principle it implements. (2) Barbell update changed from an absolute rep-based estimate to a calibrated, position-matched estimate, because the v1 formula reads a generic rep-to-max mapping and a known RIR bias as lost strength. (3) Calibration rule for the first logged exposure at each wave position. (4) Failure signal defined. (5) Audit single now rescales the mapping as well as the TM. (6) M2 and M3/M4 barbell behaviour specified (v1 was silent on M2 and ambiguous on "2 × 2 at the held TM"). (7) Accessory rule rewritten; v1 referred to the "top of the rep range" on slots that have no range. (8) Rounding rule, equipment floor for the trap-bar jump, flare ladder as a state machine, gap rule. (9) Architecture, import/export and test vectors for the build.

---

## 1. Loading principles

**L1. Load follows demonstrated performance.** Every prescribed number is computed from the last logged set on that slot. No typed anchors. (Design P4; §3.1: a percentage does not deliver a standard effort.)

**L2. One variable moves per slot.** Everything that makes two sets comparable is frozen: tempo, set count, order, RIR cap, implement. If two things change, the log cannot say why performance changed.

**L3. The variable that moves is the one the slot's adaptation responds to.**

| Slot class | What moves | What is frozen | Basis |
|---|---|---|---|
| A. Barbell strength (front squat, deadlift) | Training max, hence load | Percentages, sets, RIR cap | Design P3, P5 |
| B. Tendon heavy-slow (RDL, hack squat, abductor HSR) | Load | 3 s tempo, reps | §13.2 REASONABLE, mixed-status: magnitude and ~3 s duration, mode-agnostic |
| C. Strength accessories | Reps, then load | Sets, RIR cap | Double progression; convention |
| D. Ballistic (trap-bar jump, swing, jump shrug, explosive DB press, landmine C&PP) | Output at fixed load; load only after output plateaus | Load band by class | §5.2 REASONABLE |
| E. Reactive (depth jump, skater bound, depth landing) | RSI at the individually optimal height; contacts by phase | Height between ladders | §7.6, §7.4 REASONABLE; per-session caps are HEURISTIC (§7.5) |
| F. Fixed prehab (Nordic, abduction iso, Y-raise, Pallof) | Reps or ROM, slowly | Load | Convention |

**L4. Trust matched change, not absolute estimates; singles set the scale.** Reps achievable at a given percentage differ by person and by exercise (§3.1; modelled means run about one rep under the /30 mapping at 70 to 90%). Trained lifters underpredict RIR by roughly two reps (§3.2, REASONABLE), and a rating-only loop cannot see its own bias (§3.3, mechanistic argument, untested). Both errors are roughly constant for one lifter on one lift at one rep range, so they cancel when a set is compared with the same wave position earlier. The anchor for every RIR rating is technical failure (§2.0), held constant so the cancellation holds. The ramp single, rated at heavy load where RIR is most accurate (Remmert 2023, outside the document), fixes the absolute level.

**L5. Steps are bounded and damped to the resolution of the measurement.** One rep on a top set is about 2.7% of estimated capacity; RIR error has an SD larger than its mean (§3.2). So the cap is 2.5% per session and, once calibrated, the engine moves half the indicated distance. The gain of 0.5 is an engineering choice, not an evidenced number.

**L6. Increases need confirmation; an unambiguous miss is acted on at once.** Accessory increments need two consecutive qualifying sessions. A missed prescribed rep on a primary lift steps the TM down that day. Structural reductions need two consecutive signals (Design P8).

**L7. Progression thresholds are sized to the increment.** A 2 kg/hand step at 26 kg is 7.7%; a 2.5 kg step on a loaded pull-up is about 3%. Surplus reps required before an increment = increment % ÷ 3, rounded up. Convention derived from the same rep mapping; used only for sizing.

**L8. Tissue outranks performance, fail-closed.** A site flag freezes every upward step on slots loading that site for that session and starts the flare ladder (§9). Tendon slots are judged on tolerated load at 24 to 48 h, not on pain in the set (§13.3).

**L9. The phase changes what is progressed, never how it is computed.** M1 progresses the TM. M2 holds the TM and moves load inside a band. M3 and M4 hold intensity and cut volume (§16.4, REASONABLE). Taper cuts sets only (§15.5). Nothing new and no upward step after week 22.

**L10. A new lift gets a wide seek window for three logged sessions, then normal steps.** Front squat cap 5%; RDL +10 kg step available. After three sessions the window closes whether or not it was used.

Outside-document precedent for rep-driven load adjustment: autoregulated progressive resistance beat a fixed linear progression over 6 weeks in 23 collegiate footballers (Mann et al. 2010, JSCR 24(7):1718). Small, young, short; it supports the direction of L1, not any number here.

---

## 2. Class A: front squat and conventional deadlift

**2.0 What RIR means here.** Reps in reserve are counted to technical failure: the rep at which the lift's defining position or tempo would be lost, not the rep at which the bar stops. Front squat: rack and torso position. Deadlift: spinal position. Tempo slots: the 3 s lowering. Accessories: full range without compensation. Technical failure is never deliberately reached, because on these lifts it can only be found by performing the broken rep; the last set stops at a predicted two clean reps left and the athlete logs reps done and the RIR actually judged (0 to 4). Published RIR data are anchored to momentary failure; rating to a technical anchor is untested, and is safe for the engine only while the anchor is constant (L4). Strength gain is insensitive to this difference: 4 to 6 RIR matched 1 to 3 RIR in trained men over eight weeks, with failure groups slightly worse (Robinson et al. 2025, IJSC 5(1), n = 38; outside the document), consistent with §2.3.

**2.1 Training max.** Seed from a ramp single at RIR 2: TM = 0.90 × single ÷ 0.93 (= 0.968 × single). Stored unrounded. Current: front squat 92.0, deadlift 145.2.

**2.2 Wave (M1).** Positions 1/2/3 = 4 reps at 80%, 3 at 85%, 2 at 90% of TM; 3 sets. Position advances on completed sessions, not dates. Ramp to the first work set: 50% × 5, 70% × 3, 85% × 1 of the day's load (convention; inside the 20 min slot).
- **Position 1:** straight 3 × 4. No AMRAP, no TM update, no calibration. Last-set RIR is logged for the record only. The failure signal (2.6) still applies.
- **Positions 2 and 3:** last set AMRAP capped at RIR 2. "Par", the reps at RIR 2 at which the raw estimate equals the TM, is about 7 at position 2 and 5 at position 3; the app shows it so the set is not stopped at the prescribed count.

**2.3 Raw estimate.** E = load × (1 + (reps + RIR) / 30), from the last set only.

**2.4 Calibration (first logged exposure at positions 2 and 3, per lift).** Raw target T = 0.90 × E.
- If T > TM: step up by min(T − TM, cap). Cap 5% for front squat (L10), 2.5% for deadlift.
- If T ≤ TM and no failure signal: TM holds. Downward steps are suppressed, because both known biases push T down (L4).
- Then store the position's scale factor: β_p = TM (after the step) ÷ T.
Position 1 has no scale factor. A gap of 7% or more during calibration is handled by 2.5a.

**2.5 Matched update (every later exposure).** Target T = 0.90 × β_p × E. Step = clamp(0.5 × (T − TM), −2.5%, +2.5%). This is algebraically the change in E against the same position's calibration set, damped (L4, L5).

**2.5a Big-gap rule (positions 2 and 3, any time).** Gap = (T − TM) ÷ TM. If |gap| ≥ 7%: the step is clamp(T − TM, −5%, +5%) with no damping, and the next session on that lift opens with a ramp single at RIR 2 that resets the TM under 2.8. That session pre-cuts the prehab pair to hold 75 minutes. Exception: during calibration a negative big gap takes no step (both known biases point down) and only schedules the single. Rationale: a two-rep rating error is worth about 5% (§3.2), so a gap of 7% is past what one noisy set can explain, and the right response to a large disagreement is to measure, not to guess (L4). The 7% figure is engineering, not evidence.

**2.6 Failure signal (any time, including calibration).** Any set short of prescribed reps, or the last set logged at prescribed reps with RIR below 2. Consequence: TM − 2.5% that day, no damping (L6).

**2.7 Downward trigger.** Two consecutive negative steps on a lift → next session at position 1 with 2 sets. Restores after one session with a non-negative step. Counts positions 2 and 3 only. Suspended during calibration except via 2.6.

**2.8 Audit single.** First session of each mesocycle, after any gap over 14 days, and when scheduled by 2.5a. TM_new = 0.968 × single, overriding the running value. Then every β_p on that lift is multiplied by TM_new ÷ TM_old, so the mapping is corrected along with the level and the next rep-based update does not drag the TM back to the old scale.

**2.9 By phase (L9).**
- **M2:** contrast doubles at 87% of TM. Move to 90% when the last double is rated RIR 3 or more in two consecutive sessions; back to 87% on a failure signal. No AMRAP (it would flatten the paired jump). TM moves only at the 9 Nov and 21 Dec audits.
- **M3/M4:** 2 × 2 at 90% of TM. v1's "2 × 2 at the held TM" would be doubles at about 90% of 1RM, which §3.1 puts at 2 to 3 reps to failure and so breaches Design P3. TM moves by audit only.
- **Taper:** 1 × 2 at 90% of TM.

---

## 3. Class B: tendon heavy-slow

Validity condition: the 3 s lowering. When it breaks, the set ends and that rep count is logged (L2).

**RDL** (start 100 kg, 3 × 6 to 8, last set AMRAP capped at RIR 2 or tempo break):

| Last-set reps | Next session |
|---|---|
| 12 or more, first three sessions only | +10 kg (L10) |
| 10 or more | +5 kg |
| 8 to 9 | +2.5 kg |
| 6 to 7 | hold |
| under 6 | −5 kg |

**Hack squat (2 × 8) and gluteal abductor HSR (3 × 8):** last set taken to RIR 2 at tempo. 10 or more reps in two consecutive sessions → one increment up. Under 7 in two consecutive sessions → one increment down. No upward step if that site was flagged in the last 48 h (L8).

**v1.9: dumbbell Romanian deadlift (`db_rdl`) and seated hip abduction machine (`seated_abduction`).** Both are class B streak slots with the 3 s lowering; both are loaded by the first logged session (A.11); neither carries a load over from the slot it replaces, because the implement differs.
- `db_rdl`: load per hand, dumbbells in 2 kg steps from 2 to 40 kg (§10). The rep target is the template item's reps, 8 in Block 1 and 6 from Block 2 (A.33). Last set to RIR 2 at tempo. Target + 2 or more reps in two consecutive logged sessions → up 2 kg per hand. Below the target in two consecutive logged sessions → down 2 kg per hand.
- `seated_abduction`: the abductor HSR rule exactly (3 × 8, up at 10, down under 7, two in a row, never cut to zero), with "one stack plate" as the step, shown as a prompt until a heavier load is logged (Q6).
The barbell Romanian deadlift table above, and the hack squat and cable abductor rules, stay in force for every older log.

---

## 4. Class C: strength accessories

Last set taken to the slot's RIR cap and its reps logged; earlier sets at the prescribed reps.

| Slot | Prescription | Cap | Surplus to progress (L7) | Increment |
|---|---|---|---|---|
| DB push press, strength thread | 3 × 6 | RIR 2 | 9 or more, twice running | 2 kg/hand |
| Weighted pull-up | 3 × 5 | RIR 2 | 7 or more, twice | 2.5 kg |
| One-arm landmine press | 3 × 6 | RIR 2 | 8 or more, twice | 2.5 kg |
| Chest-supported row | 3 × 10 | RIR 2 | 12 or more, twice | one plate or 2 kg/hand |
| Bulgarian split squat | 3 × 8 | RIR 3 | 10 or more, twice | 2 kg/hand |

Below prescribed reps twice running → one increment down. First logged session on each slot sets its load; none is on record for this macrocycle. When a phase cuts sets, load and reps carry over unchanged (L9).

---

## 5. Class D: ballistic

Stop rule on every set: first visibly slower rep ends it (Design P3; §5.5).

- **Trap-bar jump.** Band 10 to 20% of front squat TM, recomputed live; hard ceiling 30% of estimated 1RM (§5.2). Equipment floor: if the empty bar exceeds the band, the empty bar is the load provided it is under the ceiling; if it is over, the slot runs with dumbbells at the band. Progression is jump height at fixed load where the app reads it; +2.5 kg only after height has risen and then held flat across two sessions. With no height reading the load simply tracks the band.
- **KB swing (M1).** Fixed heavy bell; no progression; done/not done.
- **Jump shrug (M2+).** Starting load set by the athlete at the first session (v1.6, A.24; the v1.5 start of 70% of deadlift TM is withdrawn); +2.5 kg after two sessions with no stop-rule cut before the last rep.
- **DB push press, explosive (M2+).** Fixed dumbbell under 30% class, set by the athlete at the first session (A.24); progression is speed, judged; no load step inside a mesocycle.
- **Landmine clean and push press (M2+).** Load at catch speed, set by the athlete at the first session (A.24); +2.5 kg on the same two-session rule; first slot cut on time or elbow flag.

---

## 6. Class E: reactive

- **Height:** RSI ladder 20/30/40 cm, three jumps each, best mean RSI wins; re-run at every boundary; frozen after week 22. On ladder day the ladder is the dose: 9 ladder contacts plus 3 at the winning height.
- **Instrument:** My Jump Lab drop-jump mode; RSI = flight time ÷ contact time. Against a force platform the predecessor app agreed at ICC 0.95 to 0.98 for RSI and 0.92 to 0.99 for contact time (Haynes et al. 2019, n = 14; outside the document); minimum detectable change about 0.1 RSI and 0.02 s (2023 ACL cohort, n = 51; outside the document). It reads slightly low against force plates, which is harmless while the method never changes (L2). Fallback if the app is unavailable: slow-motion frame count, and then always that.
- **Contacts:** from the exercise map by phase (6 / 6 to 9 / 9 / 12 then 9 / 6). Not progressed week to week; weekly session count is the governed variable (Design P6). Session cap 12, weekly 24 in M1/M2 and 36 in M3/M4 are conventions.
- **RSI trend:** single-session RSI change is inside noise (§12.2, REASONABLE), so RSI is read only ladder to ladder.

## 7. Class F: fixed prehab

Nordic 2 × 3: add a rep to 2 × 5, then increase range; never zero. Abduction iso, Y-raise, Pallof: fixed; done/not done.

---

## 8. Flags (all fail-closed)

| Flag | Consequence |
|---|---|
| CMJ (avg of 3, Day 1, My Jump Lab) below threshold | One reactive set out that session. Baseline series starts Mon 21 Sep (week 1 value lost); point 8 is the M1 boundary session on 9 Nov, so the personal threshold is live from week 10. Until eight points exist: flag if value < running mean × 0.95. After: flag if value < baseline mean − max(2.77 × TE, 3% of mean), TE = sample SD of consecutive differences ÷ √2; baseline re-set at each boundary from the last eight unflagged points. CMJ height TE is about 2 to 3.5% in trained adults (§12.2, SOLID), so no threshold under 3% is ever used. Two consecutive flagged Day 1s → reduced-volume week: every slot −1 set, intensity held. |
| Tissue above 3/10 in last 48 h | Flare ladder, §9. |
| Catch-heavy acro in last 48 h | Depth-jump set out on Day 1. |
| Session over 75 min (85 on audit sessions) | Next session pre-cuts: prehab pair, then pull slot, then accessory hinge or single-leg slot. Never reactive, ballistic or primary. |
| Gap of 8 to 14 days | Same TM and position; first session back: depth-jump contacts halved, no AMRAP on tempo slots (§16.1). |
| Gap over 14 days | Audit single on both lifts. |

## 9. Flare ladder (per site: patellar, gluteal)

Implements the live tendon flare protocol in the context transfer; interpretation noted where made.
1. **Flag raised:** depth jumps and landings out. Cut-first slot (hack squat for patellar, RDL for gluteal) at −40% (athlete may set 30 to 50). All other slots loading the site frozen: no upward step, no AMRAP.
2. **Second consecutive flag, or above 5/10, or night pain:** app stops prescribing for that site and shows "refer to project / physio". This is judgement, not engine.
3. **Return:** cut slot climbs by 10% of pre-flare load after every 3 clear exposures of that site. Interpretation: "sessions" in the protocol is counted as site exposures, not slot sessions, because a once-weekly slot would otherwise take months.
4. **Plyometrics return** only when the cut slot is back at pre-flare load and clear, restarting at 50% of pre-flare contacts.

---

## 10. Rounding and equipment

Barbell to nearest 2.5 kg, ties down. Dumbbells to the rack (2 kg steps, 24 to 40). TM and all estimates stored unrounded; only displayed loads are rounded. The engine reads the load actually lifted, so rounding never accumulates.

## 11. Inputs

Unchanged from v1 §1, plus: "missed a set" toggle on the primary lift; trap-bar jump height (optional); ladder result on ladder days; tissue flag asks site and score only when answered yes. v1.8: every item can be skipped with an optional reason (A.26); reps in reserve has no default value and must be chosen on every rated set, because a pre-filled rating cannot be told apart from a real one and the barbell engine depends on the rating (§2.0, L4).

---

## 12. Architecture for the build

Built in Claude Code under `app_build_plan_v1.md`. Constraints only; framework and visual design are the builder's choice.
- **Form:** static, offline-capable web app installable to the phone home screen. No backend, no accounts, no analytics. The only network call after load is the optional backup below.
- **Engine:** a pure TypeScript module with no UI or storage imports. Two functions: `prescribe(state, config, date, day?) → session` and `update(state, log) → { state, explanation }`. Every step is explained to the athlete with the numbers behind it.
- **Config:** `programme_config_v1_7.json` (v1.10; v1.6 in v1.9), bundled. A template change is a config version issued by the project, never a code change.
- **State:** schema-versioned; starts from `initial_state_v1_1.json`; per lift TM, β₂ β₃, next position, negative-step streak, single-scheduled flag; per accessory load and streaks; ladder height; CMJ series and baseline; per-site flare state; pending pre-cuts; full session log.
- **Export:** one tap → `training_log_YYYY_wNN.md`, human-readable, with the full state as a fenced JSON block at the foot. Prompted automatically at the end of every session.
- **Export, v1.8:** the human-readable log lists every entry as logged, marks entries a correction replaced or removed, and lists each correction with what it changed. The JSON block holds the raw log including corrections, so an import restores exactly.
- **Export, v1.9:** a swap reads "<Slot>: swapped to <exercise>" plus any numbers logged with it; a phase-start test reads "Phase-start test: best reactive strength index 2.14, best trap-bar jump 41.5 cm"; a session-start check answered No reads "no tendon pain above 3/10 in the last 48 hours".
- **Import:** paste or open that file to rebuild state exactly. The exported log is the record of truth; device storage is a convenience and must be assumed losable.
- **Backup (v1.7):** optional, off until the athlete saves a token.
  - Destination: one private GitHub repo named by the athlete (default `kwthebuilder/kw-conditioning-logs`). A public repo is refused, because the log holds health data. Training data never goes into the app's own repo, which is public.
  - Credential: a fine-grained personal access token limited to that one repo with Contents read and write. It is stored on the device under its own key, outside the engine state, and never appears in an export or a backup.
  - What is written: on every change to state, a few seconds later, the export file is written twice: `latest.md` and `logs/training_log_YYYY_wNN.md`, named by the calendar date, not the date on screen. A file whose content is unchanged is skipped, so no empty commits.
  - Offline: a change is marked unsent at once; the backup retries on app open, when signal returns, and when the app comes back to the foreground. The engine never waits on the network.
  - Restore: reads `latest.md` and goes through the same import as a file, so it restores exactly or refuses without touching state.
  - The manual export stays, as a second copy and for the project chat.
- **Tests (v1.10):** `engine_test_vectors_v1_7.json` is the acceptance contract. It carries every v1.6 block, with the taper Day 1 template case now opening with the jump test (A.41), plus `rir_step` (A.40) and `taper_pre` (A.41); `pinned.default` is config v1.7.
- **Export (v1.10):** the human-readable log is the corrected log in order: a corrected entry is shown as corrected, followed by "(corrected DATE; was: …)"; an added entry sits under its own date with "(added DATE)"; a removed entry is left out. The Corrections list and the JSON block are unchanged, so an import still restores exactly. If a correction cannot be read, the export falls back to the v1.8 listing.
- **Tests (v1.9):** `engine_test_vectors_v1_6.json` is the acceptance contract (v1.9). It carries every v1.5 block unchanged plus `swap`, `rep_override`, `first_load`, `audit_trims`, `phase_tests`, `record_only`, `templates` and `removed_slots`; its `pinned` field names the config each template-dependent block is read against. Human-readable summary of the barbell cases:

| Case | Input | Output |
|---|---|---|
| Position 1 | TM 92.0, 72.5 × 4, 4, 4 | No update; TM 92.0 |
| FS calibration, up | TM 92.0, pos 2, 77.5 × 9 @ RIR 2 | E 105.9, T 95.3, gap +3.6%, step +3.3, TM 95.3, β₂ 1.000; next pos 3 = 85 kg |
| FS calibration, bias | 77.5 × 7 @ RIR 2 | T 90.7, gap −1.4%, held, TM 92.0, β₂ 1.014; next pos 3 = 82.5 kg |
| FS calibration, big gap up | 77.5 × 11 @ RIR 2 | T 100.0, gap +8.7%, step +4.6, TM 96.6, β₂ 0.966; single scheduled |
| FS calibration, big gap down | 77.5 × 4 @ RIR 2 | T 83.7, gap −9.0%, no step, TM 92.0, β₂ 1.099 provisional; single scheduled |
| FS failure signal | 77.5 × 3 @ RIR 1 | TM 89.7 |
| Matched, normal | TM 95.3, β₂ 1.000, 80 × 8 @ RIR 2 | T 96.0, step +0.35, TM 95.65 |
| Matched, big gap up | TM 94.0, β₂ 1.000, 80 × 10 @ RIR 2 | T 100.8, gap +7.2%, step +4.7, TM 98.7; single scheduled |
| Matched, big gap down | TM 94.0, β₂ 1.000, 80 × 3 @ RIR 2 | T 84.0, gap −10.6%, step −4.7, TM 89.3; single scheduled |
| DL calibration | TM 145.2, pos 2, 122.5 × 8 @ RIR 2 | E 163.3, T 147.0, step +1.8, TM 147.0, β₂ 1.000; next pos 3 = 132.5 kg |
| Audit rescale | TM 96.0 → single 102.5 | TM 99.2; each β × 1.033 |

---

## 13. What is evidence and what is convention

Evidenced direction (grades as cited): L3 class bases, L4 premises, L8 judging tendon slots on tolerated load, L9 maintenance by held intensity, CMJ error floor. Convention or engineering: the /30 mapping, gain 0.5, cap 2.5%, the 7% big-gap threshold, L7 sizing, contact caps, ramp sets, −40% flare cut, accessory surplus counts. Untested by anyone: whether a calibrated rating loop out-performs an uncalibrated one (§3 open question); RIR rated to a technical rather than momentary anchor.

**Decisions:** all accepted by the athlete on 19 Sep 2026. Open input: confirm the trap bar's weight (24 kg reported).

---

## Appendix A. Implementation rulings

1. **Numbers.** TM, β and estimates are stored as floats and never rounded in state. Displayed loads round to the nearest 2.5 kg, ties down. Seeds are 92.0 and 145.2.
2. **Order of evaluation on a primary-lift log:** failure signal (2.6) → position 1 (no update) → calibration (2.4, with 2.5a) if that position has no β → big gap (2.5a) → matched update (2.5).
3. **Gap** is always (T − TM) ÷ TM using the TM before the step.
4. **Calibration β** = TM after the step ÷ (0.90 × E). If the calibration session ends in a failure signal, β stays unset and that position calibrates at its next exposure.
5. **Calibration caps:** front squat 5%, deadlift 2.5%; a positive big gap lifts either to 5%.
6. **Negative streak** counts any negative step from any rule at positions 2 and 3; a zero or positive step resets it; position 1 sessions neither count nor reset.
7. **Completed session** for wave-advance purposes = the primary lift's last set was logged. Mesocycle and template are chosen by calendar date from the config; wave position by the completed-session counter. Both lifts enter week 2 at position 2.
8. **Audit and scheduled singles** precede that day's work sets; the day's loads are computed from the TM the single produced; the session budget is 85 minutes on boundary audits and 75 with the prehab pair pre-cut on big-gap singles.
9. **M2 band:** starts at 87% of TM; "two consecutive" means two consecutive sessions of that lift; the TM does not move in M2 to M4 except by a single or a failure signal.
10. **After week 22** no slot takes an upward step; downward rules and flags stay live.
11. **Accessories:** the first logged session sets the load; streak counters reset on any load change. A site flag in the last 48 h blocks upward steps on every slot mapped to that site in the config.
12. **Flags are evaluated at session open**, before `prescribe`, from four yes/no inputs plus the CMJ value; their consequences are shown on the session, not applied silently.
13. **The engine never edits config and never invents a slot.** Anything it cannot compute from state and config is shown as "refer to project".
14. **Downward trigger restore.** The forced position 1 session (2 sets), completed without a failure signal, resets the streak. If position 1 was already due, the forced session is that session and the pointer advances to 2; otherwise the pointer stays where it was. A failure signal in a forced session cuts 2.5% and forces one more; a second returns "refer to project".
15. **Boundary singles** are suggested only on entering M2, M3 and M4. Never for the taper or the intensive. An absent `last_mesocycle` means M1.
16. **Single days.** When a session opens with a single, the work sets are straight sets: no rep-out, no calibration, no matched or big-gap update. The failure signal still applies and the position advances.
17. **Singles are suggestions.** Boundary and big-gap singles are shown with their reason and can be skipped. Skipping clears the flag and changes nothing else. The >14-day gap single is dropped from the app.
18. **Overrides.** Every prescribed load is editable before logging; `update` reads the load performed. Each TM is editable; a manual TM change multiplies that lift's β values by new ÷ old, exactly as a single does. Every override is recorded with an optional note and appears in the export.
19. **Out-of-scope rules are not to be implemented**, even partially. Appendix rulings 8 (time budget clause), 11 (site-flag clause), 12 and 13 (flag clauses) lapse with them.
20. **Ramp sets.** Each ramp load is its percentage of the day's displayed (rounded) work load, then rounded by the one barbell rule in §10: nearest 2.5 kg, ties down. There is no second rounding rule anywhere. 50% of 77.5 is 38.75 and displays as 37.5.
21. **Ladder days.** Config `ladder` lists the programme weeks and the day. On that day of those weeks the `rsi_ladder` item takes the place of the first item named in `ladder.replaces` and every other named item is dropped from the session. It is fixed text, logged done / not done with optional numbers. No ladder logic, no contact caps. The athlete records the winning height by editing `depth_jump.height_cm`.
22. **Day selection.** `prescribe` takes an optional `day` (1 or 2), which always wins. Without it: Day 2 if the front squat's `last_logged` is later than the deadlift's, otherwise Day 1 (including when both are null). The weekday is never consulted, so a shifted session changes nothing. In the taper the same rule applies.
23. **One door for state.** Every change to state goes through `update` and is appended to `state.log`: set logs, a single taken, a single skipped, a manual TM change, a load override, a CMJ value, a depth-jump height, session end. After a single is logged, `prescribe` for the same date returns that lift's work sets as straight sets (A.16) at loads computed from the new TM (A.8).
24. **Explosive slot loads.** Slots in the config with `load_rule: "carry"` (jump shrug, landmine clean and push press, explosive DB push press) carry one load in state, `state.explosive[slot] = { load, clean_streak }`, absent until first logged.
    - **First session:** no load is prescribed. The athlete works up in small jumps until the first visibly slower rep, then logs the heaviest load that stayed fast. That load is stored; the streak starts at 0.
    - **Every session:** the log carries the load lifted, the sets done and one yes/no, "the stop rule cut a set before its last rep". A logged load that differs from the stored load replaces it, is recorded as an override, and resets the streak to 0; that session does not count towards a step.
    - **Step:** on slots with `increment_kg` and `streak` (jump shrug, landmine), a session at the stored load with no cut adds 1 to the streak; a cut resets it to 0. When the streak reaches `streak`, the load rises by `increment_kg` and the streak resets to 0. After week 22 the step is withheld and the streak still resets.
    - **Explosive DB:** no `increment_kg`, so the engine never steps. The athlete changes it by logging a different dumbbell, normally at a mesocycle boundary (§5: no load step inside a mesocycle).
    - Loads are stored as logged and displayed as stored: jump shrug in kg on the bar, landmine in kg on the sleeve, DB in kg per hand.
25. **Round ranges.** When a template block carries `rounds`, every item in it without its own `sets` is prescribed `sets` = the low end and, for a range, `sets_max` = the high end. That includes the primary lift in M2 band mode, which no longer defaults to 3. The athlete chooses within the range; the engine reads only the last set, so the choice changes no rule.

26. **Skip (v1.8).** Log `{ kind: "skip", date, slot, reason?, note? }`. `reason` is one of `time`, `tissue`, `equipment`, `fatigue`, `other`. `slot` is any config slot id, or `cmj`. `update` appends the entry and changes nothing else: no training max, scale factor, load, streak, wave position, `last_logged` or `sessions_logged`. A skipped primary lift is not a completed session (A.7), so the wave position does not advance and the same position is prescribed next time. On every slot that progresses by streak (classes B and C, and the explosive slots in A.24), "two consecutive sessions" means two consecutive *logged* sessions of that slot: a skipped or unlogged session neither counts nor resets the streak (Q13). This is the behaviour the app already had for unlogged sessions; v1.8 states it and extends it to skips. A legacy `fixed` entry with `done: false` reads as a skip with no reason.
27. **Session start and plan snapshot (v1.8).** When the first item of a session is logged, the app first logs `{ kind: "session_start", date, day, at?, plan }`. `at` is the clock time, supplied by the interface; `plan` is the session exactly as displayed at that moment: for each slot in order, the displayed load, sets (and `sets_max`), reps or rep range, seconds, per side, percentage of training max, wave position, rep-out flag, contacts, and whether a single was suggested. It changes no state. A past session is shown from its snapshot. A session logged before v1.8 has none, so its plan is reconstructed: replay the log (A.28) up to the first entry dated that day and call `prescribe` for that date and day. A reconstructed plan is labelled as such, because it is computed under the current rules. `session_end` gains an optional `at`, and `minutes` when the start time is known.
28. **Corrections (v1.8).** A logged entry is never edited or deleted in place; `state.log` only grows. A correction is one entry `{ kind: "correction", date, on, actions, note? }`: `date` is the day the correction is made, `on` is the session date it corrects, and `actions` is a list of `replace(target, entry)`, `remove(target)` and `insert(entry)`. A target is the index in `state.log` of an original entry, or the pair (index of a correction, index of its action) for an entry a correction inserted.
    - **Corrected log.** Walk `state.log` in order. An original entry takes its place. A correction applies its actions in order: `replace` swaps the target's content and keeps its place; `remove` drops it; `insert` places the new entry immediately before the first entry dated later than it, or at the end. A later correction of the same target wins.
    - **Rebuild.** Every derived value (training maxes, scale factors, wave pointers, streaks, loads, overrides, CMJ series, drop-jump height) is the result of passing the corrected log through `update`, one entry at a time, from `initial_state_v1_1.json`. Each entry keeps the position, prescription and load it was logged with; only derived values are recomputed. The wave pointer still advances one step per completed session (A.7), so inserting or removing a primary-lift session shifts the pointer for every later session, and the preview says so.
    - **One door.** Corrections go through `amend(base, state, correction, config)`, which appends the correction entry and rebuilds the state by replay. `update` refuses a correction. `amend` refuses, without touching state, if replaying the current log from the initial state does not reproduce the current state exactly (for example, after a rule change between versions), or if a target does not exist.
    - **Preview.** Before a correction is saved, the interface shows what it changes, in plain language: training maxes, next loads and wave positions, streaks and loads on every slot that moves. Nothing is saved until the athlete confirms.
    - Any date can be corrected, with no time limit (Q14). Every correction stays in the log and in the export.
29. **Tissue check-in (v1.8; built in interface release 3).** Log `{ kind: "tissue_check", date, for_date?, scores: { patellar?, gluteal?, shoulder? }, above_3?, note? }`, scores 0 to 10. Record only: no rule reads it (scope cut v1.4 stands). When any score is above 3 the interface shows the athlete's live flare protocol text from the project context transfer, unchanged (Q15). v1.9: when it is asked is A.36; `above_3` is the answer to that question.
30. **Romanian deadlift explanation (v1.8).** The explanation names the band the last-set reps fall in, from the table rows: "0 reps is under 6: −5 kg", "7 reps is 6 to 7: hold", "10 reps is 10 or more: +5 kg". Wording only; the table and its thresholds are unchanged.
31. **Dates (v1.8).** The date on every log entry is the session's date, not the clock's. A session started before midnight keeps its date until it ends (interface spec §9). A correction may carry entries for any earlier date. The engine still never reads a clock; `at` and `minutes` are supplied by the interface and read by nothing in the engine.

32. **Swap (v1.9).** Log `{ kind: "swap", date, slot, to, load?, sets_done?, last_set?: { reps, rir }, note? }`. `slot` is any config slot id; `to` is the exercise done instead, a non-empty text. The interface offers only the slot's `swaps` list from the config; the engine accepts any text, so a correction can never be refused for it (Q35).
    - **Nothing moves.** `update` appends the entry and changes no training max, scale factor, load, streak, band, wave position, `sessions_logged`, `last_logged` or `last_mesocycle`. On every streak slot a swap neither counts towards nor resets "two in a row", exactly as a skip (A.26, Q13). The numbers logged with a swap are a record; no rule reads them.
    - **One exception: day selection.** A swap on the day's main lift (`front_squat` or `deadlift`) records its date in `state.swapped_main[lift]`. A.22 reads, for each lift, the later of `last_logged` and `swapped_main`, so a swapped main lift still turns the rotation and the other day comes next. Nothing else reads `swapped_main`; the lift's own next session is unchanged (same week type, same load), and a swap does not count as entering a new block (A.34), so a boundary test single, the trims and the phase-start test stay due for the next session of that lift (Q35).
    - **Explanation:** "<Slot name>: swapped to <to>. Nothing moves." A swapped main lift adds one step saying it counts as that day's main lift.
    - **Corrections** treat a swap like any other entry (A.28): replace, remove and insert all work, and the replay rebuilds `swapped_main` with everything else. A state from before v1.9 has no `swapped_main`, which reads as "no lift swapped".
33. **Template rep target (v1.9).** When a template item gives `reps` for a class B or C streak slot, that number is the slot's rep target for the session: `reps` = the item's reps, `up_at` = the item's reps + (slot `up_at` − slot `reps`), `down_below` = the item's reps. The prescription carries it as `target_reps`, and the log echoes it as `target_reps`; `update` applies the rule from the log, so a replay never depends on which template is in force. A log without `target_reps` (every log made before v1.9, and every slot whose item gives no reps) uses the slot's own rule, exactly as before. In config v1.6 only `db_rdl` has item reps (8 in Block 1, 6 from Block 2): 10 twice steps up in Block 1, 8 twice from Block 2; below 8, then below 6, twice steps down (Q36).
34. **Audit-day trims (v1.9).** On a session whose main lift is entering one of `boundary_singles_on_entering` (Blocks 2, 3 and 4: the session that opens with a boundary test single under 2.8, A.8 and A.15), `prescribe` caps at `audit_trims.max_sets` (2) the sets of: the slots listed for that day in `audit_trims.slots_by_day` (Day 1 `db_rdl`, Day 2 `bss`), and every item in that day's last block marked `upper`. The top of a set range is capped too. Nothing else changes: no load, rep, rule, order or item. The capped item records what it was cut from (`trimmed_from`), and the session says it is the test-single day.
    - **Which session.** A lift "opens its block" on a date when the date's mesocycle comes after the lift's `last_mesocycle`, or when `entered_on`, the date of the lift's first log in its current block, is that date. `entered_on` is written by `update` when a barbell log or a single dated in a block after Block 1 moves `last_mesocycle` on (or finds it already there with no date). Block 1 logs never write it, so every state and log from before v1.9 is unchanged. Because the date is kept, the rest of that day's session reads the same once the lift is logged.
    - The trims follow the session, not the single: they apply whether the suggested single is taken or skipped, because the plan is fixed when the session's first item is logged and the single comes later. Big-gap singles (2.5a, Block 1 only) do not trim; the taper has no boundary single and is not trimmed (Q38).
35. **Phase-start test (v1.9).** On the first Day 1 of each block in `phase_tests.mesocycles` (Blocks 2, 3, 4 and the taper), meaning the Day 1 session on which the front squat opens its block (A.34), `prescribe` places the `phase_tests.slot` item (`phase_test`, class F) immediately before `phase_tests.before_slot` (the depth jump), at the start of the explosive work. Its text is the slot's `cue`. It is logged as `{ kind: "phase_test", date, rsi?, trap_bar_cm?, note? }`: best reactive strength index (two decimals) and best trap-bar jump height in centimetres. Record only: `update` appends it and changes nothing else. It can be skipped like every item (A.26, slot `phase_test`) (Q39).
36. **Tendon question at session start (v1.9).** The check-in of A.29 is asked at the start of every session, Day 1 and Day 2: "Any tendon pain above 3/10 in the last 48 hours?" (config `tissue_check.prompt`). No is one tap and logs `{ kind: "tissue_check", date, for_date, above_3: false, scores: {} }`; Yes asks site and score (patellar, gluteal, left shoulder, 0 to 10) and logs them with `above_3: true`. `for_date` is the session's date; once a check-in for that date is logged the question is not asked again for it. It never blocks logging, and it is record only: no rule reads it. The morning-after card of interface v1.1 §14.9 is retired; the flare protocol still shows on a day any score is above 3 (Q40).
37. **Earlier templates for earlier dates (v1.9).** Config `templates_before` holds templates for sessions dated before its `date` (19 Oct 2026): the Block 1 templates of config v1.5, unchanged. `prescribe` uses them for a date before that date, so a plan rebuilt for a past session (A.27), a missed session added for such a date (interface §11A) and a session carried on from such a date read exactly as they did. A session that already has a saved plan always shows its saved plan. Every log, old or new, replays through the same slot rules, which config v1.6 keeps unchanged (Q41).
38. **Retired slots and contrast (v1.9).** The nine slots that leave every template (`nordic`, `abd_iso`, `y_raise`, `pallof`, `hack_squat`, `depth_landing`, `rdl`, `abductor_hsr`, `rsi_ladder`) stay in config v1.6 with their rules unchanged, so every older log replays, exports and can be corrected. A.21 (ladder) and A.25 (round ranges) are unchanged; v1.6 lists no ladder weeks and no contrast block, and uses `rounds` only to give the Block 2 main lifts 3 to 4 plain sets (Q42).
39. **Words from the config (v1.9).** Config v1.6 carries text the interface shows and the engine never reads: `text.warmup`, `text.cmj`, `text.light_week` (with `{sets}` and `{reps}` filled from the day's light-week prescription), `text.session_note`, each slot's `cue` and `swaps`, a template item's `note`, and `budget_min` (80 minutes, shown as the ceiling beside each session's target). A block's `upper` flag is read only by A.34 (Q43, Q44).
40. **Reserve counts towards a step up (v1.10).** Config `rir_step` holds `min_rir` (4) and `from` (2026-11-07). On a class B or C streak slot (§3, §4, A.33), a logged last set with reps at or above the rule's `reps` (the rep target, A.33) and below `up_at`, with `last_set.rir` at or above `min_rir`, dated on or after `from`, counts towards a step up exactly as a set at or above `up_at` does: `streak_up` + 1, `streak_down` 0. Everything else is unchanged: two in a row steps the load by the slot's increment (or owes the step for a text increment), below the target counts down, a load change resets the streaks (A.11), the week-22 freeze withholds the step (A.10), and RIR is still counted to technical failure. The explanation reads "At 8 or more with 4 in reserve (4 or more counts): 1 of 2 towards a step up." Logs dated before `from` follow the v1.9 rule, so every existing log replays to the same numbers. The RDL table (§3, class B `rdl`) and the explosive slots (A.24) do not use it. Reason: the design accepts accessory sets stopped 2 to 4 reps short of failure (design rationale v3.3 P3); under the v1.9 rule a set that grew easier at the target was invisible, and five slots stood still from 24 Sep to 6 Nov (review, 7 Nov). If a step proves too big, reps fall below the target and the rule steps back.
41. **Pre-session items by day (v1.10).** A session template may carry `pre_days`, a list of days; `pre` then applies only on those days. Absent, `pre` applies on every day as before. Config v1.7's taper (`both_days`) carries `pre: ["cmj"]` with `pre_days: [1]`: the jump test opens taper Day 1, the final freshness check before the intensive, as design rationale v3.3 §6 lists it.
42. **Session length (v1.10).** `{ kind: "session_length", date, day, minutes }`, minutes a whole number from 1 to 600, is the athlete's own figure for the session, door to door. Record only: it moves nothing and `update` refuses any other value. It attaches to the session of its date like a check-in. Where a session has one, its record shows those minutes instead of `session_end.minutes`, which stays what it always was: minutes from the first log to Finish, a logging clock that entries logged in bursts or afterwards make meaningless (16 Oct 136 min, 6 Nov 415 min, 23 Oct 1 min).

43. **Heavy doubles (v1.11).** Barbell mode `heavy_doubles`, used by config v1.10 for M2, M3, M4 and TAPER.
    - **Prescription.** Load = round(TM × 0.87 ÷ 0.90), reps 2, sets from the template item (`sets`: 3 in M2, 2 in M34, 1 in TAPER; 2 when read without a template), no AMRAP, no set range. The ramp of 2.2 precedes the work sets unless a test single was logged that day. `pct` is 0.87 ÷ 0.90 of the TM. On a session that opens Blocks 2, 3 or 4 a boundary single is suggested as before (2.8, A.8); its note asks for 1 to 2 reps left and for the reps left to be logged.
    - **Update, from the last double.** In order: (1) failure if any double fell short (`missed`), the last set's reps are below the prescribed reps, or the last set reaches the prescribed reps with 0 left: TM − 2.5%, undamped. (2) If a test single was logged the same day (A.16): no update. (3) E = load × (1 + (reps + RIR) ÷ 30) (2.3); T = 0.90 × E; gap = (T − TM) ÷ TM. If |gap| ≥ 7%: step = clamp(T − TM, ±5% of TM), undamped, and a ramp single is suggested for the next session (2.5a). Otherwise step = clamp(0.5 × (T − TM), ±2.5% of TM) (2.5). (4) Past week 22 a positive step is withheld (A.10); a negative step still applies. No scale factor β is read or changed, there is no calibration exposure and no downward trigger (2.7).
    - **Why no β.** β exists to reconcile an 8 to 12 rep estimate with a single. At 2 to 5 reps to failure Epley agrees with the effort chart to within about 1.5% (a double with 1 left reads about 1.4% low), so the TM settles, at worst, about 1.5% conservative. A β calibrated on the first double would instead lock in whatever error the TM carried into Block 2, such as a hand-set value, and the doubles would correct it only through failures (Q58).
    - **Explanation.** "Last double 90.0 kg × 2 at RIR 3 (prescribed 3 × 2). Estimate E = … Target T = … Gap … Half the gap, capped at 2.5%: step = … TM … kg."
    - **Old modes.** `update` dispatches on the log's own mode, so a `band_87_90`, `primer_2x2_90` or `single_1x2_90` log replays by 2.6 and 2.9 as before, failure at RIR below 2 included.
44. **Test single by reps left (v1.11).** A single (`{ kind: "single", lift, date, load, rir }`, or the older `single` on a barbell log) carries `rir` 0, 1, 2 or 3; anything else is refused. Estimated max = load ÷ f, with f = 1.00, 0.955, 0.93, 0.892 for 0, 1, 2, 3 left; TM_new = 0.90 × that. 0.955 and 0.892 are the RPE-10 column of the common effort chart for 2 and 4 reps; 2 left keeps 0.93 from 2.1 (the chart says 0.922) so that every older single, all logged at 2 left, replays to the same TM. Everything else in 2.8 stands: β rescales by TM_new ÷ TM_old, the suggestion clears, the lift's work sets that day come from TM_new. A logged single can be changed or removed through a correction (A.28) like any entry (Q59).
45. **Estimated max and effort words (v1.11).** The interface shows the estimated max, TM ÷ 0.90, wherever it names a lift's max, and a max set by hand is entered as an estimated max and logged as `tm_override` with tm = 0.90 × the entry; the engine is unchanged. Config v1.10 gives every class B and C slot `rir_cap` 0, which the engine reads only in explanation notes, and adds `text.doubles`, `text.double_one`, `text.single` and `text.accessory_effort`, display only (A.39) (Q60, Q62).
