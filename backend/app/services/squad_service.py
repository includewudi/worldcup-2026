"""Player squad data service — loads players.json and provides squad queries."""
import json
from pathlib import Path
from typing import Optional

_data_dir = Path(__file__).parent.parent / "data"
_players_cache: Optional[dict] = None


def _load_players() -> dict:
    global _players_cache
    if _players_cache is None:
        path = _data_dir / "players.json"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                _players_cache = json.load(f)
        else:
            _players_cache = {}
    return _players_cache


def get_squad(team_code: str) -> Optional[dict]:
    return _load_players().get(team_code.upper())


def get_squad_summary(team_code: str, limit: int = 11) -> Optional[dict]:
    squad = get_squad(team_code)
    if not squad:
        return None
    players = squad["players"]
    top_by_value = sorted(players, key=lambda x: -x.get("value_eur", 0))[:limit]
    from collections import Counter
    pos_counts = Counter(p["position"] for p in players)
    return {
        "team_code": team_code.upper(),
        "team_name": squad["name"],
        "team_name_cn": squad["name_cn"],
        "player_count": squad["player_count"],
        "total_value_eur": squad["total_value"],
        "avg_value_eur": squad["total_value"] // max(squad["player_count"], 1),
        "top_player": squad["top_player"],
        "position_breakdown": dict(pos_counts),
        "top_players": top_by_value,
    }


def compare_squads(home_code: str, away_code: str) -> dict:
    home = get_squad_summary(home_code)
    away = get_squad_summary(away_code)
    if not home:
        return {"error": f"Team not found: {home_code}"}
    if not away:
        return {"error": f"Team not found: {away_code}"}
    return {
        "home": home,
        "away": away,
        "value_gap_eur": home["total_value_eur"] - away["total_value_eur"],
        "stronger_team": home_code.upper() if home["total_value_eur"] >= away["total_value_eur"] else away_code.upper(),
    }
