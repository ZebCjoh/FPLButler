// Deterministic differential hero calculation
// Used by both homepage and snapshot generator for consistency

export interface DifferentialCandidate {
  id: number;
  name: string;
  points: number;
  ownership: number;
  ownedBy: string[];
  managers: string[];
}

export interface DifferentialHeroResult {
  player: string;
  points: number;
  ownership: number;
  ownedBy: string[];
  managers: string[];
}

/**
 * Calculate differential hero with deterministic rules:
 * 1. Must have at least 1 point this gameweek
 * 2. Must be owned by maximum 25% of teams (or max 3 teams, whichever is higher)
 * 3. Among qualifying players, pick highest points
 * 4. If tied on points, pick alphabetically first by name
 */
export function calculateDifferentialHero(
  ownershipCount: Record<number, number>,
  pointsByElement: Record<number, number>,
  elementIdToName: Record<number, string>,
  standings: Array<{ entry: number; entry_name: string; player_name: string }>,
  picksByEntry: Record<number, { picks?: Array<{ element: number }> }>
): DifferentialHeroResult {
  const totalTeams = standings.length;
  const maxOwnership = Math.max(3, Math.floor(totalTeams * 0.25)); // Max 25% or 3 teams
  
  // Get all candidates that meet criteria
  const candidates: DifferentialCandidate[] = [];
  
  // Create sorted list of player IDs for deterministic iteration
  const playerIds = Object.keys(ownershipCount)
    .map(Number)
    .sort((a, b) => a - b); // Deterministic order by player ID
  
  for (const playerId of playerIds) {
    const ownership = ownershipCount[playerId] || 0;
    const points = pointsByElement[playerId] || 0;
    const name = elementIdToName[playerId] || `#${playerId}`;
    
    // Apply criteria: must have at least 1 point and low ownership
    if (points >= 1 && ownership > 0 && ownership <= maxOwnership) {
      // Find who owns this player
      const ownedBy: string[] = [];
      const managers: string[] = [];
      
      standings.forEach((row) => {
        const entryId = row.entry;
        const picks = picksByEntry[entryId]?.picks || [];
        if (picks.some((p) => p.element === playerId)) {
          ownedBy.push(row.entry_name);
          managers.push(row.player_name);
        }
      });
      
      candidates.push({
        id: playerId,
        name,
        points,
        ownership,
        ownedBy,
        managers
      });
    }
  }
  
  if (candidates.length === 0) {
    return {
      player: 'Ingen differential-helt denne runden',
      points: 0,
      ownership: 0,
      ownedBy: [],
      managers: []
    };
  }
  
  // Sort candidates: highest points first, then alphabetically by name
  candidates.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points; // Higher points first
    }
    return a.name.localeCompare(b.name); // Alphabetical if tied
  });
  
  const winner = candidates[0];
  
  console.log(`[DifferentialHero] Selected ${winner.name} (${winner.points}p, ${winner.ownership}/${totalTeams} teams) from ${candidates.length} candidates`);
  
  return {
    player: winner.name,
    points: winner.points,
    ownership: winner.ownership,
    ownedBy: winner.ownedBy,
    managers: winner.managers
  };
}
