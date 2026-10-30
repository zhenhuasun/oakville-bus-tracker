# archive/scripts/ — one-off apply / patch scripts (already applied)

DO NOT RE-RUN these. All three have __main__ guards now, so
importing them is safe — but running any of them writes to
public/index.html or public/places.json, and their inputs are gone:

- apply_street_rule.py — applied data/generated/street-audit.json
  distances into public/places.json (positional index match).
  Paths are ROOT-based (works from anywhere). Kept as the record
  of that mapping. Moved here in Commit 3.
- apply_lang22.py — applied the 22-language snippet into
  public/index.html. Its inputs are gone: /tmp/allpacks.json and
  /tmp/lang22_snippet.js no longer exist. Its paths
  (public/index.html, lang-drafts/...) are repo-root-relative:
  it only ever worked when run from the repo root. Moved here in
  Commit 3.
- patch_stage2.py — anchor-based Stage-2 edits to public/index.html
  (transfer dot, journeyAlts container). Fails loudly if an anchor
  is absent, and the current index.html has moved far past Stage 2.
  Its path (public/index.html) is repo-root-relative. The record of
  what Stage 2 changed; the standalone Stage-2 code fragment is in
  archive/stage2_block.txt (arrives in Commit 5). Moved here in
  Commit 3.
