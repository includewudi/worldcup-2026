# ⚽ World Cup 2026 Prediction System

> 2026 FIFA World Cup (USA·Mexico·Canada) — Elo + Dixon-Coles + Monte Carlo 预测 + ESPN 实时比分 + macOS 日历导入

## 📋 目录

- [功能一览](#-功能一览)
- [在线 Demo](#-在线-demo)
- [本地开发](#-本地开发)
- [免费部署到外网](#-免费部署到外网)
- [部署注意事项](#-部署注意事项)
- [项目架构](#-项目架构)
- [预测模型](#-预测模型)
- [API 文档](#-api-文档)
- [数据同步](#-数据同步)
- [macOS 日历 Skill](#-macos-日历-skill)
- [竞猜分析 Skill](#-竞猜分析-skill)
- [技术栈](#-技术栈)

---

## 🎯 功能一览

| 功能 | 说明 |
|------|------|
|  总览仪表盘 | 夺冠概率 Top 10、Elo 评分、比赛进度、晋级预测 |
| 📅 赛程 | 72 场小组赛 + 24 场淘汰赛，实时比分 |
| 🏆 积分榜 | 12 组实时积分（自动计算） |
| 🎯 对阵预测 | Dixon-Coles 泊松模型，胜平负 / 大小球 / BTTS / 正确比分 |
| 🎲 赛事模拟 | 蒙特卡洛全赛程模拟（最高 20 万次） |
| ⭐ 关注球队 | 搜索关注 + 一键导出 .ics 日历 |
| 🔄 自动同步 | ESPN 比分每小时自动更新（比赛日） |
| 📱 移动端 | 响应式布局，hamburger 抽屉导航 |

---

## 🌐 在线 Demo

- **前端**：https://worldcup-2026-seven-tau.vercel.app
- **后端 API**：https://worldcup-2026-ypt6.onrender.com/docs

---

## 🚀 本地开发

### 前置

- Python 3.10+
- Node.js 18+

### 启动

```bash
# 后端（端口 8570）
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. python -m uvicorn app.main:app --host 0.0.0.0 --port 8570

# 前端（端口 5570，另一个终端）
cd frontend
npm install
npx vite --port 5570 --host
```

打开 http://localhost:5570

前端开发模式通过 Vite proxy 自动转发 `/api` 到 `localhost:8570`。

---

## ☁️ 免费部署到外网

三种方案，全部免费。详细步骤见 [DEPLOY.md](./DEPLOY.md)。

| 方案 | 平台 | 推荐场景 | 优点 | 缺点 |
|------|------|----------|------|------|
| **A. Hugging Face Spaces** ⭐ | HF | 不绑卡 / 不休眠 | 一个容器搞定、免费 16GB RAM | URL 是 `xxx.hf.space` |
| **B. Vercel + Render** | 分两个平台 | 自定义域名 / CDN | Vercel 超快、自动 HTTPS | Render 需绑卡、会休眠 |
| **C. Cloudflare Tunnel** | 自己电脑 | 临时分享 | 零改动 | 电脑要一直开 |

### 方案 A：Hugging Face Spaces（推荐）

1. 注册 https://huggingface.co/join
2. New Space → SDK 选 **Docker**
3. 推送代码，Dockerfile 自动构建前后端一体镜像
4. 拿到 `https://你的用户名-wc2026.hf.space`

### 方案 B：Vercel + Render

1. **后端**：Render → New Web Service → Root Directory: `backend` → Build: `pip install -r requirements.txt` → Start: `bash start.sh`
2. **前端**：Vercel → Import → Root Directory: `frontend` → 环境变量 `VITE_API_BASE` = `https://你的render域名/api`
3. **CORS**：Render 环境变量加 `CORS_ORIGINS` = 你的 Vercel 域名

### 方案 C：Cloudflare Tunnel

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:5570
```

---

## ⚠️ 部署注意事项

### Render 免费层休眠问题

Render 免费层 **15 分钟无访问自动休眠**，下次访问冷启动 **50 秒**。

**解决方案（三选一）：**

1. **UptimeRobot 保活**（推荐）
   - 注册 https://uptimerobot.com
   - 每 5 分钟 ping `https://你的域名/api/sync/status`
   - 免费层够用，世界杯期间流量大也基本不会睡

2. **前端缓存兜底**（已内置）
   - API 请求超时 15 秒 → 自动回退 localStorage 缓存
   - 显示橙色提示条「显示的是 N 分钟前的缓存数据」+ 重试按钮
   - 首次访问无缓存时显示「服务器启动中」等待页

3. **换 HF Spaces** — 不休眠，无此问题

### CORS 跨域配置

前后端分域名部署时，必须在后端设置 `CORS_ORIGINS` 环境变量：

```
# Render → Environment → CORS_ORIGINS
https://你的vercel域名.vercel.app
```

多个域名逗号分隔。忘记配的话前端页面能加载但数据请求全被拦截。

### Vercel 构建配置

Vercel 会把项目当 monorepo（有 frontend/ + backend/），必须：

- **Root Directory** 设为 `frontend`（否则在根目录找不到 package.json 报错）
- **环境变量** `VITE_API_BASE` = `https://你的后端域名/api`
- `vercel.json` 在 `frontend/` 目录下，不在根目录

### ESPN API 限制

- 免费、无需 key
- 但返回数据有缓存延迟（约 5-10 分钟）
- 非比赛日 scoreboard 可能为空
- 建议比赛日每小时同步，非比赛日不浪费请求

### 数据文件说明

| 文件 | 在 Git | 说明 |
|------|--------|------|
| `backend/app/data/teams.json` | ✅ 是 | 48 队元数据（Elo/FIFA/大洲），必需 |
| `backend/app/data/fixtures.json` | ✅ 是 | 72+24 场赛程种子数据，必需，运行时被 ESPN 更新 |
| `backend/static/` | ❌ 否 | 前端 build 产物，HF Spaces 部署时生成 |
| `backend/.venv/` | ❌ 否 | Python 虚拟环境 |

---

## 🏗️ 项目架构

```
worldcup-2026/
├── backend/                          # FastAPI (port 8570)
│   ├── app/
│   │   ├── main.py                   # API 路由 + APScheduler + 静态文件服务
│   │   ├── services/
│   │   │   ├── predictor.py          # Elo + Dixon-Coles + Monte Carlo
│   │   │   └── sync_service.py       # ESPN 单次区间 API 同步
│   │   └── data/
│   │       ├── teams.json            # 48 队元数据
│   │       └── fixtures.json         # 赛程种子数据（运行时更新）
│   ├── analyze.py                    # 竞猜分析 CLI
│   ├── start.sh                      # 云平台启动入口
│   └── requirements.txt
├── frontend/                         # Vite + React + TS (port 5570)
│   ├── src/
│   │   ├── api/index.ts              # axios + localStorage 缓存层
│   │   ├── pages/                    # 8 个页面
│   │   │   ├── Dashboard.tsx         # 总览
│   │   │   ├── StandingsPage.tsx     # 积分榜
│   │   │   ├── KnockoutPage.tsx      # 淘汰赛
│   │   │   ├── TeamsPage.tsx         # 队伍
│   │   │   ├── FixturesPage.tsx      # 赛程
│   │   │   ├── PredictPage.tsx       # 预测
│   │   │   ├── SimulationPage.tsx    # 蒙特卡洛
│   │   │   └── FollowPage.tsx        # 关注 + 日历导出
│   │   ├── contexts/SyncContext.tsx  # 全局同步状态
│   │   └── components/AppLayout.tsx  # 响应式布局
│   ├── vercel.json                   # Vercel 配置
│   └── package.json
├── skills/
│   ├── wc2026-follow/                # macOS 日历 skill（独立运行）
│   │   ├── follow_calendar.sh        # ESPN → Calendar.app
│   │   └── data/team_names_cn.json   # 中英文队名映射
│   └── wc2026-analyze/               # 竞猜分析 skill
│       └── analyze.sh                # CLI wrapper
├── Dockerfile                        # HF Spaces / Docker 部署
├── render.yaml                       # Render Blueprint
├── DEPLOY.md                         # 详细部署教程
└── AGENTS.md                         # AI Agent 部署指南
```

---

## 📊 预测模型

| 层 | 方法 | 说明 |
|----|------|------|
| 球队实力 | **Elo 评分** | eloratings.net 数据，范围 1800-2200 |
| 进球预测 | **Dixon-Coles 双变量泊松** | Dixon & Coles (1997)，低分修正（0-0/1-1 概率上调） |
| 赛事模拟 | **蒙特卡洛** | 全 48 队赛程模拟，最高 20 万次 |

**预测输出**：胜平负概率 / 预期进球 / 最可能比分 / BTTS / 大小球 / 半场结果 / 正确比分 Top 10 / 亚洲盘口

---

## 🔌 API 文档

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/teams` | 48 队（Elo / FIFA 排名 / 大洲） |
| GET | `/api/teams/{group}` | 按组查询（A-L） |
| GET | `/api/fixtures` | 72 场小组赛 + 比分 |
| GET | `/api/knockout` | 24 场淘汰赛 |
| GET | `/api/standings` | 实时积分榜（12 组） |
| GET | `/api/tournament` | 赛事信息 |
| GET | `/api/predict/{home}/{away}` | 对阵预测（如 `/api/predict/BRA/ARG`） |
| GET | `/api/simulate?sims=10000` | 蒙特卡洛模拟 |
| POST | `/api/sync/refresh` | 手动触发 ESPN 同步 |
| GET | `/api/sync/status` | 同步状态 |

Swagger 文档：`/docs`

---

## 🔄 数据同步

**ESPN API**（免费、无需 key）：

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719
```

| 同步方式 | 触发 |
|----------|------|
| 后端定时 | APScheduler，比赛日每小时 :15 |
| 前端手动 | 侧边栏同步按钮 |
| Skill 触发 | 分析/日历 skill 运行时自动 POST |

---

## 📱 macOS 日历 Skill

`skills/wc2026-follow/` — **完全独立**，不需要后端。

```bash
bash skills/wc2026-follow/follow_calendar.sh BRA          # 导入巴西全部比赛
bash skills/wc2026-follow/follow_calendar.sh BRA ARG      # 多队
bash skills/wc2026-follow/follow_calendar.sh BRA --dry-run # 预览不写入
bash skills/wc2026-follow/follow_calendar.sh BRA --cache   # 离线模式
bash skills/wc2026-follow/follow_calendar.sh --all         # 全部 48 队
```

首次运行 macOS 会弹窗授权 Calendar 自动化权限。

---

## 🎯 竞猜分析 Skill

`skills/wc2026-analyze/` — 需要 worldcup-2026 项目存在。

```bash
bash skills/wc2026-analyze/analyze.sh 巴西 阿根廷 all      # 全分析
bash skills/wc2026-analyze/analyze.sh EGY IRN btts        # 两队都进球
bash skills/wc2026-analyze/analyze.sh CPV KSA ht-draw over # 半场打平 + 大小球
```

分析类型：`summary` `result` `btts` `ht-result` `ht-draw` `over` `cs` `ht-cs` `handicap` `all`

---

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.10+, FastAPI 0.115, APScheduler, Pydantic |
| 前端 | React 18, TypeScript 5.7, Tailwind CSS 3.4, Vite 6 |
| 数据 | ESPN Soccer API（免费） |
| 预测 | Elo, Dixon-Coles 泊松, Monte Carlo |
| 日历 | AppleScript → Calendar.app |
| 部署 | Vercel + Render / Hugging Face Spaces / Docker |

---

## 📚 参考资料

- Dixon & Coles (1997) — *Modelling Association Football Scores*
- [eloratings.net](https://eloratings.net)
- [ESPN Soccer API](https://site.api.espn.com)

---

## License

MIT
