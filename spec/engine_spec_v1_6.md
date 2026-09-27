# Engine Specification v1.6

**Version 1.6 | 26 September 2026 | Supersedes `engine_spec_v1_5.md`**
**Status:** approved by the athlete 26 Sep 2026; this is the build specification. Companions, which win over prose on any numeric conflict: `engine_test_vectors_v1_3.json`, `programme_config_v1_3.json`, `initial_state_v1_1.json`. Golden session: `training_log_2026_w01_w02_r4.md`.

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

Unchanged from v1 §1, plus: "missed a set" toggle on the primary lift; trap-bar jump height (optional); ladder result on ladder days; tissue flag asks site and score only when answered yes.

---

## 12. Architecture for the build

Built in Claude Code under `app_build_plan_v1.md`. Constraints only; framework and visual design are the builder's choice.
- **Form:** static, offline-capable web app installable to the phone home screen. No backend, no accounts, no analytics, no network calls after load.
- **Engine:** a pure TypeScript module with no UI or storage imports. Two functions: `prescribe(state, config, date, day?) → session` and `update(state, log) → { state, explanation }`. Every step is explained to the athlete with the numbers behind it.
- **Config:** `programme_config_v1_3.json`, bundled and replaceable by import. A template change is a config version issued by the project, never a code change.
- **State:** schema-versioned; starts from `initial_state_v1_1.json`; per lift TM, β₂ β₃, next position, negative-step streak, single-scheduled flag; per accessory load and streaks; ladder height; CMJ series and baseline; per-site flare state; pending pre-cuts; full session log.
- **Export:** one tap → `training_log_YYYY_wNN.md`, human-readable, with the full state as a fenced JSON block at the foot. Prompted automatically at the end of every session.
- **Import:** paste or open that file to rebuild state exactly. The exported log is the record of truth; device storage is a convenience and must be assumed losable.
- **Tests:** `engine_test_vectors_v1_3.json` is the acceptance contract. Human-readable summary:

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
