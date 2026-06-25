import { useEffect, useState } from "react";
import { fetchStandings } from "@/api";
import { useSync } from "@/contexts/SyncContext";
import type { StandingsResponse, StandingRow } from "@/types";
import { Trophy, Medal } from "lucide-react";

const GROUPS = "ABCDEFGHIJKL".split("");
const COL_HEADERS = [
  { key: "played", label: "场" },
  { key: "wins", label: "胜" },
  { key: "draws", label: "平" },
  { key: "losses", label: "负" },
  { key: "gf", label: "进球" },
  { key: "ga", label: "失球" },
  { key: "gd", label: "净胜" },
  { key: "points", label: "积分" },
] as const;

function rowColor(pos: number): string {
  if (pos <= 2) return "bg-pitch-600/10 border-l-2 border-pitch-600";
  if (pos === 3) return "bg-gold-400/10 border-l-2 border-gold-400";
  return "opacity-50";
}

function posIcon(pos: number) {
  if (pos <= 2) return <Trophy size={14} className="text-pitch-600" />;
  if (pos === 3) return <Medal size={14} className="text-gold-400" />;
  return <span className="text-slate-600 text-xs">{pos}</span>;
}

function formatGd(gd: number): string {
  return gd > 0 ? `+${gd}` : `${gd}`;
}

function GroupTable({ group, rows }: { group: string; rows: StandingRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-lg font-bold text-pitch-600">{group}</span>
        <span className="text-xs text-slate-500">小组</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="w-8 text-center px-1">#</th>
              <th className="text-left px-2 py-2">队伍</th>
              {COL_HEADERS.map((h) => (
                <th key={h.key} className="text-center px-1 py-2 w-10">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.code}
                className={`border-b border-slate-800/50 ${rowColor(i + 1)}`}
              >
                <td className="text-center px-1">{posIcon(i + 1)}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.name_cn}</span>
                    <span className="text-xs text-slate-500">{row.code}</span>
                  </div>
                </td>
                {COL_HEADERS.map((h) => (
                  <td
                    key={h.key}
                    className={`text-center px-1 font-mono ${
                      h.key === "points" && row.points > 0
                        ? "text-pitch-600 font-semibold"
                        : "text-slate-400"
                    }`}
                  >
                    {h.key === "gd" ? formatGd(row[h.key]) : row[h.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Trophy size={10} className="text-pitch-600" /> 晋级16强
        </span>
        <span className="flex items-center gap-1">
          <Medal size={10} className="text-gold-400" /> 最佳第三
        </span>
      </div>
    </div>
  );
}

export default function StandingsPage() {
  const [standings, setStandings] = useState<StandingsResponse>({});
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const { syncCounter } = useSync();

  useEffect(() => {
    setLoading(true);
    fetchStandings()
      .then(setStandings)
      .finally(() => setLoading(false));
  }, [syncCounter]);

  if (loading) {
    return <div className="text-center py-20 text-slate-500">加载积分榜...</div>;
  }

  const displayGroups =
    selectedGroup === "ALL" ? GROUPS : GROUPS.filter((g) => g === selectedGroup);

  let totalPlayed = 0;
  let totalTeams = 0;
  GROUPS.forEach((g) => {
    const rows = standings[g] || [];
    rows.forEach((r) => {
      totalPlayed += r.played;
      totalTeams++;
    });
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">📊 小组积分榜</h1>
        <p className="text-slate-400 mt-1">
          12 个小组 · {totalTeams} 支队伍 · 已进行 {totalPlayed} / 72 场比赛
        </p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayGroups
          .map((g) => ({ group: g, rows: standings[g] || [] }))
          .filter(({ rows }) => rows.length > 0)
          .map(({ group, rows }) => (
            <GroupTable key={group} group={group} rows={rows} />
          ))}
      </div>
    </div>
  );
}
