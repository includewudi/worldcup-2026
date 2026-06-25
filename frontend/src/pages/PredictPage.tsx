import { useEffect, useState } from "react";
import { fetchTeams, fetchPrediction } from "@/api";
import type { Team, MatchPrediction } from "@/types";
import { ChevronRight } from "lucide-react";

export default function PredictPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeCode, setHomeCode] = useState("BRA");
  const [awayCode, setAwayCode] = useState("ARG");
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [loading, setLoading] = useState(false);

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
            <h2 className="text-lg font-semibold mb-4">⚽ 预期比分</h2>
            <div className="text-center py-6">
              <div className="text-5xl font-bold font-mono text-gold-400">
                {prediction.prediction.most_likely_score[0]} - {prediction.prediction.most_likely_score[1]}
              </div>
              <p className="text-sm text-slate-500 mt-2">
                概率 {(prediction.prediction.most_likely_score_prob * 100).toFixed(1)}%
              </p>
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>预期进球: {prediction.prediction.expected_goals_home} - {prediction.prediction.expected_goals_away}</p>
                <p>主场优势: +{prediction.prediction.home_advantage_applied} Elo</p>
              </div>
            </div>
          </div>
        </div>
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
