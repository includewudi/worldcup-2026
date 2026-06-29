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

function SquadComparisonPanel({ comparison }: { comparison: SquadComparison }) {
  const homeTop5 = comparison.home.top_players.slice(0, 5);
  const awayTop5 = comparison.away.top_players.slice(0, 5);
  const allVals = [...homeTop5, ...awayTop5].map((p) => p.value_eur);
  const maxVal = Math.max(...allVals, 1);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">⚔️ 阵容对比</h2>
      <p className="text-xs text-slate-500 mb-4">基于球员身价与阵容深度</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">{comparison.home.team_name_cn}</p>
          <p className="text-lg font-bold font-mono text-pitch-400">{formatSquadValue(comparison.home.total_value_eur)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">{comparison.away.team_name_cn}</p>
          <p className="text-lg font-bold font-mono text-blue-400">{formatSquadValue(comparison.away.total_value_eur)}</p>
        </div>
      </div>

      <div className="text-center mb-4">
        <span className="text-xs text-slate-500">身价差距 </span>
        <span className="text-sm font-bold font-mono text-gold-400">{formatSquadValue(Math.abs(comparison.value_gap_eur))}</span>
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
                  <span className="font-mono text-xs text-gold-400 shrink-0">{formatSquadValue(p.value_eur)}</span>
                  <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden w-16 shrink-0">
                    <div className="bg-gradient-to-r from-gold-500 to-gold-400 h-full rounded-full" style={{ width: `${(p.value_eur / maxVal) * 100}%` }} />
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
