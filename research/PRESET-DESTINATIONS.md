# Oakville 预设目的地清单（已核实，2026-10-27）

用途：新移民本地公交 Tracker 的预设目的地库。只列工具或官方名单查到的名字和地址；未核实、已关闭、镇界外的单独标注，不混进正式清单。
范围：Oakville 镇界内为主；镇界外、即将开业、未核实项见各节末尾的标注。
下一步（原型阶段，非本清单）：把每处映射到最近的 Oakville Transit 站牌，再进原型；本清单先锁定“去哪”，不停靠映射不硬编。

## 汇总

- 超市：18 家已核实中大型超市（另有 2 家即将开业，不计入）
- 购物中心：4 处镇内 mall 级预设（仅 Oakville Place 为室内 mall）
- 宗教场所：基督教堂、天主教、圣公会、联合教会、长老会、东正教、清真寺、印度教寺庙均有镇内清单；佛教镇内无已核实大型寺庙
- 学校：74 所（公立 35、天主教 20、法语公立 3、法语天主教 2、私立知名子集 14，非私立全量）
- 大卖场：镇内 21 处（Home Depot 3、Best Buy 1、Canadian Tire 3、RONA 1，另有 Winners/HomeSense、Marshalls、Sport Chek、Mark's、Staples、Michaels、PetSmart）
- 镇界外，Oakville Transit 直达：6 处确定（Mississauga：Costco Laird Rd、T&T Erin Mills、Metro Clarkson Crossings；Burlington：Farm Boy、Longo's、Fortinos，均经 5 路等跨界线），另 Food Basics Clarkson Village 因最近站约 600 m 待定；South Common 用户 2026-10-27 决定直接排除，不标注
- 银行（用户 2026-10-27 新增）：镇内实体分行 42 家（RBC 9、TD 12、Scotiabank 7、BMO 6、CIBC 5、National Bank 1、FirstOntario 2），另 CIBC 咨询中心 3 处单列；ATM、店内柜台、财富办公室不计入
- 医院与化验机构（用户 2026-10-27 新增）：医院 1 家（Oakville Trafalgar Memorial Hospital）；化验点 8 家（LifeLabs 5、Dynacare 3）
- 亚洲超市（用户 2026-10-27 新增）：镇内已开业 4 家（Galleria、Iqbal Foods Oakville、Spice Bazaar、Bombay Grocers），Nations 即将开业 1 家（2027 年计划），边境直达 T&T Erin Mills 1 家（Mississauga，2026 年 4 月 9 日开业）；Famijoy 已关闭、原址先为 United Supermarket、现为 Iqbal Foods Oakville（2026 年 10 月 15 日开业），不再按旧名列
- 药房（用户 2026-10-27 新增）：独立药房 19 家（Shoppers 11、Rexall 2、Guardian/IDA 5、Medicine Shoppe 1）；超市内药房柜台不计入
- 标注规则：镇内 / 镇界外直达 / 仅换乘可达三档分开；仅换乘可达的不进预设。跨界路线以当前静态包（至 2026-10-31）核实，新包发布后须复查。

---
## 1. 超市（18 家已核实）
# Oakville 主要中大型超市清单（仅 Oakville 镇界内，2026-10-27 核实）

来源：公开搜索 + Places 工具按 place_id 核实（核实项均显示未永久/临时关闭；搜索结果另标 Active / Open Now）。
坐标只写工具返回过的；未返回坐标的标注“坐标未由工具返回”，不凭空补写。
超市名、地址均按工具返回原文；街区/商场名只写来源中出现过的。

## 已核实、在营（18 家）

### Fortinos（2 家）
1. Fortinos — 173 Lakeshore Rd W, Oakville, ON L6K 1E7 — 43.437927, -79.677323
2. Fortinos Oakville Neyagawa — 493 Dundas St W, Oakville, ON L6M 1L9 — 43.467236, -79.745403
   （Dundas & Neyagawa 一带；注意：个别目录把 173 Lakeshore 这家误标为 Loblaws，同一地址，不要重复计数。）

### Longo's（3 家）
3. Longo's — 469 Cornwall Rd, Oakville, ON L6J 7S8 — 43.462009, -79.674930
4. Longo's — 3455 Wyecroft Rd, Oakville, ON L6L 0B6 — 43.398073, -79.747096
   （RioCan Centre Burloak 一带；个别目录写作 3509 Wyecroft Rd，疑为同一商场的不同门牌写法，以 Places 核实的 3455 为准。）
5. Longo's — 338 Dundas St E, Oakville, ON L6H 6Z9 — 43.4883376, -79.7175689
   （2026-10-29 经 Nominatim 核实：OSM way 27500951，Longo's, 338, Dundas Street East, Trafalgar, Oakville, L6H 6Z9。此前 build_stage21.py 的 43.453, -79.696 为占位坐标（曾导致误映射到 Kerr St 车站），已更正。最近车站：Trafalgar + Dundas（stop 1657，code 2109，routes 1/37），直线 151 m，路网步行 336 m。）

### Metro（3 家）
6. Metro — 1521 Rebecca St, Oakville, ON L6L 1Z8 — 43.412131, -79.707403
   （Hopedale Mall / South Oakville Centre 一带）
7. Metro — 1011 Upper Middle Rd E, Oakville, ON L6H 4L4 — 43.483487, -79.694896
8. Metro — 280 North Service Rd W #1A, Oakville, ON L6M 3E6 — 43.447307, -79.705502
   （Dorval 一带）

### Sobeys（1 家）
9. Sobeys Glen Abbey — 1500 Upper Middle Rd W, Oakville, ON L6M 3G3 — 43.437968, -79.741177
   （Glen Abbey 一带；搜索中出现的两个 place_id 指向同一地址，是同一家店的重复记录。）

### Real Canadian Superstore（1 家，Loblaw 旗下）
10. Real Canadian Superstore — 201 Oak Park Blvd, Oakville, ON L6H 6M3 — 坐标未由工具返回
    （Uptown Core 一带，近 Uptown Core Terminal；本次搜索未返回其 place_id，故无工具坐标。）

### No Frills（1 家已核实）
11. Oleg's No Frills — 1395 Abbeywood Dr, Oakville, ON L6M 3B2 — 43.431694, -79.726328

### Food Basics（1 家）
12. Food Basics — 530 Kerr St, Oakville, ON L6K 3C7 — 43.446290, -79.688374

### FreshCo（1 家）
13. FreshCo — 2501 Third Line, Oakville, ON L6M 5A9 — 43.449437, -79.757902
    （Third Line & Dundas 一带）

### Walmart Supercentre（2 家）
14. Walmart Supercentre — 234 Hays Blvd, Oakville, ON L6H 6M4 — 43.483385, -79.718278
    （Uptown Core / Hays Blvd 一带）
15. Walmart Supercentre — 1455 Rebecca St, Oakville, ON L6L 1Z8 — 43.413795, -79.705538
    （South Oakville Centre；2025 年 10 月 9 日开业的 Oakville 第二家 Walmart。个别报道写作 1515 Rebecca St，疑为同一商场门牌写法，以 Places 核实的 1455 为准。）

### Farm Boy（1 家）
16. Farm Boy — 1907 Ironoak Wy, Oakville, ON L6H 0N1 — 43.492474, -79.680179
    （Oakwoods 店）

### 大型亚洲超市（2 家，已核实）
17. Galleria Supermarket（韩国超市）— 2501 Hampshire Gate, Oakville, ON L6H 6C8 — 43.520199, -79.682219
18. Iqbal Foods Oakville — 125 Cross Ave Unit C2, Oakville, ON L6J 2W8 — 43.455464, -79.687120 (South Asian / Middle Eastern, halal; grand opening Oct 15, 2026; replaces United Supermarket at the same unit)
    （Trafalgar Village；自述营业面积 35,000 平方英尺。）

## 不在本次在营清单内、但容易误算的

- **Costco（即将开业，不在营）**：3471 Wyecroft Rd, Oakville（RioCan Centre Burloak 一带），在建，预计 2027 年秋季开业。这是 Oakville 第一家 Costco；目前最近的 Costco 在 Burlington（1225 Brant St）和 Mississauga，均在镇界外。
- **Nations Experience（即将开业，不在营）**：240 Leighland Ave, Oakville, ON L6H 3H6 — 43.461839, -79.686985（Oakville Place 内原 Hudson's Bay 位置），约 120,000 平方英尺，计划 2027 年开业，2026 年底开工。Places 记录存在但属“COMING SOON”，不要当作已开业超市。
- **T&T（镇界外）**：Oakville 镇内没有 T&T。最接近的新店在 Mississauga Erin Mills（3055 Vega Blvd），按 2025 年 4 月公告计划 2026 年夏季开业、定位服务 Oakville 社区，但地址在 Mississauga，不计入本清单。
- **Loblaws 招牌（镇内无独立门店）**：未核实到以 Loblaws 为招牌的 Oakville 门店。Loblaw 集团在镇内的招牌是 Fortinos、No Frills、Real Canadian Superstore；目录中 173 Lakeshore Rd W 的“Loblaws”与 Fortinos 同址，属误标，不要重复计数。
- **Metro South Oakville Centre 1515 Rebecca St（疑为重复记录，不单独计数）**：个别目录列出该地址的 Metro，但与已核实的 1521 Rebecca St（Hopedale Mall / South Oakville Centre）为同一商场区域，未见独立 place_id 或独立门店证据，暂按同一家处理。

## 未核实、未计入（需进一步核实，不要直接采用）

- **Colangelo's No Frills — 125 Cross Ave Unit 1, Oakville, ON L6J 2W8**：旧目录（YellowPages、FindOpen）仍列出，但 No Frills 官网店铺搜索本次只返回 Oleg's 一家；同一商场（Trafalgar Village）现已有 Iqbal Foods Oakville（Unit C2，原 United Supermarket 位置）。无法确认 Colangelo's 是否仍在营、已关闭或已被取代——建议以 No Frills 官网或实地为准，不要直接采用。
- **Btrust Supermarket — 2291 Winston Park Dr, Oakville**：仅见于企业名录类来源，无 place_id、无营业状态核实；该品牌总部在 Mississauga，无法确认该地址门店规模与在营状态，未计入。
- **Famijoy（Trafalgar Village, 125 Cross Ave）**：商场业态列表中出现，属亚洲食品超市，但未核实到面积与独立门店规模，按“小型/特色店”暂不计入。
- **第二家 Sobeys、第二家 Food Basics、第二家 FreshCo**：本次搜索未核实到 Oakville 镇内第二家；Uber Eats 出现的“Sobeys (Maple Grove)”未见独立地址证据，暂按 Glen Abbey 一家处理。
- **Longo's Dundas 店、Real Canadian Superstore 的坐标**：地址已多源核实，但本次未拿到 place_id，故无工具坐标；接入产品前需补一次坐标核实。

---
## 2. 购物中心
# Shopping malls — subagent result 2026-10-27 (to be compiled, not yet user-delivered)

- No current place called "Oakville Mall" — Oakville enclosed mall is Oakville Place.

Oakville mall-scale presets:
1. Oakville Place — ENCLOSED — 240 Leighland Ave, Oakville, ON L6H 3H6 — 43.461647, -79.686891 — active, ~100 stores, RioCan, only major indoor mall in Oakville.
2. SmartCentres South Oakville Centre (formerly Hopedale Mall — list once, current name only) — OPEN-AIR plaza — 1515 Rebecca St, Oakville, ON L6L 5G8 — 43.413431, -79.705670 — active, strip-format.
3. RioCan Centre Burloak — OPEN-AIR plaza — 3527 Wyecroft Rd, Oakville, ON L6L 0B6 — 43.397930, -79.749352 — active; unit addresses in same complex vary (3499/3509/3543 Wyecroft).
4. Upper Oakville Shopping Centre — OPEN-AIR plaza — 1011 Upper Middle Rd E, Oakville, ON L6H 4L2 — 43.483069, -79.695000 — active, ~50 stores since 1986.

Smaller optional plazas (format not confirmed, do not label enclosed):
- Trafalgar Village — 125 Cross Ave, Oakville, ON L6J 2W8 — 43.455661, -79.687171
- Maple Grove Village — 511 Maple Grove Dr, Oakville, ON L6J 7S2 — 43.480194, -79.656216
- Dorval Crossing West — 320 North Service Rd W #270, Oakville, ON L6M 2R7 — 43.445160, -79.703905
- Oakville Entertainment Centrum — 2075 Winston Park Dr, Oakville, ON L6H 6P5 — 43.511055, -79.668754 — entertainment-led, not general shopping preset.

Excluded:
- Bronte Village Mall, 2441 Lakeshore Rd W, Oakville — places record is_permanently_closed: true, site redeveloped — EXCLUDE.
- "Oakville Mall" — no such current place.

---
## 3. 宗教场所
# Religious places — subagent result 2026-10-27 (to be compiled, not yet user-delivered)

Scope: Oakville only, major places only. None Places-verified was flagged permanently/temporarily closed (time-of-day CLOSED is not a closure).

## Christian — Catholic (Places-verified, with coords)
- St. Andrew's Catholic Church — 47 Reynolds St — 43.447148, -79.663375
- St. Michael's Roman Catholic Church — 181 Sewell Dr — 43.463316, -79.694621
- St. James Roman Catholic Church — 231 Morden Rd — 43.435987, -79.687161
- St. Joseph's Portuguese Roman Catholic Church — 2451 Old Bronte Rd — 43.433947, -79.773321
- Holy Trinity Croatian Catholic Parish — 2110 Trafalgar Rd — 43.477155, -79.705906
- St. Joseph's Ukrainian Catholic Church — 300 River Oaks Blvd E — 43.476859, -79.705434

## Catholic — web/directory only, no Places coords
- St. Dominic Parish — 2415 Rebecca St
- St. Matthew Parish — 1150 Monks Passage
- Mary Mother of God Parish — 2745 North Ridge Trail
- St. Anthony (Polish) Parish — 40 John St

## Anglican (Places-verified)
- Church of the Incarnation — 1240 Old Abbey Ln — 43.447750, -79.713513
- St Aidans Anglican Church — 318 Queen Mary Dr — 43.446516, -79.680093
- St. Simon's Anglican Church — 1450 Litchfield Rd — 43.473637, -79.698862
- St. Jude's Anglican Church — 160 William St — 43.443578, -79.667283
- St. Cuthbert's Anglican Church — 1541 Oakhill Dr — 43.471904, -79.648375
- Church of the Epiphany — 141 Bronte Rd — 43.394995, -79.713950
- St. Luke's Community Centre (Anglican) — 3114 Dundas St W — 43.432321, -79.779540

## United Church of Canada (Places-verified)
- Glen Abbey United Church — 1469 Nottinghill Gate — 43.445705, -79.731825
- Maple Grove United Church — 346 Maple Grove Dr — 43.474474, -79.652442
- Munn's United Church — 5 Dundas St E — 43.479706, -79.729096
## United — web only
- St. John's United Church — 262 Randall St
- Trinity United Church — 1250 McCraney St E
- Palermo United Church — 2521 Dundas St W
- Walton Memorial United Church — 2489 Lakeshore Rd W

## Presbyterian (Places-verified unless noted)
- Knox Presbyterian Church, Downtown — 89 Dunn St — 43.446365, -79.666609
- Knox Presbyterian Church, Sixteen — 1150 Dundas St W — 43.460429, -79.748941
- Knox Oakville, Bronte campus (formerly Hopedale Presbyterian, amalgamated into Knox 2026-01-01) — 156 Third Line — web only

## Orthodox
- St Peter and St Paul Coptic Orthodox Church — 1177 Invicta Dr — 43.475821, -79.676580 (Places)
- Saint Volodymyr Cultural Centre (UOCC) / All Saints of Ukraine Chapel — 1280 Dundas St W — 43.45598, -79.75266 (MapCarta coords, not Places)
- No Greek Orthodox church verified inside Oakville — do NOT list one without fresh check.

## Do NOT use without re-check
- St. Paul's United Church, 454 Rebecca St — premises sold to St Peter and St Paul Coptic Orthodox per its 2025 annual report; new space mentioned at 1092 Speers Rd, which is also Sanatan Mandir address — current worship address unresolved. EXCLUDED.

## Mosques / Islamic centres — Oakville (Places-verified)
- Al Falah Islamic Centre — 391 Burnhamthorpe Rd E — 43.503954, -79.736157
- Masjid Al-Hsan – Dar Foundation — 485 Morden Rd — 43.442362, -79.694762
- Jame Masjid Oakville (World Islamic Mission Canada) — 2478 Ninth Line — 43.506283, -79.695805
- Halton Islamic Community Centre (HICC Masjid) — 4269 Regional Rd 25, Oakville L6M 4E9 — coords 43.456784, -79.802232 (Places); street address web-sourced, Places returned no street address — note this caveat.
- Islamic Community of Oakville — 407 Iroquois Shore Rd, Suite V15, Unit 8, L6H 1M3 — community/prayer space, not a standalone large masjid — verify suitability before preset use.
- Masjid Noor-UL-Haram — construction project in Oakville, no street address returned — do NOT list as visitable preset yet.

## Buddhist — NO major temple verified inside Oakville
- Nearest major found: West End Buddhist Temple and Meditation Centre — 3133 Cawthra Rd, MISSISSAUGA — 43.597531, -79.603344 — flag outside Oakville.
- Avalokiteshvara Kadampa Buddhist Centre — MapQuest listing 2435 9th Line, Oakville L6H 7G9, but centre's own site says meditation centre is in Guelph — likely outdated, UNVERIFIED, do not use.
- Lama Yeshe Ling Tibetan Buddhist Group — Burlington, no street address.

## Hindu temples — Oakville, Places-verified
- Sanatan Mandir of Canada — 1092 Speers Rd — 43.430603, -79.704358
- ISKCON Oakville — 467 Speers Rd — 43.437715, -79.697745
- Vaishno Devi Temple — 3259 Regional Road 25 — 43.442556, -79.784876 (north Oakville near Milton border)
- Shiva Temple — 3263 Regional Rd 25 — 43.442578, -79.785347 (adjacent to Vaishno Devi)

---
## 4. 学校（74 所）
# Oakville schools — elementary and secondary, by board/system
Researched 2026-10-27. Sources: HDSB school directory / HDSB awards lists, HCDSB school-boundary-maps families of schools, Conseil scolaire Viamonde and Conseil scolaire catholique MonAvenir school listings, and PublicSchools.ca's Oakville listing, cross-checked with board and school sites. Every school below was returned by at least one of those sources. Addresses are given only where a source gave them.

## Counts (distinct schools, regular day schools)
- Halton District School Board (HDSB, public): elementary 29, secondary 6 — total 35
- Halton Catholic District School Board (HCDSB): elementary 17, secondary 3 — total 20
- Conseil scolaire Viamonde (French public): elementary 2, secondary (Gr 7–12) 1 — total 3
- Conseil scolaire catholique MonAvenir (French Catholic): elementary 1, both (Gr 7–12) 1 — total 2
- Private, notable subset (NOT exhaustive): elementary 9, both 4, secondary 1 — total 14
- Grand total in this list: 74 distinct schools

## 1. Halton District School Board — public
### Elementary (29)
1. Abbey Lane Public School — 1160 Old Abbey Lane, L6M 1S4
2. Brookdale Public School — 1195 Bridge Rd, L6L 2C3
3. Captain R. Wilson Public School — 2145 Grand Oak Trail, L6M 4S7
4. Dr. David R. Williams Public School — 3199 Post Rd, L6H 7C5
5. E. J. James Public School — 338 Cairncroft Rd, L6J 4M6
6. Eastview Public School — 2266 Hixon St, L6L 1T4
7. Emily Carr Public School — 2255 Pine Glen Rd, L6M 0G5
8. Falgarwood Public School — 1385 Gainsborough Dr, L6H 2H7
9. Forest Trail Public School — 1406 Pine Glen Rd, L6M 4B9
10. Gladys Speers Public School — 2150 Samway Rd, L6L 2P6
11. Harvest Oak Public School — 1235 Wheat Boom Dr, L6H 7G1
12. Heritage Glen Public School — 1641 Heritage Way, L6M 2Z4
13. James W. Hill Public School — 2860 Kingsway Dr, L6J 6R3
14. Joshua Creek Public School — 1450 Arrowhead Rd, L6H 7P9
15. Maple Grove Public School — 288 Maple Grove Dr, L6J 4V5
16. Montclair Public School — 1285 Montclair Dr, L6H 1Z3
17. Munn's Public School — 1511 Sixth Line, L6H 1X8
18. New Central Public School — 133 Balsam Dr, L6J 3X4
19. Oakwood Public School — 357 Bartos Dr, L6K 3E5
20. Oodenawi Public School — 385 Sixteen Mile Dr, L6M 0Z4
21. Palermo Public School — 2561 Valleyridge Dr, L6M 5H4
22. Pilgrim Wood Public School — 1551 Pilgrims Way, L6M 2W7
23. Pine Grove Public School — 529 Fourth Line, L6L 5A8
24. Post's Corners Public School — 2220 Caldwell Dr, L6H 6B5
25. River Oaks Public School — 2173 Munn's Ave, L6H 3S9
26. Sheridan Public School — 1555 Lancaster Dr, L6H 3H4
27. Sunningdale Public School — 1434 Oxford Ave, L6H 1T4
28. W. H. Morden Public School — 180 Morden Rd, L6K 2S3
29. West Oak Public School — 2071 Fourth Line, L6M 3K1

### Secondary (6)
1. Abbey Park High School — 1455 Glen Abbey Gate, L6M 2G5
2. Garth Webb Secondary School — 2820 Westoak Trails Blvd, L6M 4W2
3. Iroquois Ridge High School — 1123 Glenashton Dr, L6H 5M1
4. Oakville Trafalgar High School — 1460 Devon Rd, L6J 3L6
5. T. A. Blakelock High School — 1160 Rebecca St, L6L 1Y9
6. White Oaks Secondary School — 1330 Montclair Dr, L6H 1Z5

## 2. Halton Catholic District School Board — Catholic
Families of schools (HCDSB school-boundary-maps): Holy Trinity, St. Ignatius of Loyola, St. Thomas Aquinas.
### Elementary (17)
Holy Trinity family (6):
1. Holy Family Catholic Elementary School — 1420 Grosvenor St, L6H 2X8
2. Our Lady of Peace Catholic Elementary School — 391 River Glen Dr, L6H 5X5
3. St. Andrew Catholic Elementary School — 145 Millbank Dr, L6H 6G3
4. St. Cecilia Catholic Elementary School — 420 Threshing Mill Blvd, L6H 0T1
5. St. Marguerite d'Youville Catholic Elementary School — 1359 Bayshire Dr, L6H 6C7
6. St. Michael Catholic Elementary School — 165 Sewell Dr, L6H 1E3
St. Ignatius of Loyola family (7):
7. St. Bernadette Catholic Elementary School — 1201 Heritage Way, L6M 3A4
8. St. Gregory the Great Catholic Elementary School — 138 Sixteen Mile Dr, L6M 0T7
9. St. Joan of Arc Catholic Elementary School — 2912 Westoak Trails Blvd, L6M 4T7
10. St. John Paul II Catholic Elementary School — 2130 Kingsridge Dr, L6M 4Z2
11. St. Mary Catholic Elementary School — 2175 Colonel William Pkwy, L6M 0B7
12. St. Matthew Catholic Elementary School — 1050 Nottinghill Gate, L6M 2G3
13. St. Teresa of Calcutta Catholic Elementary School — 1190 Westview Terrace, L6M 3N2
St. Thomas Aquinas family (4):
14. St. Dominic Catholic Elementary School — 2405 Rebecca St, L6L 2B1
15. St. Luke Catholic Elementary School — 2750 Kingsway Dr, L6J 7G5
16. St. Nicholas Catholic Elementary School — 477 Warminster Dr, L6L 4N4
17. St. Vincent Catholic Elementary School — 1280 Braeside Dr, L6J 2A4

### Secondary (3)
1. Holy Trinity Catholic Secondary School — 2420 Sixth Line, L6H 5Z8
2. St. Ignatius of Loyola Catholic Secondary School — 1550 Nottinghill Gate, L6M 1X7
3. St. Thomas Aquinas Catholic Secondary School — 124 Dorval Dr, L6K 2W1

## 3. Conseil scolaire Viamonde — French-language public
### Elementary (2)
1. École élémentaire du Chêne — 150 Ridge Dr, L6H 1B8
2. École élémentaire Patricia-Picknell — 1257 Sedgewick Cres, L6L 1X6 (postal variant L6L 1X5 in some listings)
### Secondary / both (1)
3. École secondaire Gaétan-Gervais — 1075 McCraney St E, L6H 1H9, Grades 7–12 (some directories list its Grades 7–8 component separately at the same site; some HoodQ reports give 1055 McCraney St E — street-number discrepancy flagged, not resolved)

## 4. Conseil scolaire catholique MonAvenir — French-language Catholic
### Elementary (1)
1. École élémentaire catholique Sainte-Marie (ÉÉC Sainte-Marie-Oakville) — 336 Maurice Dr, L6K 2X3
### Both (1)
2. École secondaire catholique Sainte-Trinité — 2600 Grand Oak Trail, L6M 0R4, Grades 7–12 (directories split it as ÉIC Sainte-Trinité, Grades 7–8, and ÉSC Sainte-Trinité, Grades 9–12, same address; counted once here)
Note: do not confuse Sainte-Marie (MonAvenir, 336 Maurice Dr) with St. Mary Catholic Elementary School (HCDSB, 2175 Colonel William Pkwy).

## 5. Private — notable subset, NOT exhaustive
### Elementary (9)
1. Clanmore Montessori School — 2463 Lakeshore Rd E, L6J 1M7, toddler–Grade 8
2. Dearcroft Montessori School — 1167 Lakeshore Rd E, L6J 1L3, toddler–Grade 8
3. Fern Hill School, Oakville Campus — 3300 Ninth Line, L6H 7A8, preschool–Grade 8 (one listing gives a Mississauga postal code L5L 5Z6 for the same street address — flagged)
4. John Knox Christian School — 2232 Sheridan Garden Dr, L6J 7T1, preschool–Grade 8
5. Linbrook School — 1079 Linbrook Rd, L6J 2L2, Kindergarten–Grade 8 (boys)
6. Oakville Christian School — 112 Third Line, L6L 3Z6, preschool–Grade 8
7. Rotherglen School — 2050 Neyagawa Blvd, L6H 6R2, preschool–Grade 8 (separate Primary Campus, ages 4–6, at 2045 Sixth Line — same school, not counted twice)
8. Walden International School — 2035 Upper Middle Rd E, L6H 7G6, preschool–Grade 8
9. Wildwood Academy — 2250 Sheridan Garden Dr, Grades 2–8 (postal code not given in the sources used — unverified)
### Both (4)
10. Appleby College — 540 Lakeshore Rd W, L6K 3P1, Grades 7–12
11. Chisholm Academy — 1484 Cornwall Rd, L6J 7W5, Grades 7–12
12. MacLachlan College — Lower School 337 Trafalgar Rd, L6J 3H3 (Pre-K–Grade 6); Upper School 2794 South Sheridan Way, L6J 7T4 (Grades 7–12); school overall Pre-K–Grade 12
13. St. Mildred's-Lightbourn School — 1080 Linbrook Rd, L6J 2L1, Junior Kindergarten–Grade 12 (girls)
### Secondary (1)
14. King's Christian Collegiate — 528 Burnhamthorpe Rd W, L6M 4K6, Grades 9–12

## Excluded / flagged — do NOT add to the preset list without verification
- Thomas Merton Catholic Secondary School (255 Morden Rd, L6K 2S2) and Thomas Merton Online Catholic School (225 Morden Rd): HCDSB adult / continuing-education, not a regular secondary school — excluded from the regular counts above.
- Gary Allan High School / Learning Centre (HDSB adult, alternative and community education): excluded on the same basis.
- Clarkson Secondary School (2524 Bromsgrove Rd): appeared in one Oakville neighbourhood guide, but that address is in Mississauga, not Oakville — excluded.
- Holy Name of Mary College School (2241 Mississauga Rd): appeared in a nearby-schools list, but that address is in Mississauga — excluded.
- USCA Academy: its own page places its campus in Mississauga (~20–28 min from Oakville) — excluded, despite marketing to Oakville families.
- "St. John Catholic Elementary School, Oakville": appears in one HCDSB 2025 information-session page under the Holy Trinity family, but does not appear in the HCDSB boundary-maps families and no separate Oakville address was found in search; it may be a shortened reference to St. John Paul II. NOT counted; verify with HCDSB before adding.
- Glenburnie School (2035 Upper Middle Rd E): appears at the same address as Walden International School in one listing — possibly a former/duplicate name; NOT counted separately.
- Small Montessori / preschool-only sites, tutoring academies and online-only schools were excluded from the private list; the private section is a notable subset, not a census.
- Sheridan College Trafalgar Campus is post-secondary and out of scope.

---
## 5. 大卖场（镇内 21 处）
# Big-box retail — Oakville (verified 2026-10-27)

Scope: Oakville town boundaries first. Cross-boundary candidates are listed separately and WITHOUT any Oakville Transit service claim (routes are verified by a separate task). Only places returned by a tool are listed; nothing invented. Places-verified entries were checked not permanently/temporarily closed.

## Oakville — verified

### The Home Depot (3)
- The Home Depot — 99 Cross Ave, Oakville, ON L6J 2W7 — 43.454848, -79.688540 — Places-verified, Active
- The Home Depot — 3300 S Service Rd W, Oakville, ON L6L 0B1 — 43.399526, -79.749378 — Places-verified, Active (Burloak)
- The Home Depot — 2555 Bristol Cir, Oakville, ON L6H 5W9 — coordinates not returned in this run — confirmed by Home Depot careers postings and Behr store #7003 listing at this address, plus YellowPages/MapQuest; do not confuse with the two Places-verified branches above

### Best Buy (1 full-size)
- Best Buy — 2500 Winston Park Dr, Unit A, Oakville, ON L6H 7E5 — 43.516312, -79.686010 — Places-verified, Active

### Canadian Tire (3)
- Canadian Tire — 1100 Kerr St, Oakville, ON L6M 0L4 — 43.449872, -79.698799 — Places-verified, Active
- Canadian Tire — 400 Dundas St E, Oakville, ON L6H 6Z9 — 43.488667, -79.715421 — Places-verified, Active (Oakville North)
- Canadian Tire — 2510 Hyde Park Gate, Oakville, ON L6H 6M2 — 43.513487, -79.689240 — Places-verified, Active (Winston Churchill)

### RONA (1)
- RONA Oakville — 399 Speers Rd, Oakville, ON L6K 3T2 — coordinates not returned in this run — confirmed by RONA's own store page and YellowPages; Active

### Winners (4) / HomeSense (2, one shared site)
- Winners — 2460 Winston Churchill Blvd, Oakville, ON L6H 6J5 — 43.520856, -79.680298 — Places-verified, Active (Winston Power Centre)
- Winners — 200 North Service Rd, Oakville, ON L6M 2G2 — 43.449850, -79.701015 — directory sources (Cylex), Active; same Dorval Crossing plaza as HomeSense below, different unit/phone
- Winners & HomeSense (combined) — 2431 Trafalgar Rd, Oakville, ON L6H 6K7 — 43.486359, -79.715729 — directory/job sources, Active (Trafalgar Ridge)
- Winners — 3465 Wyecroft Rd, Unit B1, South Oakville Centre, Oakville, ON L6L 0B6 — 43.398795, -79.747968 — Places-verified, Active
- HomeSense — 200 North Service Rd, Oakville, ON (Dorval Crossing) — 43.449510, -79.700518 — directory source, Active; separate from the Winners unit in the same plaza

### Marshalls (1)
- Marshalls — 310 N Service Rd W, Oakville, ON L6M 2R7 — 43.446568, -79.702850 — Places-verified, Active (Dorval Crossing)

### Sport Chek (2)
- Sport Chek — 240 Leighland Ave (Unit 144), Oakville Place, Oakville, ON L6H 3H6 — 43.461599, -79.687072 — Places-verified, Active
- Sport Chek — 2460 Winston Churchill Blvd, Oakville, ON L6H 6J5 — 43.520523, -79.681555 — Places-verified, Active (Winston Power Centre)

### Mark's (1)
- Mark's — 2501 Hyde Park Gate E, Oakville, ON L6H 6G6 — 43.515364, -79.687023 — Places-verified, Active. Note: its marks.com store-page slug says "mississauga-west" (a trade-area name); the Places address/city is Oakville, so it is counted as Oakville.

### Staples (1)
- Staples — 2460 Winston Churchill Blvd, Oakville, ON L6H 6J5 — 43.520675, -79.680739 — Places-verified, Active (also houses ServiceOntario)

### Michaels (1)
- Michaels — 200 N Service Rd W, Dorval Dr, Oakville, ON L6M 2V1 — 43.449350, -79.700679 — Places-verified, Active (Dorval Crossing)

### PetSmart (2)
- PetSmart — 240 Leighland Ave, Suite M7, Oakville Place, Oakville, ON L6H 3H6 — 43.462090, -79.686940 — Places-verified, Active
- PetSmart — 2501 Hyde Park Gate, Oakville, ON — coordinates not returned in this run — directory sources only (Loc8NearMe/Realty.ca, phone 905-829-9999); include with this caveat, re-verify via Places before prototype use

## Cross-boundary candidates — NOT Oakville, NO transit claim in this task
- IKEA Burlington — 1065 Plains Rd E, Burlington, ON L7T 4K1 — 43.328092, -79.829115 — Places-verified, Active. No IKEA store in Oakville. (The separate 1135 King Rd, Burlington site is an external pick-up warehouse, not a store — do not use as a preset.)
- RONA+ Burlington (North) — 3270 Harrison Cres, Burlington, ON L7M 0W4 — coordinates not returned in this run — YellowPages-verified; the large-format RONA equivalent nearest Oakville.

## No Oakville branch found / excluded — do not list as Oakville presets
- Lowe's: no Lowe's-branded store was found in Oakville in this run. Do not list Lowe's as an Oakville preset; the verified large-format equivalents nearby are RONA Oakville (399 Speers Rd) and RONA+ Burlington above.
- Best Buy Express, Oakville Place — 240 Leighland Ave, Unit 153, Oakville, ON L6H 3H6 — 43.461677, -79.686720 — Active, but SMALL-FORMAT express store inside the mall, not a big-box; do not count it as a second full Best Buy.
- Best Buy Mobile, Oakville Place — 240 Leighland Ave, Unit 210A — search result flags Permanently Closed — EXCLUDE.
- RONA (former), 2311 Royal Windsor Dr, Oakville, ON L6J 7X7 — 43.490706, -79.652760 — search result flags Permanently Closed — EXCLUDE (this was the second, older RONA site; only 399 Speers Rd is current).

---
## 6. 镇界外，Oakville Transit 直达（单独标注，不得混进镇内清单）
# 镇界外预设目的地 — Oakville Transit 直达（近镇界限定）

编制：2026-10-27。依据：Oakville 静态 GTFS（班期 2026-09-06 至 2026-10-31）+ 官方 2025-06-29 服务变更公告 + 公开搜索。
使用规则：以下所有镇界外地点在产品里必须单独标注“镇界外，Oakville Transit 直达”，不得混进 Oakville 镇内清单。
距离说明：均为 GTFS 站点坐标到地点坐标的直线距离，不是步行路线距离；实际步行可能更长。
班期说明：所列站点均在当前工作日班期（1_merged_2779034，Mon–Fri）有车；12、120、11 在本静态包里只有工作日班次，4、5、6、14、14A 另有周六、周日班次。
静态包风险：当前静态包日历只到 2026-10-31，新包发布后须复查以下路线是否仍跨界。
注：按用户最新要求，South Common 已从本清单中彻底删除，不再列出。

## 一、现行跨界路线（静态 GTFS，2026-09–10 月班期）

| 路线 | 名称 | 跨界终点（GTFS trip_headsign / 站点） | 备注 |
|---|---|---|---|
| 4 | Speers-Cornwall | Clarkson GO（Mississauga）↔ Bronte GO | 周六、周日也有车 |
| 5 | Dundas | 西：Dundas & 407 GO Carpool（Burlington，Walkers Line 一带）；东：Winston Churchill & Dundas / Laird Rd 一带（Mississauga） | Dundas 全天主干线；官方 2025-06-29 公告：5 路东至 Mississauga 的 Laird Dr / Dundas 终点、西至 Walkers Line & 407 Carpool（接 Burlington Transit） |
| 6 | Upper Middle | 东：Winston Churchill / Dundas、Laird & Ridgeway 一带（Mississauga）↔ Bronte GO | 周六、周日也有车 |
| 11 | Linbrook | Clarkson GO（Mississauga）↔ Oakville GO | 本包仅工作日 |
| 12 | Winston Park | Clarkson GO（Mississauga）↔ Laird & Ridgeway（Mississauga） | 本包仅工作日 |
| 14 / 14A | Lakeshore West | Appleby GO（Burlington）↔ Oakville GO | 周六、周日也有车 |
| 120 | East Industrial | Laird & Ridgeway（Mississauga）↔ Oakville GO | 本包仅工作日 |

## 二、（a）Oakville Transit 直达 — 近镇界超市 / 购物点

### Mississauga（Oakville 以东镇界）

1. **Costco Wholesale（Mississauga South）— 镇界外，Oakville Transit 直达**
   - 地址：3180 Laird Rd, Mississauga, ON L5L 6A5（坐标 43.52076, -79.689209）
   - 最近 OT 站点：Laird Rd At Colonial Dr，85 m，OT 5、6 路；Laird Rd East of Ridgeway Dr，150 m，OT 5、6 路；Ridgeway Dr + Dundas St West，329 m，OT 12、120 路（工作日）
   - 证据：GTFS 站点坐标 + 搜索返回的 Costco 地址/坐标；Moovit 该店页面亦列出 OT 5、6、12、120 路经过附近（另有 MiWay 1、36、101 路，非必需）
   - 注意：这是用户说的“Oakville–Mississauga 交界处的 Costco”；另两家 Mississauga Costco（5900 Rodeo Dr、1570 Dundas St E）离 OT 很远，见 (b)。

2. **T&T Supermarket Erin Mills — 镇界外，Oakville Transit 直达**
   - 地址：3055 Vega Blvd, Mississauga, ON L5L 5Y3，Erin Mills Power Centre（坐标 43.51707, -79.69035）
   - 最近 OT 站点：Laird + Ridgeway，67 m；Vega + Laird，68 m——两站均有 OT 5、6 路（全周）及 12、120 路（工作日）；Dundas St West + Vega Blvd，151 m，OT 5 路
   - 证据：T&T 2025-04-16 官方公告（40,000 平方英尺，2026 年夏季开业，定位服务 Oakville 社区）；2026-10 月外卖平台 listings 已显示该店营业
   - 附带：Erin Mills Power Centre 本身就是该店所在的购物中心，可与 T&T 合并为一个预设点，不必另立。

3. **Metro — Clarkson Crossings — 镇界外，Oakville Transit 直达**
   - 地址：920 Southdown Rd, Mississauga, ON L5J 2Y4（Clarkson Crossings，Southdown Rd & Royal Windsor Dr；坐标 43.50944, -79.62892）
   - 最近 OT 站点：Royal Windsor Dr + 2165 Royal Windsor Dr，337 m，OT 4、11、12 路；2200 Royal Windsor Dr，399 m，同上；Clarkson GO Station，457 m，同上
   - 证据：GTFS 站点坐标；搜索结果确认 Metro 仍在 Clarkson Crossings 营业（同广场另有 Canadian Tire、Mark's）
   - 班期注意：4 路全周有车，11、12 路本包仅工作日。

4. **Food Basics — Clarkson Village Shopping Centre — 镇界外，Oakville Transit 终点 + 约 600 m 步行（需家长判断是否值得做预设）**
   - 地址：1865 Lakeshore Rd W, Mississauga, ON L5J 1J6（坐标 43.5154, -79.62653）
   - 最近 OT 站点：Clarkson GO Station，593 m，OT 4、11、12 路；其余 OT 站点均在 900 m 以上
   - 证据：2026 年 7 月 9 日开业报道（32,000+ 平方英尺，Clarkson Village Shopping Centre）；GTFS 距离计算
   - 风险提示：对提着 groceries 的老人来说，600 m 步行不算“到站即到”；且步行路线是否无障碍未核实。建议：要么单独标注步行距离，要么不做预设、只在 Clarkson GO 终点页提示。

### Burlington（Oakville 以西镇界，全部经 OT 5 路 Dundas 线）

5. **Farm Boy — Walkers Line — 镇界外，Oakville Transit 直达**
   - 地址：3061 Walkers Line, Burlington, ON（坐标 43.393405, -79.8246）
   - 最近 OT 站点：Dundas St + Walkers Line，120 m，OT 5 路（另一方向同名站 233 m）
   - 证据：Farm Boy 官方店铺页地址 + GTFS 站点坐标。

6. **Longo's — Walkers Line — 镇界外，Oakville Transit 直达**
   - 地址：2900 Walkers Line, Burlington, ON（坐标 43.390238, -79.822681）
   - 最近 OT 站点：Dundas St + Walkers Line，190 m，OT 5 路（另一方向同名站 291 m）
   - 证据：Longo's 官方店铺页地址 + GTFS 站点坐标。

7. **Fortinos — Appleby Line — 镇界外，Oakville Transit 直达**
   - 地址：2515 Appleby Line, Burlington, ON（坐标 43.407351, -79.805018）
   - 最近 OT 站点：Dundas St + Appleby Line，167 m，OT 5 路（另一方向同名站 221 m）
   - 证据：Fortinos 官方店铺页地址 + GTFS 站点坐标。

### 镇界外 OT 终点（非购物预设，仅作换乘标注参考）

- Clarkson GO Station，Mississauga — OT 4、11、12 路终点（GTFS 站点 358，43.5125, -79.6327）
- Appleby GO Station，Burlington — OT 14、14A 路终点（Fairview St / Harvester Rd 站点群）
- Dundas St + Highway 407 GO Carpool，Burlington — OT 5 路西终点（GTFS 站点 1575，43.388579, -79.829729；接 Burlington Transit，不接超市）

## 三、（b）仅换乘可达 — 不得标为 Oakville Transit 直达

- **Metro Erin Mills**，2225 Erin Mills Pkwy, Mississauga — 最近 OT 站点约 2,059 m（Winston Churchill Blvd + Sheridan Park Dr，OT 12 路），须换乘 MiWay；不在近镇界范围内。
- **Metro Millcroft**，2010 Appleby Line, Burlington — 最近 OT 站点约 1,900 m（Dundas St + Millcroft Park Dr，OT 5 路），须换乘 Burlington Transit。
- **Costco Burlington**，1225 Brant St, Burlington — OT 不到；公开换乘指引为 GO 至 Burlington GO 再换乘 Burlington Transit。
- **Costco Mississauga 另两家**：5900 Rodeo Dr、1570 Dundas St E — 均远离 OT 跨界段，须换乘 MiWay。
- **Erin Mills Town Centre 一带**（Erin Mills Pkwy 北段）— 在 OT 跨界段以北约 2 km 以上，须换乘 MiWay；不在近镇界范围内。

## 四、（c）未核实 — 不得列入直达清单

- **Longo's Fairview St（1225 Fairview St）与 Walmart Fairview St（2065 Fairview St），Burlington**：地理编码返回的纬度（约 43.33）与 Fairview St / Appleby GO 一带实际纬度（约 43.37）明显不符，OT 距离无法可靠建立；OT 14/14A 虽沿 Fairview St 经 Appleby GO 一带，但到这两家店的具体距离未核实。须用可靠坐标重核后才能判断。
- **Appleby Village / Fairview 走廊的其他超市说法**：仅见于房产类页面转述，无官方店铺地址佐证，未核实。
- **Food Basics Clarkson Village 的步行路线无障碍情况**：未核实（仅直线距离）。
- **T&T Erin Mills 的实时在营状态**：公告为 2026 年夏季开业，2026-10 月平台 listings 显示营业；预设上线前建议再确认一次在营。

---
## 7. 银行（镇内实体分行 42 家 + 咨询中心 3 处）
# Bank branches — Oakville, Ontario (verified 2026-10-27)

Scope: Town of Oakville only. Full retail branches only in the main counts.
Coordinates are given only where a tool returned them in this run (Places or search result).
ATMs-only, in-store kiosks/pavilions, wealth/private offices and headquarters are NOT counted as retail branches; they are listed separately where relevant.
No branch below was flagged permanently closed in Places checks run in this task, except where noted.

## RBC Royal Bank — 9 full branches

1. Bronte — 2329 Lakeshore Rd W, Oakville, ON L6L 1H2 — RBC official branch page + routing record. Coordinates not returned by Places in this run.
2. Lakeshore & Trafalgar — 279 Lakeshore Rd E, Oakville, ON L6J 1H9 — RBC/Oakville Public Library reference. Note: one directory gives 277 Lakeshore Rd E for the same site; use 279.
3. Cornwall & Trafalgar — 361 Cornwall Rd, Unit 107, Oakville, ON L6J 7Z5 — 43.458257, -79.677369 (Places, not closed).
4. Glen Abbey — 220 North Service Rd W, Oakville, ON L6M 2Y3 — 43.448919, -79.702582 (Places, not closed).
5. Dundas & Neyagawa — 483 Dundas St W, Oakville, ON L6M 1L9.
6. Dundas & Winston Churchill — 2460 Winston Churchill Blvd, Oakville, ON L6H 6J5.
7. Fourth Line & Speers — 1005 Speers Rd, Oakville, ON L6L 2X5.
8. Oak Park — 309 Hays Blvd, Oakville, ON L6H 6Z3.
9. Third Line & Dundas — 2501 Third Line, Suite A, Oakville, ON L6M 5A9 — 43.450891, -79.759600 (Places; Places postal variant L6M 4H8 for the same site).

## TD Canada Trust — 12 strongly verified + 3 flagged

Strongly verified (official locator / Places / multiple directory sources, open):

1. 282 Lakeshore Rd E, Oakville, ON L6J 5B2 — 43.447264, -79.666006.
2. 2221 Lakeshore Rd W, Oakville, ON L6L 1H1 — 43.399540, -79.706514 (search Places record).
3. 2993 Westoak Trails Blvd, Oakville, ON L6M 5E4 — 43.428557, -79.765787. Note: one directory gives 2991 Westoak Trails for the same branch.
4. Iroquois & Trafalgar — 321 Iroquois Shore Rd, Oakville, ON L6H 1M3 — 43.465099, -79.686820. Note: directories also give 327 / 350 Iroquois Shore for the same area; use the routing-record address 321.
5. 1424 Upper Middle Rd W, Oakville, ON L6M 3G3 — 43.439389, -79.740088 (Places, not closed).
6. 1131 Nottinghill Gate, Oakville, ON L6M 1K5 — 43.440162, -79.719760.
7. 231 North Service Rd W, Oakville, ON L6M 3R2 — 43.450294, -79.703980.
8. 2325 Trafalgar Rd, Oakville, ON L6H 6N9 — 43.483127, -79.712433. Older routing data lists a Wal-Mart In-Store Branch at this same address; count once, not twice.
9. Dundas & Prince Michael — 2517 Prince Michael Dr, Oakville, ON L6H 0E9 — 43.497945, -79.707908.
10. Dundas & Neyagawa — 498 Dundas St W, Oakville, ON L6H 6Y3 — 43.463534, -79.742905 (Places, not closed).
11. 1515 Rebecca St, Oakville, ON L6L 5G8 — 43.412451, -79.705598.
12. Upper Oakville Shopping Centre — 1011 Upper Middle Rd E, Oakville, ON L6H 4L1 — 43.482475, -79.695955.

Flagged — address appears in a tool record but current 2026 branch status was NOT separately re-verified in this run; do not present as confirmed-open without a recheck:

13. Burloak & QEW — 3471 Wyecroft Rd, Oakville, ON L6L 0B6 (routing record; opened 2008).
14. 2059 Cornwall Rd, Oakville, ON L6J 7S2 — 43.481421, -79.656726 (directory listing only).
15. Oakville Place — 240 Leighland Ave, Oakville, ON L6H 3H6 (routing record only).

## Scotiabank — 7 full branches

1. Glen Abbey — Unit 10, 1500 Upper Middle Rd W, Oakville, ON L6M 3G3 (official branch locator).
2. Third Line & Speers — 611 Third Line (at Speers Rd), Oakville, ON L6L 4A8.
3. Dundas & Neyagawa — 489 Dundas St W, Oakville, ON L6M 4M2.
4. Dorval Crossing — Unit B1, 300 North Service Rd W, Oakville, ON L6M 2R9.
5. Dundas & Trafalgar — 2391 Trafalgar Rd, Unit 1, Oakville, ON L6H 6K7.
6. Oakville — 207 Lakeshore Rd E, Oakville, ON L6J 1H7.
7. Oakwoods Centre — 1919 Ironoak Way, Oakville, ON L6H 0N1.

## BMO Bank of Montreal — 6 full branches

1. Cornwall & Chartwell — 475 Cornwall Rd, Oakville, ON L6J 7S8 — 43.461838, -79.674272 (Places, not closed).
2. Hopedale Mall — 1461 Rebecca St, Oakville, ON L6L 1Z8 — 43.412765, -79.704470 (Places, not closed).
3. Dundas & Third Line — 2536 Third Line, Oakville, ON L6M 0G8 — 43.449752, -79.760676 (Places, not closed).
4. Dundas & Trafalgar — 320 Dundas St E, Oakville, ON L6H 6Z9 — 43.487985, -79.718853 (Places, not closed; BMO official branch page b3318).
5. Oakville Town Centre — 240 North Service Rd W, Oakville, ON L6M 2Y5 — 43.450135, -79.702418 (Places, not closed; one directory labels this ATM-only, but Places and BMO search show branch hours).
6. Oakville Place — 240 Leighland Ave, Oakville, ON L6H 3H6 (BMO official branch page b2472, Mon–Fri 10:00–5:00, Sat 10:00–4:00). Note: a separate BMO ATM, Unit 112, is also in the same mall; do not count it as a second branch.

## CIBC — 5 full-service + 3 Client Advice Centres

Full Service Banking Centres (CIBC official locator):

1. 1500 Upper Middle Rd W, Oakville, ON L6M 3G3.
2. 2530 Postmaster Dr, Oakville, ON L6M 0N2.
3. Trafalgar & Hays — 271 Hays Blvd, Oakville, ON L6H 6Z3.
4. 1515 Rebecca St, Oakville, ON L6L 5G8.
5. 197 Lakeshore Rd E, Oakville, ON L6J 1H5.

Client Advice Centres — staffed advice, cash at ATM only (CIBC's own label; NOT full-service, list separately):

6. 501 Dundas St W, Oakville, ON L6M 1L9.
7. 600 Speers Rd, Oakville, ON L6K 2G3.
8. 511 Maple Grove Dr, Unit 5, Oakville, ON L6J 6X8 — 43.480635, -79.655150 (Places, not closed).

## National Bank of Canada — 1 branch

1. Glen Abbey Shopping Centre — 2680 Sheridan Garden Dr, Oakville, ON L6J 7R2 (National Bank official locator). Coordinates not returned by Places in this run.

## FirstOntario Credit Union — 2 on current official list

1. North Oakville — 505 Dundas St W, Oakville, ON L6M 1L9 (FirstOntario official branches page).
2. Oakville — 511 Maple Grove Dr, Unit 14, Oakville, ON (FirstOntario official branches page).

Flagged, NOT counted:
- 338 Kerr St, Oakville, ON L6K 3B5 (older routing/directory record; not on the current official FirstOntario branches page in this run — status unverified, do not assume open).
- 3001 Hospital Gate, Oakville, ON L6M 0L8 (directory listing only, possibly a hospital-site location — status and public access unverified).

## NOT counted — excluded / unverified / non-retail

- HSBC Canada: NO current branch. RBC acquired HSBC Bank Canada on 28 March 2024 and all HSBC branches reopened as RBC on 1 April 2024. The former Oakville HSBC at 271 Cornwall Rd, Unit 102 / 499 Cornwall Rd, Bldg H, Unit 1 must NOT be listed as HSBC; whether that site is now a counted RBC branch was not confirmed in this run and it is not double-counted above.
- Tangerine — 489 Dundas St W: same site as Scotiabank Dundas & Neyagawa; kiosk/ATM presence only, not a standalone retail branch. Do not count separately.
- President's Choice Financial Pavilion / ATM — 493 Dundas St W (Fortinos) and 201 Oak Park Blvd (Superstore): in-store pavilion/ATM only, not a full bank branch.
- CIBC Wood Gundy — 277 Lakeshore Rd E, Oakville, ON — 43.447540, -79.667538: wealth/advisory office, non-retail. Do not count as a retail branch.
- BMO Private Banking — 239 Lakeshore Rd E: private-banking office, non-retail. Do not count as a retail branch.
- BMO — 128 Trafalgar Rd: GF6 directory only, no official BMO confirmation in this run. Not counted.
- RBC — 115 Nelson St: GF6 directory only, no corroboration in this run. Not counted.
- RBC — Cornwall & Maplegrove, 2035 Cornwall Rd: routing directory lists it c/o Lakeshore & Trafalgar transit 03502, with no independent standalone-branch confirmation. Not counted separately.
- RBC — 275 Hays Blvd, Unit G1: one local guide only; this was the former HSBC Trafalgar Banking Centre address. Not counted as a separate current RBC branch without a recheck.
- CIBC — 94 George St: GF6 directory only; other sources at that address show an art gallery / restaurant, and CIBC's official locator does not list it. Not counted; likely stale/mislabelled.
- Polish / St. Stanislaus–St. Casimir's Polish Parishes Credit Union — 3145 Dundas St W, Unit 5: postal code L5L 5P8, Mississauga, NOT Oakville, despite a directory labelling it Oakville. Excluded.
- Meridian, DUCA, BCU Financial: nearest branches found are in Mississauga (Erin Mills area), not Oakville. No Oakville branch found.
- ATMs-only (excluded throughout): CIBC 1289 Marlborough Ct and 234 Hays Blvd; BMO Shell/Dundas/Food Basics ATMs and BMO Oakville Place ATM Unit 112; TD ATMs at 321 Iroquois Shore Rd and 282 Lakeshore Rd E (these are ATM records at/near branch addresses, not additional branches).

## Counts

- Full retail branches, strongly verified: RBC 9 + TD 12 + Scotiabank 7 + BMO 6 + CIBC 5 + National Bank 1 + FirstOntario 2 = 42.
- Plus CIBC Client Advice Centres (separate category): 3, total staffed locations 45.
- Plus TD flagged, recheck-before-use: 3.

---
## 8. 医院与化验机构
# Hospitals and medical labs — Oakville (verified 2026-10-27)

Scope: Town of Oakville, Ontario only. Only places returned by a tool are listed; nothing invented.
Places-verified entries were checked not permanently/temporarily closed.

## 1. Hospitals — Oakville: 1

- **Oakville Trafalgar Memorial Hospital** — 3001 Hospital Gate, Oakville, ON L6M 0L8 — 43.450557, -79.764683 — Places-verified, Active, Emergency Room. Full-service acute care community hospital, Halton Healthcare, moved to this site Dec 13, 2015 (former site 327 Reynolds St, now Oakville Trafalgar Community Centre). Phone 905-845-2571.
- No other hospital physically in Oakville was verified. Other search hits labelled "Hospital" in Oakville (individual doctors/clinics) are NOT hospitals and are excluded.
- NOT counted as a hospital (separate note only): no standalone major urgent-care centre was verified in Oakville in this run; Oakville's emergency care is the OTMH Emergency Department above, plus walk-in/family clinics (e.g. Trafalgar Medical Clinic, 1235 Trafalgar Rd Ste 200, and Oak-Trafalgar Medical Clinic, 261 Oak Walk Dr — clinics, not hospitals, not in the hospital count). Nearest other Halton Healthcare hospitals are outside Oakville (Milton District Hospital, Georgetown Hospital) — not Oakville presets, listed here only to avoid confusion.

## 2. Medical labs — Oakville: 8 confirmed public collection sites

### LifeLabs — 5 confirmed (Places-verified, Active, OPEN)
1. LifeLabs — 170 Rebecca St, Oakville, ON L6K 1J6 — 43.438783, -79.677832
2. LifeLabs Medical Laboratory Services — 1060 Speers Rd Ste 104, Oakville, ON L6L 2X4 — 43.431282, -79.703981 — note: other sources give Unit/Suite 120 at the same street address; street address is the same, unit number varies by source.
3. LifeLabs Medical Laboratory Services — 575 River Glen Blvd, Oakville, ON L6H 6X6 — 43.461160, -79.737498
4. LifeLabs Medical Laboratory Services — 1235 Trafalgar Rd B-08, Oakville, ON L6H 3P1 — 43.467410, -79.690249
5. LifeLabs Medical Laboratory Services — 3075 Hospital Gate Unit 205, Oakville, ON L6M 1M1 — 43.449456, -79.767061 (North Oakville Medical Centre, Third Line & Dundas St W; walk-ins accepted per healthline listing)

### Dynacare — 3 confirmed (Places-verified, Active, OPEN)
6. Dynacare Laboratory and Health Services Centre — 2525 Old Bronte Rd #180, Oakville, ON L6M 4J2 — 43.435615, -79.775511
7. Dynacare Laboratory and Health Services Centre — 209 Oak Park Blvd #1, Oakville, ON L6H 7S8 — 43.481780, -79.717062 — note: Dynacare's own site gives 100-209 Oak Park Blvd, same building, unit numbering varies by source.
8. Dynacare Laboratory and Health Services Centre — 2315 Bristol Cir #103, Oakville, ON L6H 6P8 — 43.516734, -79.675112

## 3. Unverified / excluded — do NOT add to presets without a fresh check
- **LifeLabs, 581 Argus Rd, Oakville, ON L6J 3J4** (directory coords 43.457158, -79.684875): appears in Cylex/YellowPages/open-closed directory listings with Mon–Fri 8:00–16:30, Fri to 15:00, Sat closed hours, and a 2022 environmental report places LifeLabs LP at this Argus Medical Centre site — BUT it did not appear in the Places-verified LifeLabs set and was not confirmed as a public Patient Service Centre on LifeLabs' own locator in this run. Treat as directory-only / possible lab facility, NOT a confirmed walk-in collection preset. Verify via LifeLabs location finder before use.
- **AlphaLabs**: no Oakville Patient Service Centre was found in this run; Alpha's locator results returned were Toronto sites. Do NOT list an Oakville AlphaLabs preset.
- **Sensitivity Check, 482 South Service Rd E Unit 106, Oakville** (43.464893, -79.677880): a sensitivity-testing business, not a general OHIP blood-test collection centre — excluded.
- **Shoppers Drug Mart LifeLabs collection points** (e.g. Shoppers #1203 / #748 pages found): these were legacy COVID-test collection pages, not standalone LifeLabs Patient Service Centres — excluded, do not count as extra LifeLabs sites.
- **Hospital-internal labs**: excluded per task; only the public walk-in sites above are listed. OTMH's own lab is not listed as a public collection preset.
- **Pharmacy point-of-care testing**: excluded per task.

---
## 9. 亚洲超市
# Asian supermarkets — Oakville + border T&T (verified 2026-10-27)

Correction applied: Famijoy is NOT current. See section (a) note.

## (a) Oakville — open Asian supermarkets (verified)

1. Galleria Supermarket — Korean — 2501 Hampshire Gate, Oakville, ON L6H 6C8 — 43.520199, -79.682219 — OPEN, 8:00 AM–9:00 PM daily — Places ID 1728803331438201, not closed.
2. Iqbal Foods Oakville — South Asian / Middle Eastern supermarket, 100% HMA-certified halal — 125 Cross Ave Unit C2, Oakville, ON L6J 2W8 (Trafalgar Village) — 43.455464, -79.687120 — OPEN, grand opening Oct 15, 2026 (7th GTA store) — replaces United Supermarket at the same unit.
3. Spice Bazaar — South Asian (Indian; dosa, samosa, roti, chutneys in offerings) — 105 Cross Ave A5, Oakville, ON L6J 2W7 — 43.454131, -79.687029 — OPEN, 9:00 AM–10:00 PM daily — Places ID 1143819923667805, not closed.
4. Bombay Grocers Oakville — South Asian / Indian grocery — 2333 Taunton Rd, Oakville, ON L6H 0N5 — 43.482594, -79.715124 — OPEN, 9:00 AM–9:00 PM (Thu from 10:00 AM) — Places ID 2251410741903777, not closed.

### Famijoy correction — do NOT list Famijoy as current
- Old record: Famijoy Supermarket, 125 Cross Ave Unit C2, Oakville — Places ID 583316256567464 — now flagged Permanently Closed (verified via places details).
- Current store at the SAME unit (Unit C2, 125 Cross Ave, Trafalgar Village) is Iqbal Foods Oakville (above): grand opening Oct 15, 2026, replacing United Supermarket, which had replaced Famijoy in Dec 2024.
- Independent confirmation: Pear Oakville Chinese-ingredients guide states "Famijoy Supermarket (now UNITED Supermarket): Located at 125 Cross Ave".
- Ethnicity note for United: it is listed as an Asian grocery successor to Famijoy in that Chinese-ingredients guide, but United's own site does not state a single-ethnicity label — do not label it "Chinese-only" in the UI; use "Asian supermarket".
- Stale listings still showing "Famijoy" at Trafalgar Village (e.g. some mall/tenant lists) are outdated and must not be used.

## (b) Oakville — coming soon (NOT open, do not list as open)

- Nations Experience @ Oakville Place — international grocery + food hall + entertainment ("foodertainment") — Oakville Place, 240 Leighland Ave, Oakville, ON L6H 3H6 (former Hudson's Bay space) — Places coords 43.460608, -79.687396 (mall location; Places record itself gives no street address) — COMING SOON — ~120,000 sq ft — construction scheduled late 2026, opening planned 2027 (one Oct 2026 mall-redevelopment article notes the mall site still said "Coming Soon" with a Fall 2026 target, so treat 2027 as the planned opening, not a confirmed date).

## (c) Border — cross-boundary, Oakville-Transit-direct (NOT an Oakville store)

- T&T Supermarket, Erin Mills — Mississauga, ON — OPEN — 40,000 sq ft — 9:00 AM–10:00 PM, 7 days — grand opening April 9, 2026 (Canadian Grocer photo gallery, Retail Insider, Progressive Grocer).
  - Address discrepancy to note: announced in April 2025 as 3055 Vega Blvd (Erin Mills Power Centre, between Dundas St W and Hwy 403); opening-day reports and the current delivery listing give 3060 Ridgeway Dr, Mississauga, ON L5L 0C2, coords 43.518063, -79.689911. These are the same Erin Mills Power Centre site on two street frontages — use 3060 Ridgeway Dr as the current storefront address, with 3055 Vega Blvd noted as the announcement address.
  - Oakville Transit access, computed from Oakville static GTFS stop_times (straight-line distances, not walking routes): nearest stop Laird + Ridgeway, 62 m, routes 5, 6, 12, 120; Vega + Laird, 172 m, routes 5, 6, 12, 120; Ridgeway Dr + Dundas St West, 173 m, routes 12, 120; Laird Rd East of Ridgeway Dr, 196 m, routes 5, 6. Label: "Mississauga — Oakville Transit direct", never as an Oakville store. Service-day pattern (which of 12/120 run weekends) was not re-verified in this run and must be rechecked against the current schedule/static package (parent static calendar ends 2026-10-31).
  - Do NOT confuse with the older T&T at 715 Central Pkwy W, Mississauga (Central Parkway, near Square One) — different, farther store.

## Excluded / unverified — do NOT add

- Btrust Supermarket, 2291 Winston Park Dr, Oakville — this is Btrust's HQ/warehouse address (job postings list a warehouse order-picker at 2219/2291 Winston Park Dr, Oakville). Its verified retail stores are in Mississauga (1177 Central Pkwy W #30, 43.567559, -79.660553 — Places ID 476116737617798, open; and 2458 Dundas St W), North York and Richmond Hill. No evidence of a shop-able Btrust retail store in Oakville — do NOT list it as an Oakville supermarket.
- "Ethnic Supermarket", 2124 London Lane, Oakville — mentioned once in the Pear Oakville guide, but no place_id, hours or current-status record was returned in this run — UNVERIFIED, do not list until verified.
- Freshway Market, 353 Iroquois Shore Rd #1, Oakville — Middle Eastern grocery/restaurant hub (Places ID 1247253056059572, open) — borderline: geographically West Asian, but not an East/South/Southeast Asian supermarket preset; parent to decide whether to include under a broader "Asian/Middle Eastern" heading. Not counted in (a) above.
- Levantine Flavours (Oakville) — Places category Ethnic Grocery Store but described as a foodservice distributor, no retail street address returned — excluded.
- Restaurants (e.g. Oh Bombay, 376 Iroquois Shore Rd) — not grocery stores, excluded.
- Famijoy — permanently closed, superseded by United in Dec 2024, then by Iqbal Foods Oakville in Oct 2026 (see above).

---
## 10. 药房（独立药房 19 家）
# Pharmacies — Oakville (verified 2026-10-27)

Scope: Town of Oakville, Ontario only. Only places returned by a tool are listed; nothing invented.
Places-verified entries were checked not permanently/temporarily closed.
Coordinates are given only where a tool returned them; where no Places record was returned, coordinates are marked "not returned" — not estimated.

## Standalone count: 19 standard pharmacies
Shoppers Drug Mart 11 + Rexall 2 + Guardian/IDA 5 + The Medicine Shoppe 1 = 19.
Plus 1 separately labelled Wellwise by Shoppers home-health store (448 Speers Rd) — NOT counted in the 19.

## Shoppers Drug Mart — 11 full drugstores

Places-verified (address, coords, not closed, OPEN):
1. Shoppers Drug Mart — 240 Leighland Ave, Unit 109A, Oakville, ON L6H 3H6 — 43.461632, -79.686999 — Oakville Place; store #745; phone 905-842-3730
2. Shoppers Drug Mart — 351 Cornwall Rd, Oakville, ON L6J 7Z5 — 43.457625, -79.677776 — Olde Oakville Marketplace; store #706; phone 905-842-2327
3. Shoppers Drug Mart — 478 Dundas St W, Oakville, ON L6H 6Y3 — 43.463812, -79.742009 — Dundas & Neyagawa; store #878; phone 905-257-9737
4. Shoppers Drug Mart — 2525 Prince Michael Dr, Oakville, ON L6H 0E9 — 43.498471, -79.707033 — Shoppes on Dundas; store #1203; phone 905-257-3938
5. Shoppers Drug Mart — 1011 Upper Middle Rd E, Unit D5, Oakville, ON L6H 4L3 — 43.481937, -79.694929 — Upper Oakville Shopping Centre; store #748; phone 905-842-3934
6. Shoppers Drug Mart — 2501 Third Line, Building B/B1, Oakville, ON L6M 5A9 — 43.449849, -79.758848 — Third Line & Dundas; store #1271; phone 905-465-3000
7. Shoppers Drug Mart — 550 Kerr St, Oakville, ON L6K 3C7 — 43.446650, -79.688812 — Oaktown Plaza, Kerr & Speers; store #744; phone 905-845-6674
8. Shoppers Drug Mart — 183 Lakeshore Rd W, Oakville, ON L6K 1E7 — 43.437854, -79.678740 — Lakeshore; store #5850; phone 905-849-8878. Note: job postings describe this as a new store opening Feb 20, 2026 — this is the branch missing from older 10-store directory lists, which is why older lists say 10 and newer listings say 11.

Shoppers own store pages + multiple directories (no Places place_id returned in this run, so no Places coordinates — do not estimate):
9. Shoppers Drug Mart — 1515 Rebecca St, Oakville, ON L6L 5G8 — coordinates not returned — South Oakville Centre (formerly Hopedale Mall); store #0923; phone 905-827-4141
10. Shoppers Drug Mart — 2297 Lakeshore Rd W, Oakville, ON L6L 1H2 — coordinates not returned — Bronte; store #0996; phone 905-827-1561
11. Shoppers Drug Mart — 3535 Rebecca St, Unit C, Oakville, ON L6L 0E3 — coordinates not returned — Burloak & Rebecca; store #0683; phone 905-637-5681. Note: one flyer site mislabels this branch's "nearest stores" as Burlington; the address and L6L postal code are Oakville.

## Rexall — 2 (both Places-verified, not closed, OPEN)
1. Rexall — 523 Maple Grove Dr, Oakville, ON L6J 4W3 — 43.479611, -79.657535 — Maple Grove Village; store #2428; phone 905-849-1661
2. Rexall — 2441 Lakeshore Rd W, Unit 2 (also listed as Unit 100), Oakville, ON L6L 1H6 — 43.395332, -79.711782 — Bronte Village; store #2444; phone 905-825-0788

No third Rexall in Oakville was verified: the Mississauga Halton Healthline lists exactly two Oakville Rexall pharmacies (Lakeshore Rd W and Maple Grove Rd), and Rexall's own locator returns the same two store numbers.

## Guardian / IDA — 5 (all Places-verified, not closed, OPEN)
1. CIMS Guardian Pharmacy — 1235 Trafalgar Rd, Oakville, ON L6H 3P1 — 43.467456, -79.690396 — phone 905-845-0800
2. Morelli's Guardian Pharmacy — 469 Cornwall Rd, Oakville, ON L6J 7S8 — 43.461945, -79.674983 — phone 905-845-8999. Note: one directory also lists "Morelli's Pharmacy, 3455 Wyecroft Rd" — unverified as a second site and not counted separately; the Guardian site gives 469 Cornwall Rd.
3. Upper Middle IDA — 1534 Queensbury Cres, Oakville, ON L6H 4G5 — 43.469812, -79.706936 — phone 905-815-9111
4. St Marks Pharmacy (IDA) — 586 Argus Rd, Oakville, ON L6J 3J3 — 43.457287, -79.685403 — phone 905-845-6125
5. I.D.A Ford Drive Pharmacy — 609 Ford Dr, Unit 7, Oakville, ON L6J 7Z6 — 43.489033, -79.650431 — phone 905-845-3673

## The Medicine Shoppe — 1 (Places-verified, not closed, OPEN)
1. The Medicine Shoppe Pharmacy #209 — 267 Lakeshore Rd E, Oakville, ON L6J 1H9 — 43.447112, -79.666947 — phone 905-842-2770; Mon–Fri 10am–5pm only

## Separately labelled — NOT counted as a standard drugstore
- Wellwise by Shoppers (Shoppers Home Health Care) — 448 Speers Rd, Oakville, ON L6K 2G3 — coordinates not returned. Some directories list this address as "Shoppers Drug Mart" (phone 905-844-1445, hours 9am–5pm), while Yellow Pages / Shoppers home-health listings describe it as Wellwise by Shoppers, a home-health-care supplies store (phone 905-844-6541). Do NOT present it as a 12th full Shoppers pharmacy without confirming it dispenses prescriptions like a standard drugstore; list only as a home-health store if used at all.

## No Oakville branch verified — do not list as Oakville presets
- PharmaChoice: no Oakville store verified; the nearest PharmaChoice in the Ontario directory list is Clarkson Village, Mississauga (1865 Lakeshore Rd W) — outside Oakville, not counted.
- In-store pharmacy counters (inside Fortinos, No Frills, Walmart, Real Canadian Superstore, etc.) were NOT counted in the standalone total above, per the task. If the parent wants them, they should be added as a separately labelled "in-store counter" group, not mixed into the 19.

## Unverified / excluded
- No Shoppers, Rexall, Guardian, IDA or Medicine Shoppe branch in Oakville was flagged permanently or temporarily closed in the Places checks for this run.
- The 920 Southdown Rd, Mississauga and 3163 Winston Churchill Blvd, Mississauga Shoppers branches that appear in "near Oakville" lists are Mississauga, not Oakville — excluded.
