# tests/ — automatable regression tests

- node/ — Node regression gates (see node/README.md). Default suite:
  npm test. No browser, no live network.
- node/live/ — tests that need the live GTFS-RT feeds
  (see node/live/README.md). Excluded from npm test; run with
  npm run test:live.
- e2e/ — reserved for Playwright/Puppeteer tests. None exist yet;
  no browser automation is used anywhere in this repo.

Archived one-off verifications live in archive/tests/ and are NOT
run by CI or npm test.
