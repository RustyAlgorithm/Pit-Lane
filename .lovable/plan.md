# Championship tournament format

Add a new `"championship"` format that runs in two stages:

1. **Qualifying stage** — organiser picks either `time-trial` or `round-robin` qualifying.
2. **Championship bracket** — top N qualifiers (rounded down to a power of 2) seeded into a `single` or `double` elimination bracket, 1v N, 2v N-1, etc.

## User flow

**Create dialog (tournaments.index.tsx)**
- Add `"Championship"` to the format dropdown.
- When selected, reveal extra fields:
  - Qualifying type: `Time trial` | `Round robin`
  - If time trial → reuse existing `trackLength` + `trackUnit` inputs.
  - Bracket type: `Single elimination` | `Double elimination`
  - Cutoff `advanceCount` (number input). Validation: ≥2, ≤ participant count; rounded down to nearest power of 2 on save (with a hint shown live).
- Min participants = max(advanceCount, 2 for single / 3 for double).

**Tournament detail page (tournaments.$id.tsx)**
- New `ChampionshipView` with two tabs/sections: **Qualifying** and **Bracket**.
- Qualifying section reuses existing UI:
  - Time trial → embed current `TimeTrialView` logic (per-car best times leaderboard).
  - Round robin → render the qualifying `Match[]` list with winner buttons (same UI as round-robin tournaments).
- A **"Lock qualifying & seed bracket"** button:
  - Time trial: rank by best time asc; missing times rank last.
  - Round robin: rank by W desc, L asc (reuse `standingsFor` logic).
  - Take top `advanceCount` (power-of-2), seed 1vN, 2vN-1, … into the championship bracket via existing `buildMatches` logic, then store on the tournament.
  - Sets a `qualifyingLocked: true` flag so qualifying becomes read-only.
- After lock, Bracket section behaves like existing single/double elim (reuse current match UI + `applyWinner`).
- An **"Unlock qualifying"** button (with confirm) clears bracket matches & champion to allow re-seeding.

## Data model (`src/lib/types.ts`)

Extend `BracketFormat` with `"championship"`. Add to `Tournament`:

```ts
qualifyingType?: "time-trial" | "round-robin";
qualifyingFormat?: "single" | "double"; // bracket stage format
advanceCount?: number;                  // power of 2
qualifyingMatches?: Match[];            // round-robin qualifying
qualifyingLocked?: boolean;
seeds?: { participantId: string; seed: number }[]; // snapshot after lock
// existing trackLength/trackUnit/times reused for time-trial qualifying
```

`matches` continues to hold the championship bracket matches (empty until locked).

## Bracket logic (`src/lib/bracket.ts`)

- `buildMatches("championship", ids, type)` returns `[]` (bracket built later from seeds).
- New helper `buildQualifyingMatches(qualifyingType, ids, type)` → reuses round-robin path or returns `[]` for time trial.
- New helper `seedChampionshipBracket(t, rankedIds, bracketFormat)`:
  - Slice top N (already power of 2).
  - Pair seeds 1vN, 2v(N-1), ... in standard bracket order.
  - Build matches with `bracket: "winners"` for double elim, plus losers/final placeholders (reuse existing single/double generation but with pre-seeded round-1 pairings instead of shuffle).
  - Refactor: extract a `buildBracketFromSeeds(format, seedsInOrder, isTeams)` used by both championship-locking and (optionally) by existing single/double via a `seed?` option.
- New helper `rankQualifiers(t, cars)` returning `string[]` of participantIds best→worst.

## Backup schema (`src/lib/backup.ts`)

Extend `tournamentSchema` to allow:
- `format: "championship"`
- new optional fields: `qualifyingType`, `qualifyingFormat`, `advanceCount` (int ≥2 ≤256), `qualifyingMatches` (array of existing match schema), `qualifyingLocked` (bool), `seeds` (array of `{participantId, seed}`).

## Display surfaces

- `tournaments.index.tsx` card: show `Championship` label + stage indicator (`Qualifying` / `Bracket` / champion name).
- `FORMAT_LABEL` map: add `championship: "Championship"`.
- Leaderboard page: if championship uses time-trial qualifying, include its `times` in the global track-length leaderboard (already keyed by `trackLength+unit`, just need to relax the `format === "time-trial"` filter to also include championships with `qualifyingType === "time-trial"`).

## Out of scope

- No changes to teams/cars/garage data.
- No new routes — championship lives inside existing tournament detail route.
- Re-seeding mid-bracket (only via unlock-and-relock).
