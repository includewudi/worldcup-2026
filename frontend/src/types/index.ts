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
    top_scores: { score: number[]; prob: number }[];
    home_advantage_applied: number;
    squad_adjustment?: {
      applied: boolean;
      home_attack?: number;
      home_defense?: number;
      away_attack?: number;
      away_defense?: number;
      home_adj_pct?: number;
      away_adj_pct?: number;
    };
    key_matchups?: MatchupAnalysis;
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
  home_cn: string;
  away_cn: string;
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

export interface VisitStats {
  total_visits: number;
  unique_visitors: number;
  today: number;
  last_visit: string | null;
  daily: Record<string, number>;
}

export interface Player {
  name: string;
  position: string;
  club: string;
  age: number | null;
  value_eur: number;
  rating?: number | null;
  fc_overall?: number | null;
  pace?: number | null;
  shooting?: number | null;
  passing?: number | null;
  dribbling?: number | null;
  defending?: number | null;
  physic?: number | null;
  sprint_speed?: number | null;
  acceleration?: number | null;
  finishing?: number | null;
  heading?: number | null;
  standing_tackle?: number | null;
  marking?: number | null;
  gk_diving?: number | null;
  gk_handling?: number | null;
  gk_reflexes?: number | null;
  gk_positioning?: number | null;
}

export interface KeyPlayer {
  name: string;
  position: string;
  rating?: number | null;
  pace?: number | null;
  shooting?: number | null;
  dribbling?: number | null;
  defending?: number | null;
  physic?: number | null;
  finishing?: number | null;
  heading?: number | null;
  standing_tackle?: number | null;
  gk_reflexes?: number | null;
  gk_diving?: number | null;
}

export interface AttrProfile {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physic: number;
}

export interface KeyPlayers {
  fastest_forward?: KeyPlayer | null;
  best_shooter?: KeyPlayer | null;
  best_dribbler?: KeyPlayer | null;
  best_header_forward?: KeyPlayer | null;
  fastest_defender?: KeyPlayer | null;
  best_defender?: KeyPlayer | null;
  best_header_defender?: KeyPlayer | null;
  goalkeeper?: KeyPlayer | null;
}

export interface Matchup {
  title: string;
  home_player: KeyPlayer;
  away_player: KeyPlayer;
  home_value: number;
  away_value: number;
  differential: number | null;
  advantage: "home" | "away" | "even";
  description: string;
}

export interface MatchupAnalysis {
  available: boolean;
  reason?: string;
  home_code?: string;
  away_code?: string;
  matchups?: Matchup[];
  summary?: {
    home_advantages: number;
    away_advantages: number;
    even: number;
  };
  home_attack_profile?: AttrProfile;
  away_attack_profile?: AttrProfile;
  home_defense_profile?: AttrProfile;
  away_defense_profile?: AttrProfile;
}

export interface SquadSummary {
  team_code: string;
  team_name: string;
  team_name_cn: string;
  player_count: number;
  total_value_eur: number;
  avg_value_eur: number;
  avg_rating: number;
  rating_coverage_pct: number;
  attr_coverage_pct?: number;
  attack_rating?: number;
  defense_rating?: number;
  net_rating?: number;
  attack_profile?: AttrProfile;
  defense_profile?: Partial<AttrProfile>;
  key_players?: KeyPlayers;
  top_player: string;
  position_breakdown: Record<string, number>;
  top_players_by_rating: Player[];
  top_players_by_value: Player[];
}

export interface SquadComparison {
  home: SquadSummary;
  away: SquadSummary;
  value_gap_eur: number;
  rating_gap: number;
  attack_gap?: number;
  defense_gap?: number;
  stronger_team_by_rating: string;
  stronger_team_by_value: string;
}
