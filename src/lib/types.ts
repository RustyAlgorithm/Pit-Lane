export type BracketFormat =
  | "single"
  | "double"
  | "round-robin"
  | "time-trial"
  | "championship";

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