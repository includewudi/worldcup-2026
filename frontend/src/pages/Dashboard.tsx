import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTeams, fetchTournamentInfo, runSimulation, fetchStandings, fetchFixtures } from "@/api";
import { getCacheAge } from "@/api";
import { useSync } from "@/contexts/SyncContext";
import type { Team, TournamentInfo, SimulationResult, StandingsResponse, Fixture } from "@/types";
import { Calendar, Trophy, MapPin, BarChart3, RefreshCw, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [info, setInfo] = useState<TournamentInfo | null>(null);
  const [topTeams, setTopTeams] = useState<SimulationResult[]>([]);
  const [standings, setStandings] = useState<StandingsResponse>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);
  const { syncCounter } = useSync();

  useEffect(() => {
    setLoading(true);
    setError(false);
    setStale(false);
    Promise.allSettled([fetchTeams(), fetchTournamentInfo(), fetchStandings(), fetchFixtures()])
      .then(([t, i, s, f]) => {
        let anySuccess = false;
        if (t.status === "fulfilled") { setTeams(t.value); anySuccess = true; }
        if (i.status === "fulfilled") { setInfo(i.value); anySuccess = true; }
        if (s.status === "fulfilled") { setStandings(s.value); anySuccess = true; }
        if (f.status === "fulfilled") { setFixtures(f.value); anySuccess = true; }

        const teamsAge = getCacheAge("teams");
        const fixturesAge = getCacheAge("fixtures");
        const newestAge = Math.min(teamsAge ?? Infinity, fixturesAge ?? Infinity);
        if (newestAge !== Infinity && (t.status === "rejected" || f.status === "rejected")) {
          setStale(true);
        }

        if (!anySuccess && t.status === "rejected" && f.status === "rejected") {
          setError(true);
        }
      })
      .finally(() => setLoading(false));
  }, [syncCounter]);

  useEffect(() => {
    runSimulation(5000).then((res) => setTopTeams(res.results.slice(0, 10))).catch(() => {});
  }, [syncCounter]);

  const top10 = [...teams].sort((a, b) => b.elo_rating - a.elo_rating).slice(0, 10);
  const playedCount = fixtures.filter((f) => f.played).length;
  const qualifiedTeams = topTeams.filter((t) => t.r16_prob >= 0.95).slice(0, 8);
  const previewGroups = "ABCD".split("").filter((g) => (standings[g] || []).length > 0);

  const cacheAgeMin = (() => {
    const teamsAge = getCacheAge("teams");
    if (teamsAge === null) return null;
    return Math.round(teamsAge / 60000);
  })();

  if (loading) return <div className="text-center py-20 text-slate-500">加载中...</div>;

  if (error) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">🏟️ FIFA 世界杯 2026</h1>
          <p className="text-slate-400 mt-1">48队 · 16座城市 · USA / Mexico / Canada</p>
        </header>
        <div className="card border-l-4 border-amber-500 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <p className="font-medium text-amber-400">服务器启动中，请稍候</p>
              <p className="text-sm text-slate-400 mt-1">
                后端服务正在冷启动（约 50 秒），稍后刷新即可。
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-pitch-600 hover:bg-pitch-700 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw size={14} />
                重新加载
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">🏟️ FIFA 世界杯 2026</h1>
        <p className="text-slate-400 mt-1">
          {info ? `${info.total_matches}场比赛 · ` : ""}48队 · 16座城市 · USA / Mexico / Canada
        </p>
      </header>

      {stale && (
        <div className="card border-l-4 border-amber-500 bg-amber-500/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-400 shrink-0" size={18} />
              <span className="text-sm text-amber-400">
                服务器响应超时，显示的是 {cacheAgeMin !== null ? `${cacheAgeMin} 分钟前` : ""}的缓存数据
              </span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs font-medium transition-colors text-amber-400"
            >
              <RefreshCw size={12} />
              重试
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="赛事日期" value="6月11日 - 7月19日" color="text-blue-400" />
        <StatCard icon={Trophy} label="参赛队伍" value={`${teams.length} 支`} color="text-gold-400" />
        <StatCard icon={MapPin} label="主办城市" value="16 座" color="text-pitch-600" />
        <StatCard icon={BarChart3} label="比赛进度" value={`${playedCount} / 72 场`} color="text-purple-400" />
      </div>

      {playedCount > 0 && (
        <div className="card border-l-2 border-pitch-600">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📊 实时积分榜</h2>
            <Link to="/standings" className="text-xs text-pitch-600 hover:underline">查看全部 →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {previewGroups.map((g) => {
              const rows = standings[g] || [];
              if (rows.length === 0) return null;
              return (
                <div key={g} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-sm font-semibold text-pitch-600 mb-2">Group {g}</div>
                  <div className="space-y-1">
                    {rows.map((r, i) => (
                      <div key={r.code} className={`flex items-center justify-between text-xs py-1 px-2 rounded ${i < 2 ? "bg-pitch-600/10" : i === 2 ? "bg-gold-400/10" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-4">{i + 1}</span>
                          <span className={i < 2 ? "text-pitch-600 font-medium" : ""}>{r.name_cn}</span>
                        </div>
                        <span className={`font-mono ${r.points > 0 ? "text-pitch-600" : "text-slate-500"}`}>
                          {r.points}分
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">🏆 夺冠热门 (实时模拟 Top 10)</h2>
            <Link to="/simulate" className="text-xs text-pitch-600 hover:underline">查看全部 →</Link>
          </div>
          {topTeams.length === 0 ? (
            <p className="text-slate-500 text-sm">模拟中...</p>
          ) : (
            <div className="space-y-2">
              {topTeams.map((t, i) => (
                <div key={t.code} className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm w-6">{i + 1}</span>
                  <span className="flex-1 font-medium">{t.name_cn}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-pitch-600 to-gold-500 h-full rounded-full"
                      style={{ width: `${Math.max(t.champion_prob * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-gold-400 font-mono text-sm w-12 text-right">
                    {(t.champion_prob * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📊 Elo 评分 Top 10</h2>
            <Link to="/teams" className="text-xs text-pitch-600 hover:underline">全部队伍 →</Link>
          </div>
          <div className="space-y-2">
            {top10.map((t, i) => (
              <div key={t.code} className="flex items-center gap-3">
                <span className="text-slate-500 text-sm w-6">{i + 1}</span>
                <span className="flex-1 font-medium">{t.name_cn}</span>
                <span className="text-slate-500 text-xs">FIFA #{t.fifa_ranking}</span>
                <span className="text-blue-400 font-mono text-sm w-14 text-right">{t.elo_rating}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {qualifiedTeams.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">✅ 预计晋级16强</h2>
          <div className="flex flex-wrap gap-2">
            {qualifiedTeams.map((t) => (
              <span key={t.code} className="badge bg-pitch-600/20 text-pitch-600 px-3 py-1">
                {t.name_cn}
                <span className="ml-1 text-[10px] text-slate-500">{(t.r16_prob * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">⚡ 快速操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/standings" className="btn bg-pitch-600/20 hover:bg-pitch-600/30 text-pitch-600 text-center">
            📊 积分榜
          </Link>
          <Link to="/predict" className="btn bg-slate-800 hover:bg-slate-700 text-center">
            🎯 预测对阵
          </Link>
          <Link to="/simulate" className="btn bg-slate-800 hover:bg-slate-700 text-center">
            🎲 蒙特卡洛模拟
          </Link>
          <Link to="/fixtures" className="btn bg-slate-800 hover:bg-slate-700 text-center">
            📅 查看赛程
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <Icon className={color} size={28} />
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="font-semibold mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}
