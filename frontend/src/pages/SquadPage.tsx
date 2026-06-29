import { useEffect, useState } from "react";
import { fetchTeams, fetchSquadComparison } from "@/api";
import type { Team, SquadComparison } from "@/types";
import clsx from "clsx";

const POSITION_STYLES: Record<string, string> = {
  GK: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DF: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  MF: "bg-green-500/20 text-green-400 border-green-500/30",
  FW: "bg-red-500/20 text-red-400 border-red-500/30",
};

const POSITION_CHIP_COLORS: Record<string, string> = {
  GK: "bg-yellow-500/30 text-yellow-300",
  DF: "bg-blue-500/30 text-blue-300",
  MF: "bg-green-500/30 text-green-300",
  FW: "bg-red-500/30 text-red-300",
};

function formatValue(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}K`;
  return `€${v}`;
}

function ValueBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="bg-slate-800 rounded-full h-2 overflow-hidden w-20">
      <div className="bg-gradient-to-r from-gold-500 to-gold-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function TeamSquadTable({ squad }: { squad: SquadComparison["home"] }) {
  const maxVal = Math.max(...squad.top_players.map((p) => p.value_eur), 1);

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl font-bold text-gold-400">{squad.team_code}</span>
        <div>
          <h2 className="text-lg font-semibold">{squad.team_name_cn}</h2>
          <p className="text-xs text-slate-500">{squad.team_name} · {squad.player_count}人</p>
        </div>
      </div>

      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">总身价</span>
          <span className="text-lg font-bold font-mono text-gold-400">{formatValue(squad.total_value_eur)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-slate-400">人均身价</span>
          <span className="text-sm font-mono text-slate-300">{formatValue(squad.avg_value_eur)}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(squad.position_breakdown).map(([pos, count]) => (
          <span key={pos} className={clsx("badge border", POSITION_CHIP_COLORS[pos] || "bg-slate-700 text-slate-300")}>
            {pos} {count}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">球员</th>
              <th className="text-left py-2 px-2">置</th>
              <th className="text-left py-2 px-2">俱乐部</th>
              <th className="text-center py-2 px-2">年龄</th>
              <th className="text-right py-2 px-2">身价</th>
              <th className="py-2 px-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {squad.top_players.map((p, i) => (
              <tr key={p.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-2 text-slate-600 font-mono">{i + 1}</td>
                <td className="py-2 px-2 font-medium">{p.name}</td>
                <td className="py-2 px-2">
                  <span className={clsx("badge border", POSITION_STYLES[p.position] || "bg-slate-700 text-slate-300")}>{p.position}</span>
                </td>
                <td className="py-2 px-2 text-slate-400">{p.club}</td>
                <td className="py-2 px-2 text-center text-slate-400">{p.age ?? "-"}</td>
                <td className="py-2 px-2 text-right font-mono text-gold-400 text-xs">{formatValue(p.value_eur)}</td>
                <td className="py-2 px-2"><ValueBar value={p.value_eur} max={maxVal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SquadPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeCode, setHomeCode] = useState("BRA");
  const [awayCode, setAwayCode] = useState("ARG");
  const [comparison, setComparison] = useState<SquadComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams().then(setTeams);
  }, []);

  const loadComparison = () => {
    if (homeCode === awayCode) return;
    setLoading(true);
    setError(null);
    fetchSquadComparison(homeCode, awayCode)
      .then(setComparison)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadComparison();
  }, [homeCode, awayCode]);

  const homeVal = comparison?.home.total_value_eur ?? 0;
  const awayVal = comparison?.away.total_value_eur ?? 0;
  const maxTotalVal = Math.max(homeVal, awayVal, 1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">🛡️ 阵容对比</h1>
        <p className="text-slate-400 mt-1">选择两支球队，查看球员阵容与身价对比</p>
      </header>

      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">球队 A</label>
            <select
              value={homeCode}
              onChange={(e) => setHomeCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.code} value={t.code}>{t.name_cn} ({t.code})</option>
              ))}
            </select>
          </div>

          <span className="text-2xl text-slate-600 pt-6">⚔️</span>

          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">球队 B</label>
            <select
              value={awayCode}
              onChange={(e) => setAwayCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.code} value={t.code}>{t.name_cn} ({t.code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card text-center py-8 text-slate-400">
          <span className="animate-pulse">⏳ 加载阵容数据...</span>
        </div>
      )}

      {error && (
        <div className="card text-center py-6 text-red-400">{error}</div>
      )}

      {comparison && !loading && (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">💰 总身价对比</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{comparison.home.team_name_cn} ({comparison.home.team_code})</span>
                  <span className="font-mono text-gold-400">{formatValue(homeVal)}</span>
                </div>
                <div className="bg-slate-800 rounded-full h-4 overflow-hidden">
                  <div className="bg-gradient-to-r from-pitch-600 to-pitch-500 h-full rounded-full transition-all duration-500" style={{ width: `${(homeVal / maxTotalVal) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{comparison.away.team_name_cn} ({comparison.away.team_code})</span>
                  <span className="font-mono text-blue-400">{formatValue(awayVal)}</span>
                </div>
                <div className="bg-slate-800 rounded-full h-4 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(awayVal / maxTotalVal) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-center">
              <p className="text-sm text-slate-400">身价差距</p>
              <p className="text-xl font-bold font-mono text-gold-400">{formatValue(Math.abs(comparison.value_gap_eur))}</p>
              <p className="text-xs text-slate-500 mt-1">
                {comparison.stronger_team === "equal" ? "两队身价持平" : `${comparison.stronger_team} 身价更高`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamSquadTable squad={comparison.home} />
            <TeamSquadTable squad={comparison.away} />
          </div>
        </>
      )}
    </div>
  );
}
