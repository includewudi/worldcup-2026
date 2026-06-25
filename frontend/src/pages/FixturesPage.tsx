import { useEffect, useState } from "react";
import { fetchFixtures, fetchTeams } from "@/api";
import { useSync } from "@/contexts/SyncContext";
import type { Fixture, Team } from "@/types";

const GROUPS = "ABCDEFGHIJKL".split("");

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const { syncCounter } = useSync();

  useEffect(() => {
    fetchFixtures().then(setFixtures);
    fetchTeams().then((t) => {
      const m = new Map<string, Team>();
      t.forEach((team) => m.set(team.code, team));
      setTeams(m);
    });
  }, [syncCounter]);

  const filtered = fixtures
    .filter((f) => selectedGroup === "ALL" || f.group === selectedGroup)
    .sort((a, b) => a.id - b.id);

  const playedCount = fixtures.filter((f) => f.played).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">📅 小组赛赛程</h1>
        <p className="text-slate-400 mt-1">
          72 场小组赛 · 2026年6月11日 - 6月27日
          {playedCount > 0 && (
            <span className="text-pitch-600 ml-2">
              · 已赛 {playedCount} 场
            </span>
          )}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGroup("ALL")}
          className={`badge ${selectedGroup === "ALL" ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-400"}`}
        >
          全部 ({fixtures.length})
        </button>
        {GROUPS.map((g) => {
          const count = fixtures.filter((f) => f.group === g).length;
          return (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`badge ${selectedGroup === g ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
            >
              Group {g} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.map((fx) => {
          const home = teams.get(fx.home);
          const away = teams.get(fx.away);
          const isPlayed = fx.played;

          return (
            <div
              key={fx.id}
              className={`card flex items-center gap-4 py-3 ${
                isPlayed
                  ? "border-l-2 border-pitch-600 bg-pitch-600/5"
                  : "hover:border-slate-700"
              }`}
            >
              <div className="text-xs text-slate-500 w-20 font-mono">
                {fx.date.slice(5)} {fx.time_utc.slice(0, 5)}
              </div>
              <span className="badge bg-slate-800 text-slate-400 w-16 text-center justify-center">
                Group {fx.group}
              </span>

              <div className="flex-1 flex items-center justify-end gap-3">
                <span className={`font-medium ${isPlayed && fx.home_score! > fx.away_score! ? "text-pitch-600 font-semibold" : ""}`}>
                  {home?.name_cn ?? fx.home}
                </span>
                {home?.is_host && <span className="text-xs text-gold-400">🏠</span>}
              </div>

              {isPlayed ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-pitch-600/20 rounded text-sm font-bold font-mono text-pitch-600">
                    {fx.home_score} - {fx.away_score}
                  </span>
                  <span className="badge bg-pitch-600/20 text-pitch-600 text-[10px]">
                    FT
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1 bg-slate-800 rounded text-xs font-mono text-slate-500">
                  VS
                </div>
              )}

              <div className="flex-1 flex items-center gap-3">
                {away?.is_host && <span className="text-xs text-gold-400">🏠</span>}
                <span className={`font-medium ${isPlayed && fx.away_score! > fx.home_score! ? "text-pitch-600 font-semibold" : ""}`}>
                  {away?.name_cn ?? fx.away}
                </span>
              </div>

              <div className="text-right text-xs text-slate-500 w-40 truncate">
                🏟️ {fx.venue}, {fx.city}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
