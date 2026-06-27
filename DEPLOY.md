# 免费部署到外网（Vercel + Render）

> 30 分钟把 World Cup 2026 系统部署到公网，永久免费。

## 架构

```
用户浏览器
  │
  ├── Vercel (前端 React)
  │     └── 调用 API →
  │
  └── Render (后端 FastAPI)
        └── ESPN API（拉取比分）
```

## 前置

- GitHub 账号
- 仓库已 fork 或 push 到你自己的 GitHub

## Step 1: 部署后端到 Render

1. 打开 https://render.com，用 GitHub 登录
2. **New +** → **Web Service** → 选择你的 `worldcup-2026` 仓库
3. 填写：
   - **Name**: `wc2026-api`（或随意）
   - **Region**: 新加坡 / Oregon（离你近的）
   - **Runtime**: Python 3
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `bash start.sh`
   - **Plan**: Free
4. **Environment** 标签 → 添加变量：
   - `CORS_ORIGINS` = （暂时留空，部署前端后填）
5. 点 **Create Web Service**

等 2-3 分钟构建完成，Render 会给你一个 URL：

```
https://wc2026-api.onrender.com
```

验证：

```bash
curl https://wc2026-api.onrender.com/api/sync/status
```

返回 JSON 即成功。

⚠️ Render 免费层：15 分钟无访问会休眠，下次访问冷启动 ~30s。世界杯期间流量大基本不会睡。

## Step 2: 部署前端到 Vercel

1. 打开 https://vercel.com，用 GitHub 登录
2. **Add New** → **Project** → 选择 `worldcup-2026` 仓库
3. 配置已写在 `vercel.json`，确认即可：
   - **Framework**: Vite
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
4. **Environment Variables** → 添加：
   - `VITE_API_BASE` = `https://wc2026-api.onrender.com/api`
   （替换成你 Step 1 拿到的 Render URL + `/api`）
5. 点 **Deploy**

等 1-2 分钟，Vercel 给你：

```
https://worldcup-2026-xxx.vercel.app
```

打开，确认页面正常显示，赛程、积分榜、预测功能都能用。

## Step 3: 互连 CORS

回到 Render Dashboard → 你的 Web Service → Environment：

- `CORS_ORIGINS` = `https://worldcup-2026-xxx.vercel.app`

（多个域名用逗号分隔，比如 preview URL 也要加）

保存后 Render 自动重启，前端即可正常调用 API。

## 常见问题

### Q: Vercel 部署后页面空白？
A: 检查浏览器 Console。如果是 CORS 错误，确认 Step 3 的 `CORS_ORIGINS` 已配置。如果是 404，检查 Vercel 的 build log 是否成功生成 `dist/`。

### Q: Render 冷启动太慢？
A: 免费层无解。可以在 https://uptimerobot.com 配 5 分钟 ping `/api/sync/status`，让服务保持热。世界杯期间流量大一般不会睡。

### Q: 怎么更新比分？
A: 后端每小时 :15 自动从 ESPN 同步。无需手动操作。

### Q: 部署后能改代码吗？
A: 改了 push 到 `main`，Render 和 Vercel 都会自动重新部署。

## 本地开发

本地不用任何配置：

```bash
# 后端
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. python -m uvicorn app.main:app --port 8570

# 前端（另一个终端）
cd frontend && npm install && npx vite --port 5570
```

前端本地走 Vite proxy，自动转发 `/api` 到 `localhost:8570`。
