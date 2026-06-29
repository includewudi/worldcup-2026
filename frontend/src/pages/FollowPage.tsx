import { useEffect, useState, useMemo } from "react";
import { fetchTeams, fetchFixtures, fetchKnockout } from "@/api";
import type { Team, Fixture, KnockoutFixture } from "@/types";
import { Star, Search, Download, Trash2, Calendar, MapPin, Clock } from "lucide-react";

const STORAGE_KEY = "wc2026-followed-teams";

function knockoutToFixture(ko: KnockoutFixture, index: number): Fixture {
  return {
    id: 10000 + index,
    group: ko.round || "淘汰赛",
    date: ko.date,
    time_utc: ko.utc_time || "00:00",
    home: ko.home_abbr,
    away: ko.away_abbr,
    venue: ko.venue,
    city: ko.city,
    played: ko.played,
    home_score: ko.home_score ?? undefined,
    away_score: ko.away_score ?? undefined,
  };
}

function loadFollowed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFollowed(codes: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
}

function parseUTC(date: string, timeStr: string): Date {
  const [h, m] = timeStr.replace("+1", "").split(":").map(Number);
  const d = new Date(date + "T00:00:00Z");
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function formatLocal(date: Date): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return date.toLocaleString("zh-CN", {
    timeZone: tz,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

function formatICSDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    "00Z"
  );
}

function buildICS(fixtures: Fixture[], teamMap: Map<string, Team>): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WC2026//Follow//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const fx of fixtures) {
    const home = teamMap.get(fx.home);
    const away = teamMap.get(fx.away);
    const start = parseUTC(fx.date, fx.time_utc);
    const end = new Date(start.getTime() + 105 * 60 * 1000);
    const title = `${home?.name_cn ?? fx.home} vs ${away?.name_cn ?? fx.away}`;
    const desc = fx.played
      ? `已结束 ${fx.home_score}-${fx.away_score}`
      : "即将开始";
    const uid = `wc2026-match-${fx.id}@worldcup2026`;
    const stageLabel = /^[A-L]$/.test(fx.group) ? `${fx.group}组` : fx.group;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${title} (世界杯${stageLabel})`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${fx.venue}, ${fx.city}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${title} 即将开始！`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FollowPage() {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
  const [followed, setFollowed] = useState<string[]>(loadFollowed);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchTeams().then(setAllTeams);
    Promise.all([fetchFixtures(), fetchKnockout()]).then(([groupFx, koFx]) => {
      const koAsFixtures: Fixture[] = koFx.map((ko, i) => knockoutToFixture(ko, i));
      setAllFixtures([...groupFx, ...koAsFixtures]);
    });
  }, []);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    allTeams.forEach((t) => m.set(t.code, t));
    return m;
  }, [allTeams]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTeams
      .filter(
        (t) =>
          t.name_cn.includes(query) ||
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, allTeams]);

  const followedFixtures = useMemo(() => {
    return allFixtures
      .filter((f) => followed.includes(f.home) || followed.includes(f.away))
      .sort((a, b) => a.id - b.id);
  }, [allFixtures, followed]);

  function toggleFollow(code: string) {
    setFollowed((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code];
      saveFollowed(next);
      return next;
    });
  }

  function handleDownloadICS() {
    if (followedFixtures.length === 0) return;
    const names = followed
      .map((c) => teamMap.get(c)?.name_cn ?? c)
      .join("-");
    const ics = buildICS(followedFixtures, teamMap);
    downloadICS(ics, `世界杯2026-${names}.ics`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Star className="text-gold-400" /> 关注球队
        </h1>
        <p className="text-slate-400 mt-1">
          关注你喜欢的球队 · 一键导出赛程到日历 · 开赛30分钟前提醒
        </p>
      </header>

      <div className="relative">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={20}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索球队：巴西 / Brazil / BRA"
            className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-pitch-600 focus:outline-none focus:ring-1 focus:ring-pitch-600"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            {searchResults.map((t) => (
              <button
                key={t.code}
                onClick={() => {
                  toggleFollow(t.code);
                  setQuery("");
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{t.name_cn}</span>
                  <span className="text-xs text-slate-500">
                    {t.name} · {t.group}组
                  </span>
                </div>
                <span className="badge bg-slate-700 text-slate-300 text-xs">
                  Elo {t.elo_rating}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {followed.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-slate-400">已关注：</span>
          {followed.map((code) => {
            const t = teamMap.get(code);
            return (
              <span
                key={code}
                className="badge bg-gold-500/20 text-gold-400 flex items-center gap-1 pr-1"
              >
                {t?.name_cn ?? code}
                <button
                  onClick={() => toggleFollow(code)}
                  className="hover:text-red-400 ml-1"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            );
          })}
          <button
            onClick={handleDownloadICS}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-pitch-600 hover:bg-pitch-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            导出日历 (.ics)
          </button>
        </div>
      )}

      {followed.length === 0 && !query && (
        <div className="card text-center py-16">
          <Star className="mx-auto text-slate-600 mb-3" size={48} />
          <p className="text-slate-400">
            还没有关注任何球队，搜索添加吧 🇧🇷
          </p>
        </div>
      )}

      {followedFixtures.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">
            关注赛程（{followedFixtures.length}场）
          </h2>
          {followedFixtures.map((fx) => {
            const home = teamMap.get(fx.home);
            const away = teamMap.get(fx.away);
            const isFollowedHome = followed.includes(fx.home);
            const kickoff = parseUTC(fx.date, fx.time_utc);
            const isPast = fx.played;

            return (
              <div
                key={fx.id}
                className={`card flex items-center gap-4 py-4 ${
                  isPast
                    ? "border-l-2 border-pitch-600 bg-pitch-600/5"
                    : "border-l-2 border-gold-500"
                }`}
              >
                <div className="flex-shrink-0 w-16 text-center">
                  <div className={`text-xs font-mono ${isPast ? "text-slate-600" : "text-gold-400"}`}>
                    {fx.date.slice(5)}
                  </div>
                  {isPast ? (
                    <span className="text-[10px] text-pitch-600 font-bold">FT</span>
                  ) : (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {formatLocal(kickoff).split(" ").slice(-1)}
                    </div>
                  )}
                </div>

                <span className={`badge bg-slate-800 text-slate-400 text-xs min-w-[3rem] text-center ${
                  /^[A-L]$/.test(fx.group) ? "" : "text-gold-400"
                }`}>
                  {/^[A-L]$/.test(fx.group) ? `${fx.group}组` : fx.group}
                </span>

                <div className="flex-1 flex items-center justify-end gap-2">
                  <span
                    className={`font-medium ${
                      isFollowedHome ? "text-gold-400" : ""
                    }`}
                  >
                    {home?.name_cn ?? fx.home}
                  </span>
                  {home?.is_host && <span className="text-xs">🏠</span>}
                </div>

                {isPast ? (
                  <div className="px-4 py-1 bg-pitch-600/20 rounded-lg text-pitch-600 font-bold text-lg font-mono">
                    {fx.home_score} - {fx.away_score}
                  </div>
                ) : (
                  <div className="px-3 py-1 bg-slate-800 rounded text-xs font-mono text-slate-500">
                    VS
                  </div>
                )}

                <div className="flex-1 flex items-center gap-2">
                  {away?.is_host && <span className="text-xs">🏠</span>}
                  <span
                    className={`font-medium ${
                      !isFollowedHome ? "text-gold-400" : ""
                    }`}
                  >
                    {away?.name_cn ?? fx.away}
                  </span>
                </div>

                <div className="text-right text-xs text-slate-500 w-44 space-y-0.5">
                  {!isPast && (
                    <div className="flex items-center gap-1 justify-end">
                      <Clock size={11} />
                      {formatLocal(kickoff)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 justify-end text-slate-600">
                    <MapPin size={11} />
                    {fx.city}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={handleDownloadICS}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-pitch-600 rounded-xl text-slate-300 hover:text-pitch-600 transition-colors"
          >
            <Calendar size={18} />
            导出全部 {followedFixtures.length} 场赛程到日历（含提醒）
          </button>
        </div>
      )}
    </div>
  );
}
