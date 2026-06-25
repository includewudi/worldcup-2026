---
name: wc2026-follow
description: 2026世界杯赛程导入macOS日历。关注球队→自动创建日历事件(含30分钟提醒)。数据实时来自ESPN API，完全自包含无需后端。当用户说"世界杯日历"、"导入赛程"、"关注球队"、"加日历提醒"、"wc2026"、"世界杯提醒"时触发。
triggers:
  - 世界杯日历
  - 导入赛程
  - 关注球队
  - 加日历提醒
  - wc2026
  - 世界杯提醒
  - worldcup calendar
  - 导入巴西
  - 导入阿根廷
  - 世界杯赛程日历
---

# WC2026 赛程日历导入

## 功能

从 ESPN API 实时拉取 2026 世界杯赛程，导入 macOS 日历。每个事件包含：
- 比赛时间（北京时间）
- 比赛场地 + 城市
- 比分（已完赛自动显示）
- 30 分钟提前提醒

## 特点

- **纯 API 数据源**：所有赛程/比分/淘汰赛对阵实时来自 ESPN，永远最新
- **零后端依赖**：只需 1KB 中文队名映射文件，无需运行任何服务
- **自动覆盖淘汰赛**：小组赛结束后 ESPN 自动生成 R16/QF/SF/Final 对阵
- **离线兜底**：`--cache` 使用上次缓存的 ESPN 数据
- **幂等**：重复运行自动跳过已存在的事件
- **中文队名**：巴西、阿根廷、法国…（淘汰赛 placeholder 显示英文）

## 用法

```bash
# 导入巴西全部赛程（小组赛+淘汰赛）
bash follow_calendar.sh BRA

# 预览不写入
bash follow_calendar.sh BRA --dry-run

# 多支球队
bash follow_calendar.sh BRA ARG FRA

# 离线模式（用上次缓存的 ESPN 数据）
bash follow_calendar.sh BRA --cache

# 指定日历
bash follow_calendar.sh BRA --calendar "工作"

# 全部 48 队
bash follow_calendar.sh --all
```

## 文件

- `follow_calendar.sh` — 主脚本
- `data/team_names_cn.json` — 48 队代码→中文名映射（1KB，唯一本地数据）

## 数据源

ESPN scoreboard API：
```
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719
```
返回所有小组赛 + 淘汰赛的时间、比分、场地、组别。脚本每次运行实时拉取。

## 首次运行

首次运行 macOS 会弹权限对话框：**系统设置 → 隐私与安全性 → 自动化 → [终端] → Calendar**

## 球队代码

BRA(巴西) ARG(阿根廷) FRA(法国) ENG(英格兰) ESP(西班牙) POR(葡萄牙)
GER(德国) NED(荷兰) MEX(墨西哥) USA(美国) CAN(加拿大) JPN(日本)
KOR(韩国) AUS(澳大利亚) MAR(摩洛哥) SEN(塞内加尔)

完整 48 队见 `data/team_names_cn.json`。
