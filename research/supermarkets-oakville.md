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
