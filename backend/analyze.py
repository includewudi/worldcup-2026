#!/usr/bin/env python3
"""
WC2026 竞猜概率分析 CLI

用法:
  python analyze.py <team1> <team2>              # 全分析
  python analyze.py <team1> <team2> <type>...     # 指定分析类型

分析类型:
  all          全部分析 (默认)
  result       全场赛果 (胜/平/负)
  btts         两队都进球
  ht-draw      半场打平
  ht-result    半场赛果
  over         大小球 (O/U 0.5/1.5/2.5/3.5)
  cs           正确比分 Top 10
  ht-cs        半场正确比分 Top 5
  handicap     让球盘 (主队-1/-2, 客队+1/+2)
  summary      一句话总结

示例:
  python analyze.py BRA ARG all
  python analyze.py EGY IRN btts ht-draw
  python analyze.py CPV KSA over cs summary

球队代码支持: 3字母代码 (BRA/ARG/EGY) 或中文名 (巴西/阿根廷/埃及)
"""
import sys
import math
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))

from app.services.predictor import get_team_by_code, get_teams_raw, expected_goals_from_elo, dixon_coles_tau, poisson_pmf

HALF_TIME_GOAL_RATIO = 0.45  # ~45% of goals in first half
MAX_GOALS = 8
HALF_MAX = 6


def _resolve_team(name: str) -> dict:
    name_lower = name.lower()
    for t in get_teams_raw()["teams"]:
        if name_lower == t["code"].lower():
            return t
        if name_lower == t["name"].lower():
            return t
        if name == t.get("name_cn", ""):
            return t
        if name_lower in t.get("name_cn", "").lower():
            return t
    sys.exit(f"找不到球队: {name}")


def _build_score_matrix(lam_h: float, lam_a: float, size: int = MAX_GOALS) -> list[list[float]]:
    matrix = [[0.0] * (size + 1) for _ in range(size + 1)]
    total = 0.0
    for h in range(size + 1):
        for a in range(size + 1):
            tau = dixon_coles_tau(h, a, lam_h, lam_a)
            p = poisson_pmf(h, lam_h) * poisson_pmf(a, lam_a) * tau
            matrix[h][a] = p
            total += p
    if total > 0:
        for h in range(size + 1):
            for a in range(size + 1):
                matrix[h][a] /= total
    return matrix


def _build_half_matrix(lam_h_ft: float, lam_a_ft: float) -> list[list[float]]:
    return _build_score_matrix(lam_h_ft * HALF_TIME_GOAL_RATIO, lam_a_ft * HALF_TIME_GOAL_RATIO, HALF_MAX)



def analyze_result(home: dict, away: dict, lam_h: float, lam_a: float, m: list, hm: list, hm_h: float, hm_a: float) -> list[str]:
    hw = sum(m[h][a] for h in range(MAX_GOALS + 1) for a in range(MAX_GOALS + 1) if h > a)
    dw = sum(m[h][a] for h in range(MAX_GOALS + 1) for a in range(MAX_GOALS + 1) if h == a)
    aw = sum(m[h][a] for h in range(MAX_GOALS + 1) for a in range(MAX_GOALS + 1) if h < a)
    return [
        "📊 全场赛果",
        f"   {home['name_cn']}胜:  {hw*100:.1f}%",
        f"   平局:       {dw*100:.1f}%",
        f"   {away['name_cn']}胜:  {aw*100:.1f}%",
    ]


def analyze_btts(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    p_h_score = 1 - math.exp(-lam_h)
    p_a_score = 1 - math.exp(-lam_a)
    btts = p_h_score * p_a_score
    return [
        "⚽ 两队都进球 (BTTS)",
        f"   {home['name_cn']}进球概率: {p_h_score*100:.1f}%",
        f"   {away['name_cn']}进球概率: {p_a_score*100:.1f}%",
        f"   ★ 都进球:  {btts*100:.1f}%",
        f"   至少一队零封: {(1-btts)*100:.1f}%",
    ]


def analyze_ht_result(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    p_draw = sum(hm[h][h] for h in range(HALF_MAX + 1))
    p_home = sum(hm[h][a] for h in range(HALF_MAX + 1) for a in range(HALF_MAX + 1) if h > a)
    p_away = sum(hm[h][a] for h in range(HALF_MAX + 1) for a in range(HALF_MAX + 1) if h < a)
    return [
        "⏱️  半场赛果",
        f"   {home['name_cn']}领先: {p_home*100:.1f}%",
        f"   半场平局:     {p_draw*100:.1f}%",
        f"   {away['name_cn']}领先: {p_away*100:.1f}%",
    ]


def analyze_ht_draw(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    p_draw = sum(hm[h][h] for h in range(HALF_MAX + 1))
    p_00 = hm[0][0]
    p_11 = hm[1][1]
    return [
        "⏱️  半场打平",
        f"   ★ 半场平局: {p_draw*100:.1f}%",
        f"   其中 0-0: {p_00*100:.1f}% / 1-1: {p_11*100:.1f}%",
        f"   半场不平: {(1-p_draw)*100:.1f}%",
    ]


def analyze_over_under(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    lines = ["🎯 大小球"]
    for line in [0.5, 1.5, 2.5, 3.5]:
        over = 0.0
        for h in range(MAX_GOALS + 1):
            for a in range(MAX_GOALS + 1):
                if h + a > line:
                    over += m[h][a]
        under = 1.0 - over
        lines.append(f"   大{line}/小{line}: {over*100:.1f}% / {under*100:.1f}%")
    total = lam_h + lam_a
    lines.append(f"   预期总进球: {total:.2f}")
    return lines


def analyze_correct_score(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    scores = []
    for h in range(MAX_GOALS + 1):
        for a in range(MAX_GOALS + 1):
            scores.append((h, a, m[h][a]))
    scores.sort(key=lambda x: -x[2])
    lines = ["🔢 正确比分 Top 10"]
    for h, a, p in scores[:10]:
        tag = ""
        if h > a:
            tag = f"({home['name_cn']}胜)"
        elif h < a:
            tag = f"({away['name_cn']}胜)"
        else:
            tag = "(平局)"
        lines.append(f"   {h}-{a} {p*100:.1f}% {tag}")
    return lines


def analyze_ht_correct_score(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    scores = []
    for h in range(HALF_MAX + 1):
        for a in range(HALF_MAX + 1):
            scores.append((h, a, hm[h][a]))
    scores.sort(key=lambda x: -x[2])
    lines = ["⏱️  半场比分 Top 5"]
    for h, a, p in scores[:5]:
        lines.append(f"   {h}-{a} {p*100:.1f}%")
    return lines


def analyze_handicap(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    lines = ["🎚️  让球盘"]
    for hc in [-2, -1, 0, 1, 2]:
        win = draw = lose = 0.0
        for h in range(MAX_GOALS + 1):
            for a in range(MAX_GOALS + 1):
                adj = h + hc - a
                if adj > 0:
                    win += m[h][a]
                elif adj == 0:
                    draw += m[h][a]
                else:
                    lose += m[h][a]
        label = f"主队{hc:+d}" if hc != 0 else "平手"
        lines.append(f"   {label}: 赢 {win*100:.1f}% / 走 {draw*100:.1f}% / 输 {lose*100:.1f}%")
    return lines


def analyze_summary(home, away, lam_h, lam_a, m, hm, hm_h, hm_a) -> list[str]:
    hw = sum(m[h][a] for h in range(MAX_GOALS + 1) for a in range(MAX_GOALS + 1) if h > a)
    dw = sum(m[h][a] for h in range(MAX_GOALS + 1) for a in range(MAX_GOALS + 1) if h == a)
    aw = 1 - hw - dw
    btts = (1 - math.exp(-lam_h)) * (1 - math.exp(-lam_a))
    ht_draw = sum(hm[h][h] for h in range(HALF_MAX + 1))
    total = lam_h + lam_a
    best_h = best_a = 0
    best_p = 0.0
    for h in range(MAX_GOALS + 1):
        for a in range(MAX_GOALS + 1):
            if m[h][a] > best_p:
                best_h, best_a, best_p = h, a, m[h][a]
    fav = home["name_cn"] if hw > aw else away["name_cn"]
    fav_p = max(hw, aw)
    return [
        f"📋 {home['name_cn']}({home['elo_rating']}) vs {away['name_cn']}({away['elo_rating']})",
        f"   看好 {fav} ({fav_p*100:.0f}%) · 预期进球 {total:.1f} · 最可能 {best_h}-{best_a}",
        f"   BTTS {btts*100:.0f}% · 半场平 {ht_draw*100:.0f}% · 全场平 {dw*100:.0f}%",
    ]


ANALYZERS = {
    "all": None,
    "result": analyze_result,
    "btts": analyze_btts,
    "ht-draw": analyze_ht_draw,
    "ht-result": analyze_ht_result,
    "over": analyze_over_under,
    "cs": analyze_correct_score,
    "ht-cs": analyze_ht_correct_score,
    "handicap": analyze_handicap,
    "summary": analyze_summary,
}

ALL_TYPES = ["summary", "result", "btts", "ht-result", "ht-draw", "over", "cs", "ht-cs", "handicap"]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    team1 = sys.argv[1]
    team2 = sys.argv[2]
    types = sys.argv[3:] if len(sys.argv) > 3 else ["all"]

    if "all" in types:
        types = ALL_TYPES

    home = _resolve_team(team1)
    away = _resolve_team(team2)

    home_adv = 80.0 if home.get("is_host") else 25.0
    lam_h, lam_a = expected_goals_from_elo(home["elo_rating"], away["elo_rating"], home_advantage=home_adv)

    m = _build_score_matrix(lam_h, lam_a, MAX_GOALS)
    hm = _build_half_matrix(lam_h, lam_a)
    hm_h = lam_h * HALF_TIME_GOAL_RATIO
    hm_a = lam_a * HALF_TIME_GOAL_RATIO

    print(f"\n{'='*52}")
    print(f"  {home['name_cn']} vs {away['name_cn']}")
    print(f"  Elo {home['elo_rating']} vs {away['elo_rating']} · 预期进球 {lam_h:.2f} - {lam_a:.2f}")
    print(f"{'='*52}\n")

    for t in types:
        fn = ANALYZERS.get(t)
        if fn is None:
            print(f"  未知分析类型: {t} (可用: {', '.join(ANALYZERS.keys())})")
            continue
        for line in fn(home, away, lam_h, lam_a, m, hm, hm_h, hm_a):
            print(line)
        print()


if __name__ == "__main__":
    main()
