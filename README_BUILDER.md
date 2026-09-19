# Acro Base S&C training app — repo starter

Unzip the contents of this folder into an empty git repo. Then open Claude Code in that folder.

- `CLAUDE.md` — standing rules for every session. Claude Code reads it automatically.
- `spec/` — read-only contracts. Never edited by the builder.
  - `engine_spec_v1_3.md` — the rules, with Appendix A removing ambiguity
  - `engine_test_vectors_v1.json` — the acceptance contract; numbers here beat prose
  - `programme_config_v1.json` — every session template, slot class, increment, date
  - `initial_state_v1.json` — starting state, 19 Sep 2026
  - `training_log_2026_w01_w02_r3.md` — the golden session for phase 3
  - `app_build_plan_v1.md` — phases and gates, for reference
- `SPEC_QUESTIONS.md` — the builder appends questions here instead of guessing.

Make `spec/` read-only after unzipping: `chmod -R a-w spec`
