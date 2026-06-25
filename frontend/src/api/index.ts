import axios from "axios";
import type { Team, Fixture, TournamentInfo, MatchPrediction, MonteCarloResponse, StandingsResponse, SyncResult, SyncStatus } from "@/types";

const api = axios.create({ baseURL: "/api", timeout: 120000 });

export async function fetchTeams(group?: string): Promise<Team[]> {
  const { data } = await api.get("/teams", { params: group ? { group } : {} });
  return data.teams;
}

export async function fetchFixtures(group?: string): Promise<Fixture[]> {
  const { data } = await api.get("/fixtures", { params: group ? { group } : {} });
  return data.fixtures;
}

export async function fetchTournamentInfo(): Promise<TournamentInfo> {
  const { data } = await api.get("/tournament");
  return data;
}

export async function fetchPrediction(homeCode: string, awayCode: string): Promise<MatchPrediction> {
  const { data } = await api.get(`/predict/${homeCode}/${awayCode}`);
  return data;
}

export async function runSimulation(sims: number = 10000, seed: number = 2026): Promise<MonteCarloResponse> {
  const { data } = await api.get("/simulate", { params: { sims, seed } });
  return data;
}

export async function fetchStandings(group?: string): Promise<StandingsResponse> {
  const { data } = await api.get("/standings", { params: group ? { group } : {} });
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
