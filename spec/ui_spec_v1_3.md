# Interface Specification v1.3

**Version 1.3 | 10 October 2026 | Supersedes v1.2 (same day).** Governs the app's screens, words and inputs. The rules that compute numbers stay in `engine_spec_v1_8.md`; where this document needs a new kind of log entry, that spec defines it (Appendix A items 26 to 31). v1.1 was approved by the athlete on 9 October 2026 with four rulings, all still in force: a skipped session neither counts towards nor breaks a "two in a row" streak; any date can be corrected, with every correction kept visible; the tissue check-in is record only, showing the flare protocol above 3/10; the light week carries a one-line note that never blocks logging.

**v1.3 change note (athlete answers, 10 Oct 2026).** Closes every open question in §17; release 1.1's scope grows by three small items.
1. **Dumbbells run 2 to 40 kg in 2 kg steps.** Config v1.4 already says so; the v1.1 and v1.2 question was stale and is withdrawn. The load buttons now stop at 2 and 40 kg (§5.1).
2. **The trap bar is 24 kg, confirmed.** Config v1.5 sets `trap_bar_kg_confirmed` to true. No number changes.
3. **29 Sep Romanian deadlift:** handled by the athlete. Nothing for the build.
4. **Depth jumps are from one 51 cm box.** The athlete has no lower box. This was decided in the programme chat on 21 Sep 2026 ("lock the 51 cm in": 6 jumps from the box, no ladder), but was never written into a project document, which is why it was asked again on 9 and 10 Oct. The drop-jump ladder therefore leaves the app (§5.5): config v1.5 empties the ladder schedule, the depth jump item shows "51 cm box", and the test vectors' ladder cases change to match (§13A). Engine rule A.21 then never fires; it needs no edit.

**v1.2 change note (athlete-approved 10 Oct 2026).** Drafted in the programme chat from the athlete's complaint about the date bar; the build chat checks it against the code before building (§13A). It adds a small patch, **release 1.1**, shipped before release 2. No engine rule changes and no change to the programme: every new action uses entries engine spec v1.8 already defines.

1. **The date bar goes.** The previous-day and next-day arrows, the date field, the Today button and the empty-day card are removed. The programme is a rotation (engine rule A.22 never consults the weekday), and with two sessions a week, stepping by day landed on an empty date about five taps in seven. The app becomes one screen: Today, then History, then Plan (§3).
2. **No future dates.** Preview mode (v1.1 §4.4) is replaced by the next session on Today, with the existing Day 1 / Day 2 switch (§4.4). In a rotation the app cannot know which date the next session falls on.
3. **History grouped by programme week** replaces "Recent sessions", with weeks that have no sessions folded into one line (§11). It also replaces release 3's planned calendar of past sessions (§15).
4. **Add a missed session** moves to the foot of History and asks for the date first (§11A).
5. **Unfinished sessions stay open** until finished, closed, or the end of the next calendar day, with one "Carry on / Close it" card on Today (§9). This replaces v1.1's 6-hour rule and stops one session being split into two, as happened on Fri 2 and Sat 3 Oct.
6. **Finish asks about items not recorded** before it closes the session (§10). Release 2's finish summary (§14.6) replaces this sheet when it ships.
7. **Remove this session** is added to Edit (§4.3), for a session started on the wrong day.
8. **Records drop the training max chips** (they show today's numbers above an old session) and count items as done, skipped and not recorded (§4.2).
9. **Dates are always written out** ("Sat 10 Oct 2026"), never numeric. The phone's date field showed month-first order.
10. **One attention card at a time** on Today (§3).

**Mockup.** Design canvas "Acro S&C redesign v1", six phone screens: https://claude.ai/artifact/2MbRXcRAwR9dN63T3R3f2a. The top row uses the athlete's log; the bottom row is an invented storyline from 12 to 21 October. Where the canvas and this document differ, this document wins.

**Why v1.1 existed.** The 8 October audit found the numbers right and the screen misleading. Every date showed the *next* prescription under that date's label, so Monday's 3 × 4 front squat became 3 × 3 on Thursday, past dates looked like blank forms, and there was no way to record "not done" or to fix a mistake. A 0-rep entry typed to mean "skipped" cut the Romanian deadlift by 5 kg. v1.1 fixed that. v1.2 removes the date navigation that v1.1 kept, because it still put empty dates in front of the athlete.

---

## 1. Principles

1. **Honest about time.** A past session is a record of what was done. Today's session is live. The next session is shown as the next session, never under a date it may not fall on. No screen shows one under the label of another.
2. **Nothing moves a number silently.** Every change to a load or training max is shown with the reason in plain words. Anything that rewrites history is previewed before it is saved.
3. **One hand, between sets.** Every control is at least 48 px tall. Numbers change with plus and minus buttons; the keyboard is a fallback.
4. **Plain words.** The screen never shows internal shorthand. The table in §2 is the only vocabulary.
5. **Quiet by default.** One accent colour. No celebrations, streak counters or badges for effort, because the programme rewards stopping at the prescription, not exceeding it. At most one attention card on Today.

## 2. Words on screen

| Show this | Instead of | Meaning |
|---|---|---|
| Training max | TM | The working number every barbell load is a percentage of |
| Reps left | RIR, reps in reserve | Clean reps you could still have done before your position or tempo would break |
| Light week / Medium week / Heavy week | Position 1 / 2 / 3 | 80% / 85% / 90% of the training max |
| Last set: as many clean reps as you can, stop with 2 left | AMRAP capped at RIR 2 | The rep-out on medium and heavy weeks |
| Test single | Ramp single, audit single | One heavy rep with 2 left, which resets the training max |
| Block 1: build tissue and reserve | M1 | Programme blocks: 2 convert strength to power, 3 ballistic expression, 4 reactive realisation, then taper and the intensive |
| Week 5 of 25 | Programme week 5 | Counted from Monday 14 September 2026; a week runs Monday to Sunday |
| Show the maths | (the engine's explanation) | The step-by-step numbers, folded away by default |
| Not recorded | Not logged, blank | A planned item with no log and no skip |
| Sat 10 Oct 2026 (headings), Thu 8 Oct (rows) | 10/10/2026, any numeric date | Every date on every screen |
| History | Recent sessions | The list of past sessions (§11) |
| Next session | Preview, a future date | The session Today will run next (§4.4) |

## 3. Layout

There is one main screen, Today. A past session opens as a record from History and returns to Today.

**Today, top to bottom:**

1. **Header.** App name, backup status (Backed up / Waiting to send / Backup off), and a Backup button.
2. **Date line.** Today's date written out ("Sat 10 Oct 2026") and "Week 4 of 25 · Block 1: build tissue and reserve". Not tappable. There is no date bar.
3. **Training max chips.** "Front squat max 96.9 kg" and "Deadlift max 147.0 kg". Tapping opens the training max sheet (§8).
4. **Attention card, at most one.** In priority order: an unfinished session (§9); then, from release 2, the tissue check-in (§14.9). A lower card waits until the higher one is dealt with.
5. **Status line.** One of:
   - "No session today. Last session: Day 2 on Thu 8 Oct." (nothing live; "No sessions yet." on an empty log)
   - "Today's session · Day 1 · Medium week · started 18:42" (live)
   - "Done today · Day 1 · 72 min" (finished today)
6. **The session.** The live session, or the next session ready to start (§4.1, §4.4). After a session has finished today: that session as one line that opens its record, then the next session read-only (§4.4).
7. **History** (§11).
8. **Plan.** One row, "Plan · Block 1 · week 4 of 8", opening the blocks with dates in plain words and the current block marked.
9. **Bottom bar.** **Finish session** while a session is live; nothing otherwise.

**A record (a past session opened from History), top to bottom:** a back link "Today"; the date written out; the status line "Record · Day 2 · Light week · about 70 min"; the week and block line; the counts (§4.2); the items; **Edit session** at the foot. No training max chips.

## 4. Modes

There are three modes and one state of Today. What you tapped decides the mode; the date never does.

### 4.1 Live: today's session
- Every item that isn't logged shows its prescription and inputs (§5), with **Log** and **Skip**.
- A logged item collapses to one line: what was done, and what it changed in plain words (§12). Under it: **Change**, and **Show the maths**.
- When the first item is logged, the app also saves the plan as displayed (engine A.27). From then the day is fixed and the day switch is replaced by text.
- A session carried on from the previous day (§9) is live in the same way, labelled "Thu 15 Oct's session, carried on". Its entries carry its own date.
- Bottom bar: **Finish session** (§10).

### 4.2 Record: a past session
- Read-only. Opened from History, or from today's finished session on Today.
- The header line gives the counts: "2 done · 6 not recorded", "7 done · 2 skipped · 1 not recorded", plus the session length when known.
- Each planned item shows one of: **Done**, with planned against what you did (load, sets × reps, last set and reps left) and what it changed; **Skipped**, with the reason.
- Items not recorded are grouped in one card, "Not recorded (6)", one row each with the item's plan. For sessions logged before release 1 (9 Oct) the card adds: "Logged before the app could record a skip. Use Edit to add or skip them; skipping moves nothing."
- Tags flag differences: "Load raised 2.5 kg", "Corrected 9 Oct", "Logged twice", "Not finished".
- Anything logged that wasn't in the plan (jump test, a training max set by hand) is listed under "Also logged".
- A plan saved on the day is labelled "Plan as shown on the day". A plan rebuilt for sessions logged before release 1 is labelled "Plan rebuilt from your log".
- No training max chips: they show today's values, which do not belong above an old session.
- Bottom: **Edit session**.

### 4.3 Edit: correcting a past or current session
- The banner reads "Editing Mon 6 Oct. Nothing is saved until you review the changes."
- Each logged item offers **Change** and **Remove**. Each unlogged item offers **Add** and **Skip**. Change and Add open the same inputs as live mode, filled with what was logged.
- **Remove this session**, at the foot, puts a removal of every entry of the session in the draft. It is for a session started on the wrong day or logged twice.
- Changes collect in a draft. The bottom bar shows **Review changes (n)** and **Cancel**.
- Review opens the correction preview (§7). Saving applies one correction for all the draft's changes (engine A.28). A removed session disappears from History; the next session then follows engine A.22.
- In live mode, Change on a logged item skips the draft and goes straight to the preview.

### 4.4 Today's next session
- When no session is live, Today shows the next session: `prescribe` for today's date with the day from engine A.22 (Day 2 if the front squat was logged more recently than the deadlift, otherwise Day 1). Its heading is "Next session · Day 1 · about 72 min".
- **Day switch** (Day 1 / Day 2) shows the other day's prescription. One line under it: "Day 1 is next in your rotation. Logging the first item starts the session and fixes the day." When the athlete has switched, the line names the switch: "You've chosen Day 2. Day 1 is next in your rotation."
- It is the live session not yet started: the items carry their inputs, **Log** and **Skip**. Logging the first item starts it (§4.1). There is no Start button.
- **After a session has finished today**, the next session is shown read-only, labelled "Next session · loads assume your training maxes hold", with one secondary button, **Start it today**, which makes it live.
- **While an unfinished session is open** (§9), the next session shows as a heading only, "Next session · Day 1", with "Ready once Thursday's session is finished or closed." It cannot be started until then.
- There are no future dates anywhere in the app.

## 5. Inputs

1. **Load: plus and minus buttons** in the step for the equipment, with the number typable. Barbell lifts, Romanian deadlift, landmine and pull-up belt step 2.5 kg. Dumbbell slots step 2 kg per hand, from 2 to 40 kg (config `db_min_kg`, `db_max_kg`): minus stops at 2, plus stops at 40, and a typed value outside that range is refused with "Your dumbbells run 2 to 40 kg." Chest-supported row steps 2 kg; cable and hack squat step 2.5 kg.
2. **Reps: plus and minus buttons.** Straight sets start at the prescribed reps. A rep-out starts blank and the first plus goes to the prescribed reps.
3. **Reps left: five buttons, 0, 1, 2, 3 and 4+, with nothing pre-selected.** Logging is refused with "Choose reps left" until one is chosen. A pre-filled value cannot be told apart from a real rating, and the training max depends on the rating.
4. **Zero reps.** Logging 0 reps asks first: "0 reps logs a failed set and lowers the load. Didn't do it? Skip instead." The two buttons are **Skip instead** and **Log 0 reps**.
5. **Depth jump (v1.3).** One box, 51 cm. The item reads "Depth jump · 6 jumps · 51 cm box", with the block's configured contacts (6 in Blocks 1 and 2, 9 in Block 3, 12 then 9 in Block 4), taking the height from the stored depth-jump height (engine A.21's `depth_jump.height_cm`, set to 51). There is no ladder and no height choice. The v1.1 ladder buttons (20, 30, 40 cm) are removed.
6. **Barbell missed rep.** A checkbox, "An earlier set fell short", stays until set ticking arrives in release 2.
7. **Drafts survive.** Anything typed into an item survives other items being logged, the screen refreshing and the backup finishing.
8. **Dates (release 1.1).** The only date input is in Add a missed session (§11A): a button showing the date written out, opening the phone's date picker on tap. The picker's own format is the phone's; the app never displays a numeric date.

## 6. Skip

- Every item, including the jump test, has **Skip**. Tapping it offers one-tap reasons: Time, Tissue, Equipment, Fatigue, Other, or no reason.
- A skip moves nothing (engine A.26). The logged line reads "Skipped · Time. Nothing moves."
- A skipped primary lift keeps the same week type for next time. It also leaves that lift's last-logged date unchanged, so under engine A.22 the same day comes up next time; the day switch covers the athlete who wants the other day.

## 7. Undo and the correction preview

- **Undo.** After any log or skip in live mode, a bar shows "Logged Front squat · Undo" for 10 seconds. Undo restores the state exactly as it was, including the plan snapshot if that log created it; undoing a session's first log therefore brings the day switch back. It is not a correction and leaves no entry.
- **Correction preview.** This is a sheet titled "Check the change", with three parts:
  - "What you're changing": one line per change, for example "Mon 29 Sep · Romanian deadlift: 55 kg × 0, 2 left → skipped (Other)", "Mon 19 Oct · Day 1 added · 9 done, 1 skipped" or "Thu 15 Oct · Day 2 removed".
  - "What else changes": every derived difference in plain words, for example "Romanian deadlift next load 50 → 55 kg", "Front squat max 96.9 → 95.3 kg", "Front squat next session: Heavy week 87.5 kg → Light week 77.5 kg", "Weighted pull-up: 1 of 2 towards +2.5 kg → 0 of 2", and, from release 1.1, "Your next session: Day 1 → Day 2". When nothing else changes, it says "Nothing else changes."
  - An optional note.
- Buttons: **Save correction** and **Cancel**.
- If the history cannot be replayed (engine A.28), the sheet says so and nothing is saved.

## 8. Training max sheet

- The current training max, large, with what it means this week: "At this max: light 77.5 · medium 82.5 · heavy 87.5 kg".
- History: every change with its date and reason ("21 Sep · medium week rep-out · 92.0 → 95.3").
- **Set by hand:** plus and minus in 0.5 kg steps, with the three loads updating live, an optional reason, and Save.
- Saving the same value says "That's the current max. Nothing to save." and logs nothing.

## 9. The session date and open sessions

- **Today** is the phone's date when the app opens, and again whenever it comes back to the screen.
- **A session's date** is the date of its `session_start` entry (engine A.27). Every entry logged into that session carries that date, including entries logged after midnight or on the next day.
- **A session is open** from its first log until one of: **Finish session** (§10); **Close it** (below); or the end of the calendar day after its date. A session past that point is simply no longer open: nothing is logged, and its unrecorded items read "Not recorded". Nothing moves.
- **Opening the app with an earlier session still open** (its date is before today) shows the attention card: "Thu 15 Oct's Day 2 isn't finished", then "2 done · 6 not recorded · started 19:05. Carry on to log the rest into Thursday's session, or close it.", then **Carry on** and **Close it**, then "Carry on is open until the end of today."
  - **Carry on** makes that session live on Today (§4.1). It keeps its date and its plan snapshot.
  - **Close it** asks the not-recorded question (§10), then logs `session_end` once.
- **One open session at a time.** The next session cannot start while another is open; the card comes first.
- **Sessions from before release 1.1** are never treated as open, so no card appears for anything logged from 21 September to the release date.
- **Logging only happens in live mode** (including Carry on), so nothing can be logged to a past session by accident. Past sessions change only through Edit or Add a missed session, both of which preview first.

## 10. Finish session

- If any planned item has neither a log nor a skip, Finish first opens a sheet: "3 items not recorded", one row per item with its plan, "Log them now, or skip them so this session's record is complete. Skipping moves nothing.", and two buttons, **Log them** (back to the session) and **Skip the rest** (one skip each, no reason, engine A.26). Under them: "Either way, saving a copy comes next."
- Finish then logs the end once per session, with the length in minutes when the start time is known.
- It then opens the save-a-copy panel (non-negotiable rule 7 in the app's build rules).
- Today then shows "Done today" (§3).
- Release 2 replaces both the not-recorded sheet and the panel with the finish summary (§14.6) when the automatic backup is on.

## 11. History and plan

- **History** lists every session, newest first, grouped by programme week (Monday to Sunday, counted from Monday 14 September 2026).
- **Week header:** "Week 4 · 5 to 11 Oct" on the left, "2 sessions" on the right.
- **Session row:** the date ("Thu 8 Oct"), then "Day 2 · 2 done · 6 not recorded". Skips are counted when present: "Day 1 · 7 done · 2 skipped · 1 not recorded". Tags as in §4.2 ("Not finished" while a session is open; "Logged twice"). Tapping a row opens its record. Each row is at least 56 px tall.
- **Weeks without sessions** appear between the first week with a session and the current week, as one line: "Week 6 · no sessions". Consecutive empty weeks fold: "Weeks 6 to 7 · no sessions". A current week with nothing yet reads "Week 8 · no sessions yet".
- **Length:** the four most recent weeks, then **Show earlier weeks**.
- **At the foot:** **Add a missed session** (§11A).
- The raw log stays available at the bottom of the save-a-copy panel as "All log entries".
- **Plan** uses the block names from §2.

## 11A. Add a missed session (release 1.1)

For a session the athlete trained but did not log. It is a full-screen flow in two steps, with **Cancel** at the top left, which discards everything.

1. **When did you train?** A date button, written out, defaulting to yesterday, with the line "Any day from Mon 14 Sep up to today." The picker refuses dates outside that range.
2. **Which session?** Two choices, Day 1 and Day 2, each with one line. The pre-selected day is the one engine A.22 gives after replaying the corrected log up to that date, with the line "Next in your rotation on Mon 19 Oct". The other reads "Your last Day 2 was Thu 15 Oct".
3. **If that date already has a session**, the flow says "Thu 8 Oct already has Day 2" and offers **Add to that session** (opens it in Edit, §4.3) and **Add a separate session**. Nothing is duplicated unless the athlete chooses the second.
4. A note under the choices: "Adding a session can change your loads and your next session. You'll see every change before anything is saved."
5. **Step 2, enter what you did.** The plan for that date and day (engine A.27's reconstruction: replay up to that date, then `prescribe` for that date and day), with the Edit inputs. Each item takes **Add** or **Skip**.
6. **Review** opens the correction preview (§7). **Save correction** writes one correction (engine A.28) whose `on` is the missed date and whose actions insert, in order, a `session_start` (with the plan as shown and no `at`), the entries, and a `session_end`. Inserted entries take their place before the first entry dated later (A.28), so every later number replays from them.

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

## 13. Release 1 acceptance tests (accepted 9 Oct; kept for regression)

Each is checked on a phone-width browser with a log built to match the shape of the athlete's (no real training data in the public repo). Tests 1, 2, 8 and 14 are restated in §13A for the date-free layout; the rest stand as written.

1. Opening a past session with logged entries shows the record, never inputs. For a session like 6 Oct, the planned front squat reads 77.5 kg 3 × 4 (light week) and what was done reads 80 kg, last set 8, 1 left, with "Load raised 2.5 kg".
2. After Monday's light-week front squat is logged, Monday's record still shows its own plan (3 × 4) and the next Day 1 shows the next prescription (medium week, 3 × 3). The two are never shown under the same date.
3. Skip on any item records the reason and changes no load, training max or week type.
4. A Romanian deadlift logged as 0 reps asks before logging. Correcting a past 0-rep entry to a skip previews "next load 50 → 55 kg" and, once saved, the next prescription is 55 kg.
5. Undo within 10 seconds restores the exact previous state.
6. Reps left has no pre-selected value; Log without it is refused with a message.
7. *(Retired in v1.3: there is no ladder. Replaced by §13A test 19.)* Ladder height can only be 20, 30 or 40 cm.
8. *(Restated in §13A test 7.)* Leaving the app open past midnight and returning moves to the new day unless a session is open.
9. Saving an unchanged training max logs nothing.
10. Finish twice logs one finish.
11. Typed values in one item survive logging another item.
12. Export, then import, restores exactly, including corrections. The export lists corrections in plain words.
13. The full test suite passes, including every vector in `engine_test_vectors_v1_4.json`.
14. *(Restated in §13A test 15.)* A Block 2 session shows the skater bound as "6 reps each side · stuck landing" and drop landings as "4–6 landings". The phone-screen smoke tests in `e2e/` run on every pull request.

## 13A. Release 1.1: the date-free patch

**Scope:** §1 principle 1; §2 new rows; §3; §4.2 counts, the not-recorded card and no chips; §4.3 Remove this session; §4.4; §5.8; §7 the Undo note and the new preview lines; §9; §10's not-recorded sheet; §11; §11A; and from v1.3, §5.1's dumbbell limits, §5.5's single-box depth jump, and config v1.5. Ships before release 2 and does not wait for it.

**Config v1.5 and test vectors (v1.3).** The build chat issues `programme_config_v1_5.json` with `trap_bar_kg_confirmed` set to true and the ladder schedule emptied (`ladder.weeks` set to an empty list), nothing else changed, and updates the ladder cases in the test vectors to expect each template's normal reactive items (test 19). If the stored depth-jump height is not already 51 cm (the athlete was told on 21 Sep to type 51 on the ladder item), the patch logs it once as a depth-jump height entry (engine A.23), shown in the export.

**Before building:** the build chat checks this scope against the code, `engine_spec_v1_8.md` and the test vectors, and tells the athlete in plain words about any conflict before writing code. The expected answer is that no engine rule changes: adding and removing sessions use A.28's `insert` and `remove`, day choice uses A.22, skips use A.26, and the inserted plan uses A.27's reconstruction. One point to confirm: Carry on appends entries dated D after anything already logged on D + 1 (for example a training max set by hand that morning). If the engine's replay assumes entries arrive in date order, either Carry on writes its entries as A.28 inserts, or other logging is held while an earlier session is open. The build chat chooses and says which.

**Acceptance tests** (phone-width browser, the athlete-shaped log, today's date set by the test):

1. No screen shows a numeric date or a date bar. Headings read like "Sat 10 Oct 2026" and rows like "Thu 8 Oct".
2. With sessions on 21 Sep, 24 Sep, 29 Sep, 2 Oct, 3 Oct, 6 Oct and 8 Oct shaped like the athlete's, and today set to 10 Oct: Today reads "No session today. Last session: Day 2 on Thu 8 Oct.", shows "Next session · Day 1", and History shows weeks 4, 3 and 2 with "2 sessions", "3 sessions" and "2 sessions". The 8 Oct row reads "Day 2 · 2 done · 6 not recorded". On every row, done, skipped and not recorded are separate counts that add up to the planned items, and a zero count is left out. (Release 1's "7 of 10 logged, 2 skipped" did not say whether skips were inside the 7; the build chat confirms from the code which they were.)
3. Tapping a History row opens that session's record with no training max chips; the back link returns to Today. The 6 Oct record passes release 1 test 1.
4. Before anything is logged, the day switch shows Day 2's prescription; logging the first item fixes the day; Undo of that first log brings the switch back.
5. Finish with 3 items not recorded opens the sheet. **Skip the rest** logs 3 skips with no reason; training maxes, loads, streaks and week types are identical before and after.
6. A session started on day D and not finished: opening the app on D + 1 shows the card. **Carry on** logs entries dated D, and History shows one session, not two.
7. The same session opened on D + 2 shows no card and logs nothing; its unlogged items read "Not recorded". Leaving the app open past midnight during a live session keeps it live and dated D.
8. **Close it** asks the not-recorded question, then logs one `session_end`. Pressing it twice logs one.
9. While a session is open, the next session cannot be started; the card is shown first.
10. Add a missed session: the default date is yesterday; dates after today or before 14 Sep 2026 are refused. Adding a Day 1 session after a log ending on Day 2 pre-selects Day 1, previews "Your next session: Day 1 → Day 2", and once saved Today's next session is Day 2.
11. Adding on a date that already has a session offers **Add to that session**, and no duplicate is created unless **Add a separate session** is chosen.
12. **Remove this session** previews every knock-on; once saved the session is gone from History and the next session follows A.22.
13. No session logged before release 1.1 ever produces the unfinished-session card.
14. After Finish today: the status line reads "Done today", the finished session is one line that opens its record, and the next session is read-only with **Start it today**.
15. Weeks without sessions fold into one line between weeks with sessions; the current week with nothing logged reads "no sessions yet". Release 1 test 14's Block 2 doses render on a Block 2 session.
16. Export, then import, restores exactly, including inserted and removed sessions; the export lists them in plain words.
17. The full test suite passes, including every vector in the test vectors, with the ladder cases changed as in test 19. Phone-screen smoke tests cover Today (rest day, live, done today), a record, the Finish sheet, the unfinished card and Add a missed session.
18. (v1.3) Dumbbell load buttons stop at 2 and 40 kg; typing 42 or 0 is refused with "Your dumbbells run 2 to 40 kg."
19. (v1.3) A Day 1 session in programme week 9, 15 or 20 (the old ladder weeks) shows that block's normal reactive items, with the depth jump reading "Depth jump · 6 jumps · 51 cm box" in week 9, 9 jumps in week 15 and 12 in week 20. There is no ladder item and no height buttons. Test vector cases that expected `rsi_ladder` now expect the template's normal reactive items (for 21 Sep, `depth_jump` with 6 contacts; for 9 Nov, `depth_jump` and `depth_landing`).
20. (v1.3) Config v1.5 differs from v1.4 only in `trap_bar_kg_confirmed: true` and an empty ladder schedule; every other config value is unchanged.

## 14. Release 2: built for the gym floor

Unchanged from v1.1 except where marked v1.2.

1. **One block in focus.** The first block with anything not yet logged is open. A superset or contrast block opens as a whole, because its items alternate. Blocks already done collapse to one line per item, with Change. Later blocks are a short "Up next" list showing each item's plan. Tapping any block opens it.
2. **Set ticking.**
   - Each set is a tickable row, with the warm-up sets in one row. Ticking a set starts the rest timer.
   - Only the last set needs numbers: load, reps and reps left.
   - Earlier sets are assumed done as prescribed only when ticked. If any earlier set is unticked when the last set is logged, the app asks: "Set 2 isn't ticked. Was every earlier set done as prescribed?" with **All done** and **One fell short**. It never records "fell short" on its own, because that cuts the training max 2.5% (engine §2.6).
   - The "An earlier set fell short" checkbox is replaced by that question.
3. **Live preview while entering.** Before reps are entered, a primary lift shows the aim ("About 7 reps keeps your max where it is"). As reps and reps left are set, it shows what logging would do: "Max 96.9 → 98.1 kg · next heavy week 87.5 kg". The engine computes it without saving.
4. **Last time, like for like.** Shipped in release 1.
5. **Rest timer and session clock.**
   - The timer counts up from the last tick and shows on the open block and at the foot of the screen.
   - The programme sets no rest periods, so there is no default target. The athlete may pick one per exercise (1:30, 2:00, 3:00 or none), remembered on the phone; at the target the phone vibrates where the browser allows it.
   - The session clock runs from the session's start and is recorded at Finish.
   - The screen stays awake while a session is open, where the browser allows it.
   - A web app cannot show a lock-screen timer or reliable background alerts without a server; out of scope.
6. **Finish summary.** Finish opens a summary instead of the not-recorded sheet and the save-a-copy panel (v1.2: it absorbs §10's sheet):
   - session length;
   - anything planned but not logged, with **Log them** (back to the session) and **Skip the rest** (one skip each, no reason);
   - what moved, in plain words, compared with the start of the session (training maxes, loads, streaks);
   - what's next (each lift's next session and load);
   - the backup status, and a **Save a copy** button.
   The full save-a-copy panel opens by itself only when the automatic backup is off or failing. **Close it** (§9) opens the same summary.
7. **Light-week note.** The light-week card says "3 × 4 and stop. Light weeks don't change your max." (shipped in release 1). Logging more than 2 reps above the prescription on a light week adds one line to the outcome: "Light weeks are for recovery; extra reps here don't count towards your max." It never blocks logging.
8. **Contrast rounds (Block 2, from 9 November).**
   - A contrast block shows a grid: one row per round up to the top of the range ("Round 3 of 3–4"), one tick per item in the block.
   - Ticking an item in a round starts the rest timer.
   - Below the grid, each item logs once at the end: the heavy lift's last set (reps and reps left), the jump as done, and any item done inside the rests with its own last set.
   - The heavy lift's logged sets are the rounds ticked for it, so stopping at 3 or going to 4 is recorded as done.
9. **Tissue check-in (moved from release 3; engine A.29).**
   - On the first or second day after a session, Today shows the check-in as its attention card (v1.2: second in priority after an unfinished session, §3): "How do they feel today? For Tue 6 Oct's session."
   - **All clear** logs 0 for patellar, gluteal and left shoulder in one tap. **Something's sore** opens the three, each 0 to 10, and **Save**.
   - It is recorded only; no rule reads it.
   - Any score above 3 shows the athlete's flare protocol, word for word from the programme context transfer (v8, clinical register item 5).
   - For two days after a check-in, any site above 0 is shown as a tag on the items that load it, from the programme's site list ("Gluteal 2/10 yesterday"). The shoulder has no site list in the programme, so it shows on the card only.

## 15. Release 3: the season, visible

1. **Navigation.** Three tabs: Today, Plan, Progress. History stays on Today (§11).
2. **Plan.**
   - Weeks to the intensive, the programme week, and both training maxes with their change since the block began.
   - The blocks with dates and one line each.
   - The current block week by week: week type, the loads for each lift, and a tick for each logged session.
   - Future loads are labelled as assuming the maxes hold.
   - (v1.2: the calendar of past sessions is dropped; History serves it.)
3. **Progress.**
   - Each lift's training max over time, with its estimated max from each rep-out.
   - A shaded band about one rep either side (about 2.5% at these loads), so a single session's noise isn't read as change.
   - Accessory loads over time.
   - Jump test readings with their running average.
4. **Tissue check-in history.** The check-ins from release 2 shown over time beside the training they followed.
5. **Adherence, not overreach.** Prehab items done per week. No streak counters or celebrations on rep-outs.

## 16. Out of scope

- Server, accounts, analytics.
- Lock-screen widgets and push notifications.
- Any rule that reads the tissue check-in or the jump test.
- Changing a rule's numbers. That is an engine spec version.
- (v1.2) Date-by-date navigation, a calendar of dates, and previews of future dates.

## 17. Open questions for the athlete

None. All answered on 10 Oct 2026; recorded here so they are not asked again.

| Question | Answer | Where it now lives |
|---|---|---|
| Dumbbell range | 2 to 40 kg in 2 kg steps (given earlier; config v1.4 already held it) | Config `db_min_kg`, `db_max_kg`; §5.1 |
| Trap-bar weight | 24 kg, confirmed | Config v1.5 `trap_bar_kg_confirmed` |
| 29 Sep Romanian deadlift | Handled by the athlete in the app | The log |
| Depth jump box | One 51 cm box; no ladder (decided 21 Sep in the programme chat) | Stored depth-jump height; config v1.5 ladder schedule; §5.5 |

**For the programme chat, not the athlete:** Block 2's depth landings (from 9 Nov) are written as landings from above the depth-jump height, and there is only one box. That slot needs adapting at the 9 November block review.
