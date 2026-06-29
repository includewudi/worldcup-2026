import { useEffect, useState } from "react";
import { fetchTeams, fetchSquadComparison } from "@/api";
import type { Team, SquadComparison, Player } from "@/types";
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

function ratingTierColor(r: number): string {
  if (r >= 90) return "text-gold-400";
  if (r >= 85) return "text-purple-400";
  if (r >= 80) return "text-blue-400";
  if (r >= 75) return "text-emerald-400";
  return "text-slate-400";
}

function ratingBarColor(r: number): string {
  if (r >= 90) return "from-gold-500 to-gold-400";
  if (r >= 85) return "from-purple-500 to-purple-400";
  if (r >= 80) return "from-blue-500 to-blue-400";
  if (r >= 75) return "from-emerald-500 to-emerald-400";
  return "from-slate-600 to-slate-500";
}

function RatingBadge({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return <span className="text-slate-600">-</span>;
  return (
    <span className={clsx("text-lg font-bold font-mono tabular-nums", ratingTierColor(rating))}>
      {rating}
    </span>
  );
}

function RatingBar({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return <div className="bg-slate-800 rounded-full h-2 w-20" />;
  const pct = (rating / 99) * 100;
  return (
    <div className="bg-slate-800 rounded-full h-2 overflow-hidden w-20">
      <div
        className={clsx("bg-gradient-to-r h-full rounded-full transition-all duration-500", ratingBarColor(rating))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ValueBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="bg-slate-800 rounded-full h-2 overflow-hidden w-20">
      <div
        className="bg-gradient-to-r from-gold-500 to-gold-400 h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

type SortMode = "rating" | "value";

function TeamSquadTable({ squad, sortMode }: { squad: SquadComparison["home"]; sortMode: SortMode }) {
  const players: Player[] = sortMode === "rating" ? squad.top_players_by_rating : squad.top_players_by_value;
  const maxVal = Math.max(...players.map((p) => p.value_eur), 1);

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl font-bold text-gold-400">{squad.team_code}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{squad.team_name_cn}</h2>
          <p className="text-xs text-slate-500 truncate">
            {squad.team_name} · {squad.player_count}人
            <span className="ml-2 text-slate-600">
              FC25 {Math.round(squad.rating_coverage_pct * 100) / 100}%
            </span>
          </p>
        </div>
      </div>

      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-slate-500 block">平均能力值</span>
          <span className="text-xl font-bold font-mono text-emerald-400">
            {squad.avg_rating > 0 ? squad.avg_rating.toFixed(1) : "-"}
          </span>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">总身价</span>
          <span className="text-xl font-bold font-mono text-gold-400">{formatValue(squad.total_value_eur)}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(squad.position_breakdown).map(([pos, count]) => (
          <span key={pos} className={clsx("badge border", POSITION_CHIP_COLORS[pos] || "bg-slate-700 text-slate-300")}>
            {pos} {count}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2 px-1.5 w-6">#</th>
              <th className="text-left py-2 px-1.5">球员</th>
              <th className="text-left py-2 px-1.5 w-12">位置</th>
              <th className="text-left py-2 px-1.5">俱乐部</th>
              <th className="text-center py-2 px-1.5 w-8">年龄</th>
              {sortMode === "rating" ? (
                <>
                  <th className="text-center py-2 px-1.5 w-10">评分</th>
                  <th className="text-right py-2 px-1.5 w-16">身价</th>
                  <th className="py-2 px-1.5 w-20" />
                </>
              ) : (
                <>
                  <th className="text-center py-2 px-1.5 w-10">评分</th>
                  <th className="text-right py-2 px-1.5 w-16">身价</th>
                  <th className="py-2 px-1.5 w-20" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr
                key={p.name}
                className={clsx(
                  "border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors",
                  p.rating == null && "opacity-50"
                )}
              >
                <td className="py-2 px-1.5 text-slate-600 font-mono">{i + 1}</td>
                <td className="py-2 px-1.5 font-medium truncate max-w-[180px]">{p.name}</td>
                <td className="py-2 px-1.5">
                  <span className={clsx("badge border text-xs", POSITION_STYLES[p.position] || "bg-slate-700 text-slate-300")}>
                    {p.position}
                  </span>
                </td>
                <td className="py-2 px-1.5 text-slate-400 truncate max-w-[140px]">{p.club}</td>
                <td className="py-2 px-1.5 text-center text-slate-400">{p.age ?? "-"}</td>
                <td className="py-2 px-1.5 text-center">
                  <RatingBadge rating={p.rating} />
                </td>
                <td className={clsx("py-2 px-1.5 text-right font-mono text-xs", sortMode === "rating" ? "text-slate-500" : "text-gold-400")}>
                  {formatValue(p.value_eur)}
                </td>
                <td className="py-2 px-1.5">
                  {sortMode === "rating" ? <RatingBar rating={p.rating} /> : <ValueBar value={p.value_eur} max={maxVal} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RatingComparisonCard({ comparison }: { comparison: SquadComparison }) {
  const { home, away } = comparison;
  const gap = comparison.rating_gap;
  const homeLabel = `${home.team_name_cn} (${home.team_code})`;
  const awayLabel = `${away.team_name_cn} (${away.team_code})`;

  return (
    <div className="card relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-gold-500/5 pointer-events-none" />

      <h2 className="text-lg font-semibold mb-6 relative">⚡ 能力值对比 (FC25)</h2>

      <div className="flex items-center justify-center gap-8 mb-6 relative">
        <div className="text-center flex-1">
          <p className="text-xs text-slate-500 mb-1">{home.team_code}</p>
          <p className={clsx("text-5xl font-black font-mono tabular-nums", gap >= 0 ? "text-emerald-400" : "text-slate-300")}>
            {home.avg_rating > 0 ? home.avg_rating.toFixed(1) : "-"}
          </p>
          <p className="text-sm text-slate-400 mt-1 truncate">{home.team_name_cn}</p>
        </div>


        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl text-slate-600">⚔️</span>
          <span className={clsx(
            "text-sm font-bold font-mono px-3 py-1 rounded-full",
            gap > 0
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : gap < 0
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-slate-700/50 text-slate-400 border border-slate-600/30"
          )}>
            {gap > 0 ? `+${gap.toFixed(1)}` : gap < 0 ? gap.toFixed(1) : "0"}
          </span>
          <span className="text-[10px] text-slate-600">
            {comparison.stronger_team_by_rating === "equal" ? "势均力敌" : `${comparison.stronger_team_by_rating} 更强`}
          </span>
        </div>


        <div className="text-center flex-1">
          <p className="text-xs text-slate-500 mb-1">{away.team_code}</p>
          <p className={clsx("text-5xl font-black font-mono tabular-nums", gap <= 0 ? "text-emerald-400" : "text-slate-300")}>
            {away.avg_rating > 0 ? away.avg_rating.toFixed(1) : "-"}
          </p>
          <p className="text-sm text-slate-400 mt-1 truncate">{away.team_name_cn}</p>
        </div>
      </div>

      <div className="flex justify-center gap-6 text-xs text-slate-500 mb-6 relative">
        <span>主队 {Math.round(home.rating_coverage_pct * 100) / 100}% 已评分</span>
        <span>客队 {Math.round(away.rating_coverage_pct * 100) / 100}% 已评分</span>
      </div>

      <div className="space-y-3 relative">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{homeLabel}</span>
            <span className="font-mono text-emerald-400">{home.avg_rating.toFixed(1)}</span>
          </div>
          <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${(home.avg_rating / 99) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{awayLabel}</span>
            <span className="font-mono text-sky-400">{away.avg_rating.toFixed(1)}</span>
          </div>
          <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-600 to-sky-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${(away.avg_rating / 99) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueComparisonCard({ comparison }: { comparison: SquadComparison }) {
  const homeVal = comparison.home.total_value_eur;
  const awayVal = comparison.away.total_value_eur;
  const maxTotalVal = Math.max(homeVal, awayVal, 1);
  const homeLabel = `${comparison.home.team_name_cn} (${comparison.home.team_code})`;
  const awayLabel = `${comparison.away.team_name_cn} (${comparison.away.team_code})`;

  return (
    <div className="card">
      <h2 className="text-base font-semibold mb-4 text-slate-300">💰 总身价对比</h2>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{homeLabel}</span>
            <span className="font-mono text-gold-400">{formatValue(homeVal)}</span>
          </div>
          <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-pitch-600 to-pitch-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(homeVal / maxTotalVal) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{awayLabel}</span>
            <span className="font-mono text-blue-400">{formatValue(awayVal)}</span>
          </div>
          <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(awayVal / maxTotalVal) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-center">
        <p className="text-xs text-slate-500">身价差距</p>
        <p className="text-lg font-bold font-mono text-gold-400">{formatValue(Math.abs(comparison.value_gap_eur))}</p>
        <p className="text-xs text-slate-500 mt-1">
          {comparison.stronger_team_by_value === "equal"
            ? "两队身价持平"
            : `${comparison.stronger_team_by_value} 身价更高`}
        </p>
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
  const [sortMode, setSortMode] = useState<SortMode>("rating");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCode, awayCode]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">🛡️ 阵容对比</h1>
        <p className="text-slate-400 mt-1">选择两支球队，查看 FC25 能力值与身价对比</p>
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
          <RatingComparisonCard comparison={comparison} />

          <ValueComparisonCard comparison={comparison} />

          <div className="flex justify-center">
            <div className="inline-flex bg-slate-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => setSortMode("rating")}
                className={clsx(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  sortMode === "rating"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-300"
                )}
              >
                ⚡ 按能力值排序 (FC25)
              </button>
              <button
                onClick={() => setSortMode("value")}
                className={clsx(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  sortMode === "value"
                    ? "bg-gold-500/20 text-gold-400 border border-gold-500/30"
                    : "text-slate-400 hover:text-slate-300"
                )}
              >
                💰 按身价排序
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamSquadTable squad={comparison.home} sortMode={sortMode} />
            <TeamSquadTable squad={comparison.away} sortMode={sortMode} />
          </div>
        </>
      )}
    </div>
  );
}
