import csv
import json
import re
from pathlib import Path

ATTR_FIELDS = {
    "pace": "pace",
    "shooting": "shooting",
    "passing": "passing",
    "dribbling": "dribbling",
    "defending": "defending",
    "physic": "physic",
    "sprint_speed": "movement_sprint_speed",
    "acceleration": "movement_acceleration",
    "finishing": "attacking_finishing",
    "heading": "attacking_heading_accuracy",
    "standing_tackle": "defending_standing_tackle",
    "marking": "defending_marking_awareness",
    "gk_diving": "goalkeeping_diving",
    "gk_handling": "goalkeeping_handling",
    "gk_reflexes": "goalkeeping_reflexes",
    "gk_positioning": "goalkeeping_positioning",
}

FC26_CSV = "/tmp/fc26_full_attrs.csv"
FC25_CSV = "/tmp/fc25_full.csv"
PLAYERS_JSON = Path(__file__).parent.parent / "backend" / "app" / "data" / "players.json"


def load_fc26():
    players = []
    with open(FC26_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            players.append({
                "short_name": (row.get("short_name") or "").strip(),
                "long_name": (row.get("long_name") or "").strip(),
                "positions": (row.get("player_positions") or "").strip(),
                "overall": int(row["overall"]) if row.get("overall") else None,
                "club": (row.get("club_name") or "").strip(),
                "raw": row,
            })
    return players


def load_fc25():
    ratings = {}
    with open(FC25_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip().lower()
            if name:
                ovr = row.get("overall_rating")
                if ovr:
                    ratings[name] = int(float(ovr))
    return ratings


def normalize_pos(pos: str) -> str:
    parts = [p.strip().upper() for p in pos.split(",")]
    primary = parts[0] if parts else ""
    if primary == "GK":
        return "GK"
    if primary in ("CB", "LB", "RB", "LWB", "RWB"):
        return "DF"
    if primary in ("CM", "CDM", "CAM", "LM", "RM"):
        return "MF"
    if primary in ("ST", "CF", "LW", "RW"):
        return "FW"
    return ""


def is_gk(pos_str: str) -> bool:
    return "GK" in pos_str


def score_candidate(player, candidate, expected_pos):
    score = 0
    cand_pos = candidate["positions"]
    cand_primary = normalize_pos(cand_pos)

    if expected_pos == "GK":
        if cand_primary == "GK":
            score += 100
        elif is_gk(cand_pos):
            score += 80
        else:
            score -= 200
    elif expected_pos == "DF":
        if cand_primary == "DF":
            score += 50
        elif "DF" in cand_pos or any(x in cand_pos for x in ("CB", "LB", "RB", "LWB", "RWB")):
            score += 30
        if is_gk(cand_pos):
            score -= 200
    elif expected_pos == "MF":
        if cand_primary == "MF":
            score += 50
        elif any(x in cand_pos for x in ("CM", "CDM", "CAM", "LM", "RM")):
            score += 30
    elif expected_pos == "FW":
        if cand_primary == "FW":
            score += 50
        elif any(x in cand_pos for x in ("ST", "CF", "LW", "RW")):
            score += 30

    if candidate.get("overall"):
        score += candidate["overall"] / 10

    return score


def find_best_match(player_name, expected_pos, fc26_players, index):
    nl = player_name.lower()
    candidates = []

    exact_short = index.get("short", {}).get(nl, [])
    if exact_short:
        candidates.extend(exact_short)

    if not candidates:
        for fp in fc26_players:
            if fp["long_name"].lower() == nl:
                candidates.append(fp)

    if not candidates:
        surname = nl.split()[-1] if len(nl.split()) > 1 else nl
        for fp in fc26_players:
            if fp["short_name"].lower() == surname:
                candidates.append(fp)
            elif surname in fp["long_name"].lower():
                candidates.append(fp)

    if not candidates:
        return None

    best = None
    best_score = -999
    for c in candidates:
        s = score_candidate(player_name, c, expected_pos)
        if s > best_score:
            best_score = s
            best = c

    return best


def build_index(fc26_players):
    idx = {"short": {}, "long": {}}
    for fp in fc26_players:
        sn = fp["short_name"].lower()
        ln = fp["long_name"].lower()
        if sn:
            idx["short"].setdefault(sn, []).append(fp)
        if ln:
            idx["long"].setdefault(ln, []).append(fp)
    return idx


def main():
    print("Loading FC26 data...")
    fc26 = load_fc26()
    fc26_index = build_index(fc26)
    print(f"  {len(fc26)} FC26 players loaded")

    print("Loading FC25 ratings...")
    fc25 = load_fc25()
    print(f"  {len(fc25)} FC25 ratings loaded")

    print("Loading players.json...")
    data = json.load(open(PLAYERS_JSON, encoding="utf-8"))

    matched = 0
    total = 0
    gk_fixed = 0

    for code, squad in data.items():
        for p in squad["players"]:
            total += 1
            name = p["name"]
            pos = p["position"]

            match = find_best_match(name, pos, fc26, fc26_index)

            was_gk = p.get("fc_position")
            p.pop("fc_position", None)

            if match:
                matched += 1
                raw = match["raw"]

                if pos == "GK" and was_gk and was_gk != "GK":
                    gk_fixed += 1

                p["fc_overall"] = match.get("overall")

                for json_field, csv_col in ATTR_FIELDS.items():
                    val = raw.get(csv_col)
                    if val and val.strip():
                        try:
                            p[json_field] = int(float(val))
                        except ValueError:
                            p.pop(json_field, None)
                    else:
                        p.pop(json_field, None)
            else:
                for f in ATTR_FIELDS:
                    p.pop(f, None)
                p.pop("fc_overall", None)

    print(f"\nMatched: {matched}/{total} ({matched*100//total}%)")
    print(f"GK position fixes: {gk_fixed}")

    with open(PLAYERS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"\nSaved to {PLAYERS_JSON}")

    for code in ("BRA", "FRA"):
        gks = [p for p in data[code]["players"] if p["position"] == "GK"]
        print(f"\n{code} GKs after fix:")
        for g in gks:
            print(f"  {g['name']}: ref={g.get('gk_reflexes')} div={g.get('gk_diving')} pace={g.get('pace')}")


if __name__ == "__main__":
    main()
