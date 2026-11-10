# Interface Specification v1.7

**Version 1.7 | 10 November 2026 | Supersedes v1.6.** Everything in v1.6 stands except §29 to §31 below; read "config v1.8" as "config v1.9". Engine spec v1.10 is unchanged: §29 is a template change the engine already reads (engine §4 templates, A.34 test-single caps), and §30 and §31 are display text (engine A.39).

**v1.7 change note: release 3.3, the final programme evaluation (athlete-approved 10 Nov 2026, design rationale v3.6, SPEC_QUESTIONS Q55 to Q57).**

## 29. The strength push press stays in Blocks 3 and 4 (v1.7)

Day 1 of Blocks 3 and 4 (weeks 15 to 24, config `templates.M34.day1`) keeps the dumbbell push press strength thread (`db_pp_strength`) at 2 sets of 6, alternating with the pull-up in the upper block, after the dumbbell Romanian deadlift. Loads come from the same accessory rule as in Blocks 1 and 2; nothing new is computed.

- The upper block is a superset: push press, then pull-up, then rest.
- On the test-single day that opens Blocks 3 and 4 the push press is capped at 2 sets like the rest (`audit_trims`, engine A.34).
- The Day 1 time line reads "about 68 min, 80 max" (config `target_min` 68).
- Not in the taper.
- The running-long and short-session lines (§28) already cover it: the upper pair goes first.

## 30. The jump test comes at the end of the warm-up (v1.7)

The Day 1 jump test (`cmj`) is taken straight after the 2 building jumps that end the glute warm-up, not before the warm-up.

- In the live session the Jump test card sits straight after the warm-up card. When a slotted block comes before the warm-up (the Spanish squat holds in Blocks 3 and 4), that block is still opened first.
- The card head reads "end of the warm-up" (config `text.cmj_when`, "End of the warm-up"); the next-session lines and the not-recorded list use the same words.
- Config `text.warmup` ends: "On Day 1 the jump test comes straight after; then start the first explosive exercise within 1 to 3 minutes."
- Config `text.cmj`: "Straight after the 2 building jumps that end your warm-up. Leave the same gap between the three jumps every time."
- The help line says "Average of three jumps." and the record line "Average of 3 jumps".
- The running mean on the card keeps every logged reading (display only). Readings up to 10 Nov 2026 were taken cold; the design rationale v3.6 compares from 16 Nov 2026 onwards.

## 31. Phase-start test: frames, and what reactive strength means (v1.7)

- The phase-start test card says to film 3 drop jumps and 1 trap-bar jump set in slow motion, and that these are the first 3 drop jumps and the first trap-bar set of the session, not extra work (config `slots.phase_test.cue`).
- It states the formula in words: reactive strength index is time in the air divided by time on the floor, which is what My Jump Lab's drop jump test reports and what the app's frame calculator computes.
- Each of its two numbers has a "Calculate from video" button, the same frame calculator as the drop jump and trap-bar jump cards: frames per second, frames in the air and frames on the ground give the reactive strength index; frames per second and frames in the air give the jump height.
- Every reactive-strength line in the app uses the same words ("time in the air divided by time on the floor"); "bounce height divided by time on the floor" is gone.

Acceptance: `e2e/release33.e2e.ts` (§29 to §31) and the updated warm-up and phase-start tests in `e2e/release3.e2e.ts`; `tests/release33.test.ts`; unit tests read config v1.9 and vectors v1.9 (v1.8 plus the Blocks 3 and 4 Day 1 template cases with the push press, target 68, and the Block 3 and 4 test-single trims with `db_pp_strength: 2`).
