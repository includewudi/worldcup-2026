import axios from "axios";
import type { Team, Fixture, TournamentInfo, MatchPrediction, MonteCarloResponse, StandingsResponse, SyncResult, SyncStatus, KnockoutFixture, VisitStats, SquadSummary, SquadComparison } from "@/types";

const baseURL = import.meta.env.VITE_API_BASE || "/api";
const api = axios.create({ baseURL, timeout: 15000 });

const CACHE_PREFIX = "wc2026-cache:";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export function getCacheAge(key: string): number | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.ts;
  } catch {
    return null;
  }
}

async function fetchWithCache<T>(key: string, fn: () => Promise<T>): Promise<{ data: T; stale: boolean }> {
  try {
    const data = await fn();
    writeCache(key, data);
    return { data, stale: false };
  } catch (err) {
    const cached = readCache<T>(key);
    if (cached !== null) {
      return { data: cached, stale: true };
    }
    throw err;
  }
}

export async function fetchTeams(group?: string): Promise<Team[]> {
  const { data } = await fetchWithCache("teams", () =>
    api.get("/teams", { params: group ? { group } : {} }).then(r => r.data.teams)
  );
  return data;
}

export async function fetchFixtures(group?: string): Promise<Fixture[]> {
  const { data } = await fetchWithCache("fixtures", () =>
    api.get("/fixtures", { params: group ? { group } : {} }).then(r => r.data.fixtures)
  );
  return data;
}

export async function fetchTournamentInfo(): Promise<TournamentInfo> {
  const { data } = await fetchWithCache("tournament", () =>
    api.get("/tournament").then(r => r.data)
  );
  return data;
}

export async function fetchPrediction(homeCode: string, awayCode: string): Promise<MatchPrediction> {
  const { data } = await api.get(`/predict/${homeCode}/${awayCode}`);
  return data;
}

export async function runSimulation(sims: number = 10000, seed: number = 2026): Promise<MonteCarloResponse> {
  const { data } = await fetchWithCache(`sim-${sims}`, () =>
    api.get("/simulate", { params: { sims, seed } }).then(r => r.data)
  );
  return data;
}

export async function fetchStandings(group?: string): Promise<StandingsResponse> {
  const { data } = await fetchWithCache("standings", () =>
    api.get("/standings", { params: group ? { group } : {} }).then(r => r.data)
  );
  return data;
}

export async function refreshResults(): Promise<SyncResult> {
  const { data } = await api.post("/sync/refresh");
  return data;
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const { data } = await api.get("/sync/status");
  return data;
}

export async function fetchKnockout(): Promise<KnockoutFixture[]> {
  const { data } = await fetchWithCache("knockout", () =>
    api.get("/knockout").then(r => r.data.fixtures)
  );
  return data;
}

export async function trackVisit(): Promise<void> {
  try { await api.post("/stats/track"); } catch {}
}

export async function fetchStats(): Promise<VisitStats> {
  const { data } = await api.get("/stats");
  return data;
}

export async function fetchSquad(teamCode: string): Promise<SquadSummary> {
  const { data } = await fetchWithCache(`squad-${teamCode}`, () =>
    api.get(`/squad/${teamCode}`).then(r => r.data)
  );
  return data;
}

export async function fetchSquadComparison(homeCode: string, awayCode: string): Promise<SquadComparison> {
  const { data } = await fetchWithCache(`squad-cmp-${homeCode}-${awayCode}`, () =>
    api.get(`/squad/compare/${homeCode}/${awayCode}`).then(r => r.data)
  );
  return data;
}
