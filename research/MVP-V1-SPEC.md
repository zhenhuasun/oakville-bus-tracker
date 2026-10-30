# 新移民本地公交 Tracker — MVP v1 规格（待用户确认后开工）

状态：草案，2026-10-27。Tier 1 语言已定；预设地点清单已完成（见 PRESET-DESTINATIONS.md）；用户 2026-10-27 决定做网页原型，已建成 web artifact（slug: oakville-bus-tracker），一屏、五种语言、服务端代拉 GTFS-RT，静态包每日 09:14 多伦多时间自动刷新（artifact 内置任务 oakville-bus-tracker-static-refresh，首跑 2026-10-28）。待用户实测反馈后再改。

## 一句话定位

帮不懂英语的老年新移民，在 Oakville 本地坐对公交。不是跨城出行工具。

## 范围（已定，不做清单见下）

- 第一城：Oakville，唯一机构 Oakville Transit。
- 火车站只作为本地公交终点 / 换乘点，不做跨城行程规划。
- 白天非高峰是主场景：班次稀，“下一班几点”比“最快路线”重要。
- 无广告、无弹窗、无登录、无绑卡，任何元素不得盖住到站时间。

## 语言（v1，已定）

- 界面 + 提醒都要翻译，不只翻界面。
- Tier 1（人工审全套，用户 2026-10-27 定）：英语（底本）+ 法语 + 简体中文 + 阿拉伯语 + 印地语。
注：法语是加拿大官方语言之一，也是 Oakville 官方应用已有的语言；印地语替代了早版建议的乌尔都语——两者口语接近但文字、书写系统不同，不可混用，v1 只做用户定的印地语。
- Tier 2（后续按需）：乌尔都语、西班牙语、葡萄牙语等，提醒走按需机翻并标明，界面文案逐步补人工译文。
- 架构要求：加一种语言 = 加一个语言文件 + 一套提醒模板译文，不改代码，不影响已有用户；用户只下载自己那一种语言包。Tier 1 里只有阿拉伯语需从右往左布局，数字、路线号、方向箭头单独测试；印地语用天城文、从左往右。
- 站名、路名不直译：保留英文原名（如 Trafalgar Rd），加母语方向 / 地标说明。

## 预设目的地（v1：类别已定，具体名待用户补齐）

日常零搜索：家人一次设好，老人每天只点大按钮。类别（用户 2026-10-26 确认）：

1. 超市 — 已核实 18 家镇内中大型超市，见 PRESET-DESTINATIONS.md 第 1 节
2. 社区中心 — 已在静态数据里验证的参考点：Oakville Trafalgar Community Centre（站点 689 MacDonald Rd + Reynolds St，站点 49 Reynolds St at Oakville Trafalgar Community Centre）
3. 公交枢纽 — Uptown Core Terminal（站点 1293，站码 3233）
4. 火车站 — Oakville GO Station（站点 1212，站码 3172）；Bronte GO Station（站点 645，站码 2421）
5. 购物中心 — 镇内 4 处 mall 级预设（仅 Oakville Place 为室内 mall），见 PRESET-DESTINATIONS.md 第 2 节
6. 宗教场所 — 镇内清单见 PRESET-DESTINATIONS.md 第 3 节；佛教镇内无已核实大型寺庙，不硬编
7. 学校 / 幼托场所 — 74 所见 PRESET-DESTINATIONS.md 第 4 节；参考点 Sheridan College（站点 905，站码 3236）为专上院校，不在中小学清单内
8. 大卖场（用户 2026-10-27 新增类别）— 镇内 21 处（Home Depot、Best Buy、RONA、Canadian Tire 及同类），见 PRESET-DESTINATIONS.md 第 5 节
9. 镇界外，Oakville Transit 直达（用户 2026-10-27 新增规则，单独标注，不得混进镇内清单）— 6 处确定，见 PRESET-DESTINATIONS.md 第 6 节；South Common 用户同日决定直接排除，不标注
10. 银行（用户 2026-10-27 新增）— 镇内实体分行 42 家 + CIBC 咨询中心 3 处，见 PRESET-DESTINATIONS.md 第 7 节
11. 医院与化验机构（用户 2026-10-27 新增）— 医院 1 家、LifeLabs 5 家、Dynacare 3 家，见 PRESET-DESTINATIONS.md 第 8 节
12. 亚洲超市（用户 2026-10-27 新增）— 镇内 4 家 + Nations 即将开业 + 边境 T&T Erin Mills 直达，见 PRESET-DESTINATIONS.md 第 9 节；Famijoy 已关闭、原址先为 United、现为 Iqbal Foods Oakville（2026 年 10 月 15 日开业），不按旧名列
13. 药房（用户 2026-10-27 新增）— 独立药房 19 家（Shoppers 11、Rexall 2、Guardian/IDA 5、Medicine Shoppe 1），见 PRESET-DESTINATIONS.md 第 10 节
14. 家 — 用户自设起点，不预设

每个目的地在 v1 只回答：坐哪路、往哪个方向、在哪个站牌等、车现在在哪、还有几分钟、错过这班下一班几点、返程一键查看。

注：完整清单在 PRESET-DESTINATIONS.md；原型阶段再把每处映射到最近站牌，不在本清单硬编停靠映射。

## 一屏原型布局（v1，不做地图浏览全城）

从上到下，只有一屏，不滚动找功能：

1. 顶部：目的地大按钮（图标 + 母语名），当前选中高亮
2. 核心区（最大字）：下一班车还有 X 分钟；第二行：路线号 + 往 XX 方向
3. 等车信息：在 XX 站牌等（英文站名原样 + 母语方向说明）
4. 车的位置：车现在在 XX 附近 / 还有 Y 站到（只显示带 trip 的在运营车辆，无 trip 车辆不显示）
5. 兜底行：错过这班，下一班 HH:MM；返程按钮
6. 提醒区（仅当有提醒时出现）：母语改道/延误说明，路线号和街名保留英文；无提醒时不占位
7. 页脚小字：数据来源 Oakville Transit 署名 + 独立项目、非官方

不做：全城搜索、地图浏览所有线路、票价比较、购票、订阅、打车/骑行、新闻/天气、复杂设置。

## 数据管线（已实测，见 MVP-DATA-CHECKLIST.md）

- 静态：ArcGIS 下载，3.3 MB，35 路线 / 5,242 班次 / 1,160 站点；时区 America/Toronto。
- 实时：busfinder.oakvilletransit.ca/gtfsrt/，车辆位置 + 班次更新 + 提醒，约 30 秒刷新；轮询不高于官方频率。
- Join 键（关键）：trip 用 original_trip_id + route_id + 当天 service；stop 用去掉 _merged_* 后缀的原始号；route 直接 join。精确 trip_id / stop_id 匹配会丢一半以上，禁止这样写。
- 服务过滤：按当天日期取 service（如周二平日 1_merged_2779034），不把旧班期和新班期混算。
- 降级：未知 trip / 未知 stop / 无 trip 车辆 / 静态过期，全部走降级显示 + 日志，不静默丢数据，不显示无 trip 车辆为可坐车辆。
- 署名：按 Town of Oakville Open Government Licence 署名 Oakville Transit，标注独立项目、非官方。

## 翻译工作流（埋在服务端中间层，不在前端实时机翻）

- 固定文案：i18n 资源文件，人工审，构建时打包，前端只查表。
- 实时提醒：提醒到达时触发（不是用户打开时）：去重 → 匹配模板库（改道/封路/施工/取消/不停靠等人工审译文）→ 无模板则机翻兜底并标明、进复核队列 → 按 alert_id + 语言缓存 → 提醒失效译文同步失效。
- 英文原文保留作溯源，不改写原始数据；街名、路线号保留英文。

## 风险与待办（按优先级）

1. 静态包日历只到 2026-10-31：已设每日早上约 9:14 多伦多时间检查（cron：oakville-static-gtfs-expiry-check），无变化不打扰；出现新包、下载失败或 10 月 31 日仍无新包时汇报，之后关掉检查。
2. 【已定 2026-10-27】Tier 1 = 英语 + 法语 + 简体中文 + 阿拉伯语 + 印地语；乌尔都语、西班牙语、葡萄牙语列为 Tier 2 候选。
3. 【已完成 2026-10-27】预设地点清单：超市 18 家、购物中心 4 处、宗教场所镇内清单、学校 74 所、大卖场 21 处、镇界外直达 6 处，见 PRESET-DESTINATIONS.md。
4. 先做网页原型（建议：免下载、家人发链接即可用）还是直接做 App。
5. 原型后找 3–5 位老年新移民实测唯一任务：去超市，下一班车怎么坐；记录点错、卡住的地方再改。

## 新增功能三问（任何新需求先过这关）

1. 不懂英语的老人不用学就会用吗？
2. 会不会挡住或干扰“下一班车还有几分钟”？
3. 是不是已超出本地出行范围？
任一答案为否则砍掉或延后。
