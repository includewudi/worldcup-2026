# AGENTS.md — WC2026 Prediction System

> 本文件写给 AI agent（Claude / GPT / Cursor / Copilot 等）看。
> 拿到这个 repo 后，按本文档即可独立部署全套系统或单独部署日历 skill。

## 项目概况

2026 FIFA 世界杯预测系统。三层预测引擎（Elo → Dixon-Coles 泊松 → 蒙特卡洛）+ ESPN 实时比分同步 + macOS 日历导入。

- **后端**：Python 3.10+ / FastAPI / APScheduler — 端口 8570
- **前端**：React 18 / TypeScript / Tailwind CSS / Vite — 端口 5570
- **日历 Skill**：纯 Bash + AppleScript，零后端依赖，独立运行

## 三种部署模式

### 模式 A部署日历 Skill（最轻量，无需后端）

仅需 1 个文件 + 1 个 1KB 数据文件，任何 macOS 机器即可运行。

**前置条件：**
- macOS（需要 Calendar.app + osascript）
- Python 3（系统自带即可，仅用于 JSON 解析）
- curl + jq

**步骤：**

```bash
# 1. 复制 skill 到目标机器
mkdir -p ~/.local/share/wc2026-follow
cp skills/wc2026-follow/follow_calendar.sh ~/.local/share/wc2026-follow/
cp -r skills/wc2026-follow/data ~/.local/share/wc2026-follow/

# 2. 赋予执行权限
chmod +x ~/.local/share/wc2026-follow/follow_calendar.sh

# 3. 测试（dry-run，不写入日历）
~/.local/share/wc2026-follow/follow_calendar.sh BRA --dry-run

# 4. 正式导入（首次会弹出 macOS 日历权限授权）
~/.local/share/wc2026-follow/follow_calendar.sh BRA
```

**作为 OpenCode/Claude skill 安装：**

```bash
cp -r skills/wc2026-follow ~/.config/opencode/skills/
# 或 Claude Code:
cp -r skills/wc2026-follow ~/.claude/skills/
```

安装后 AI agent 通过自然语言触发（"导入巴西赛程"、"世界杯日历"等）。

**Skill 用法：**

```bash
follow_calendar.sh BRA                    # 导入巴西全部比赛
follow_calendar.sh BRA ARG FRA            # 多队
follow_calendar.sh BRA --dry-run          # 预览不写入
follow_calendar.sh BRA --cache            # 离线模式（用缓存数据）
follow_calendar.sh --all                  # 全部 48 队
follow_calendar.sh BRA --calendar 工作    # 指定日历名称
```

**数据流：** ESPN API → JSON 解析（Python heredoc）→ 中文名映射 → AppleScript → Calendar.app

**文件清单（仅 3 个文件）：**

| 文件 | 大小 | 作用 |
|------|------|------|
| `follow_calendar.sh` | ~280 行 | 主脚本：ESPN 拉取 + 日历写入 |
| `data/team_names_cn.json` | ~1KB | 英文名 → 中文名映射（48 队） |
| `SKILL.md` | ~50 行 | Skill 触发词和描述（可选） |

### 模式 A2：部署竞猜分析 Skill（需项目存在）

**前置条件：** worldcup-2026 项目已 clone 到本地 + Python 3.10+

```bash
# 安装 skill
cp -r skills/wc2026-analyze ~/.config/opencode/skills/
# 或 Claude Code:
cp -r skills/wc2026-analyze ~/.claude/skills/

# 直接使用
bash skills/wc2026-analyze/analyze.sh EGY IRN all           # 全分析
bash skills/wc2026-analyze/analyze.sh 巴西 阿根廷 btts      # 只看两队都进球
bash skills/wc2026-analyze/analyze.sh CPV KSA ht-draw over  # 半场打平 + 大小球
```

分析类型：`summary` `result` `btts` `ht-result` `ht-draw` `over` `cs` `ht-cs` `handicap` `all`

非默认路径设置：`export WC2026_BACKEND=/path/to/worldcup-2026/backend`

### 模式 B：部署后端 API

**前置条件：** Python 3.10+

```bash
cd backend

# 推荐：用 venv 隔离
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 首次运行：自动从 ESPN 拉取数据，生成 fixtures.json
PYTHONPATH=. python -m uvicorn app.main:app --host 0.0.0.0 --port 8570

# 验证
curl http://localhost:8570/api/teams | python -m json.tool | head -20
```

**`fixtures.json` 说明：**
- 运行时自动生成，已被 `.gitignore` 排除
- 首次启动后端会自动调用 ESPN 同步
- 内容：72 场小组赛 + 24 场淘汰赛 + 实时比分

**核心文件：**

| 文件 | 职责 |
|------|------|
| `app/main.py` | FastAPI 路由 + APScheduler 定时同步 |
| `app/services/predictor.py` | Elo + Dixon-Coles + Monte Carlo 引擎 |
| `app/services/sync_service.py` | ESPN 单次区间 API 调用 |
| `app/data/teams.json` | 48 队元数据（Elo / FIFA 排名 / 大洲） |

**API 端点：**

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/teams` | 全部 48 队 |
| GET | `/api/fixtures` | 72 场小组赛 + 比分 |
| GET | `/api/knockout` | 24 场淘汰赛 |
| GET | `/api/standings` | 实时积分榜 |
| GET | `/api/predict/{home}/{away}` | 两队对阵预测 |
| GET | `/api/simulate?sims=10000` | 蒙特卡洛模拟 |
| POST | `/api/sync/refresh` | 手动触发 ESPN 同步 |
| GET | `/api/sync/status` | 同步状态 |

### 模式 C：部署前端

**前置条件：** Node.js 18+

```bash
cd frontend
npm install
npx vite --port 5570 --host
```

打开 http://localhost:5570

前端通过 Vite proxy 将 `/api` 转发到 `http://localhost:8570`，后端必须同时运行。

**页面：**

| 路由 | 页面 | 文件 |
|------|------|------|
| `/` | 总览（积分榜+夺冠概率+Elo） | `Dashboard.tsx` |
| `/follow` | 关注球队 | `FollowPage.tsx` |
| `/standings` | 积分榜 | `StandingsPage.tsx` |
| `/knockout` | 淘汰赛 | `KnockoutPage.tsx` |
| `/teams` | 队伍 | `TeamsPage.tsx` |
| `/fixtures` | 赛程 | `FixturesPage.tsx` |
| `/predict` | 对阵预测 | `PredictPage.tsx` |
| `/simulate` | 赛事模拟 | `SimulationPage.tsx` |

## 关键技术决策

### ESPN 单次区间 API

不用按天循环（39 次 HTTP），用区间查询一次拿全部：

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719
```

返回 ~100 场比赛。用 `altGameNote` 字段区分小组赛（"FIFA World Cup, Group A"）和淘汰赛（"FIFA World Cup"）。

### Dixon-Coles 低分修正

纯泊松会低估 0-0 和 1-1 概率。Dixon-Coles 引入 ρ 参数修正低分情况。实现见 `predictor.py` 中 `dixon_coles_probability()` 函数。

### Predict 缓存

`predictor.py` 用模块级 `_fixtures_cache` 缓存。同步后需调用 `invalidate_cache()` 函数（带 `global` 声明）清空。

⚠️ **常见坑：** `from services.predictor import _fixtures_cache; _fixtures_cache = None` 只重绑定局部名，不会清模块内的缓存。必须用模块内定义的 `invalidate_cache()` 函数。

### 移动端响应式

`AppLayout.tsx` 用 Tailwind `lg:` 断点：
- ≥1024px：侧边栏固定 240px
- <1024px：hamburger 按钮 + 滑入抽屉 + 遮罩 + 路由切换自动关闭

## 常见问题

**Q: 后端启动报 pydantic / typing_extensions 错误？**
A: 系统 Python 可能损坏。用 `.venv` 隔离：`python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`

**Q: ESPN 返回 0 场比赛？**
A: 检查日期范围。世界杯赛程为 2026-06-11 到 2026-07-19。非比赛日期间 scoreboard 可能为空。

**Q: Skill 首次运行无反应？**
A: macOS 需要授权 Calendar 自动化权限。系统设置 → 隐私与安全 → 自动化 → 允许终端/脚本访问日历。

**Q: 淘汰赛显示 "F组第2" 这种占位符？**
A: 这是正常的。小组赛未全部结束前，ESPN 返回的就是占位符。Skill 会翻译成中文（"Group F 2nd Place" → "F组第2"）。

**Q: 如何更新比分？**
A: 后端每小时 :15 自动同步。Skill 每次运行都会拉最新数据。也可手动 `curl -X POST http://localhost:8570/api/sync/refresh`。

## 环境变量

无必需环境变量。ESPN API 免费、无需 key。

可选：
- `FOOTBALL_DATA_TOKEN`：football-data.org API token（备用数据源，非必需）

## 技术栈版本

| 组件 | 版本 |
|------|------|
| Python | 3.10+ |
| FastAPI | 0.115.6 |
| uvicorn | 0.34.0 |
| apscheduler | 3.10.0+ |
| pydantic | 2.11.0+ |
| Node.js | 18+ |
| React | 18.3.1 |
| TypeScript | 5.7.2 |
| Vite | 6.0.7 |
| Tailwind CSS | 3.4.17 |
