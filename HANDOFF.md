# HANDOFF — repo cleanup: human actions

Open this file after the cleanup pass. It lists everything the assistant
could not do itself (remote deletions, GitHub UI actions) and how to
verify the result. Nothing else in the repo needs your action.

## 1. Current state

**2026-11-05 GTFS refresh (pushed).** New static package Nov 1–Dec 26,
2026: timetable/pairs/stops/places/shapes rebuilt, street audit
re-measured (230/230), test fixtures re-pinned to Tue Nov 17 / Wed
Nov 18 (weekday schedule verified identical). Suite 32/32 daytime.
The `test_google13` evening note below now applies only after
Nov 17 (fixtures are future-dated to then).

Repo cleanup Commits 1–5 are done and the local tree is final: tests live
in `tests/node/` (32-file default suite, green) plus `tests/node/live/`
(live-network, excluded from the default suite), scripts live in
`scripts/` and `archive/scripts/`, data lives in `data/` and
`data/generated/`, one-off history lives in `archive/`, and a stale-root
guard (`npm run check`) fails if old root files reappear. The CI workflow
(`.github/workflows/test.yml`) is delivered in section 3a below but was
not pushed, and 51 stale root files still exist on GitHub because the
assistant's push tool cannot delete remote files — sections 2 and 3 below
are the complete human action list.
Note: the default suite is green during daytime service hours.
tests/node/test_google13.mjs has a pre-existing time-of-day
dependence (a past-date input is clamped to today+now, so evening
runs may find no departures); see §5.

## 2. Manual cleanup — delete 51 stale root files from GitHub

From a local clone, on `main`, after `git pull`, run this one command
from the repo root, then `git commit` and `git push`:

```
git rm test_boardclarity.mjs test_boarding.mjs test_branchmerge.mjs test_busicon.mjs test_catwalk.mjs test_google13.mjs test_header.mjs test_homefix.mjs test_languages.mjs test_languages22.mjs test_leglive.mjs test_mapstyle.mjs test_osmwalk.mjs test_p0.mjs test_p0b.mjs test_pwa.mjs test_saveui.mjs test_schools.mjs test_searchtime.mjs test_sort.mjs test_stage1.mjs test_stage2.mjs test_stage2_1.mjs test_stage3.mjs test_stationlist.mjs test_streetrule.mjs test_strip7col.mjs test_stripalign.mjs test_stripbranches.mjs test_timepicker.mjs test_uibatch.mjs test_weather.mjs test_rt.mjs test_phase13only.mjs apply_lang22.py apply_street_rule.py build_schools.py build_stage21.py derive_pairs.py derive_places.py derive_shapes.py derive_stops.py derive_timetable.py geocode_schools.py measure_street.py patch_stage2.py schools_list.py schools-geocoded.json schools-pending-decision.json street-audit.json stage2_block.txt
```

Notes: `build_lang22.py` is intentionally excluded — it still lives at
root by design (P3, see section 5). If `git rm` complains that a path is
already gone, your clone already had a partial cleanup: drop that path
from the command and continue. After this push, the remote tree matches
the local tree (except `test.yml`, which you add in section 3a).

## 3. GitHub UI actions

### a. Create `.github/workflows/test.yml`

Create this file via the GitHub web UI (the assistant cannot push
workflow files). It runs the default suite on push and pull requests to
`main`, with Node 22, the stale-root gate before the tests, and never
the live suite:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install dependencies
        run: if [ -f package-lock.json ]; then npm ci; else npm install; fi
      - name: Local stale-root gate
        run: npm run check
      - name: Run default test suite (not test:live)
        run: npm test
```

### b. Confirm `.github/workflows/pages.yml` is unaffected

Open `.github/workflows/pages.yml` and confirm it does not reference any
root-level `.py` or `.mjs` file. Expected: it only deploys `public/**`
(plus its own workflow path) and should be untouched by the cleanup.
A remote read during this pass found exactly that (checkout,
configure-pages, upload `public`, deploy-pages — no root script
references), but re-confirm visually while you are in the file list
adding `test.yml`.

## 4. Post-cleanup verification

After sections 2 and 3, from a fresh clone (or after `git pull`), run:

```
npm install && npm run check && npm test
```

Expected: `npm run check` prints
`PASS: no stale root files (no root .mjs, no moved .py, no moved root JSON).`
and `npm test` prints `tests 32, pass 32, fail 0`. (`npm install` may
create `package-lock.json` since the repo has zero dependencies;
committing it is optional — it only makes future CI runs take the
`npm ci` branch.)

If run in the evening, test_google13.mjs may fail with
`opts: null` — this is a known pre-existing time-dependent test,
not caused by the cleanup; see §5.

## 5. Known issues (non-blocking)

- tests/node/test_google13.mjs: the fixed 2026-10-27 08:10
  depart-mode case is time-of-day dependent. public/index.html
  setTimeMode bumps past dates to today and clamps past depart
  times to now, so evening runs can find no departures (opts null).
  Passes in daytime service hours. Fixing it means a test-design
  change (a future-date case plus a past-date-clamp case with
  assertions adjusted), not a logic change; deferred and tracked
  here, not fixed in this cleanup.
- `tests/node/test_stage3.mjs` skips its raw-GTFS shapes cross-check
  when no static package is on disk (prints a SKIP line, suite still
  passes). Set `OAKVILLE_GTFS_STATIC` to a GTFS static dir to enable it.
- `scripts/derive_shapes.py` `--static` and `scripts/derive_places.py`
  `SRC` still default to absolute `~/workspace/...` paths. Portable
  overrides exist: `OAKVILLE_GTFS_STATIC` and `OAKVILLE_RESEARCH_MD`
  (CLI flag wins over env var wins over absolute default). The absolute
  defaults are kept as fallback so the current author's workflow keeps
  working.
- `build_lang22.py` is not runnable as-is — the `/tmp/allpacks.json`
  intermediate is gone (its docstring says so); see section 6 before
  attempting to regenerate.
- Test merges deferred: the strip, language, and stage2 duplicate
  candidate groups from the audit were flagged only, never merged.
- Dated log sections in root `README.md` still use pre-cleanup paths
  (historical record); the `## Files` section is the current layout.
- CI uses Node 22 (section 3a). This resolves the Commit 5 watch-item:
  `test_schools.mjs` imports JSON with `with { type: "json" }`
  (import attributes, stabilized in Node 22).
- Until section 2 is done, the remote root still shows the 51 stale
  files. Harmless: Pages deploys `public/` only, and tests run from
  their new paths.

## 6. What was NOT done and why

- Remote deletions: the assistant's push tool creates/updates files
  only; it cannot delete. Section 2 is the human's `git rm`.
- CI workflow not pushed: the push tool is blocked from writing
  `.github/workflows/*` (403). Section 3a is a web-UI creation.
- Test merges: explicitly out of scope for the whole cleanup (audit
  said flag only, never merge).
- `build_lang22.py` regeneration: blocked — its `/tmp/allpacks.json`
  input has no producer anywhere in the repo, and the script's
  top-level input load is gone with it. Docstring updated to say so;
  logic untouched.
- Absolute derive defaults not removed: preserved as the last-resort
  fallback in the CLI > env > default order (see section 5).
- `pages.yml` content: verified by remote read during this pass (see
  section 3b), final visual confirmation left to the human.
- No changes to `public/` and no test-logic changes anywhere in this
  pass; only path resolution, docs, and the new `HANDOFF.md`.

## 7. Remote-vs-local drift report (verified 2026-10-30)

Method: direct remote reads compared by sha256 for the 6 byte-comparison
rows; direct remote reads for 4 stale spot checks (†); full 20-commit
`main` history reviewed — every commit is an addition (assistant pushes,
your `pages.yml` workflow commit, your icon uploads, initial commit) and
no deletion commit exists, so everything pushed initially is still on
the remote. Result: no surprises. The only remote-only files are the 51
stale root paths (section 2) plus `pages.yml`; the only file absent on
both sides is `test.yml` (section 3a).

| file | on local | on remote | notes |
|---|---|---|---|
| test_boardclarity.mjs | absent | present | stale; §2 |
| test_boarding.mjs | absent | present | stale; §2 |
| test_branchmerge.mjs | absent | present | stale; §2 |
| test_busicon.mjs | absent | present | stale; §2 |
| test_catwalk.mjs | absent | present | stale; §2 |
| test_google13.mjs | absent | present | stale; §2 |
| test_header.mjs | absent | present | stale; §2 |
| test_homefix.mjs | absent | present | stale; §2 |
| test_languages.mjs | absent | present | stale; §2 |
| test_languages22.mjs | absent | present | stale; §2 |
| test_leglive.mjs | absent | present | stale; §2 |
| test_mapstyle.mjs | absent | present | stale; §2 |
| test_osmwalk.mjs | absent | present | stale; §2 |
| test_p0.mjs | absent | present | stale; §2 |
| test_p0b.mjs | absent | present | stale; §2 |
| test_pwa.mjs | absent | present | stale; §2 |
| test_saveui.mjs | absent | present | stale; §2 |
| test_schools.mjs | absent | present | stale; §2 |
| test_searchtime.mjs | absent | present | stale; §2 |
| test_sort.mjs | absent | present | stale; §2 |
| test_stage1.mjs | absent | present | stale; §2 |
| test_stage2.mjs | absent | present | stale; §2 |
| test_stage2_1.mjs | absent | present | stale; §2 |
| test_stage3.mjs | absent | present | stale; §2 |
| test_stationlist.mjs | absent | present | stale; §2 |
| test_streetrule.mjs | absent | present | stale; §2 |
| test_strip7col.mjs | absent | present | stale; §2 |
| test_stripalign.mjs | absent | present | stale; §2 |
| test_stripbranches.mjs | absent | present | stale; §2 |
| test_timepicker.mjs | absent | present | stale; §2 |
| test_uibatch.mjs | absent | present | stale; §2 |
| test_weather.mjs | absent | present | stale; §2 † |
| test_rt.mjs | absent | present | stale; §2 |
| test_phase13only.mjs | absent | present | stale; §2 |
| apply_lang22.py | absent | present | stale; §2 |
| apply_street_rule.py | absent | present | stale; §2 |
| build_schools.py | absent | present | stale; §2 |
| build_stage21.py | absent | present | stale; §2 |
| derive_pairs.py | absent | present | stale; §2 † |
| derive_places.py | absent | present | stale; §2 |
| derive_shapes.py | absent | present | stale; §2 |
| derive_stops.py | absent | present | stale; §2 |
| derive_timetable.py | absent | present | stale; §2 |
| geocode_schools.py | absent | present | stale; §2 |
| measure_street.py | absent | present | stale; §2 |
| patch_stage2.py | absent | present | stale; §2 |
| schools_list.py | absent | present | stale; §2 |
| schools-geocoded.json | absent | present | stale; §2 † |
| schools-pending-decision.json | absent | present | stale; §2 |
| street-audit.json | absent | present | stale; §2 |
| stage2_block.txt | absent | present | stale; §2 † |
| package.json | present | present | byte-identical (sha 59e6140ed06fdd0c) |
| README.md | present | present | byte-identical (sha e16da07cbf1c857f) |
| .gitignore | present | present | byte-identical (sha 3037927ad0e42d89) |
| .github/workflows/pages.yml | absent (no local .github/) | present | no root .py/.mjs refs (remote read); §3b |
| .github/workflows/test.yml | absent | absent | to be created by human (§3a) |
| tests/node/test_schools.mjs | present | present | byte-identical (sha c67d7a49e8982206) |
| tests/node/test_stage3.mjs | present | present | byte-identical, Commit B version (sha 790cc3fffe407f04) |
| scripts/check_stale_root.mjs | present | present | byte-identical (sha e6eb0cb6ddf75cc1) |

† = spot-verified by direct remote read; all other stale rows follow
from the push history (pushed initially, never deleted).
