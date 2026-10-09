# Interface Specification v1.0

**Version 1.0 | 9 October 2026 | New.** Governs the app's screens, words and inputs. The rules that compute numbers stay in `engine_spec_v1_8.md`; where this document needs a new kind of log entry, that spec defines it (Appendix A items 26 to 31). Approved by the athlete on 9 October 2026 with four rulings: a skipped session neither counts towards nor breaks a "two in a row" streak; any date can be corrected, with every correction kept visible; the tissue check-in is record only, showing the flare protocol above 3/10; the light week carries a one-line note that never blocks logging.

**Why this exists.** The 8 October audit found the numbers right and the screen misleading. Every date showed the *next* prescription under that date's label, so Monday's 3 × 4 front squat became 3 × 3 on Thursday, past dates looked like blank forms, and there was no way to record "not done" or to fix a mistake. A 0-rep entry typed to mean "skipped" cut the Romanian deadlift by 5 kg. This document fixes that first and then makes the app fast to use with one hand between sets.

---

## 1. Principles

1. **Honest about time.** A past date is a record of what was done. Today is a live session. A future date is a preview and says so. No screen shows one under the label of another.
2. **Nothing moves a number silently.** Every change to a load or training max is shown with the reason in plain words. Anything that rewrites history is previewed before it is saved.
3. **One hand, between sets.** Every control is at least 48 px tall. Numbers change with plus and minus buttons; the keyboard is a fallback.
4. **Plain words.** The screen never shows internal shorthand. The table in §2 is the only vocabulary.
5. **Quiet by default.** One accent colour. No celebrations, streak counters or badges for effort, because the programme rewards stopping at the prescription, not exceeding it.

## 2. Words on screen

| Show this | Instead of | Meaning |
|---|---|---|
| Training max | TM | The working number every barbell load is a percentage of |
| Reps left | RIR, reps in reserve | Clean reps you could still have done before your position or tempo would break |
| Light week / Medium week / Heavy week | Position 1 / 2 / 3 | 80% / 85% / 90% of the training max |
| Last set: as many clean reps as you can, stop with 2 left | AMRAP capped at RIR 2 | The rep-out on medium and heavy weeks |
| Test single | Ramp single, audit single | One heavy rep with 2 left, which resets the training max |
| Block 1: build tissue and reserve | M1 | Programme blocks: 2 convert strength to power, 3 ballistic expression, 4 reactive realisation, then taper and the intensive |
| Week 5 of 25 | Programme week 5 | Counted from 14 September 2026 |
| Show the maths | (the engine's explanation) | The step-by-step numbers, folded away by default |

## 3. Layout

From top to bottom:

1. **Header.** App name, backup status (Backed up / Waiting to send / Backup off), and a Backup button.
2. **Date bar.** Previous day, the date (tapping it opens the phone's date picker), next day, and a Today button whenever another date is showing.
3. **Day switch.** Day 1 or Day 2. Shown only while nothing has been logged for that date; after that the day is fixed and shown as text.
4. **Context line.** For example "Light week · Week 4 of 25 · Block 1: build tissue and reserve", and the session's target length.
5. **Training max chips.** "Front squat max 96.9 kg" and "Deadlift max 147.0 kg". Tapping opens the training max sheet (§8).
6. **Mode banner.** One line saying which of the four modes (§4) is showing.
7. **The session**, block by block, as in the programme.
8. **Recent sessions.** The last eight dates with anything logged: date, day, items logged out of planned. Tapping one opens it.
9. **Plan.** The blocks with dates in plain words, with the current block marked.
10. **Bottom bar.** One main action per mode (§4).

## 4. Four modes

The date decides the mode. The session date is normally today; a session started before midnight keeps its date (§9).

### 4.1 Live: today's session
- Every item that isn't logged shows its prescription and inputs (§5), with **Log** and **Skip**.
- A logged item collapses to one line: what was done, and what it changed in plain words (§12). Under it: **Change**, and **Show the maths**.
- When the first item is logged, the app also saves the plan as displayed (engine A.27).
- Bottom bar: **Finish session**. Once finished, it reads "Session finished" and opens the save-a-copy panel without logging a second finish.

### 4.2 Record: a past date
- The screen is read-only. The banner says "Record of what you logged".
- The header line gives items logged out of planned, items skipped, and the session length when known.
- Each planned item shows one of: **Done**, with planned against what you did (load, sets × reps, last set and reps left) and what it changed; **Skipped**, with the reason; **Not logged**, in grey.
- Tags flag differences: "Load raised 2.5 kg", "Corrected 9 Oct", "Logged twice".
- Anything logged that wasn't in the plan (jump test, a training max set by hand) is listed under "Also logged".
- A plan saved on the day is labelled "Plan as shown on the day". A plan rebuilt for sessions logged before this release is labelled "Plan rebuilt from your log".
- A date with nothing logged says so, and offers **Add a missed session**.
- Bottom bar: **Edit session**.

### 4.3 Edit: correcting a past or current session
- The banner reads "Editing Mon 6 Oct. Nothing is saved until you review the changes."
- Each logged item offers **Change** and **Remove**. Each unlogged item offers **Add** and **Skip**. Change and Add open the same inputs as live mode, filled with what was logged.
- Changes collect in a draft. The bottom bar shows **Review changes (n)** and **Cancel**.
- Review opens the correction preview (§7). Saving applies one correction for all the draft's changes (engine A.28).
- In live mode, Change on a logged item skips the draft and goes straight to the preview.

### 4.4 Preview: a future date
- The banner reads "Preview. Loads assume your training maxes hold; they update as you log."
- Prescriptions are shown without inputs. The day switch works. No bottom bar action.

## 5. Inputs

1. **Load: plus and minus buttons** in the step for the equipment, with the number typable. Barbell lifts, Romanian deadlift, landmine and pull-up belt step 2.5 kg. Dumbbell slots step 2 kg per hand. Chest-supported row steps 2 kg; cable and hack squat step 2.5 kg. No lower or upper limit is imposed, because the configured dumbbell range (24 to 40 kg) is contradicted by logged 16 kg sets (question in §17).
2. **Reps: plus and minus buttons.** Straight sets start at the prescribed reps. A rep-out starts blank and the first plus goes to the prescribed reps.
3. **Reps left: five buttons, 0, 1, 2, 3 and 4+, with nothing pre-selected.** Logging is refused with "Choose reps left" until one is chosen. A pre-filled value cannot be told apart from a real rating, and the training max depends on the rating.
4. **Zero reps.** Logging 0 reps asks first: "0 reps logs a failed set and lowers the load. Didn't do it? Skip instead." The two buttons are **Skip instead** and **Log 0 reps**.
5. **Drop-jump ladder.** The winning height is one of three buttons (20, 30, 40 cm), required before Done.
6. **Barbell missed rep.** A checkbox, "An earlier set fell short", stays until set ticking arrives in release 2.
7. **Drafts survive.** Anything typed into an item survives other items being logged, the screen refreshing and the backup finishing.

## 6. Skip

- Every item, including the jump test, has **Skip**. Tapping it offers one-tap reasons: Time, Tissue, Equipment, Fatigue, Other, or no reason.
- A skip moves nothing (engine A.26). The logged line reads "Skipped · Time. Nothing moves."
- A skipped primary lift keeps the same week type for next time.

## 7. Undo and the correction preview

- **Undo.** After any log or skip in live mode, a bar shows "Logged Front squat · Undo" for 10 seconds. Undo restores the state exactly as it was, including the plan snapshot if that log created it. It is not a correction and leaves no entry.
- **Correction preview.** This is a sheet titled "Check the change", with three parts:
  - "What you're changing": one line per change, for example "Mon 29 Sep · Romanian deadlift: 55 kg × 0, 2 left → skipped (Other)".
  - "What else changes": every derived difference in plain words, for example "Romanian deadlift next load 50 → 55 kg", "Front squat max 96.9 → 95.3 kg", "Front squat next session: Heavy week 87.5 kg → Light week 77.5 kg", "Weighted pull-up: 1 of 2 towards +2.5 kg → 0 of 2". When nothing else changes, it says "Nothing else changes."
  - An optional note.
- Buttons: **Save correction** and **Cancel**.
- If the history cannot be replayed (engine A.28), the sheet says so and nothing is saved.

## 8. Training max sheet

- The current training max, large, with what it means this week: "At this max: light 77.5 · medium 82.5 · heavy 87.5 kg".
- History: every change with its date and reason ("21 Sep · medium week rep-out · 92.0 → 95.3").
- **Set by hand:** plus and minus in 0.5 kg steps, with the three loads updating live, an optional reason, and Save.
- Saving the same value says "That's the current max. Nothing to save." and logs nothing.

## 9. The session date

- The date is today's date when the app opens, and again whenever it comes back to the screen.
- A session started before midnight keeps its date while it is open (started, not finished, within the last 6 hours).
- Logging only happens in live mode, so nothing can be logged to a past date by accident. Past dates change only through Edit, which previews first.

## 10. Finish session

- Finish logs the end once per session, with the length in minutes when the start time is known.
- It then opens the save-a-copy panel (non-negotiable rule 7 in the app's build rules).
- Release 2 replaces that panel with a summary when the automatic backup is on.

## 11. Recent sessions and plan

Recent sessions replaces the raw history list. The raw list stays available at the bottom of the save-a-copy panel as "All log entries". The plan card uses the block names from §2.

## 12. Outcome lines

Each line is shown under a logged item and in the record.

- **Barbell, light week:** "Light week: max unchanged at 147.0 kg."
- **Barbell, rep-out:** "Max 95.3 → 96.9 kg (+1.6)" or "Max holds at 147.0 kg".
- **Barbell, a test single suggested:** add "A test single is suggested next time."
- **Barbell, short of the prescription:** "Short of the prescription: max 147.0 → 143.3 kg (−2.5%)."
- **Romanian deadlift:** "Next time 55 kg (+5)" or "Next time 50 kg (−5)" or "Next time 55 kg (hold)".
- **Accessories:**
  - "Load set at 26 kg."
  - "Holding 26 kg · 1 of 2 towards 28 kg."
  - "Up to 28 kg next time."
  - "Go up one plate next time."
  - "Down to 24 kg next time."
- **Explosive slots:** "Holding 40 kg · 1 of 2 clean sessions towards +2.5 kg" or "Up to 42.5 kg next time".
- **Jump test:** "54 cm · average 52.5 cm over 2."
- **Skip:** "Skipped · reason. Nothing moves."
- **Training max set by hand:** "Max set by hand 96.9 → 98.0 kg."

## 13. Release 1 acceptance tests

Each is checked on a phone-width browser with a log built to match the shape of the athlete's (no real training data in the public repo).

1. Opening a past date with logged entries shows the record, never inputs. For a session like 6 Oct, the planned front squat reads 77.5 kg 3 × 4 (light week) and what was done reads 80 kg, last set 8, 1 left, with "Load raised 2.5 kg".
2. After Monday's light-week front squat is logged, Monday still shows its own plan (3 × 4) and the next Day 1 shows the next prescription (medium week, 3 × 3). The two are never shown under the same date.
3. Skip on any item records the reason and changes no load, training max or week type.
4. A Romanian deadlift logged as 0 reps asks before logging. Correcting a past 0-rep entry to a skip previews "next load 50 → 55 kg" and, once saved, the next prescription is 55 kg.
5. Undo within 10 seconds restores the exact previous state.
6. Reps left has no pre-selected value; Log without it is refused with a message.
7. Ladder height can only be 20, 30 or 40 cm.
8. Leaving the app open past midnight and returning moves to the new day unless a session is open.
9. Saving an unchanged training max logs nothing.
10. Finish twice logs one finish.
11. Typed values in one item survive logging another item.
12. Export, then import, restores exactly, including corrections. The export lists corrections in plain words.
13. The full test suite passes, including every vector in `engine_test_vectors_v1_4.json`.

## 14. Release 2: built for the gym floor

1. **One item in focus.** The current item is expanded. Done items are one line, and the rest of the session is a short "Up next" list. Tapping any item focuses it.
2. **Set ticking.** Each set is a tickable row (warm-up sets in one row). Ticking starts the rest timer. Only the last set needs numbers. An unticked earlier set replaces the "An earlier set fell short" checkbox.
3. **Live preview while entering.** Before reps are entered, the item shows the aim ("About 7 reps keeps your max where it is"). As reps and reps left are set, it shows the training max change and the next heavy-week load, computed by the engine without saving.
4. **Last time, like for like.** Barbell lifts show the last session of the same week type ("Last medium week: 77.5 × 9, 2 left"); other items show the last logged session.
5. **Rest timer and session clock.**
   - The timer starts on a tick and vibrates at the end where the phone allows it.
   - The screen stays awake during a session where the browser allows it.
   - The clock runs from session start and is recorded at Finish.
   - A web app cannot show a lock-screen timer or reliable background alerts without a server; out of scope.
6. **Finish summary.** What moved (training maxes, steps earned, "1 of 2 towards 28 kg"), what's next, and the backup status. The save-a-copy panel appears instead only when the automatic backup is off or failing.
7. **Light-week note.** The light-week card says "3 × 4 and stop. Light weeks don't change your max." Logging more than 2 reps above the prescription adds one line: "Light weeks are for recovery; extra reps here don't count towards your max." It never blocks logging.
8. **Contrast rounds (Block 2, from 9 November).** A contrast block runs as rounds: "Round 2 of 4: heavy set, then jump". Each round is one tick per item, and the round range (3 to 4) is chosen by finishing or stopping.

## 15. Release 3: the season, visible

1. **Navigation.** Three tabs: Today, Plan, Progress.
2. **Plan.**
   - Weeks to the intensive, the programme week, and both training maxes with their change since the block began.
   - The blocks with dates and one line each.
   - The current block week by week: week type, the loads for each lift, and a tick for each logged day.
   - Future loads are labelled as assuming the maxes hold.
   - A calendar of past sessions opens each record.
3. **Progress.**
   - Each lift's training max over time, with its estimated max from each rep-out.
   - A shaded band about one rep either side (about 2.5% at these loads), so a single session's noise isn't read as change.
   - Accessory loads over time.
   - Jump test readings with their running average.
4. **Tissue check-in** (engine A.29).
   - The morning after each session, a one-tap card asks patellar, gluteal and shoulder from 0 to 10.
   - It is recorded only and shown beside the exercises that load each site.
   - Above 3/10 it shows the athlete's flare protocol text, unchanged.
5. **Adherence, not overreach.** Prehab items done per week. No streak counters or celebrations on rep-outs.

## 16. Out of scope

- Server, accounts, analytics.
- Lock-screen widgets and push notifications.
- Any rule that reads the tissue check-in or the jump test.
- Changing a rule's numbers. That is an engine spec version.

## 17. Open questions for the athlete

1. **Dumbbell range.** The config says dumbbells run 24 to 40 kg in 2 kg steps, but Bulgarian split squats were logged at 16 kg per hand. What does your rack actually hold? Until answered, dumbbell steps are 2 kg with no range limit. Not blocking.
2. **Trap-bar weight.** Still recorded as 24 kg, unconfirmed since 14 September. Not blocking.
3. **Your log.** Two items:
   - 29 Sep Romanian deadlift: skipped, or done? Fix it with Edit once release 1 is live.
   - 21 Sep drop-jump ladder: which height won (20, 30 or 40 cm)? Before your next Day 1.
