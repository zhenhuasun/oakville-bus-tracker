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
