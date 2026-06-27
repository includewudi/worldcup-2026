# 免费部署到外网

> 三种方案，全部免费，选一个就行。

## 方案对比

| 方案 | 平台 | 优点 | 缺点 |
|------|------|------|------|
| **A. HF Spaces** ⭐推荐 | Hugging Face | 一个 Space 搞定、不休眠、不绑卡、16GB RAM | URL 是 `xxx.hf.space` |
| **B. Vercel + Render** | 分两个平台 | Vercel CDN 超快、自定义域名 | Render 休眠、需绑卡 |
| **C. 本地 + Cloudflare Tunnel** | 自己 Mac | 零改动 | Mac 要一直开 |

---

## 方案 A: Hugging Face Spaces（推荐）

一个 Docker 容器同时跑前后端，完全免费，不休眠。

### 步骤

1. 注册 https://huggingface.co/join（GitHub 登录）

2. 右上角头像 → **New Space**
   - **Name**: `wc2026`（随意）
   - **SDK**: **Docker**
   - **Visibility**: Public
   - 点 **Create Space**

3. 把 GitHub 仓库同步到 HF Space（二选一）：

   **方式 1（推荐）：在 Space 页面直接 Files → 上传**
   ```bash
   # 克隆你的 GitHub 仓库后，把所有文件上传到 Space
   ```

   **方式 2：Git 推送**
   ```bash
   # 在你的 GitHub 仓库目录
   git remote add hf https://huggingface.co/spaces/你的用户名/wc2026
   git push hf main
   ```

4. Space 会自动构建 Dockerfile（2-5 分钟），构建完成后拿到 URL：
   ```
   https://你的用户名-wc2026.hf.space
   ```

5. 打开 URL，前端 + API 全部可用。

### 工作原理

- Dockerfile 两阶段构建：Node build 前端 → Python 跑 FastAPI
- 前端 build 产物放到 `backend/static/`
- FastAPI 检测到 `static/` 目录后自动挂载（`SERVE_FRONTEND=1`）
- 端口 7860（HF Spaces 要求）
- 访问 `/` 返回前端，`/api/*` 返回 API，`/predict` 等前端路由自动 fallback 到 index.html

### 更新

改代码后 `git push hf main`，Space 自动重新构建。

---

## 方案 B: Vercel + Render

前后端分开部署。

### Step 1: 后端 → Render

1. https://render.com → GitHub 登录
2. **New +** → **Blueprint** → 选仓库（自动读 `render.yaml`）
3. 拿到 URL：`https://wc2026-api-xxxx.onrender.com`

### Step 2: 前端 → Vercel

1. https://vercel.com → GitHub 登录
2. **Add New Project** → 选仓库
3. `vercel.json` 已配好，添加环境变量：
   - `VITE_API_BASE` = `https://wc2026-api-xxxx.onrender.com/api`
4. Deploy → 拿到 `https://worldcup-2026-xxx.vercel.app`

### Step 3: 互连 CORS

回 Render → Environment → `CORS_ORIGINS` = 你的 Vercel URL

---

## 方案 C: 本地 + Cloudflare Tunnel

适合自己用或给少数人分享。

```bash
# 启动后端 + 前端
cd backend && PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --port 8570 &
cd frontend && npx vite --port 5570 &

# 装 cloudflared
brew install cloudflared

# 一条命令获得公网 URL
cloudflared tunnel --url http://localhost:5570
```

拿到 `https://xxx.trycloudflare.com` 发给朋友。

后端 CORS 需要加这个域名：
```bash
CORS_ORIGINS=https://xxx.trycloudflare.com PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --port 8570
```

---

## 本地开发

不需要任何配置：

```bash
# 后端
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. python -m uvicorn app.main:app --port 8570

# 前端（另一个终端）
cd frontend && npm install && npx vite --port 5570
```

前端本地走 Vite proxy，自动转发 `/api` 到 `localhost:8570`。

## 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 8570 | 后端端口（HF Spaces 自动设 7860） |
| `CORS_ORIGINS` | `localhost:5570` | 允许的前端域名（逗号分隔） |
| `SERVE_FRONTEND` | 1 | 为 1 时后端自动服务 `static/` 目录 |
| `VITE_API_BASE` | 空 | 前端 API 地址（空=走 proxy） |
| `VITE_OUT_DIR` | dist | 前端 build 输出目录（HF 用 `../backend/static`） |
