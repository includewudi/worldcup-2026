---
name: wc2026-analyze
description: 2026世界杯竞猜概率分析。输入两队→输出全场赛果、BTTS、半场平局、大小球、正确比分、让球盘等全部概率。当用户说"竞猜分析"、"概率分析"、"两队都进球吗"、"半场打平吗"、"大小球"、"比分预测"、"让球"、"xx vs xx"时触发。
triggers:
  - 竞猜分析
  - 概率分析
  - 两队都进球
  - 半场打平
  - 半场平局
  - 大小球
  - 比分预测
  - 正确比分
  - 让球
  - vs
  - VS
  - btts
  - over under
  - 世界杯预测
  - 赢面
---

# WC2026 竞猜概率分析

## 功能

输入两支球队，输出竞猜全维度概率分析：

| 类型 | 内容 |
|------|------|
| summary | 一句话总结（看好谁 + 关键指标） |
| result | 全场胜/平/负 |
| btts | 两队都进球概率 |
| ht-result | 半场赛果 |
| ht-draw | 半场打平概率 |
| over | 大小球 (O/U 0.5/1.5/2.5/3.5) |
| cs | 正确比分 Top 10 |
| ht-cs | 半场比分 Top 5 |
| handicap | 让球盘 (主队 -2/-1/+1/+2) |
| all | 以上全部 (默认) |

## 用法

```bash
bash analyze.sh <队1> <队2> [类型...]
```

球队代码：3字母代码（BRA/ARG/EGY）或中文名（巴西/阿根廷/埃及）均可。

### 示例

```bash
bash analyze.sh EGY IRN all           # 全分析
bash analyze.sh 巴西 阿根廷 btts      # 只看两队都进球
bash analyze.sh CPV KSA ht-draw over  # 半场打平 + 大小球
bash analyze.sh BRA ARG summary       # 一句话总结
```

## 原理

Elo 评分 → Dixon-Coles 泊松模型 → 比分概率矩阵 → 各竞猜玩法概率。
半场数据按 45% 进球比例推算。

## 依赖

需要 worldcup-2026 项目存在（自动定位 `~/data/code/python/worldcup-2026`）。
可通过 `WC2026_BACKEND` 环境变量手动指定 backend 路径。
后端运行时自动触发数据同步。
