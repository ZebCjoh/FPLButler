// Shared deterministic differential hero calculation (server-safe)

export interface DifferentialHeroResult {
  player: string;
  points: number;
  ownership: number;
  ownedBy: string[];
  managers: string[];
}

/**
 * Calculate differential hero deterministically.
 * Rules:
 * 1) At least 1 point this GW
 * 2) Max 25% ownership (or max 3 teams, whichever is higher)
 * 3) Highest points first, tie-break alphabetically by name
 */
export function calculateDifferentialHero(
  ownershipCount: Record<number, number>,
  pointsByElement: Record<number, number>,
  elementIdToName: Record<number, string>,
  standings: Array<{ entry: number; entry_name: string; player_name: string }>,
  picksByEntry: Record<number, { picks?: Array<{ element: number }> }>
): DifferentialHeroResult {
  const totalTeams = standings.length || 1;
  const maxOwnership = Math.max(3, Math.floor(totalTeams * 0.25));

  type Candidate = { id: number; name: string; points: number; ownership: number; };
  const candidates: Candidate[] = [];

  const playerIds = Object.keys(ownershipCount).map(Number).sort((a, b) => a - b);
  for (const playerId of playerIds) {
    const ownership = ownershipCount[playerId] || 0;
    const points = pointsByElement[playerId] || 0;
    const name = elementIdToName[playerId] || `#${playerId}`;
    if (points >= 1 && ownership > 0 && ownership <= maxOwnership) {
      candidates.push({ id: playerId, name, points, ownership });
    }
  }

  if (candidates.length === 0) {
    return { player: '-', points: 0, ownership: 0, ownedBy: [], managers: [] };
  }

  candidates.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name);
  });

  const winner = candidates[0];

  const ownedBy: string[] = [];
  const managers: string[] = [];
  for (const row of standings) {
    const picks = picksByEntry[row.entry]?.picks || [];
    if (picks.some(p => p.element === winner.id)) {
      ownedBy.push(row.entry_name);
      managers.push(row.player_name);
    }
  }

  return {
    player: winner.name,
    points: winner.points,
    ownership: winner.ownership,
    ownedBy,
    managers,
  };
}


