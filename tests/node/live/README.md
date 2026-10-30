# tests/node/live/ — live-network tests (excluded from npm test)

- test_rt.mjs — the Worker's protobuf parser against the live Oakville
  GTFS-RT feeds, plus the RT↔static join check. It fails offline, in
  sandboxed VMs without egress, and at night when no service runs —
  that is expected, not a regression. Run separately:
  npm run test:live (or node tests/node/live/test_rt.mjs).
