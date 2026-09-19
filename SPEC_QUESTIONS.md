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
- **Ruling:** (orchestrator) 
- **Spec revision:** (orchestrator) 
