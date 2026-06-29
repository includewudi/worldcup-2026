import { useEffect, useState } from "react";
import { fetchTeams, fetchPrediction, fetchSquadComparison } from "@/api";
import type { Team, MatchPrediction, SquadComparison } from "@/types";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";

export default function PredictPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeCode, setHomeCode] = useState("BRA");
  const [awayCode, setAwayCode] = useState("ARG");
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [squadCmp, setSquadCmp] = useState<SquadComparison | null>(null);

  useEffect(() => {
    fetchTeams().then(setTeams);
  }, []);

  const runPrediction = () => {
    if (homeCode === awayCode) return;
    setLoading(true);
    fetchPrediction(homeCode, awayCode)
      .then(setPrediction)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runPrediction();
  }, []);

  useEffect(() => {
    if (homeCode && awayCode && homeCode !== awayCode) {
      fetchSquadComparison(homeCode, awayCode).then(setSquadCmp).catch(() => {});
    }
  }, [homeCode, awayCode]);

  const total = prediction
    ? prediction.prediction.home_win + prediction.prediction.draw + prediction.prediction.away_win || 1
    : 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">🎯 对阵预测</h1>
        <p className="text-slate-400 mt-1">Elo + Dixon-Coles Poisson 模型 · 选择两支队伍进行预测</p>
      </header>

      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">主队</label>
            <select
              value={homeCode}
              onChange={(e) => setHomeCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name_cn} (Elo: {t.elo_rating}, Group {t.group})
                </option>
              ))}
            </select>
          </div>

          <div className="text-center pt-6">
            <ChevronRight className="text-slate-600" />
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">客队</label>
            <select
              value={awayCode}
              onChange={(e) => setAwayCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name_cn} (Elo: {t.elo_rating}, Group {t.group})
                </option>
              ))}
            </select>
          </div>

          <button onClick={runPrediction} disabled={loading || homeCode === awayCode} className="btn-primary mt-6">
            {loading ? "计算中..." : "🔮 预测"}
          </button>
        </div>
      </div>

      {prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">📊 胜/平/负概率</h2>
            <div className="space-y-3">
              <ProbBar
                label={prediction.home_team.name_cn}
                value={prediction.prediction.home_win}
                total={total}
                color="bg-pitch-600"
              />
              <ProbBar label="平局" value={prediction.prediction.draw} total={total} color="bg-slate-500" />
              <ProbBar
                label={prediction.away_team.name_cn}
                value={prediction.prediction.away_win}
                total={total}
                color="bg-blue-600"
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">⚽ 预期进球</h2>
            <div className="text-center py-4">
              <div className="text-4xl font-bold font-mono text-gold-400">
                {prediction.prediction.expected_goals_home} <span className="text-slate-500 text-2xl">-</span> {prediction.prediction.expected_goals_away}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                主场优势: +{prediction.prediction.home_advantage_applied} Elo
              </p>
            </div>
          </div>

          {prediction.prediction.squad_adjustment?.applied && (
            <SquadAdjustmentPanel prediction={prediction} />
          )}

          <div className="card lg:col-span-3">
            <h2 className="text-lg font-semibold mb-1">🎯 比分概率 Top 10</h2>
            <p className="text-xs text-slate-500 mb-4">基于 Dixon-Coles 修正泊松模型，按概率降序排列</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {prediction.prediction.top_scores?.map((s, i) => {
                const [h, a] = s.score;
                const pct = (s.prob * 100).toFixed(1);
                const isDraw = h === a;
                const homeWin = h > a;
                const borderColor = isDraw ? "border-slate-500" : homeWin ? "border-pitch-600" : "border-blue-600";
                const glow = i === 0 ? "ring-2 ring-gold-400/50" : "";
                return (
                  <div key={`${h}-${a}`} className={`border-l-2 ${borderColor} ${glow} bg-slate-800/50 rounded-lg p-3 text-center`}>
                    <div className="text-2xl font-bold font-mono text-slate-100">{h} - {a}</div>
                    <div className="text-sm text-gold-400 font-semibold mt-1">{pct}%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {isDraw ? "平局" : homeWin ? `${prediction.home_team.name_cn}胜` : `${prediction.away_team.name_cn}胜`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {squadCmp && (
        <SquadComparisonPanel comparison={squadCmp} />
      )}
    </div>
  );
}

function ProbBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = ((value / total) * 100).toFixed(1);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-gold-400">{pct}%</span>
      </div>
      <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const POS_STYLE: Record<string, string> = {
  GK: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DF: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  MF: "bg-green-500/20 text-green-400 border-green-500/30",
  FW: "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatSquadValue(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}K`;
  return `€${v}`;
}

function ratingTierClass(r: number | null | undefined): string {
  if (!r) return "text-slate-600";
  if (r >= 90) return "text-gold-400";
  if (r >= 85) return "text-purple-400";
  if (r >= 80) return "text-blue-400";
  if (r >= 75) return "text-green-400";
  return "text-slate-400";
}

function ratingBarClass(r: number | null | undefined): string {
  if (!r) return "bg-slate-700";
  if (r >= 90) return "bg-gradient-to-r from-gold-600 to-gold-400";
  if (r >= 85) return "bg-gradient-to-r from-purple-600 to-purple-400";
  if (r >= 80) return "bg-gradient-to-r from-blue-600 to-blue-400";
  if (r >= 75) return "bg-gradient-to-r from-green-600 to-green-400";
  return "bg-gradient-to-r from-slate-600 to-slate-400";
}

function SquadAdjustmentPanel({ prediction }: { prediction: MatchPrediction }) {
  const sa = prediction.prediction.squad_adjustment!;
  const ha = sa.home_attack ?? 0;
  const hd = sa.home_defense ?? 0;
  const aa = sa.away_attack ?? 0;
  const ad = sa.away_defense ?? 0;

  const homeEdge = ha - ad;
  const awayEdge = aa - hd;

  const edgeText = (edge: number) => {
    if (edge > 3) return "显著占优";
    if (edge > 1) return "略占优";
    if (edge > -1) return "势均力敌";
    if (edge > -3) return "稍处下风";
    return "明显劣势";
  };
  const edgeColor = (edge: number) => {
    if (edge > 1) return "text-emerald-400";
    if (edge < -1) return "text-red-400";
    return "text-slate-400";
  };

  return (
    <div className="card lg:col-span-3">
      <h2 className="text-lg font-semibold mb-1">🧠 攻防分析</h2>
      <p className="text-xs text-slate-500 mb-4">
        FC25 攻防能力值已影响预测 · 进攻 vs 对手防守决定进球期望微调
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-2">
            {prediction.home_team.name_cn} 进攻 vs {prediction.away_team.name_cn} 防守
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-500">进攻</p>
              <p className={clsx("text-2xl font-bold font-mono", ratingTierClass(ha))}>{ha}</p>
            </div>
            <span className="text-xl text-slate-600">vs</span>
            <div className="text-center">
              <p className="text-[10px] text-slate-500">防守</p>
              <p className={clsx("text-2xl font-bold font-mono", ratingTierClass(ad))}>{ad}</p>
            </div>
          </div>
          <div className="text-center mt-2">
            <span className={clsx("text-sm font-medium", edgeColor(homeEdge))}>
              {edgeText(homeEdge)}
            </span>
            <span className={clsx("text-xs font-mono ml-2", sa.home_adj_pct! >= 0 ? "text-emerald-400" : "text-red-400")}>
              ({sa.home_adj_pct! >= 0 ? "+" : ""}{sa.home_adj_pct}% λ)
            </span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-2">
            {prediction.away_team.name_cn} 进攻 vs {prediction.home_team.name_cn} 防守
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-500">进攻</p>
              <p className={clsx("text-2xl font-bold font-mono", ratingTierClass(aa))}>{aa}</p>
            </div>
            <span className="text-xl text-slate-600">vs</span>
            <div className="text-center">
              <p className="text-[10px] text-slate-500">防守</p>
              <p className={clsx("text-2xl font-bold font-mono", ratingTierClass(hd))}>{hd}</p>
            </div>
          </div>
          <div className="text-center mt-2">
            <span className={clsx("text-sm font-medium", edgeColor(awayEdge))}>
              {edgeText(awayEdge)}
            </span>
            <span className={clsx("text-xs font-mono ml-2", sa.away_adj_pct! >= 0 ? "text-emerald-400" : "text-red-400")}>
              ({sa.away_adj_pct! >= 0 ? "+" : ""}{sa.away_adj_pct}% λ)
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-lg p-3 text-center text-xs text-slate-400">
        进攻强遇到防守弱 → 进球期望 ↑ · 防守强遇到进攻弱 → 进球期望 ↓
      </div>
    </div>
  );
}

function SquadComparisonPanel({ comparison }: { comparison: SquadComparison }) {
  const homeTop5 = comparison.home.top_players_by_rating.slice(0, 5);
  const awayTop5 = comparison.away.top_players_by_rating.slice(0, 5);
  const allRatings = [...homeTop5, ...awayTop5].map((p) => p.rating ?? 0);
  const maxRating = Math.max(...allRatings, 99);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">⚔️ 阵容对比</h2>
      <p className="text-xs text-slate-500 mb-4">FC25 能力值 · {comparison.home.rating_coverage_pct}%/{comparison.away.rating_coverage_pct}% 球员有评分</p>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">{comparison.home.team_name_cn}</p>
          <p className={clsx("text-2xl font-bold font-mono", ratingTierClass(comparison.home.avg_rating))}>{comparison.home.avg_rating || "-"}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">平均能力值</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">{comparison.away.team_name_cn}</p>
          <p className={clsx("text-2xl font-bold font-mono", ratingTierClass(comparison.away.avg_rating))}>{comparison.away.avg_rating || "-"}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">平均能力值</p>
        </div>
      </div>

      <div className="text-center mb-4">
        <span className="text-xs text-slate-500">能力值差距 </span>
        <span className={clsx("text-sm font-bold font-mono", comparison.rating_gap >= 0 ? "text-pitch-400" : "text-blue-400")}>
          {comparison.rating_gap >= 0 ? "+" : ""}{comparison.rating_gap}
        </span>
        <span className="text-xs text-slate-500 ml-2">| 身价差 </span>
        <span className="text-xs font-mono text-gold-400">{formatSquadValue(Math.abs(comparison.value_gap_eur))}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[homeTop5, awayTop5].map((list, colIdx) => (
          <div key={colIdx}>
            <h3 className="text-sm font-semibold text-slate-400 mb-2">
              {colIdx === 0 ? comparison.home.team_name_cn : comparison.away.team_name_cn} Top 5
            </h3>
            <div className="space-y-2">
              {list.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-sm">
                  <span className={clsx("badge border shrink-0", POS_STYLE[p.position] || "bg-slate-700 text-slate-300")}>{p.position}</span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className={clsx("font-mono text-sm font-bold shrink-0 w-7 text-right", ratingTierClass(p.rating))}>{p.rating ?? "-"}</span>
                  <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden w-14 shrink-0">
                    <div className={clsx("h-full rounded-full", ratingBarClass(p.rating))} style={{ width: `${((p.rating ?? 0) / maxRating) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
