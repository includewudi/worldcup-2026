import { useEffect, useState } from "react";
import { fetchKnockout } from "@/api";
import { useSync } from "@/contexts/SyncContext";
import type { KnockoutFixture } from "@/types";
import { MapPin } from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}/${d.getDate()} 周${days[d.getDay()]}`;
}

function formatTime(utcTime: string | null): string {
  if (!utcTime) return "";
  const [h, m] = utcTime.split(":").map(Number);
  const bjH = (h + 8) % 24;
  return `${String(bjH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function KnockoutPage() {
  const [fixtures, setFixtures] = useState<KnockoutFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const { syncCounter } = useSync();

  useEffect(() => {
    setLoading(true);
    fetchKnockout()
      .then(setFixtures)
      .finally(() => setLoading(false));
  }, [syncCounter]);

  if (loading) {
    return <div className="text-center py-20 text-slate-500">加载淘汰赛赛程...</div>;
  }

  if (fixtures.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p className="text-lg">淘汰赛赛程尚未生成</p>
        <p className="text-sm mt-2">小组赛全部结束后自动出现</p>
      </div>
    );
  }

  const played = fixtures.filter((f) => f.played);
  const upcoming = fixtures.filter((f) => !f.played);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">🏆 淘汰赛</h1>
        <p className="text-slate-400 mt-1">
          {fixtures.length} 场 · {played.length} 已完赛 · {upcoming.length} 待赛
        </p>
      </header>

      <div className="space-y-3">
        {fixtures
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((fx, i) => (
            <div
              key={`${fx.home_abbr}-${fx.away_abbr}-${i}`}
              className={`card flex items-center gap-4 p-4 ${
                fx.played ? "border-l-2 border-pitch-600" : "opacity-90"
              }`}
            >
              <div className="w-20 text-center shrink-0">
                <div className="text-sm font-bold text-slate-300">
                  {formatDate(fx.date)}
                </div>
                <div className="text-xs text-gold-400">
                  {formatTime(fx.utc_time)}
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
                <div className="text-right flex-1 min-w-0">
                  <div className="font-semibold text-slate-100 truncate">
                    {fx.home_cn ?? fx.home_display}
                  </div>
                </div>
                {fx.played ? (
                  <div className="px-4 py-1 bg-slate-800 rounded-lg text-lg font-bold text-gold-400 shrink-0">
                    {fx.home_score} - {fx.away_score}
                  </div>
                ) : (
                  <div className="px-4 py-1 text-slate-500 text-sm shrink-0">vs</div>
                )}
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-slate-100 truncate">
                    {fx.away_cn ?? fx.away_display}
                  </div>
                </div>
              </div>

              <div className="w-40 text-right shrink-0 hidden md:block">
                <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                  <MapPin size={11} />
                  {fx.venue}
                </div>
                <div className="text-[10px] text-slate-600">{fx.city}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
