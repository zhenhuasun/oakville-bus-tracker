#!/usr/bin/env python3
"""Apply the 22-language expansion to public/index.html (no deploy).

Edits, all exact-string anchored (fails loudly if an anchor is absent or
ambiguous):
1. LANG_NAMES line -> final 22-language order, zh renamed to 简体中文.
2. LANG_EXAMPLE line -> final order + 7 new examples.
3. RTL test (ar/ur) -> add fa.
4. Onboarding arrays (title list + button list, 2 occurrences) -> final order.
5. translateAlert maps (detourWord, route-detour summary, closed, detour-via)
   -> append the 7 new languages.
6. Insert the consolidated I18N_LANG22 / CAT22 / DEST22 block right after
   `Object.assign(CAT_LABEL, CAT2);` (after all ADD merges, so the new
   packs need no per-block edits). Existing 15 packs are not touched.
"""
import json, re, sys

ORDER = ["en", "fr", "zh", "ar", "es", "ur", "pt", "pl", "it", "pa", "ko",
         "hi", "tl", "hr", "ru", "zh-Hant", "fa", "sr", "de", "ro", "uk", "ja"]
ALL = json.load(open("/tmp/allpacks.json"))
NAMES = dict(ALL["names"]); EXAMPLES = dict(ALL["examples"])
NAMES["zh"] = "简体中文"
NAMES.update({"tl": "Tagalog", "hr": "Hrvatski", "fa": "فارسی", "sr": "Srpski",
              "de": "Deutsch", "ro": "Română", "zh-Hant": "Traditional Chinese / 繁體中文"})
EXAMPLES.update({"tl": "Susunod na bus sa loob ng 5 minuto",
                 "hr": "Sljedeći autobus za 5 minuta",
                 "fa": "اتوبوس بعدی تا ۵ دقیقه دیگر",
                 "sr": "Sledeći autobus za 5 minuta",
                 "de": "Nächster Bus in 5 Minuten",
                 "ro": "Următorul autobuz în 5 minute",
                 "zh-Hant": "下一班車還有 5 分鐘"})
# zh-Hant example must equal the converted zh example from the draft
draft_hant = json.load(open("lang-drafts/zh-Hant.json"))
EXAMPLES["zh-Hant"] = draft_hant["lang_example"]

def js_map(d, order):
    return "{" + ", ".join(
        (f"{k}:{json.dumps(d[k], ensure_ascii=False)}" if "-" not in k
         else f"{json.dumps(k)}:{json.dumps(d[k], ensure_ascii=False)}")
        for k in order) + "}"

path = "public/index.html"
html = open(path, encoding="utf-8").read()
orig = html

def rep_once(old, new, label):
    global html
    n = html.count(old)
    assert n == 1, f"{label}: anchor found {n} times, expected 1"
    html = html.replace(old, new)

def rep_all(old, new, label, expect):
    global html
    n = html.count(old)
    assert n == expect, f"{label}: anchor found {n} times, expected {expect}"
    html = html.replace(old, new)

# 1. LANG_NAMES (single line, whole-line replace)
m = re.search(r"const LANG_NAMES = \{[^}]*\};", html)
assert m, "LANG_NAMES line not found"
html = html[:m.start()] + "const LANG_NAMES = " + js_map(NAMES, ORDER) + ";" + html[m.end():]
# 2. LANG_EXAMPLE (single line)
m = re.search(r"const LANG_EXAMPLE = \{[^}]*\};", html)
assert m, "LANG_EXAMPLE line not found"
html = html[:m.start()] + "const LANG_EXAMPLE = " + js_map(EXAMPLES, ORDER) + ";" + html[m.end():]
# 3. RTL
rep_once('(lang === "ar" || lang === "ur")',
          '(lang === "ar" || lang === "ur" || lang === "fa")', "RTL test")
# 4. Onboarding arrays (2 occurrences, identical literal)
old_arr = '["en","fr","zh","ar","hi","es","pt","pa","ur","pl","it","uk","ru","ko","ja"]'
new_arr = json.dumps(ORDER, ensure_ascii=False, separators=(",", ":"))
rep_all(old_arr, new_arr, "onboarding arrays", 2)
# 5a. detourWord map
rep_once('ja:"迂回" }[lang]',
         'ja:"迂回", tl:"lihis", hr:"obilazak", fa:"انحراف", sr:"obilazak", de:"Umleitung", ro:"ocolire", "zh-Hant":"改道" }[lang]',
         "detourWord")
# 5b. route-detour summary map
rep_once('ja:`${r}路線 迂回` }[lang]',
         'ja:`${r}路線 迂回`, tl:`Lihis ng ruta ${r}`, hr:`Obilazak linije ${r}`, fa:`انحراف مسیر ${r}`, sr:`Obilazak linije ${r}`, de:`Umleitung der Linie ${r}`, ro:`Ocolirea liniei ${r}`, "zh-Hant":`${r}路改道` }[lang]',
         "routeDetour summary")
# 5c. closed map
rep_once('ja:`${street}は${a}と${b}の間で閉鎖されています。${r}路線は${detour}経由で迂回します（両方向）。` }[lang]',
         'ja:`${street}は${a}と${b}の間で閉鎖されています。${r}路線は${detour}経由で迂回します（両方向）。`, tl:`${street} sarado sa pagitan ng ${a} at ${b}. Lihis ng ruta ${r} sa ${detour} (sa parehong direksyon).`, hr:`${street} zatvorena između ${a} i ${b}. Obilazak linije ${r} preko ${detour} (u oba smjera).`, fa:`${street} بین ${a} و ${b} بسته است. انحراف مسیر ${r} از طریق ${detour} (در هر دو جهت).`, sr:`${street} zatvorena između ${a} i ${b}. Obilazak linije ${r} preko ${detour} (u oba smera).`, de:`${street} gesperrt zwischen ${a} und ${b}. Umleitung der Linie ${r} über ${detour} (in beide Richtungen).`, ro:`${street} închisă între ${a} și ${b}. Ocolirea liniei ${r} prin ${detour} (în ambele sensuri).`, "zh-Hant":`${street}在${a}和${b}之間封閉，${r}路改道走${detour}（雙向）。` }[lang]',
         "closed map")
# 5d. detour-via map
rep_once('ja:`${r}路線は${det[1]}経由で迂回します。` }[lang]',
         'ja:`${r}路線は${det[1]}経由で迂回します。`, tl:`Lihis ng ruta ${r} sa ${det[1]}.`, hr:`Obilazak linije ${r} preko ${det[1]}.`, fa:`انحراف مسیر ${r} از طریق ${det[1]}.`, sr:`Obilazak linije ${r} preko ${det[1]}.`, de:`Umleitung der Linie ${r} über ${det[1]}.`, ro:`Ocolirea liniei ${r} prin ${det[1]}.`, "zh-Hant":`${r}路改道走${det[1]}。` }[lang]',
         "detourVia map")
# 6. Consolidated block after CAT2 merge
snippet = open("/tmp/lang22_snippet.js", encoding="utf-8").read()
i18n_block = snippet.split("const CAT22")[0].strip()
cat_block = "const CAT22" + snippet.split("const CAT22", 1)[1].split("const DEST22")[0].rstrip()
dest_block = "const DEST22" + snippet.split("const DEST22", 1)[1].split("const LANG22_NAMES")[0].rstrip()
block = """
// Language expansion 2026-10-29 (22 languages, DRAFT translations):
// order = 2021 Census Oakville mother tongue, English/French first;
// uk (<1,000) and ja (smallest) are estimates, not census top-list values.
// 'zh' code unchanged (LANG_NAMES.zh renamed to Simplified Chinese only);
// 'zh-Hant' is a separate pack converted from zh via zhconv (draft).
// Serbian is Latin script (sr). Persian (fa) is RTL like ar/ur.
""" + i18n_block + """
for (const l of Object.keys(I18N_LANG22)) I18N[l] = I18N_LANG22[l];
""" + cat_block + """
for (const l of Object.keys(CAT22)) for (const c of Object.keys(CAT22[l])) CAT_LABEL[c][l] = CAT22[l][c];
""" + dest_block + """
for (const l of Object.keys(DEST22)) for (const d of Object.keys(DEST22[l])) DEST_LABEL[d][l] = DEST22[l][d];
"""
rep_once("Object.assign(CAT_LABEL, CAT2);",
          "Object.assign(CAT_LABEL, CAT2);\n" + block, "CAT2 merge anchor")

open(path, "w", encoding="utf-8").write(html)
print(f"OK: index.html {len(orig)} -> {len(html)} bytes")
