import { useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Trophy, Users, Calendar, Target, Dice5, BarChart3, Star, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { useSync } from "@/contexts/SyncContext";

const navItems = [
  { to: "/", label: "总览", icon: Trophy },
  { to: "/follow", label: "关注", icon: Star },
  { to: "/standings", label: "积分榜", icon: BarChart3 },
  { to: "/teams", label: "队伍", icon: Users },
  { to: "/fixtures", label: "赛程", icon: Calendar },
  { to: "/predict", label: "对阵预测", icon: Target },
  { to: "/simulate", label: "赛事模拟", icon: Dice5 },
];

export default function AppLayout() {
  const { syncing, lastSync, triggerSync } = useSync();

  useEffect(() => {
    triggerSync();
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900/95 border-r border-slate-800 flex flex-col fixed h-full">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="bg-gradient-to-r from-pitch-600 to-gold-500 bg-clip-text text-transparent">
              WC 2026
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">预测系统 · USA·MX·CA</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-pitch-600/20 text-pitch-600 border-l-2 border-pitch-600"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "同步中..." : "同步最新比分"}
          </button>
          {lastSync && (
            <p className="text-[10px] text-slate-600 text-center">
              最后同步: {new Date(lastSync).toLocaleString("zh-CN")}
            </p>
          )}
          <p className="text-[10px] text-slate-600 text-center">数据源: ESPN · 每小时:15自动</p>
        </div>
      </aside>
      <main className="flex-1 ml-60 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
