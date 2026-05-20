export type BracketFormat =
  | "single"
  | "double"
  | "round-robin"
  | "time-trial"
  | "championship"
  | "heats";

export type TrackUnit = "cm" | "m" | "ft";

export interface TimeEntry {
  id: string;
  carId: string;
  seconds: number;
  recordedAt: number;
}

export interface Car {
  id: string;
  name: string;
  driver: string;
  make: string;
  model: string;
  weightG: number;
  brand: string; // Hot Wheels, Matchbox, etc.
  photo?: string; // dataURL
  notes?: string;
  createdAt: number;
  wins?: number;
  losses?: number;
  championshipWins?: number;
}

export interface Match {
  id: string;
  round: number;
  slot: number;
  bracket?: "winners" | "losers" | "final";
  carAId?: string | null;
  carBId?: string | null;
  teamAId?: string | null;
  teamBId?: string | null;
  winnerId?: string | null;
  winnerType?: "car" | "team" | null;
  // round-robin only
  isGroup?: boolean;
  // full-team mode (team tournaments): each team-vs-team match is a series of car-vs-car games
  series?: SeriesGame[];
  seriesLength?: number;
  // heats format (multi-lane racing)
  heatRound?: number;
  heatIndex?: number;
  participantIds?: (string | null)[];
  finishOrder?: (string | null)[];
  isConsolation?: boolean;
}

export interface SeriesGame {
  id: string;
  carAId: string | null;
  carBId: string | null;
  winnerCarId: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  format: BracketFormat;
  participationType: "cars" | "teams";
  carIds?: string[];
  teamIds?: string[];
  matches: Match[];
  createdAt: number;
  champion?: string | null;
  championType?: "car" | "team" | null;
  // full-team mode for team tournaments
  fullTeamMode?: boolean;
  seriesLength?: number;
  // time-trial only
  trackLength?: number;
  trackUnit?: TrackUnit;
  times?: TimeEntry[];
  // championship only
  qualifyingType?: "time-trial" | "round-robin";
  qualifyingFormat?: "single" | "double";
  advanceCount?: number; // power of 2
  qualifyingMatches?: Match[];
  qualifyingLocked?: boolean;
  seeds?: { participantId: string; seed: number }[];
  // persistent tournaments
  persistent?: boolean;
  previousSeasons?: { season: number; champion: string; championType: "car" | "team"; dateEnded: number }[];
  // heats format
  heatRounds?: { lanes: number; advance: number }[];
  consolation?: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string; // hex like "#ef4444"
  carIds: string[];
  sponsor?: string;
  notes?: string;
  createdAt: number;
  wins?: number;
  losses?: number;
  championshipWins?: number;
}