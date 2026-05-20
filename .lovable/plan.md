# Heats format (multi-lane racing)

A new `"heats"` BracketFormat where each race ("heat") runs N cars/teams in parallel lanes. Organiser defines rounds upfront; losers can optionally race a consolation.

## Create dialog

When format = "Heats":
- Repeater of rounds. For each round:
  - **Lanes** (number, ≥2): cars per heat
  - **Advance** (number, ≥1, < lanes): top finishers per heat that progress
- "+ Add round" / remove buttons. Live preview: "R1: 6 lanes, top 2 → R2: 4 lanes, top 2 → R3: 2 lanes, top 1 (final)"
- **Consolation heat** toggle: if on, all eliminated participants race one final multi-lane heat for a consolation winner
- Validation: round 1 lanes must divide participant count evenly OR support byes; final round must have advance=1; each round's input count = previous round's heats × advance.

## Data model (types.ts)

```ts
BracketFormat += "heats"

interface HeatRound { lanes: number; advance: number; }

interface HeatResult {
  // ordered finishing positions; index 0 = 1st place
  positions: (string | null)[]; // length === heat.lanes
}

interface Match {  // extend
  heatRound?: number;
  heatIndex?: number;          // which heat within the round
  participantIds?: (string|null)[]; // generalised slots for N-car heats
  finishOrder?: (string|null)[];    // ordered 1st..Nth
  isConsolation?: boolean;
}

interface Tournament {  // extend
  heatRounds?: HeatRound[];
  consolation?: boolean;
}
```

`carAId/carBId/teamAId/teamBId` remain for 2-car matches; new `participantIds` array used for heats. `winnerId` still set when finishOrder[0] is chosen.

## Bracket logic (bracket.ts)

- `buildHeats(rounds, participantIds, isTeams)` → Match[]:
  - Round 1: chunk shuffled ids into heats of `rounds[0].lanes` (last heat may have fewer; nulls fill).
  - Subsequent rounds: pre-create empty heats sized by previous round's heats × advance / lanes.
- `applyHeatFinish(t, matchId, finishOrder)`:
  - Sets finishOrder, winnerId = finishOrder[0].
  - Top `advance` carry to next round, filling next heats in order.
  - Eliminated → if consolation, pool them for the consolation heat (created lazily when all main rounds complete).
  - Final round: winnerId → champion.

## UI (tournaments.$id.tsx)

- New `HeatsView`: list rounds; each heat = card with N rows (one per lane). Each row has a position dropdown (1st/2nd/3rd…) or up/down reorder buttons. "Record results" button locks order and calls applyHeatFinish.
- Consolation heat appears after main bracket complete; champion display shows main + consolation winners.

## Backup (backup.ts)

Extend match + tournament schemas: `participantIds`, `finishOrder`, `heatRound`, `heatIndex`, `isConsolation`, `heatRounds`, `consolation`.

## Out of scope

- Series/full-team mode for heats (heats are already multi-car).
- Championship qualifying via heats (can be added later).
- Lane assignment strategy (random shuffle for now).
