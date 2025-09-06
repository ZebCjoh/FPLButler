import { FPL_LEAGUE_ID } from '../api/config';

interface WeeklyStats {
  weekWinner: { manager: string; points: number; teamName: string };
  weekLoser: { manager: string; points: number; teamName: string };
  benchWarmer: { manager: string; benchPoints: number; teamName: string };
  chipsUsed: Array<{ teamName: string; chip: string; emoji: string }>;
  movements: {
    riser: { manager: string; change: number; teamName: string };
    faller: { manager: string; change: number; teamName: string };
  };
}

// Helper to fetch JSON safely from the FPL API
const fetchFPL = async <T>(url: string): Promise<T> => {
  const headers = { 'User-Agent': 'FPL-Butler/1.0' } as Record<string, string>;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`FPL API Error (${response.status}): ${url}`, errorText);
    throw new Error(`Failed to fetch from FPL API: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export async function generateComprehensiveWeeklyStats(gameweek: number): Promise<any> {
  console.log(`[summaryGenerator] Starting comprehensive stat generation for GW ${gameweek}`);

  // 1. Fetch league and live data
  const leagueData: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID}/standings/`);
  const liveData: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);

  const standings = leagueData.standings.results as Array<{
    entry: number;
    entry_name: string;
    player_name: string;
    rank: number;
    last_rank: number;
    total: number;
    event_total?: number;
  }>;

  const livePointsMap = new Map<number, number>((liveData.elements || []).map((p: any) => [Number(p.id ?? p.element ?? 0), p.stats?.total_points ?? 0]));

  // 2. Fetch data for each manager in the league
  const managerIds = standings.map((s) => s.entry);
  const managerDataPromises = managerIds.map(async (id) => {
    try {
      const picks: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/entry/${id}/event/${gameweek}/picks/`);
      return { id, picks } as { id: number; picks: any };
    } catch (error) {
      console.warn(`[summaryGenerator] Failed to fetch picks for manager ${id}. Skipping.`, error);
      return { id, picks: null as unknown as any };
    }
  });

  const managerData = await Promise.all(managerDataPromises);
  const managerDataMap = new Map<number, { id: number; picks: any }>(managerData.map((m) => [m.id, m as any]));

  // 3. Calculate all the detailed stats
  const chipsUsed: WeeklyStats['chipsUsed'] = [];
  const benchPoints: { manager: string; teamName: string; points: number }[] = [];

  for (const manager of standings) {
    const data = managerDataMap.get(manager.entry);
    if (!data || !data.picks || !data.picks.picks) continue;

    const typedPicks = data.picks.picks as Array<{ element: number; multiplier: number }>;

    // Chips
    const activeChip = data.picks.active_chip as string | null;
    if (activeChip) {
      const chipEmoji: Record<string, string> = {
        triple_captain: '⚡',
        wildcard: '🃏',
        freehit: '🎯',
        bench_boost: '🏟️',
      };
      chipsUsed.push({
        teamName: manager.entry_name,
        chip: activeChip,
        emoji: chipEmoji[activeChip] || 'CHIP',
      });
    }

    // Bench points
    const bench = typedPicks
      .filter((p) => p.multiplier === 0)
      .reduce((sum, p) => sum + (livePointsMap.get(p.element) || 0), 0);
    benchPoints.push({ manager: manager.player_name, teamName: manager.entry_name, points: bench });
  }

  // 4. Assemble the final weeklyStats object
  const weekWinner = [...standings].sort((a, b) => (b.event_total || 0) - (a.event_total || 0))[0];
  const weekLoser = [...standings].sort((a, b) => (a.event_total || 0) - (b.event_total || 0))[0];
  const benchWarmer = [...benchPoints].sort((a, b) => b.points - a.points)[0];
  
  const movements = standings.map((s) => ({
    manager: s.player_name,
    teamName: s.entry_name,
    change: (s.last_rank || s.rank) - s.rank,
  }));
  const riser = [...movements].sort((a, b) => b.change - a.change)[0];
  const faller = [...movements].sort((a, b) => a.change - b.change)[0];

  const weeklyStats = {
    currentGw: gameweek,
    weekWinner: {
      manager: weekWinner?.player_name || '-',
      teamName: weekWinner?.entry_name || '-',
      points: weekWinner?.event_total || 0,
    },
    weekLoser: {
      manager: weekLoser?.player_name || '-',
      teamName: weekLoser?.entry_name || '-',
      points: weekLoser?.event_total || 0,
    },
    benchWarmer: {
      manager: benchWarmer?.manager || '-',
      teamName: benchWarmer?.teamName || '-',
      benchPoints: benchWarmer?.points || 0,
    },
    chipsUsed,
    movements: {
      riser: { manager: riser?.manager || '-', teamName: riser?.teamName || '-', change: riser?.change || 0 },
      faller: { manager: faller?.manager || '-', teamName: faller?.teamName || '-', change: faller?.change || 0 },
    },
  };
  
  console.log('[summaryGenerator] Finished generating stats.');
  return weeklyStats;
}
