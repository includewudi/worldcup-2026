"""FastAPI application entry point — World Cup 2026 Prediction API."""
import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import predictor, sync_service

logger = logging.getLogger("wc2026")
_scheduler: BackgroundScheduler | None = None

TOURNAMENT_END = "2026-07-19"


def _is_match_day() -> bool:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return "2026-06-11" <= today <= TOURNAMENT_END


def _auto_sync():
    if not _is_match_day():
        return
    try:
        result = sync_service.sync_results()
        if result.get("new_results", 0) > 0:
            logger.info("Auto-sync: %d new results (total %d played)",
                        result["new_results"], result["total_played"])
    except Exception as e:
        logger.error("Auto-sync failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _auto_sync,
        CronTrigger(hour="*", minute=15),
        id="auto_sync",
    )
    _scheduler.start()
    logger.info("Scheduler started: sync at :15 of every hour (match days only)")
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)


app = FastAPI(
    title="World Cup 2026 Prediction API",
    description="Football World Cup 2026 prediction system with Elo + Dixon-Coles + Monte Carlo",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5570", "http://127.0.0.1:5570"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "World Cup 2026 Prediction API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "teams": "/api/teams",
            "teams_by_group/{group}": "/api/teams/{group}",
            "fixtures": "/api/fixtures",
            "fixtures_by_group/{group}": "/api/fixtures/{group}",
            "standings": "/api/standings",
            "standings/{group}": "/api/standings/{group}",
            "tournament_info": "/api/tournament",
            "predict_match": "/api/predict/{home_code}/{away_code}",
            "monte_carlo": "/api/simulate?sims=10000",
            "sync": "POST /api/sync/refresh",
            "sync_status": "GET /api/sync/status",
        },
    }


@app.get("/api/teams")
def get_teams(group: str | None = None, sort_by: str = "fifa_ranking"):
    teams = predictor.teams_list()
    if group:
        teams = [t for t in teams if t["group"] == group.upper()]
    sort_keys = {"fifa_ranking": "fifa_ranking", "elo": "elo_rating", "composite": "composite_rating", "name": "name"}
    key = sort_keys.get(sort_by, "fifa_ranking")
    reverse = sort_by in ("elo", "composite")
    teams = sorted(teams, key=lambda x: x[key], reverse=reverse)
    return {"count": len(teams), "teams": teams}


@app.get("/api/teams/{group}")
def get_teams_by_group(group: str):
    if len(group) != 1 or group.upper() not in "ABCDEFGHIJKL":
        raise HTTPException(400, "Group must be a single letter A-L")
    teams = [t for t in predictor.teams_list() if t["group"] == group.upper()]
    return {"group": group.upper(), "count": len(teams), "teams": teams}


@app.get("/api/fixtures")
def get_fixtures(group: str | None = None):
    fixtures = predictor.fixtures_list()
    if group:
        fixtures = [f for f in fixtures if f["group"] == group.upper()]
    return {"count": len(fixtures), "fixtures": fixtures}


@app.get("/api/fixtures/{group}")
def get_fixtures_by_group(group: str):
    if len(group) != 1 or group.upper() not in "ABCDEFGHIJKL":
        raise HTTPException(400, "Group must be a single letter A-L")
    fixtures = [f for f in predictor.fixtures_list() if f["group"] == group.upper()]
    return {"group": group.upper(), "count": len(fixtures), "fixtures": fixtures}


@app.get("/api/tournament")
def get_tournament_info():
    return predictor.tournament_info()


@app.get("/api/standings")
def get_standings(group: str | None = None):
    return predictor.compute_group_standings(group)


@app.get("/api/standings/{group}")
def get_standings_by_group(group: str):
    if len(group) != 1 or group.upper() not in "ABCDEFGHIJKL":
        raise HTTPException(400, "Group must be a single letter A-L")
    return predictor.compute_group_standings(group)


@app.get("/api/predict/{home_code}/{away_code}")
def predict_match(home_code: str, away_code: str):
    home_code = home_code.upper()
    away_code = away_code.upper()
    if not predictor.get_team_by_code(home_code):
        raise HTTPException(404, f"Team not found: {home_code}")
    if not predictor.get_team_by_code(away_code):
        raise HTTPException(404, f"Team not found: {away_code}")
    return predictor.predict_match(home_code, away_code)


@app.get("/api/simulate")
def run_simulation(
    sims: int = Query(default=10000, ge=100, le=200000, description="Number of Monte Carlo simulations"),
    seed: int = Query(default=2026, description="Random seed"),
):
    return predictor.run_monte_carlo(n_simulations=sims, seed=seed)


@app.post("/api/sync/refresh")
def refresh_results():
    return sync_service.sync_results()


@app.get("/api/sync/status")
def sync_status():
    return sync_service.get_sync_status()
