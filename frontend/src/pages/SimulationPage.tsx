import { useEffect, useState } from "react";
import { runSimulation } from "@/api";
import type { SimulationResult } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export default function SimulationPage() {
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [sims, setSims] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ n: number; seed: number } | null>(null);

  const run = (n: number) => {
    setLoading(true);
    setSims(n);
    runSimulation(n)
      .then((res) => {
        setResults(res.results);
        setMeta({ n: res.n_simulations, seed: res.seed });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    run(10000);
  }, []);

  const top15 = results.slice(0, 15);
  const chartData = top15.map((r) => ({
    name: r.name_cn,
    夺冠率: +(r.champion_prob * 100).toFixed(2),
    进决赛: +(r.final_prob * 100).toFixed(2),
  }));

  const colors = ["#f59e0b", "#fbbf24", "#16a34a", "#15803d", "#3b82f6", "#6366f1", "#a855f7"];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">🎲 赛事模拟</h1>
          <p className="text-slate-400 mt-1">蒙特卡洛模拟 · 48队完整赛程 · Elo + Poisson 引擎</p>
        </div>
        <div className="flex gap-2">
          {[1000, 5000, 10000, 50000].map((n) => (
            <button
              key={n}
              onClick={() => run(n)}
              disabled={loading}
              className={`badge ${sims === n ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
            >
              {n.toLocaleString()} 次
            </button>
          ))}
        </div>
      </header>

      {meta && (
        <div className="text-xs text-slate-500">
          ✅ 完成 {meta.n.toLocaleString()} 次模拟 · 种子 {meta.seed}
        </div>
      )}

      {loading ? (
        <div className="card text-center py-20">
          <div className="inline-block animate-spin text-4xl mb-3">⚽</div>
          <p className="text-slate-400">正在运行 {sims.toLocaleString()} 次蒙特卡洛模拟...</p>
          <p className="text-xs text-slate-600 mt-1">这可能需要几秒钟到一分钟</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">🏆 夺冠概率 (Top 15)</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={70} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="夺冠率" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Bar>
                <Bar dataKey="进决赛" fill="#334155" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">📋 详细晋级概率</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">队伍</th>
                    <th className="text-left py-2 px-3">组</th>
                    <th className="text-right py-2 px-3">Elo</th>
                    <th className="text-right py-2 px-3">出线</th>
                    <th className="text-right py-2 px-3">16强</th>
                    <th className="text-right py-2 px-3">4强</th>
                    <th className="text-right py-2 px-3">决赛</th>
                    <th className="text-right py-2 px-3">夺冠</th>
                    <th className="text-right py-2 px-3">次数</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.code} className="border-b border-slate-900 hover:bg-slate-900/50">
                      <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                      <td className="py-2 px-3 font-medium">{r.name_cn}</td>
                      <td className="py-2 px-3 text-slate-500">{r.group}</td>
                      <td className="py-2 px-3 text-right font-mono text-blue-400">{r.elo_rating}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400">{(r.group_advance_prob * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400">{(r.r16_prob * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono text-purple-400">{(r.semi_final_prob * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono text-pitch-600">{(r.final_prob * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono text-gold-400 font-bold">{(r.champion_prob * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right text-slate-600 text-xs">{r.champion_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
