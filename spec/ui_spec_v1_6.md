# Interface Specification v1.6

**Version 1.6 | 7 November 2026 | Supersedes v1.5.** Everything in v1.5 stands except §28 below; read "config v1.7" as "config v1.8". Engine spec v1.10 is unchanged: every line here is display text (engine A.39).

**v1.6 change note: release 3.2, the short-session list (athlete-approved 7 Nov 2026, design rationale v3.5).**

## 28. Running-long note and the short-session list (v1.6)

Under each session's time line, the note block shows:

1. The running-long line for that day: config `text.session_note_day1` or `text.session_note_day2`, falling back to `text.session_note`.
   - Day 1: "Running long? First drop the upper pair to 2 rounds, then leave it out. Never cut the jumps, the front squat or the Romanian deadlift."
   - Day 2: unchanged from v1.4.
2. The short-session line for that day (`text.short_day1`, `text.short_day2`), on every session except the taper:
   - Day 1: "Only 45 to 50 minutes? Keep the jump test, drop jumps, trap-bar jumps, front squat and dumbbell Romanian deadlift. Everything else goes this time; skip it with Time as the reason."
   - Day 2: "Only 45 to 50 minutes? Keep the jump shrug and landmine clean and push press at 2 sets each, the deadlift, and the split squat with the seated abduction. The carry and row go this time; skip them with Time as the reason."

Nothing is cut automatically; the athlete decides on the day and records it with Skip (reason Time) or Swapped to….

Acceptance: `e2e/release31.e2e.ts` §28 test (both days, absent in the taper) and the updated running-long test in `e2e/release3.e2e.ts`; unit tests read config v1.8 and vectors v1.8 (v1.7 with the version and `pinned.default` moved to config v1.8, nothing else changed).
