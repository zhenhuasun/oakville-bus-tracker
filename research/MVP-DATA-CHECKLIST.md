# Oakville MVP 数据对接清单（已实测，2026-10-27）

数据源：Oakville Transit 2026-10-27 09:38 回复给出的官方源，已获 Town of Oakville Open Government Licence 使用许可（需署名）。

## 1. 静态 GTFS（已下载验证）

- 下载地址：https://www.arcgis.com/sharing/rest/content/items/d78a1c1ad6a940009de8b68839a8f606/data
- 数据集页：https://portal-exploreoakville.opendata.arcgis.com/datasets/d78a1c1ad6a940009de8b68839a8f606/about
- 文件：3.3 MB zip，含 agency / routes / trips / stops / stop_times / shapes / calendar / calendar_dates（无 transfers.txt 之外的缺失关键表）
- 规模：35 条路线、5,242 个班次、1,160 个站点、158,180 条停站记录、96,426 个形状点
- 时区：America/Toronto，机构 Oakville Transit（agency_id=1）
- **⚠️ 有效期风险（第一风险）：当前静态包的日历只到 2026-10-31。**
  - 平日服务 1_merged_2779034：2026-09-06 至 2026-10-31（周一至周五）
  - 周六 / 周日服务同理止于 2026-10-31；另含 2026-06-28 至 2026-09-05 的旧班期
  - 数据页标注 Data Updated：2026-09-04，未说明更新频率
  - 结论：11 月 1 日起若无新静态包，时刻表 / 班次匹配将失效。MVP 必须有“静态包过期检测 + 新包发布提醒”，并在 10 月 31 日前复查该 ArcGIS 页。

## 2. 实时 GTFS-RT（已实测为活源）

- 索引：https://busfinder.oakvilletransit.ca/gtfsrt/
- 车辆位置：https://busfinder.oakvilletransit.ca/gtfsrt/vehicles
- 班次更新：https://busfinder.oakvilletransit.ca/gtfsrt/trips
- 服务提醒：https://busfinder.oakvilletransit.ca/gtfsrt/alerts
- 官方称约每 30 秒刷新；实测快照（2026-10-27 11:00 EDT）：车辆 79 条、班次更新 72 条
- 提醒实测：11 路改道（2026-10-19 至 10-30）、15 路改道；提醒文本目前只有英文（`language: "en"`），产品必须自己翻译提醒，这是多语言卖点之一。

## 3. Join 实测结果（快照 2026-10-27 11:00 EDT）

| 维度 | 结果 | 说明 |
|---|---|---|
| route_id | VP 16/16，TU 17/17，Alerts 2/2 | 直接 join，100% |
| trip_id 精确匹配 | VP 16/42，TU 33/72 | 只用精确 trip_id 会丢一半以上，**不能这样写** |
| trip_id 经 original_trip_id 匹配 | VP 42/42，TU 72/72 | 100% 找到静态班次 |
| TU 停站全部落在匹配班次的 stop_times 里 | 69/72（精确 stop_id）→ 72/72（按原始 stop_id，见下） | 剩余 3 班各差 1 站只是后缀问题，不是真缺失 |
| TU 停站全局落在 stops.txt 里 | 751/753（精确 stop_id）→ 753/753（按原始 stop_id） | 见下 |

### 关键适配规则（必须按这条写，否则会重蹈 TTC 的坑）

1. **不要只用 `trips.txt.trip_id` 精确匹配。**
   静态包里 957 个 `original_trip_id` 各对应 2 个静态班次（旧班期 + 新班期），静态 `trip_id` 是 `original + _merged_<数字>` 形式，例如 `2043020_merged_2780362`。
   实时 `trip_id` 就是 `original_trip_id` 本身（例如 `2043020`）。
2. **匹配键 = `original_trip_id` + `route_id` + 当前日期的 service。**
   同一个 original 在旧班期和新班期会指向不同路线（例：`2043020` 在新班期是 11 路、在旧班期是 5 路），只用 trip_id 会选错路线；用实时给的 `route_id` 过滤后才能唯一确定当前班次。
3. **按日期过滤 service，不要把两个班期的班次都算进来。**
   今天（周二）应取平日服务 `1_merged_2779034`，共 1,535 个班次。
4. **stop_id 也要按原始号匹配，不要精确匹配。**
   静态站点同样有 `_merged_<数字>` 后缀：实时 `573` 对应静态 `573_merged_2779028` / `573_merged_2779023`（Devon Rd + Elmhurst Ave，站码 2932），实时 `1795` 对应静态 `1795_merged_2779026` / `1795_merged_2779021`（Trafalgar Rd + Threshing Mills Blvd，站码 3454）。按“去掉 `_merged_*` 后缀后的原始号”匹配后，TU 停站全局 753/753、按班次 72/72 全对得上。站码（stop_code）在同一站点的两个 merged 版本里是稳定的，可作辅助校验。

### 勘误（2026-10-27 复查更正）

- 早版清单曾写 `573`、`1795` 不在静态包里，那是精确匹配的误判，实际是后缀问题，已按上条规则更正。真正的容错原则不变：班次更新里遇到真正未知的 stop_id 时不要整班丢弃，显示实时到达时间并记日志。

## 4. 车辆位置的显示规则

- 79 辆车里 42 辆带 trip/route（在运营），37 辆只有位置、无 trip/route。
- 无 trip 的车里 33 辆速度为 0（多集中在 Oakville GO 一带，疑似停场 / 待发），4 辆低速移动（疑似出库 / 空驶）。
- MVP 规则：**只把带 trip_id 的车显示为“在运营的公交”**；无 trip 的车默认不显示，避免老人看到一堆不动的车误以为是可坐的车。

## 5. MVP 最小数据管线

1. 定时拉静态包（ArcGIS `/data`），解析后按日期过滤 service，建 `original_trip_id + route_id -> 静态班次` 索引。
2. 每 ~30 秒拉车辆位置 + 班次更新 + 提醒（不要高于官方刷新频率去轮询）。
3. 车辆位置 join 班次：得路线、方向、下一站；班次更新 join 停站：得每站预计到达时间。
4. 提醒：先按 route_id 匹配受影响路线，再把英文提醒翻译成用户母语后展示；不要直接贴英文原文。
5. 异常分支：未知 stop_id、未知 trip、无 trip 车辆、静态包过期，全部走降级显示 + 日志，不静默丢数据。
6. 署名：界面 / 关于页按 Town of Oakville Open Government Licence 署名 Oakville Transit，并标注独立项目、非官方。

## 6. 待复查项（不在本次快照内）

- [ ] 2026-10-31 前后复查 ArcGIS 静态包是否发布新班期；若未发布，11 月 1 日产品时刻表将过期。
- [ ] 确认静态包更新频率（官方页未说明），可邮件问 opendata@oakville.ca（数据集页所留联系方式）。
- [ ] 官方未在回复里说明 rate limit；MVP 按 ~30 秒刷新轮询，不做高频抓取。
