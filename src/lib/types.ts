export type BracketFormat = "single" | "double" | "round-robin";

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
}

export interface Match {
  id: string;
  round: number;
  slot: number;
  bracket?: "winners" | "losers" | "final";
  carAId?: string | null;
  carBId?: string | null;
  winnerId?: string | null;
  // round-robin only
  isGroup?: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  format: BracketFormat;
  carIds: string[];
  matches: Match[];
  createdAt: number;
  champion?: string | null;
}