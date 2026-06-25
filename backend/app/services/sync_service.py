"""
Multi-source match result sync.

Primary: ESPN unofficial scoreboard API (free, no key, reliable)
  GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD

Optional: football-data.org (requires token)
  GET https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=FINISHED
"""
from __future__ import annotations

import json
import os
import threading
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FIXTURES_PATH = DATA_DIR / "fixtures.json"

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
FOOTBALL_DATA_BASE = "https://api.football-data.org/v4/competitions/WC/matches"

_last_sync: dict = {"espn": None, "football_data": None, "results": {}, "updated": 0}
_sync_lock = threading.Lock()

ESPN_NAME_MAP: dict[str, str] = {
    "BOS": "BIH", "SUI": "SUI", "URU": "URU", "CZE": "CZE", "PAR": "PAR",
    "CRC": "CRC", "TUR": "TUR", "RSA": "RSA", "KOR": "KOR", "IRN": "IRN",
}

FD_TOKEN_ENV = "FOOTBALL_DATA_TOKEN"


def _http_get_json(url: str, headers: dict | None = None, timeout: int = 15) -> dict:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "WC2026-Sync/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_espn_range(start: str, end: str) -> tuple[list[dict], list[dict]]:
    """Fetch matches from ESPN across a date range (YYYY-MM-DD).

    Returns (group_results, knockout_results).
    ESPN supports a single call with dates=YYYYMMDD-YYYYMMDD.
    """
    start_compact = start.replace("-", "")
    end_compact = end.replace("-", "")
    url = f"{ESPN_BASE}?dates={start_compact}-{end_compact}"
    try:
        data = _http_get_json(url)
    except Exception as e:
        _last_sync["results"]["espn_error"] = str(e)
        return [], []

    group_results: list[dict] = []
    knockout_results: list[dict] = []
    seen_ko: set = set()

    for event in data.get("events", []):
        comps = event.get("competitions", [])
        if not comps:
            continue
        comp = comps[0]
        competitors = comp.get("competitors", [])
        home = next((t for t in competitors if t.get("homeAway") == "home"), {})
        away = next((t for t in competitors if t.get("homeAway") == "away"), {})
        if not home or not away:
            continue

        home_abbr = ESPN_NAME_MAP.get(
            home.get("team", {}).get("abbreviation", ""),
            home.get("team", {}).get("abbreviation", ""),
        )
        away_abbr = ESPN_NAME_MAP.get(
            away.get("team", {}).get("abbreviation", ""),
            away.get("team", {}).get("abbreviation", ""),
        )
        status = comp.get("status", {}).get("type", {})
        completed = status.get("completed", False)
        alt_note = comp.get("altGameNote", "")
        venue_obj = comp.get("venue", {})
        venue = venue_obj.get("fullName", "")
        city = venue_obj.get("address", {}).get("city", "")
        home_display = home.get("team", {}).get("displayName", home_abbr)
        away_display = away.get("team", {}).get("displayName", away_abbr)

        result = {
            "date": event.get("date", "")[:10],
            "utc_time": event.get("date", "")[11:16] if len(event.get("date", "")) > 15 else None,
            "home_abbr": home_abbr,
            "away_abbr": away_abbr,
            "home_display": home_display,
            "away_display": away_display,
            "home_score": int(home.get("score", 0)) if completed else None,
            "away_score": int(away.get("score", 0)) if completed else None,
            "played": completed,
            "venue": venue,
            "city": city,
            "source": "ESPN",
        }

        if "Group" in alt_note:
            group_results.append(result)
        else:
            key = (home_abbr, away_abbr, result["date"])
            if key not in seen_ko:
                seen_ko.add(key)
                result["round"] = alt_note.replace("FIFA World Cup, ", "").replace("FIFA World Cup", "").strip() or "Knockout"
                knockout_results.append(result)

    _last_sync["results"]["espn_count"] = len(group_results) + len(knockout_results)
    return group_results, knockout_results


def fetch_football_data(season: int = 2026) -> list[dict]:
    """Fetch finished matches from football-data.org (requires token)."""
    token = os.environ.get(FD_TOKEN_ENV)
    if not token:
        _last_sync["results"]["football_data"] = "no token"
        return []

    url = f"{FOOTBALL_DATA_BASE}?season={season}&status=FINISHED"
    headers = {"X-Auth-Token": token, "User-Agent": "WC2026-Sync/1.0"}
    try:
        data = _http_get_json(url, headers=headers)
    except Exception as e:
        _last_sync["results"]["football_data_error"] = str(e)
        return []

    results = []
    for match in data.get("matches", []):
        home_team = match.get("homeTeam", {})
        away_team = match.get("awayTeam", {})
        score = match.get("score", {})
        full_time = score.get("fullTime", {})
        results.append({
            "date": (match.get("utcDate", "")[:10]),
            "home_abbr": home_team.get("tla", ""),
            "away_abbr": away_team.get("tla", ""),
            "home_score": full_time.get("home"),
            "away_score": full_time.get("away"),
            "played": True,
            "source": "FootballData",
        })
    _last_sync["results"]["football_data_count"] = len(results)
    return results


def _match_fixture(fixture: dict, result: dict) -> bool:
    fh, fa = fixture["home"], fixture["away"]
    rh, ra = result["home_abbr"], result["away_abbr"]
    if fh == rh and fa == ra:
        return True
    return False


def apply_results(fixtures: list[dict], results: list[dict]) -> int:
    updated = 0
    for fx in fixtures:
        for r in results:
            if not _match_fixture(fx, r):
                continue

            if r.get("utc_time"):
                new_date = r.get("date", fx["date"])
                new_time = r["utc_time"]
                if fx["date"] != new_date or fx["time_utc"] != new_time:
                    fx["date"] = new_date
                    fx["time_utc"] = new_time
                    updated += 1

            if r.get("played") and not fx.get("played"):
                fx["played"] = True
                fx["home_score"] = r["home_score"]
                fx["away_score"] = r["away_score"]
                fx["source"] = r["source"]
                updated += 1
            break
    return updated


def sync_results(start_date: str | None = None, end_date: str | None = None) -> dict:
    with _sync_lock:
        start = start_date or "2026-06-11"
        end = end_date or "2026-07-19"

        raw = json.loads(FIXTURES_PATH.read_text("utf-8"))
        fixtures = raw["group_stage_fixtures"]

        before_played = sum(1 for f in fixtures if f.get("played"))

        espn_group, espn_knockout = fetch_espn_range(start, end)
        updated_espn = apply_results(fixtures, espn_group)

        fd_results = fetch_football_data()
        updated_fd = apply_results(fixtures, fd_results)

        after_played = sum(1 for f in fixtures if f.get("played"))
        new_results = after_played - before_played

        raw["group_stage_fixtures"] = fixtures
        raw["knockout_fixtures"] = espn_knockout
        raw["last_sync"] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "espn_results": len(espn_group),
            "espn_knockout": len(espn_knockout),
            "football_data_results": len(fd_results),
            "new_results_found": new_results,
        }
        FIXTURES_PATH.write_text(json.dumps(raw, ensure_ascii=False, indent=2), "utf-8")

        from app.services import predictor
        predictor.invalidate_cache()

        _last_sync["espn"] = datetime.now(timezone.utc).isoformat()
        _last_sync["results"] = {
            "espn_fetched": len(espn_group),
            "espn_knockout": len(espn_knockout),
            "football_data_fetched": len(fd_results),
            "new_results": new_results,
            "total_played": after_played,
        }
        _last_sync["updated"] = _last_sync.get("updated", 0) + 1

        return {
            "espn_fetched": len(espn_group),
            "espn_knockout": len(espn_knockout),
            "football_data_fetched": len(fd_results),
            "new_results": new_results,
            "total_played": after_played,
            "synced_at": _last_sync["espn"],
        }


def get_sync_status() -> dict:
    return dict(_last_sync)
