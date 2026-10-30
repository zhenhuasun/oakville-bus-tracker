# archive/scripts/ — one-off apply / patch scripts (already applied)

Do not re-run these: their inputs are gone or their anchors no
longer exist in public/index.html, so they fail loudly by design.

- apply_street_rule.py — applied data/generated/street-audit.json
  distances into public/places.json (positional index match). Kept
  as the record of that mapping.
- apply_lang22.py — applied the 22-language snippet into
  public/index.html. Its /tmp inputs are gone.
- patch_stage2.py — anchor-based Stage-2 edits to public/index.html
  (transfer dot, journeyAlts container). The record of what Stage 2
  changed; the standalone Stage-2 code fragment is in
  archive/stage2_block.txt.
