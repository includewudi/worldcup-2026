#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAMES_FILE="$SCRIPT_DIR/data/team_names_cn.json"
CACHE_FILE="/tmp/wc2026_espn_cache.json"
CALENDAR_NAME="日历"
DRY_RUN=false
USE_CACHE=false
TEAMS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --cache) USE_CACHE=true; shift ;;
        --calendar) CALENDAR_NAME="$2"; shift 2 ;;
        --all) TEAMS=("__ALL__"); shift ;;
        -h|--help)
            echo "Usage: $0 <TEAM_CODE> [TEAM_CODE...] [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run       Preview without writing to calendar"
            echo "  --cache         Use cached ESPN data (offline mode, skips API call)"
            echo "  --calendar NAME Target calendar name (default: 日历)"
            echo "  --all           Import all 48 teams"
            echo ""
            echo "Data source: ESPN API (live scores + fixtures)"
            echo ""
            echo "Examples:"
            echo "  $0 BRA                    # Import Brazil fixtures"
            echo "  $0 BRA ARG --dry-run      # Preview Brazil + Argentina"
            echo "  $0 BRA ARG FRA             # Multiple teams"
            echo "  $0 BRA --cache             # Use cached data (no network)"
            exit 0
            ;;
        *) TEAMS+=("$(echo "$1" | tr 'a-z' 'A-Z')"); shift ;;
    esac
done

if [[ ${#TEAMS[@]} -eq 0 ]]; then
    echo "Usage: $0 <TEAM_CODE> [--dry-run] [--cache] [--calendar NAME]"
    echo "Example: $0 BRA ARG"
    exit 1
fi

if [[ ! -f "$NAMES_FILE" ]]; then
    echo "ERROR: Team names file not found: $NAMES_FILE"
    exit 1
fi

if [[ "$USE_CACHE" == "true" && -f "$CACHE_FILE" ]]; then
    echo "Using cached ESPN data (offline mode)"
    cp "$CACHE_FILE" /tmp/wc2026_fixtures.json
else
    echo "Fetching from ESPN API..."
    HTTP_CODE=$(curl -s -o /tmp/wc2026_fixtures.json -w "%{http_code}" \
        "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719" 2>/dev/null)

    if [[ "$HTTP_CODE" != "200" ]] || [[ ! -s /tmp/wc2026_fixtures.json ]]; then
        if [[ -f "$CACHE_FILE" ]]; then
            echo "ESPN API failed (HTTP $HTTP_CODE), falling back to cache"
            cp "$CACHE_FILE" /tmp/wc2026_fixtures.json
        else
            echo "ERROR: ESPN API failed (HTTP $HTTP_CODE) and no cache available"
            exit 1
        fi
    else
        cp /tmp/wc2026_fixtures.json "$CACHE_FILE"
        echo "  Fetched + cached successfully"
    fi
fi

# Trigger backend sync if it's running (keep prediction system in sync)
BACKEND_SYNC=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:8570/api/sync/refresh" --max-time 30 2>/dev/null || echo "000")
if [[ "$BACKEND_SYNC" == "200" ]]; then
    echo "  Backend prediction system synced"
else
    echo "  Backend not running (sync skipped — skill works standalone)"
fi

TEAM_QUERY=$(IFS=,; echo "${TEAMS[*]}")

python3 << PYEOF
import json, subprocess, sys, re
from datetime import datetime, timedelta, timezone

with open("/tmp/wc2026_fixtures.json") as f:
    espn = json.load(f)
with open("$NAMES_FILE") as f:
    team_cn = json.load(f)

# ESPN abbreviations are mostly standard, override a few mismatches
ESPN_OVERRIDE = {"BOS": "BIH", "SUI": "SUI"}

def norm_abbr(a):
    return ESPN_OVERRIDE.get(a, a)

def _translate_placeholder(text):
    if not text or len(text) <= 3:
        return text
    t = text
    t = re.sub(r'Group ([A-L]) Winner', lambda m: m.group(1) + "\u7ec4\u7b2c1", t)
    t = re.sub(r'Group ([A-L]) 2nd Place', lambda m: m.group(1) + "\u7ec4\u7b2c2", t)
    t = re.sub(r'Group ([A-L]) 3rd Place', lambda m: m.group(1) + "\u7ec4\u7b2c3", t)
    t = re.sub(r'Round of 32 (\d+) Winner vs Round of 32 (\d+) Winner',
               lambda m: f"R32\u80dc\u8005{m.group(1)} vs R32\u80dc\u8005{m.group(2)}", t)
    t = re.sub(r'Round of 16 (\d+) Winner vs Round of 16 (\d+) Winner',
               lambda m: f"R16\u80dc\u8005{m.group(1)} vs R16\u80dc\u8005{m.group(2)}", t)
    if "Third Place Group" in t:
        groups = re.findall(r'Group ([A-L])', t)
        t = "\u5c0f\u7ec4\u7b2c3\uff08" + "/".join(groups) + "\uff09"
    return t

events_raw = espn.get("events", [])
fixtures = []

for ev in events_raw:
    comp = ev.get("competitions", [{}])[0]
    competitors = comp.get("competitors", [])
    if len(competitors) < 2:
        continue

    home_c = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
    away_c = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

    home_raw = home_c.get("team", {}).get("abbreviation", "")
    away_raw = away_c.get("team", {}).get("abbreviation", "")
    home_display_raw = home_c.get("team", {}).get("displayName", "") or home_raw
    away_display_raw = away_c.get("team", {}).get("displayName", "") or away_raw
    home = norm_abbr(home_raw)
    away = norm_abbr(away_raw)

    status = comp.get("status", {}).get("type", {})
    completed = status.get("completed", False)

    date_str = ev.get("date", "")  # "2026-06-11T19:00Z"
    # Handle ISO format with or without seconds: "19:00Z" or "19:00:00Z"
    iso_core = date_str[:16] if len(date_str) <= 17 else date_str[:19]
    fmt = "%Y-%m-%dT%H:%M" if len(date_str) <= 17 else "%Y-%m-%dT%H:%M:%S"
    utc_dt = datetime.strptime(iso_core, fmt).replace(tzinfo=timezone.utc)

    venue_obj = comp.get("venue", {})
    venue = venue_obj.get("fullName", "")
    city = venue_obj.get("address", {}).get("city", "")

    # Parse group or round from altGameNote: "FIFA World Cup, Group A" or "FIFA World Cup"
    group = None
    round_label = None
    alt_note = comp.get("altGameNote", "")
    m = re.search(r'Group ([A-L])', alt_note)
    if m:
        group = m.group(1)
    else:
        clean = alt_note.replace("FIFA World Cup, ", "").replace("FIFA World Cup", "").strip()
        round_label = clean or "淘汰赛"


    fixtures.append({
        "home": home, "away": away,
        "home_display_raw": home_display_raw,
        "away_display_raw": away_display_raw,
        "utc_iso": date_str,
        "utc_dt": utc_dt,
        "played": completed,
        "home_score": int(home_c.get("score", 0)) if completed else None,
        "away_score": int(away_c.get("score", 0)) if completed else None,
        "group": group,
        "round_label": round_label,
        "venue": venue, "city": city,
    })

team_codes = set("${TEAM_QUERY}".split(","))
if "__ALL__" in team_codes:
    team_codes = set(team_cn.keys())

matched = [f for f in fixtures if f["home"] in team_codes or f["away"] in team_codes]

if not matched:
    print(f"No fixtures found for teams: ${TEAM_QUERY}")
    sys.exit(0)

bj_tz = timezone(timedelta(hours=8))

events = []
print(f"\n=== {len(matched)} matches found (ESPN live data) ===\n")

for fx in matched:
    bj_dt = fx["utc_dt"].astimezone(bj_tz)
    end_dt = bj_dt + timedelta(minutes=105)

    home_cn = team_cn.get(fx["home"], _translate_placeholder(fx["home_display_raw"]))
    away_cn = team_cn.get(fx["away"], _translate_placeholder(fx["away_display_raw"]))

    if fx["group"]:
        stage = f"\u4e16\u754c\u676f{fx['group']}\u7ec4"
    else:
        rl = fx.get("round_label") or "\u6dd8\u6c70\u8d5b"
        stage = f"\u4e16\u754c\u676f{rl}"

    if fx["played"]:
        score = f'{fx["home_score"]}-{fx["away_score"]}'
        title = f"\u26bd {home_cn} {score} {away_cn} ({stage})"
    else:
        title = f"\u26bd {home_cn} vs {away_cn} ({stage})"

    venue_full = f"{fx['venue']}, {fx['city']}" if fx['city'] else fx['venue']

    events.append({
        "title": title,
        "y": bj_dt.year, "mo": bj_dt.month, "d": bj_dt.day,
        "h": bj_dt.hour, "mi": bj_dt.minute,
        "ey": end_dt.year, "emo": end_dt.month, "ed": end_dt.day,
        "eh": end_dt.hour, "emi": end_dt.minute,
        "venue": venue_full,
        "note": venue_full,
    })
    score_display = f'{fx["home_score"]}-{fx["away_score"]}' if fx["played"] else "vs"
    stage_short = f'{fx["group"]}\u7ec4' if fx["group"] else (fx.get('round_label') or '\u6dd8\u6c70\u8d5b')
    print(f'  {bj_dt.strftime("%m/%d %a %H:%M")} | {home_cn} {score_display} {away_cn} | {stage_short} | {venue_full}')

print()

if "${DRY_RUN}" == "true":
    print("[DRY RUN] No calendar events created.")
    sys.exit(0)

calendar_name = "${CALENDAR_NAME}"
created = 0
skipped = 0
errors = 0

for ev in events:
    script = f'''
tell application "Calendar"
    set targetCal to first calendar whose name is "{calendar_name}"
    set evTitle to "{ev["title"]}"
    set existing to (every event of targetCal whose summary is evTitle)
    if (count of existing) > 0 then
        return "skip"
    end if

    set sd to (current date)
    set year of sd to {ev["y"]}
    set month of sd to {ev["mo"]}
    set day of sd to {ev["d"]}
    set hours of sd to {ev["h"]}
    set minutes of sd to {ev["mi"]}
    set seconds of sd to 0

    set ed to (current date)
    set year of ed to {ev["ey"]}
    set month of ed to {ev["emo"]}
    set day of ed to {ev["ed"]}
    set hours of ed to {ev["eh"]}
    set minutes of ed to {ev["emi"]}
    set seconds of ed to 0

    set newEvent to make new event at end of events of targetCal with properties ¬
        {{summary:evTitle, start date:sd, end date:ed, location:"{ev["venue"]}", description:"{ev["note"]}"}}
    make new display alarm at end of display alarms of newEvent with properties {{trigger interval:-30}}
    return "created"
end tell
'''
    try:
        result = subprocess.run(["osascript", "-e", script],
                                capture_output=True, text=True, timeout=15)
        out = result.stdout.strip()
        if "created" in out:
            created += 1
        elif "skip" in out:
            skipped += 1
        else:
            errors += 1
    except Exception:
        errors += 1

print(f"Done: {created} created, {skipped} skipped, {errors} errors")
if errors > 0 and created == 0:
    print("All failed - check Calendar permissions in System Settings > Privacy > Automation")
PYEOF