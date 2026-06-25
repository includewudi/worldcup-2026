# ⚽ World Cup 2026 Prediction System

> 2026 FIFA World Cup (USA·Mexico·Canada) — Elo + Dixon-Coles + Monte Carlo prediction with real-time ESPN sync and macOS calendar integration

## 🚀 Quick Start

### Backend (port 8570)

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. python -m uvicorn app.main:app --host 0.0.0.0 --port 8570
```

### Frontend (port 5570)

```bash
cd frontend
npm install
npx vite --port 5570 --host
```

Open http://localhost:5570

### macOS Calendar Skill (standalone, no backend needed)

```bash
bash skills/wc2026-follow/follow_calendar.sh BRA          # Import Brazil fixtures
bash skills/wc2026-follow/follow_calendar.sh BRA ARG       # Multiple teams
bash skills/wc2026-follow/follow_calendar.sh BRA --dry-run # Preview
```

## 🏗️ Architecture

```
worldcup-2026/
├── backend/                      # FastAPI (port 8570)
│   ├── app/
│   │   ├── main.py               # API routes + APScheduler
│   │   ├── services/
│   │   │   ├── predictor.py      # Elo + Dixon-Coles + Monte Carlo
│   │   │   └── sync_service.py   # ESPN multi-source sync
│   │   └── data/
│   │       ├── teams.json        # 48 teams
│   │       └── fixtures.json     # 72 fixtures (gitignored, auto-generated)
│   └── requirements.txt
├── frontend/                     # Vite + React + TS (port 5570)
│   └── src/
│       ├── pages/                # Dashboard, Teams, Fixtures, Predict, Sim, Follow, Standings
│       ├── contexts/SyncContext.tsx  # Global sync state
│       └── components/AppLayout.tsx
└── skills/wc2026-follow/         # Standalone macOS calendar skill
    ├── SKILL.md
    ├── follow_calendar.sh        # ESPN → Calendar
    └── data/team_names_cn.json   # 1KB Chinese team name map
```

## 📊 Prediction Model

| Layer | Method | Description |
|-------|--------|-------------|
| Team strength | **Elo ratings** | eloratings.net, range 1800-2200 |
| Goal prediction | **Dixon-Coles bivariate Poisson** | Dixon & Coles (1997), low-score correction |
| Tournament | **Monte Carlo** | Full 48-team simulation, up to 200K runs |

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | 48 teams with Elo/FIFA ratings |
| GET | `/api/fixtures` | 72 fixtures + live scores |
| GET | `/api/standings` | Group standings (computed from real results) |
| GET | `/api/predict/{home}/{away}` | Match prediction (Dixon-Coles) |
| GET | `/api/simulate?sims=10000` | Monte Carlo tournament simulation |
| POST | `/api/sync/refresh` | Manual ESPN sync |
| GET | `/api/sync/status` | Last sync time + counts |

## 🔄 Data Sync

**ESPN API** (primary, free, no key):
```
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

- Backend: APScheduler runs hourly at :15 during match days
- Frontend: manual sync button in sidebar
- Skill: fetches directly + triggers backend sync if running

## 📱 macOS Calendar Skill

The `wc2026-follow` skill is **fully standalone** — no backend required.

```bash
# Import all Brazil matches (group + knockout)
bash skills/wc2026-follow/follow_calendar.sh BRA

# Pull latest ESPN scores before importing
bash skills/wc2026-follow/follow_calendar.sh BRA

# Offline mode (uses last cached ESPN data)
bash skills/wc2026-follow/follow_calendar.sh BRA --cache

# Import all 48 teams
bash skills/wc2026-follow/follow_calendar.sh --all
```

**Features:**
- Live data from ESPN API (scores, fixtures, knockout brackets)
- Beijing timezone conversion (UTC → +8)
- 30-minute advance reminder per event
- Idempotent (skip existing events)
- Chinese team names (巴西, 阿根廷, 法国…)
- 1KB local data (just team name map)

**First run:** macOS will prompt for Calendar automation permission.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, APScheduler, Pydantic |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Data | ESPN Soccer API |
| Prediction | Elo, Dixon-Coles, Monte Carlo |
| Calendar | AppleScript → Calendar.app |

## 📚 References

- Dixon & Coles (1997) — *Modelling Association Football Scores*
- [eloratings.net](https://eloratings.net)
- [Nate Silver PELE](https://www.natesilver.net)

## License

MIT
