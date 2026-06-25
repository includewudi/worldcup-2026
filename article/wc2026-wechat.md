# 为了世界杯竞猜，我 code 了个预测系统

最近各种世界杯竞猜活动满天飞，群里每天都有人在晒战绩。我手痒也参加了几个，然后发现——光靠直觉猜真的会输得很惨。

于是花了两晚上搓了个工具出来。本来只想给自己查数据用，结果群友看到后有人说「能不能把赛程导到日历里」，有人说「我只支持 Mac」，需求越聊越多，最后就变成了现在这个样子。

## 能干什么

- **实时比分**：ESPN 数据源，每小时自动同步，小组赛淘汰赛都有
- **对阵预测**：选两支队，算出每个比分的概率，热力图展示
- **夺冠模拟**：蒙特卡洛跑一万次，看谁大概率进四强、进决赛
- **积分榜**：按小组实时更新，已完成比赛高亮
- **Mac 日历导入**：关注哪支球队，命令行一键导入日历，带时间场馆对阵

打开就是总览页，实时积分榜 + 夺冠概率 + Elo 评分一站看完：

![](../screenshots/01-dashboard.png)

积分榜按小组展示，踢完的比赛绿色标记：

![](../screenshots/02-standings.png)

淘汰赛单独一页，24 场对阵按时间排好：

![](../screenshots/03-knockout.png)

## 预测怎么算的

不是调什么付费 API，是自己算的，三层叠在一起。

### 第一层：Elo 评分

每支队有个 Elo ，参考 FIFA 排名和历史战绩定的初始值。每场踢完按标准 Elo 公式更新：

```
R_new = R_old + K × (actual - expected)
```

K 值设的 30，世界杯级别权重高一点。expected 用 logistic 函数算，东道主 USA/Mexico/Canada 有 65 分主场加成。

### 第二层：Dixon-Coles 泊松

两队对阵时，预期进球数 λ 用对数线性模型算：

```
λ_home = α_attack(home) + β_defense(away) + γ_主场优势
```

然后泊松分布采样得到比分概率矩阵。选 Dixon-Coles 而不是纯泊松，是因为它修了经典问题：0-0 和 1-1 概率被纯泊松低估，有个 ρ 参数专门调这个。

### 第三层：蒙特卡洛

从小组赛一路模拟到决赛，跑一万次，统计每支队在每轮被淘汰的概率。总览页那个夺冠概率条就是这么来的。

选两队预测的页面长这样：

![](../screenshots/05-predict.png)

颜色越深概率越高，底部还有胜平负三项概率。蒙特卡洛模拟页：

![](../screenshots/06-simulate.png)

## 实时比分怎么搞的

数据源 ESPN，免费，不要 key，有世界杯数据。

一开始按天循环调 API，39 天 39 个请求，同步一次十几秒还老超时。后来发现 ESPN 支持区间查询：

```
site.api.espn.com/.../scoreboard?dates=20260611-20260719
```

一次请求 100 场比赛全回来，同步时间降到 4 秒。

小组赛和淘汰赛的区分靠 altGameNote 字段：小组赛是 "FIFA World Cup, Group A"，淘汰赛只有 "FIFA World Cup"。靠这个拆开存储。

自动同步用的 APScheduler，每小时第 15 分钟跑一次，只在比赛日有效。

## Mac 日历导入：群友点菜做的

这个功能是被群友催出来的。有人说「我想在日历里看到巴西的比赛」，有人说「我只用 Mac 日历」，那就做一个。

写了个独立的 bash 脚本，不依赖后端，只要有 ESPN 和 macOS 就能跑：

```
$ follow_calendar.sh BRA ARG --dry-run

Fetching from ESPN API...
  Fetched + cached successfully

=== 8 matches found ===

  06/14 Sun 06:00 | 巴西 1-1 摩洛哥 | C组 | MetLife Stadium
  06/17 Wed 09:00 | 阿根廷 3-0 阿尔及利亚 | J组 | Arrowhead Stadium
  06/20 Sat 08:30 | 巴西 3-0 海地 | C组 | Lincoln Financial Field
  06/30 Tue 01:00 | 巴西 vs F组第2 | 淘汰赛 | NRG Stadium

[DRY RUN] No calendar events created.
```

去掉 --dry-run 就是真写入 macOS 日历，AppleScript 操作 Calendar.app，每个事件带时间、场馆、城市、对阵，踢完的还有比分。

几个细节：

- **中文名**：ESPN 返回 "Brazil"，日历里要显示"巴西"，维护了个 1KB 映射表覆盖 48 队
- **淘汰赛占位符**："Group F 2nd Place" 翻译成"F组第2"
- **幂等**：同一支队重复导入不会产生重复事件，靠标题+时间去重
- **离线模式**：加 --cache 用上次缓存的 ESPN 数据，没网也能跑

只支持 Mac 日历。Windows 和手机端的需求暂时没做，如果群里呼声高再说。

## 关注球队页

网页端也做了关注功能，输入队名看该队所有比赛：

![](../screenshots/04-follow.png)

网页端纯展示，日历导入交给命令行工具，职责分开。

## 手机也能看

本来只做了桌面端，群里有几个人说想在手机上刷。就加了响应式，侧边栏在手机上变成抽屉：

![](../screenshots/07-mobile-home.png)

点右上角菜单展开：

![](../screenshots/08-mobile-menu.png)

纯 CSS 断点搞的，没引额外 UI 库。

## 踩过的坑

### Python 缓存失效

predictor 里有个模块级变量缓存赛程数据，同步完想清空，用 from import 的方式——结果只重新绑定了局部名，模块里的原始变量没动。改成在模块里写 invalidate_cache() 函数加 global 声明才好。

### f-string 反斜杠

Python 3.10 不让 f-string 表达式里出现反斜杠，正则替换 \g<1> 在 f-string 里直接报 SyntaxError。解法是把 replacement 提到 f-string 外面，用 lambda 替代字符串。

### ESPN 数据区分

100 场在一个 JSON 里，一开始靠有没有 group 字段区分小组赛淘汰赛，后来发现淘汰赛占位符不稳定。最终用 altGameNote 字段，靠谱多了。

## 开源了

代码放 GitHub 了：

```
github.com/includewudi/worldcup-2026
```

README 有完整部署教程，后端、前端、命令行工具三种方式都能单独跑。那个日历导入脚本甚至能脱离整个系统独立用，装上就能跑。

世界杯还有一年，今年竞猜应该不会再输太惨了。
