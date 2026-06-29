import json
from pathlib import Path
from typing import Optional
from collections import Counter

_data_dir = Path(__file__).parent.parent / "data"
_players_cache: Optional[dict] = None

ATTACK_POS = {"FW", "MF"}
DEFENSE_POS = {"DF", "GK"}

TEAM_ATTRS = ["pace", "shooting", "passing", "dribbling", "defending", "physic"]


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


def _avg(values: list) -> float:
    return round(sum(values) / len(values), 1) if values else 0


def _calc_strengths(players: list) -> dict:
    rated = [p for p in players if p.get("rating")]
    fwd_mf = [p["rating"] for p in rated if p["position"] in ATTACK_POS]
    df_gk = [p["rating"] for p in rated if p["position"] in DEFENSE_POS]
    attack = _avg(fwd_mf)
    defense = _avg(df_gk)
    return {
        "attack": attack,
        "defense": defense,
        "net": round(attack - defense, 1),
        "attack_rated": len(fwd_mf),
        "defense_rated": len(df_gk),
    }


def _calc_attr_profile(players: list, position_filter: set) -> dict:
    filtered = [p for p in players if p["position"] in position_filter and p.get("pace") is not None]
    if not filtered:
        return {}
    profile = {}
    for attr in TEAM_ATTRS:
        vals = [p[attr] for p in filtered if p.get(attr) is not None]
        profile[attr] = _avg(vals)
    return profile


def _top_by_attr(players: list, attr: str, position_filter: Optional[set] = None, limit: int = 3) -> list:
    candidates = players
    if position_filter:
        candidates = [p for p in candidates if p["position"] in position_filter]
    with_attr = [p for p in candidates if p.get(attr) is not None]
    return sorted(with_attr, key=lambda x: -x[attr])[:limit]


def _key_players(players: list) -> dict:
    forwards = [p for p in players if p["position"] in ATTACK_POS]
    defenders = [p for p in players if p["position"] in DEFENSE_POS]
    gks = [p for p in players if p["position"] == "GK"]

    fastest_fw = _top_by_attr(forwards, "pace", limit=1)
    best_shooter = _top_by_attr(forwards, "finishing", limit=1)
    best_dribbler = _top_by_attr(forwards, "dribbling", limit=1)
    best_header_fw = _top_by_attr(forwards, "heading", limit=1)
    fastest_df = _top_by_attr(defenders, "pace", limit=1)
    best_defender = _top_by_attr(defenders, "defending", limit=1)
    best_header_df = _top_by_attr(defenders, "heading", limit=1)
    best_gk = _top_by_attr(gks, "gk_reflexes", limit=1)
    if not best_gk:
        best_gk = sorted(gks, key=lambda x: -(x.get("rating") or 0))[:1]

    def slim(p):
        if not p:
            return None
        return {
            "name": p["name"], "position": p["position"],
            "rating": p.get("rating"),
            "pace": p.get("pace"), "shooting": p.get("shooting"),
            "dribbling": p.get("dribbling"), "defending": p.get("defending"),
            "physic": p.get("physic"), "finishing": p.get("finishing"),
            "heading": p.get("heading"), "standing_tackle": p.get("standing_tackle"),
            "gk_reflexes": p.get("gk_reflexes"), "gk_diving": p.get("gk_diving"),
        }

    return {
        "fastest_forward": slim(fastest_fw[0]) if fastest_fw else None,
        "best_shooter": slim(best_shooter[0]) if best_shooter else None,
        "best_dribbler": slim(best_dribbler[0]) if best_dribbler else None,
        "best_header_forward": slim(best_header_fw[0]) if best_header_fw else None,
        "fastest_defender": slim(fastest_df[0]) if fastest_df else None,
        "best_defender": slim(best_defender[0]) if best_defender else None,
        "best_header_defender": slim(best_header_df[0]) if best_header_df else None,
        "goalkeeper": slim(best_gk[0]) if best_gk else None,
    }


def get_squad_summary(team_code: str, limit: int = 11) -> Optional[dict]:
    squad = get_squad(team_code)
    if not squad:
        return None
    players = squad["players"]

    rated = [p for p in players if p.get("rating")]
    avg_rating = _avg([p["rating"] for p in rated])
    coverage_pct = round(len(rated) / len(players) * 100) if players else 0
    attr_coverage = len([p for p in players if p.get("pace") is not None]) / len(players) * 100 if players else 0

    top_by_rating = sorted(rated, key=lambda x: -x["rating"])[:limit]
    top_by_value = sorted(players, key=lambda x: -x.get("value_eur", 0))[:limit]

    pos_counts = Counter(p["position"] for p in players)
    strengths = _calc_strengths(players)
    attack_profile = _calc_attr_profile(players, ATTACK_POS)
    defense_profile = _calc_attr_profile(players, {"DF"})
    key = _key_players(players)

    return {
        "team_code": team_code.upper(),
        "team_name": squad["name"],
        "team_name_cn": squad["name_cn"],
        "player_count": squad["player_count"],
        "total_value_eur": squad["total_value"],
        "avg_value_eur": squad["total_value"] // max(squad["player_count"], 1),
        "avg_rating": avg_rating,
        "rating_coverage_pct": coverage_pct,
        "attr_coverage_pct": round(attr_coverage),
        "attack_rating": strengths["attack"],
        "defense_rating": strengths["defense"],
        "net_rating": strengths["net"],
        "attack_profile": attack_profile,
        "defense_profile": defense_profile,
        "key_players": key,
        "top_player": squad["top_player"],
        "position_breakdown": dict(pos_counts),
        "top_players_by_rating": top_by_rating,
        "top_players_by_value": top_by_value,
    }


def compare_squads(home_code: str, away_code: str) -> dict:
    home = get_squad_summary(home_code)
    away = get_squad_summary(away_code)
    if not home:
        return {"error": f"Team not found: {home_code}"}
    if not away:
        return {"error": f"Team not found: {away_code}"}

    home_rating = home["avg_rating"]
    away_rating = away["avg_rating"]

    return {
        "home": home,
        "away": away,
        "value_gap_eur": home["total_value_eur"] - away["total_value_eur"],
        "rating_gap": round(home_rating - away_rating, 1),
        "attack_gap": round(home["attack_rating"] - away["attack_rating"], 1),
        "defense_gap": round(home["defense_rating"] - away["defense_rating"], 1),
        "stronger_team_by_rating": home_code.upper() if home_rating >= away_rating else away_code.upper(),
        "stronger_team_by_value": home_code.upper() if home["total_value_eur"] >= away["total_value_eur"] else away_code.upper(),
    }


def analyze_matchups(home_code: str, away_code: str) -> dict:
    home = get_squad_summary(home_code)
    away = get_squad_summary(away_code)
    if not home or not away:
        return {"error": f"Team not found"}

    if home.get("attr_coverage_pct", 0) < 30 or away.get("attr_coverage_pct", 0) < 30:
        return {"available": False, "reason": "insufficient_attribute_coverage"}

    hk = home["key_players"]
    ak = away["key_players"]

    matchups = []

    def add(title, home_player, away_player, home_attr, away_attr, home_advantage, description):
        matchups.append({
            "title": title,
            "home_player": home_player,
            "away_player": away_player,
            "home_value": home_attr,
            "away_value": away_attr,
            "differential": round(home_attr - away_attr, 1) if home_attr and away_attr else None,
            "advantage": home_advantage,
            "description": description,
        })

    # 1. Speed duel: home fastest forward vs away fastest defender
    hf = hk.get("fastest_forward")
    ad = ak.get("fastest_defender")
    if hf and ad and hf.get("pace") and ad.get("pace"):
        diff = hf["pace"] - ad["pace"]
        adv = "home" if diff > 3 else "away" if diff < -3 else "even"
        desc = f"{hf['name']} 速度{hf['pace']} vs {ad['name']} 速度{ad['pace']}"
        if diff > 10:
            desc += "，速度碾压"
        elif diff > 3:
            desc += "，速度优势明显"
        elif diff < -10:
            desc += "，防守方速度碾压"
        elif diff < -3:
            desc += "，防守方速度占优"
        else:
            desc += "，速度相当"
        add("⚡ 速度对决", hf, ad, hf["pace"], ad["pace"], adv, desc)

    # 2. Reverse: away fastest forward vs home fastest defender
    af = ak.get("fastest_forward")
    hd = hk.get("fastest_defender")
    if af and hd and af.get("pace") and hd.get("pace"):
        diff = af["pace"] - hd["pace"]
        adv = "away" if diff > 3 else "home" if diff < -3 else "even"
        desc = f"{af['name']} 速度{af['pace']} vs {hd['name']} 速度{hd['pace']}"
        if diff > 10:
            desc += "，速度碾压"
        elif diff > 3:
            desc += "，速度优势明显"
        elif diff < -10:
            desc += "，防守方速度碾压"
        elif diff < -3:
            desc += "，防守方速度占优"
        else:
            desc += "，速度相当"
        add("⚡ 速度对决", hd, af, hd["pace"], af["pace"], adv, desc)

    # 3. Aerial battle: home best header vs away best header defender
    hhd = hk.get("best_header_forward")
    ahd = ak.get("best_header_defender")
    if hhd and ahd and hhd.get("heading") and ahd.get("heading"):
        diff = hhd["heading"] - ahd["heading"]
        adv = "home" if diff > 3 else "away" if diff < -3 else "even"
        desc = f"{hhd['name']} 头球{hhd['heading']} vs {ahd['name']} 头球{ahd['heading']}"
        add("🎯 空霸对决", hhd, ahd, hhd["heading"], ahd["heading"], adv, desc)

    # 4. Best shooter vs opposition GK
    hs = hk.get("best_shooter")
    agk = ak.get("goalkeeper")
    if hs and agk and hs.get("finishing") and agk.get("gk_reflexes"):
        diff = hs["finishing"] - agk["gk_reflexes"]
        adv = "home" if diff > 5 else "away" if diff < -5 else "even"
        desc = f"{hs['name']} 射门{hs['finishing']} vs {agk['name']} 扑救{agk['gk_reflexes']}"
        if diff > 10:
            desc += "，射手占优"
        elif diff < -10:
            desc += "，门将占优"
        add("🥅 射门 vs 门将", hs, agk, hs["finishing"], agk["gk_reflexes"], adv, desc)

    as_ = ak.get("best_shooter")
    hgk = hk.get("goalkeeper")
    if as_ and hgk and as_.get("finishing") and hgk.get("gk_reflexes"):
        diff = as_["finishing"] - hgk["gk_reflexes"]
        adv = "away" if diff > 5 else "home" if diff < -5 else "even"
        desc = f"{as_['name']} 射门{as_['finishing']} vs {hgk['name']} 扑救{hgk['gk_reflexes']}"
        if diff > 10:
            desc += "，射手占优"
        elif diff < -10:
            desc += "，门将占优"
        add("🥅 射门 vs 门将", hgk, as_, hgk["gk_reflexes"], as_["finishing"], adv, desc)

    # 5. Dribble vs Tackle: best dribbler vs best defender
    hdr = hk.get("best_dribbler")
    abd = ak.get("best_defender")
    if hdr and abd and hdr.get("dribbling") and abd.get("defending"):
        diff = hdr["dribbling"] - abd["defending"]
        adv = "home" if diff > 5 else "away" if diff < -5 else "even"
        desc = f"{hdr['name']} 盘带{hdr['dribbling']} vs {abd['name']} 防守{abd['defending']}"
        add("🎭 盘带 vs 抢断", hdr, abd, hdr["dribbling"], abd["defending"], adv, desc)

    adr = ak.get("best_dribbler")
    hbd = hk.get("best_defender")
    if adr and hbd and adr.get("dribbling") and hbd.get("defending"):
        diff = adr["dribbling"] - hbd["defending"]
        adv = "away" if diff > 5 else "home" if diff < -5 else "even"
        desc = f"{adr['name']} 盘带{adr['dribbling']} vs {hbd['name']} 防守{hbd['defending']}"
        add("🎭 盘带 vs 抢断", hbd, adr, hbd["defending"], adr["dribbling"], adv, desc)

    home_adv_count = sum(1 for m in matchups if m["advantage"] == "home")
    away_adv_count = sum(1 for m in matchups if m["advantage"] == "away")

    return {
        "available": True,
        "home_code": home_code.upper(),
        "away_code": away_code.upper(),
        "home_attack_profile": home["attack_profile"],
        "away_attack_profile": away["attack_profile"],
        "home_defense_profile": home["defense_profile"],
        "away_defense_profile": away["defense_profile"],
        "matchups": matchups,
        "summary": {
            "home_advantages": home_adv_count,
            "away_advantages": away_adv_count,
            "even": len(matchups) - home_adv_count - away_adv_count,
        },
    }
