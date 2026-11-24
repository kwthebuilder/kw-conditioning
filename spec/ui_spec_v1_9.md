# Interface Specification v1.9

**Version 1.9 | 24 November 2026 | Supersedes v1.8.** Everything in v1.8 stands, with §35 below added; read "config v1.10" and "config v1.11" as "config v1.12" and "engine spec v1.11" as "engine spec v1.12".

**v1.9 change note: release 3.6, B weeks in Block 2 (athlete-approved 24 Nov 2026, design rationale v3.9, SPEC_QUESTIONS Q64).**

## 35. B weeks (v1.9)

- **Where.** Programme weeks 12 and 14 (from Mon 30 Nov and Mon 14 Dec 2026), Block 2 only. Other weeks read exactly as before.
- **Main lifts.** The prescription line reads 3 × 3 at the lighter load and "% of max" follows it. The item note reads "B week: triples instead of doubles, a little lighter, worked out to the same effort. Doubles come back next week." The effort line is `text.triples` in place of `text.doubles`.
- **Weighted pull-up.** The variant "neutral grip" shows beside the load, and the note says to log it in the same slot.
- **Overhead carry and row.** The note names the B-week exercise and says to log it with "Swapped to…". The row's swap list offers "Split-stance one-arm cable row"; the carry's already offers "Front-rack carry".
- **Words.** Notes and the triples line come from the config, shown as written (A.39). No new controls.
- **Test.** `e2e/release36.e2e.ts`.
