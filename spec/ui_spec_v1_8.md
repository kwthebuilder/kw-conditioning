# Interface Specification v1.8

**Version 1.8 | 12 November 2026 | Supersedes v1.7.** Everything in v1.7 stands except §32 to §34 below; read "config v1.9" as "config v1.10" and "engine spec v1.10" as "engine spec v1.11".

**v1.8 change note: release 3.4, heavy doubles and the effort rule (athlete-approved 10 and 12 Nov 2026, design rationale v3.7, SPEC_QUESTIONS Q58 to Q62).**

## 32. The test single: reps left, and changing it (v1.8)

- **Logging.** The test single callout asks for the load and "Reps left after the single", a choice of 0, 1, 2 or 3 (engine A.44). Log single refuses until both are given ("Enter the single." / "Choose how many reps you had left."). The callout text is config `text.single`: work up to one clean rep with 1 to 2 left, then log the weight and how many were left.
- **After logging.** The callout is replaced by a record on the lift: "Test single logged: 152.5 kg with 1 left. Estimated max 159.7 kg. Today's sets are worked out from it." with a Change single control. It stays on the lift after the work sets are logged.
- **Changing it.** Change single opens the same two fields, filled in, with Check the change, Remove single and Cancel. Check the change and Remove single go through the correction preview and Save correction (engine A.28), exactly as Change does on any item.
- **A past session.** In Edit, a row whose lift had a test single shows the same record and Change single; the change is a draft of its own ("The test single will read: Test single 152.5 kg, 0 left", with Undo this change) and is saved with Review changes.
- **Skipped.** Skip single hides the callout for the rest of the day (engine A.17). Before v1.8 a boundary single's callout stayed until the lift was logged.
- **Record line.** A single reads "Test single 152.5 kg, 1 left".

## 33. The estimated max is the number shown (v1.8)

The engine keeps the training max; the athlete sees the estimated max, which is the training max ÷ 0.90 (engine 2.1, A.45). One decimal throughout.

- **Chips** on Today read "Front squat estimated max · 102.2 kg".
- **The sheet** is titled "<Lift> estimated max", shows it large, then: "Your best single worked out from what you log. It is an estimate, not a tested max."; "Training max X kg: 90% of the estimated max, the number your loads come from."; "At this max:" the loads for today's block (doubles at 87% of it in Blocks 2 to 4 and the taper; the three wave loads in Block 1). Set it by hand takes an estimated max; saving logs `tm_override` with 90% of it.
- **Outcome lines** say "estimated max" with its value: "Estimated max 102.2 → 103.3 kg (+1.1).", "Estimated max held at …", "Estimated max reset to … kg. Today's sets are worked out from it.", "Estimated max set by hand …", and on the change preview "<Lift> estimated max A → B kg". On a heavy double the failure line reads "No reps left, or a double short: estimated max A → B kg (−2.5%)."
- **Percentages** beside a lift are of the estimated max: "87% of max" on heavy doubles; Block 1 weeks read "Light week · 72% of max", "Medium week · 77% of max", "Heavy week · 81% of max". The "Show the maths" text keeps the engine's own terms (TM, E, T).

## 34. The effort rule in words (v1.8)

- **Heavy doubles** (2 or 3): config `text.doubles`: "Earlier doubles: stop with 2 to 3 left. The last double may go to 1 left, never to 0. Log the reps you really had left; the last double moves your max." One double (taper): `text.double_one`. The missed-set box reads "An earlier double fell short". There is no optional set: Block 2 is 3 doubles.
- **Accessories** (class B and C slots, `rir_cap` 0): `text.accessory_effort`: "Earlier sets with 1 to 2 left. Last set: as many clean reps as you can, up to the last one with good form." A tempo slot adds "Stop as soon as the 3-second lowering speeds up."
- **Jumps and explosive lifts:** unchanged (stop at the first slower rep).

### Tests (phone screen, synthetic data): `e2e/release34.e2e.ts`
1. The test single needs reps left; 1 left gives a training max of 0.90 × single ÷ 0.955; Change single to 2 left and Save correction gives 0.90 × single ÷ 0.93.
2. Skip single hides the callout.
3. Block 2 Day 1: "87% of max", the doubles text, no Set 3 row before the last set; 1 left previews an estimated max change, 0 left previews the failure line; the accessory effort text shows.
4. The chip and sheet show the estimated max and the training max; setting 102.7 by hand stores 92.43.
5. A past session's single changed to 0 left in Edit is saved as a correction.
