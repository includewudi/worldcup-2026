import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Trophy, Users, Calendar, Target, Dice5, BarChart3, Star, RefreshCw, Crown, Menu, X, Eye } from "lucide-react";
import clsx from "clsx";
import { useSync } from "@/contexts/SyncContext";
import { trackVisit, fetchStats } from "@/api";
import type { VisitStats } from "@/types";

const navItems = [
  { to: "/", label: "总览", icon: Trophy },
  { to: "/follow", label: "关注", icon: Star },
  { to: "/standings", label: "积分榜", icon: BarChart3 },
  { to: "/knockout", label: "淘汰赛", icon: Crown },
  { to: "/teams", label: "队伍", icon: Users },
  { to: "/fixtures", label: "赛程", icon: Calendar },
  { to: "/predict", label: "对阵预测", icon: Target },
  { to: "/simulate", label: "赛事模拟", icon: Dice5 },
];

export default function AppLayout() {
  const { syncing, lastSync, triggerSync } = useSync();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const location = useLocation();

  useEffect(() => {
    triggerSync();
    trackVisit();
    fetchStats().then(setStats).catch(() => {});
  }, []);

  // Route change → close mobile sidebar
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Body scroll lock when mobile sidebar open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <span className="bg-gradient-to-r from-pitch-600 to-gold-500 bg-clip-text text-transparent">WC 2026</span>
        </h1>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
          aria-label="打开菜单"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Overlay (mobile only) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "w-60 bg-slate-900/95 border-r border-slate-800 flex flex-col fixed h-full z-50 transition-transform duration-300",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">⚽</span>
              <span className="bg-gradient-to-r from-pitch-600 to-gold-500 bg-clip-text text-transparent">
                WC 2026
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">预测系统 · USA·MX·CA</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
            aria-label="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
          {stats && (
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pb-2 border-b border-slate-800/50">
              <span className="flex items-center gap-1" title="总访问 / 独立访客">
                <Eye size={12} />
                <span className="text-slate-300 font-semibold">{stats.total_visits}</span>
                <span className="text-slate-600">/</span>
                <span className="text-gold-400 font-semibold">{stats.unique_visitors}</span>
              </span>
              <span title="今日访问">
                今日 <span className="text-slate-300 font-semibold">{stats.today}</span>
              </span>
            </div>
          )}
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

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 p-4 lg:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
