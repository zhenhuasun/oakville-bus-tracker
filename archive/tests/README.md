# archive/tests/ — superseded / dormant verification harnesses

- test_phase13only.mjs — Phase 1+3-only guard. It self-skips with
  exit 0 because Phase 2 (routed-foot walking) was re-enabled; its
  assertions no longer execute. Kept as the record of the fallback
  option. Un-skip it only if STREET_WALK_ENABLED ever flips back
  to false. Do not add to any suite.
