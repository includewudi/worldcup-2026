export interface Team {
  code: string;
  name: string;
  name_cn: string;
  group: string;
  confederation: string;
  fifa_ranking: number;
  elo_rating: number;
  composite_rating: number;
  title_odds: number;
  star_player: string;
  key_players: string[];
  best_wc: string;
  appearances: number;
  is_host?: boolean;
  is_debut?: boolean;
}

export interface Fixture {
  id: number;
  group: string;
  date: string;
  time_utc: string;
  home: string;
  away: string;
  venue: string;
  city: string;
  is_opening_match?: boolean;
  played?: boolean;
  home_score?: number;
  away_score?: number;
}

export interface StandingRow {
  code: string;
  name: string;
  name_cn: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface StandingsResponse {
  [group: string]: StandingRow[];
}

export interface TournamentInfo {
  tournament: string;
  host_countries: string[];
  start_date: string;
  end_date: string;
  total_matches: number;
  groups: string[];
  knockout_schedule: Record<string, string>;
}

export interface MatchPrediction {
  home_team: { code: string; name: string; name_cn: string; elo: number };
  away_team: { code: string; name: string; name_cn: string; elo: number };
  prediction: {
    home_win: number;
    draw: number;
    away_win: number;
    expected_goals_home: number;
    expected_goals_away: number;
    most_likely_score: number[];
    most_likely_score_prob: number;
    home_advantage_applied: number;
  };
}

export interface SimulationResult {
  code: string;
  name: string;
  name_cn: string;
  group: string;
  elo_rating: number;
  fifa_ranking: number;
  champion_prob: number;
  final_prob: number;
  semi_final_prob: number;
  r16_prob: number;
  group_advance_prob: number;
  champion_count: number;
  simulations: number;
}

export interface MonteCarloResponse {
  n_simulations: number;
  seed: number;
  generated_at: string;
  results: SimulationResult[];
}

export interface SyncResult {
  espn_fetched: number;
  espn_knockout?: number;
  football_data_fetched: number;
  new_results: number;
  total_played: number;
  synced_at: string;
}

export interface SyncStatus {
  espn: string | null;
  football_data: string | null;
  results: Record<string, number | string>;
  updated: number;
}

export interface KnockoutFixture {
  home_abbr: string;
  away_abbr: string;
  home_display: string;
  away_display: string;
  date: string;
  utc_time: string | null;
  home_score: number | null;
  away_score: number | null;
  played: boolean;
  venue: string;
  city: string;
  round: string;
  source: string;
}
