"""
Elo → Dixon-Coles Poisson → Monte Carlo prediction engine for FIFA World Cup 2026.

Based on methodologies from:
- Dixon & Coles (1997): bivariate Poisson with low-score correction
- eloratings.net: Elo rating system for national teams
- Nate Silver PELE: Elo + player market values + historical regression
"""
import json
import math
import random
from datetime import datetime
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(filename: str) -> dict:
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


_teams_cache: Optional[dict] = None
_fixtures_cache: Optional[dict] = None


def get_teams_raw() -> dict:
    global _teams_cache
    if _teams_cache is None:
        _teams_cache = _load_json("teams.json")
    return _teams_cache


def get_fixtures_raw() -> dict:
    global _fixtures_cache
    if _fixtures_cache is None:
        _fixtures_cache = _load_json("fixtures.json")
    return _fixtures_cache


def invalidate_cache() -> None:
    global _teams_cache, _fixtures_cache
    _fixtures_cache = None


def get_team_by_code(code: str) -> Optional[dict]:
    for t in get_teams_raw()["teams"]:
        if t["code"] == code:
            return t
    return None


def teams_list() -> list[dict]:
    return get_teams_raw()["teams"]


def fixtures_list() -> list[dict]:
    return get_fixtures_raw()["group_stage_fixtures"]


def tournament_info() -> dict:
    raw = get_fixtures_raw()
    return {k: v for k, v in raw.items() if k != "group_stage_fixtures"}


def compute_group_standings(group: str | None = None) -> dict[str, list[dict]]:
    """Compute standings from actual played matches only."""
    fixtures = fixtures_list()
    if group:
        fixtures = [f for f in fixtures if f["group"] == group.upper()]

    groups: dict[str, list[dict]] = {}
    for team in teams_list():
        g = team["group"]
        if group and g != group.upper():
            continue
        groups.setdefault(g, []).append({
            "code": team["code"],
            "name": team["name"],
            "name_cn": team["name_cn"],
            "played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "gf": 0,
            "ga": 0,
            "gd": 0,
            "points": 0,
        })

    for fx in fixtures:
        if not fx.get("played"):
            continue
        g = fx["group"]
        home_entry = next((t for t in groups.get(g, []) if t["code"] == fx["home"]), None)
        away_entry = next((t for t in groups.get(g, []) if t["code"] == fx["away"]), None)
        if not home_entry or not away_entry:
            continue
        hg, ag = fx["home_score"], fx["away_score"]
        home_entry["played"] += 1
        away_entry["played"] += 1
        home_entry["gf"] += hg
        home_entry["ga"] += ag
        away_entry["gf"] += ag
        away_entry["ga"] += hg
        if hg > ag:
            home_entry["points"] += 3
            home_entry["wins"] += 1
            away_entry["losses"] += 1
        elif hg < ag:
            away_entry["points"] += 3
            away_entry["wins"] += 1
            home_entry["losses"] += 1
        else:
            home_entry["points"] += 1
            away_entry["points"] += 1
            home_entry["draws"] += 1
            away_entry["draws"] += 1

    for teams in groups.values():
        for t in teams:
            t["gd"] = t["gf"] - t["ga"]
        teams.sort(key=lambda x: (x["points"], x["gd"], x["gf"], x["code"]), reverse=True)

    return groups


# ──────────────────────────────────────────────────────────────────────────
#  Elo → Win Expectancy
# ──────────────────────────────────────────────────────────────────────────

def expected_goals_from_elo(home_elo: float, away_elo: float, home_advantage: float = 55.0) -> tuple[float, float]:
    """Convert Elo ratings to expected goals (λ) for both teams.

    Uses a logistic mapping: stronger team → more expected goals.
    Average match total ~2.6 goals.
    """
    # Home advantage added to home team
    eff_home = home_elo + home_advantage
    diff = eff_home - away_elo
    # Win expectancy for home team
    we = 1.0 / (1.0 + 10.0 ** (-diff / 400.0))

    # Map win expectancy to expected goals
    # Average total goals per match
    avg_total = 2.6
    # Home team gets proportionally more
    lambda_home = avg_total * (0.55 + 0.35 * (we - 0.5) * 2)  # ~1.43 at we=0.5, up to ~2.86
    lambda_away = avg_total - lambda_home

    # Clamp to reasonable range
    lambda_home = max(0.2, min(lambda_home, 4.5))
    lambda_away = max(0.15, min(lambda_away, 3.5))

    return lambda_home, lambda_away


def dixon_coles_tau(home_goals: int, away_goals: int, lambda_home: float, lambda_away: float, rho: float = -0.08) -> float:
    """Dixon-Coles low-score correction factor.

    Adjusts the probability of 0-0, 1-0, 0-1, 1-1 scorelines.
    """
    if home_goals == 0 and away_goals == 0:
        return 1.0 - (lambda_home * lambda_away * rho)
    elif home_goals == 0 and away_goals == 1:
        return 1.0 + (lambda_home * rho)
    elif home_goals == 1 and away_goals == 0:
        return 1.0 + (lambda_away * rho)
    elif home_goals == 1 and away_goals == 1:
        return 1.0 - rho
    else:
        return 1.0


def poisson_pmf(k: int, lam: float) -> float:
    """Poisson probability mass function."""
    return (math.exp(-lam) * lam ** k) / math.factorial(k)


def match_probabilities(home_elo: float, away_elo: float, max_goals: int = 8) -> dict:
    """Compute win/draw/loss probabilities and scoreline matrix.

    Returns:
        {
            "home_win": float,
            "draw": float,
            "away_win": float,
            "score_matrix": list[list[float]],
            "expected_score_home": float,
            "expected_score_away": float,
            "most_likely_score": [int, int],
        }
    """
    lambda_home, lambda_away = expected_goals_from_elo(home_elo, away_elo)

    # Build score matrix with Dixon-Coles correction
    matrix = [[0.0] * (max_goals + 1) for _ in range(max_goals + 1)]
    total = 0.0

    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            tau = dixon_coles_tau(h, a, lambda_home, lambda_away)
            p = poisson_pmf(h, lambda_home) * poisson_pmf(a, lambda_away) * tau
            matrix[h][a] = p
            total += p

    # Normalize
    if total > 0:
        for h in range(max_goals + 1):
            for a in range(max_goals + 1):
                matrix[h][a] /= total

    # Aggregate
    home_win = sum(matrix[h][a] for h in range(max_goals + 1) for a in range(max_goals + 1) if h > a)
    draw = sum(matrix[h][a] for h in range(max_goals + 1) for a in range(max_goals + 1) if h == a)
    away_win = sum(matrix[h][a] for h in range(max_goals + 1) for a in range(max_goals + 1) if h < a)

    # Most likely score
    best_h, best_a, best_p = 0, 0, 0.0
    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            if matrix[h][a] > best_p:
                best_h, best_a, best_p = h, a, matrix[h][a]

    return {
        "home_win": round(home_win, 4),
        "draw": round(draw, 4),
        "away_win": round(away_win, 4),
        "expected_goals_home": round(lambda_home, 2),
        "expected_goals_away": round(lambda_away, 2),
        "most_likely_score": [best_h, best_a],
        "most_likely_score_prob": round(best_p, 4),
    }


def predict_match(home_code: str, away_code: str) -> dict:
    """Predict a match between two teams by their 3-letter codes."""
    home = get_team_by_code(home_code)
    away = get_team_by_code(away_code)

    if not home or not away:
        raise ValueError(f"Team code not found: {home_code if not home else away_code}")

    # Home advantage: +55 Elo for host nation, +25 for neutral
    home_adv = 80.0 if home.get("is_host") else 25.0

    probs = match_probabilities(home["elo_rating"], away["elo_rating"])
    probs["home_advantage_applied"] = home_adv

    return {
        "home_team": {"code": home["code"], "name": home["name"], "name_cn": home["name_cn"], "elo": home["elo_rating"]},
        "away_team": {"code": away["code"], "name": away["name"], "name_cn": away["name_cn"], "elo": away["elo_rating"]},
        "prediction": probs,
    }


def sample_match_result(home_elo: float, away_elo: float, rng: random.Random) -> tuple[int, int]:
    """Sample a single match result (home_goals, away_goals) from the Poisson model."""
    lambda_home, lambda_away = expected_goals_from_elo(home_elo, away_elo)

    def sample_poisson(lam: float) -> int:
        L = math.exp(-lam)
        k = 0
        p = 1.0
        while True:
            k += 1
            p *= rng.random()
            if p <= L:
                return k - 1

    h = sample_poisson(lambda_home)
    a = sample_poisson(lambda_away)
    return h, a


# ──────────────────────────────────────────────────────────────────────────
#  Tournament Simulation (Monte Carlo)
# ──────────────────────────────────────────────────────────────────────────

def simulate_group_stage(rng: random.Random) -> dict[str, list[dict]]:
    """Simulate all 72 group stage matches and return group standings.

    Returns: {"A": [{"code": "MEX", "points": 7, "gd": 5, "gf": 8, "position": 1}, ...], ...}
    """
    fixtures = fixtures_list()

    # Group teams
    groups: dict[str, list[dict]] = {}
    for team in teams_list():
        g = team["group"]
        groups.setdefault(g, []).append({
            "code": team["code"],
            "name": team["name"],
            "elo": team["elo_rating"],
            "is_host": team.get("is_host", False),
            "points": 0,
            "gf": 0,
            "ga": 0,
            "gd": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
        })

    # Play all group matches — use real results for already-played matches
    team_map = {t["code"]: t for t in teams_list()}
    for fx in fixtures:
        home_code = fx["home"]
        away_code = fx["away"]

        if fx.get("played"):
            hg = fx["home_score"]
            ag = fx["away_score"]
        else:
            home_elo = team_map[home_code]["elo_rating"]
            away_elo = team_map[away_code]["elo_rating"]
            home_adv = 80.0 if team_map[home_code].get("is_host") else 25.0
            hg, ag = sample_match_result(home_elo + home_adv, away_elo, rng)

        home_entry = next(t for t in groups[fx["group"]] if t["code"] == home_code)
        away_entry = next(t for t in groups[fx["group"]] if t["code"] == away_code)

        home_entry["gf"] += hg
        home_entry["ga"] += ag
        away_entry["gf"] += ag
        away_entry["ga"] += hg

        if hg > ag:
            home_entry["points"] += 3
            home_entry["wins"] += 1
            away_entry["losses"] += 1
        elif hg < ag:
            away_entry["points"] += 3
            away_entry["wins"] += 1
            home_entry["losses"] += 1
        else:
            home_entry["points"] += 1
            away_entry["points"] += 1
            home_entry["draws"] += 1
            away_entry["draws"] += 1

    # Compute GD and sort each group
    result = {}
    for g, teams in groups.items():
        for t in teams:
            t["gd"] = t["gf"] - t["ga"]
        teams.sort(key=lambda x: (x["points"], x["gd"], x["gf"], -x["elo"]), reverse=True)
        for i, t in enumerate(teams):
            t["position"] = i + 1
        result[g] = teams

    return result


def get_qualified_teams(group_results: dict[str, list[dict]]) -> dict:
    """Get the 32 qualified teams: 24 (top-2 from each group) + 8 best thirds."""
    qualified_1st = []
    qualified_2nd = []
    third_placed = []

    for g, teams in group_results.items():
        qualified_1st.append(teams[0])
        qualified_2nd.append(teams[1])
        third_placed.append(teams[2])

    # Sort third-placed teams by points, GD, GF
    third_placed.sort(key=lambda x: (x["points"], x["gd"], x["gf"]), reverse=True)
    best_thirds = third_placed[:8]

    return {
        "first": qualified_1st,
        "second": qualified_2nd,
        "best_thirds": best_thirds,
        "all": qualified_1st + qualified_2nd + best_thirds,
    }


def simulate_knockout(team_a_elo: float, team_b_elo: float, rng: random.Random, neutral: bool = True) -> str:
    """Simulate a knockout match, return winner code reference ('a' or 'b').

    Uses extra-time + penalties if draw after 90min.
    """
    home_adv = 0.0 if neutral else 80.0

    # Full match
    hg, ag = sample_match_result(team_a_elo + home_adv, team_b_elo, rng)

    if hg > ag:
        return "a"
    elif ag > hg:
        return "b"

    # Extra time: reduce expected goals by ~40%
    et_hg, et_ag = sample_match_result((team_a_elo + home_adv) * 0.6, team_b_elo * 0.6, rng)
    if et_hg > et_ag:
        return "a"
    elif et_ag > et_hg:
        return "b"

    # Penalties: 50/50 (slight edge to higher Elo)
    elo_diff = team_a_elo - team_b_elo
    p_a = 0.5 + min(0.1, elo_diff / 2000.0)
    return "a" if rng.random() < p_a else "b"


def simulate_tournament(rng: random.Random) -> dict:
    """Simulate one complete tournament.

    Returns: {
        "group_results": ...,
        "round_of_32": [...],
        "round_of_16": [...],
        "quarter_finals": [...],
        "semi_finals": [...],
        "final": {"home": code, "away": code, "winner": code},
        "champion": code,
    }
    """
    group_results = simulate_group_stage(rng)
    qualified = get_qualified_teams(group_results)

    team_map = {t["code"]: t for t in teams_list()}

    first = [t["code"] for t in qualified["first"]]
    second = [t["code"] for t in qualified["second"]]
    thirds = [t["code"] for t in qualified["best_thirds"]]

    r32_teams = []
    for i in range(12):
        r32_teams.append(first[i])
    for i in range(8):
        r32_teams.append(thirds[i])
    for i in range(12):
        r32_teams.append(second[i])
    random.shuffle(r32_teams)

    # R32
    r32_winners = []
    r32_results = []
    for i in range(0, 32, 2):
        a, b = r32_teams[i], r32_teams[i + 1]
        if a is None or b is None:
            continue
        winner_code = simulate_knockout(team_map[a]["elo_rating"], team_map[b]["elo_rating"], rng)
        winner = a if winner_code == "a" else b
        r32_winners.append(winner)
        r32_results.append({"home": a, "away": b, "winner": winner})

    # R16
    r16_winners = []
    r16_results = []
    for i in range(0, 16, 2):
        if i + 1 >= len(r32_winners):
            break
        a, b = r32_winners[i], r32_winners[i + 1]
        winner_code = simulate_knockout(team_map[a]["elo_rating"], team_map[b]["elo_rating"], rng)
        winner = a if winner_code == "a" else b
        r16_winners.append(winner)
        r16_results.append({"home": a, "away": b, "winner": winner})

    # QF
    qf_winners = []
    qf_results = []
    for i in range(0, 8, 2):
        if i + 1 >= len(r16_winners):
            break
        a, b = r16_winners[i], r16_winners[i + 1]
        winner_code = simulate_knockout(team_map[a]["elo_rating"], team_map[b]["elo_rating"], rng)
        winner = a if winner_code == "a" else b
        qf_winners.append(winner)
        qf_results.append({"home": a, "away": b, "winner": winner})

    # SF
    sf_winners = []
    sf_results = []
    for i in range(0, 4, 2):
        if i + 1 >= len(qf_winners):
            break
        a, b = qf_winners[i], qf_winners[i + 1]
        winner_code = simulate_knockout(team_map[a]["elo_rating"], team_map[b]["elo_rating"], rng)
        winner = a if winner_code == "a" else b
        sf_winners.append(winner)
        sf_results.append({"home": a, "away": b, "winner": winner})

    # Final
    champion = None
    final_result = None
    if len(sf_winners) >= 2:
        a, b = sf_winners[0], sf_winners[1]
        winner_code = simulate_knockout(team_map[a]["elo_rating"], team_map[b]["elo_rating"], rng)
        champion = a if winner_code == "a" else b
        final_result = {"home": a, "away": b, "winner": champion}

    return {
        "group_results": {g: [{"code": t["code"], "points": t["points"], "gd": t["gd"], "position": t["position"]}
                               for t in teams]
                          for g, teams in group_results.items()},
        "round_of_32": r32_results,
        "round_of_16": r16_results,
        "quarter_finals": qf_results,
        "semi_finals": sf_results,
        "final": final_result,
        "champion": champion,
    }


def run_monte_carlo(n_simulations: int = 10000, seed: int = 2026) -> dict:
    """Run Monte Carlo tournament simulation.

    Returns championship probabilities, stage advancement probabilities, etc.
    """
    rng = random.Random(seed)

    # Tally counters
    champion_count: dict[str, int] = {}
    final_count: dict[str, int] = {}
    semi_count: dict[str, int] = {}
    r16_count: dict[str, int] = {}
    group_advance_count: dict[str, int] = {}

    for team in teams_list():
        champion_count[team["code"]] = 0
        final_count[team["code"]] = 0
        semi_count[team["code"]] = 0
        r16_count[team["code"]] = 0
        group_advance_count[team["code"]] = 0

    completed = 0
    for _ in range(n_simulations):
        try:
            result = simulate_tournament(rng)
        except Exception:
            continue

        if result["champion"]:
            champion_count[result["champion"]] += 1
        if result["final"]:
            final_count[result["final"]["home"]] += 1
            final_count[result["final"]["away"]] += 1
        for m in result["semi_finals"]:
            semi_count[m["home"]] += 1
            semi_count[m["away"]] += 1
        for m in result["round_of_16"]:
            r16_count[m["home"]] += 1
            r16_count[m["away"]] += 1
        for g_teams in result["group_results"].values():
            for t in g_teams[:2]:  # top 2 advance
                group_advance_count[t["code"]] += 1

        completed += 1

    # Build results
    teams_data = teams_list()
    results = []
    for team in teams_data:
        code = team["code"]
        results.append({
            "code": code,
            "name": team["name"],
            "name_cn": team["name_cn"],
            "group": team["group"],
            "elo_rating": team["elo_rating"],
            "fifa_ranking": team["fifa_ranking"],
            "champion_prob": round(champion_count[code] / completed, 4) if completed > 0 else 0,
            "final_prob": round(final_count[code] / completed, 4) if completed > 0 else 0,
            "semi_final_prob": round(semi_count[code] / completed, 4) if completed > 0 else 0,
            "r16_prob": round(r16_count[code] / completed, 4) if completed > 0 else 0,
            "group_advance_prob": round(group_advance_count[code] / completed, 4) if completed > 0 else 0,
            "champion_count": champion_count[code],
            "simulations": completed,
        })

    # Sort by champion probability
    results.sort(key=lambda x: x["champion_prob"], reverse=True)

    return {
        "n_simulations": completed,
        "seed": seed,
        "generated_at": datetime.now().isoformat(),
        "results": results,
    }
