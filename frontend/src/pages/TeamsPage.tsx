import { useEffect, useState } from "react";
import { fetchTeams } from "@/api";
import type { Team } from "@/types";

const GROUPS = "ABCDEFGHIJKL".split("");

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"fifa_ranking" | "elo_rating" | "composite_rating">("elo_rating");

  useEffect(() => {
    fetchTeams().then(setTeams);
  }, []);

  const filtered = teams
    .filter((t) => selectedGroup === "ALL" || t.group === selectedGroup)
    .sort((a, b) => (sortBy === "fifa_ranking" ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">👥 参赛队伍</h1>
        <p className="text-slate-400 mt-1">全部 48 支球队信息 · 含 Elo 评分与关键球员</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGroup("ALL")}
          className={`badge ${selectedGroup === "ALL" ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-400"}`}
        >
          全部
        </button>
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`badge ${selectedGroup === g ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
          >
            Group {g}
          </button>
        ))}
      </div>

      <div className="flex gap-2 text-sm">
        <span className="text-slate-500">排序:</span>
        {[
          { key: "elo_rating" as const, label: "Elo 评分" },
          { key: "fifa_ranking" as const, label: "FIFA 排名" },
          { key: "composite_rating" as const, label: "综合评分" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`${sortBy === opt.key ? "text-gold-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((team) => (
          <div key={team.code} className="card hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{team.name_cn}</h3>
                  {team.is_host && <span className="badge bg-gold-500/20 text-gold-400">🏆 东道主</span>}
                  {team.is_debut && <span className="badge bg-purple-500/20 text-purple-400">★ 首秀</span>}
                </div>
                <p className="text-sm text-slate-500">{team.name}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Group {team.group}</div>
                <div className="text-2xl font-bold text-gold-400">#{team.fifa_ranking}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="bg-slate-800/50 rounded p-2">
                <p className="text-xs text-slate-500">Elo</p>
                <p className="font-mono font-semibold text-blue-400">{team.elo_rating}</p>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <p className="text-xs text-slate-500">综合</p>
                <p className="font-mono font-semibold text-purple-400">{team.composite_rating.toFixed(1)}</p>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <p className="text-xs text-slate-500">夺冠率</p>
                <p className="font-mono font-semibold text-gold-400">{(team.title_odds * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <p className="text-sm">
                <span className="text-slate-500">⭐ 核心球员:</span>{" "}
                <span className="font-medium">{team.star_player}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {team.key_players.join(" · ")}
              </p>
              <p className="text-xs text-slate-600 mt-2">
                {team.confederation} · {team.appearances}次参赛 · {team.best_wc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
