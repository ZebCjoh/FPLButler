import { FPL_LEAGUE_ID } from '../api/config';
import {
  BootstrapStaticData,
  Entry,
  Fixture,
  Gameweek,
  LeagueStandings,
  ManagerPicks,
  ManagerHistory,
  ManagerTransfers,
  LiveGameweekData,
  LivePlayer,
} from '../api/types';

interface WeeklyStats {
  weekWinner: { manager: string; points: number; teamName: string };
  weekLoser: { manager: string; points: number; teamName: string };
  benchWarmer: { manager: string; benchPoints: number; teamName: string };
  chipsUsed: Array<{ teamName: string; chip: string; emoji: string }>;
  movements: {
    riser: { manager: string; change: number; teamName: string };
    faller: { manager: string; change: number; teamName: string };
  };
  // Add other stats as needed
}

// Helper to fetch JSON safely from the FPL API
const fetchFPL = async <T>(url: string): Promise<T> => {
  const headers = { 'User-Agent': 'FPL-Butler/1.0' };
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

  // 1. Fetch bootstrap and league data
  const bootstrapData = await fetchFPL<BootstrapStaticData>('https://fantasy.premierleague.com/api/bootstrap-static/');
  const leagueData = await fetchFPL<LeagueStandings>(`https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID}/standings/`);
  const liveData = await fetchFPL<LiveGameweekData>(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);

  const { elements: players } = bootstrapData;
  const { results: standings } = leagueData.standings;

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const livePointsMap = new Map(liveData.elements.map((p) => [p.id, p.stats.total_points]));

  // 2. Fetch data for each manager in the league
  const managerIds = standings.map((s) => s.entry);
  const managerDataPromises = managerIds.map(async (id) => {
    try {
      const [picks, history, transfers] = await Promise.all([
        fetchFPL<ManagerPicks>(`https://fantasy.premierleague.com/api/entry/${id}/event/${gameweek}/picks/`),
        fetchFPL<ManagerHistory>(`https://fantasy.premierleague.com/api/entry/${id}/history/`),
        fetchFPL<ManagerTransfers[]>(`https://fantasy.premierleague.com/api/entry/${id}/transfers/`),
      ]);
      return { id, picks, history, transfers };
    } catch (error) {
      console.warn(`[summaryGenerator] Failed to fetch data for manager ${id}. Skipping.`, error);
      return { id, picks: null, history: null, transfers: [] };
    }
  });

  const managerData = await Promise.all(managerDataPromises);
  const managerDataMap = new Map(managerData.map((m) => [m.id, m]));

  // 3. Calculate all the detailed stats
  const chipsUsed: WeeklyStats['chipsUsed'] = [];
  const benchPoints: { manager: string; teamName: string; points: number }[] = [];

  for (const manager of standings) {
    const data = managerDataMap.get(manager.entry);
    if (!data || !data.picks) continue;

    // Chips
    if (data.picks.active_chip) {
      const chipEmoji: Record<string, string> = {
        triple_captain: '⚡',
        wildcard: '🃏',
        freehit: '🎯',
        bench_boost: '🏟️',
      };
      chipsUsed.push({
        teamName: manager.entry_name,
        chip: data.picks.active_chip,
        emoji: chipEmoji[data.picks.active_chip] || 'CHIP',
      });
    }

    // Bench points
    const bench = data.picks.picks
      .filter((p) => p.multiplier === 0)
      .reduce((sum, p) => sum + (livePointsMap.get(p.element) || 0), 0);
    benchPoints.push({ manager: manager.player_name, teamName: manager.entry_name, points: bench });
  }

  // 4. Assemble the final weeklyStats object
  const weekWinner = [...standings].sort((a, b) => b.event_total - a.event_total)[0];
  const weekLoser = [...standings].sort((a, b) => a.event_total - b.event_total)[0];
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
      manager: weekWinner.player_name,
      teamName: weekWinner.entry_name,
      points: weekWinner.event_total,
    },
    weekLoser: {
      manager: weekLoser.player_name,
      teamName: weekLoser.entry_name,
      points: weekLoser.event_total,
    },
    benchWarmer: {
      manager: benchWarmer.manager,
      teamName: benchWarmer.teamName,
      benchPoints: benchWarmer.points,
    },
    chipsUsed,
    movements: {
      riser: { manager: riser.manager, teamName: riser.teamName, change: riser.change },
      faller: { manager: faller.manager, teamName: faller.teamName, change: faller.change },
    },
    // Add other complex calculations like Transfer ROI, Differentials etc. here if needed
  };
  
  console.log('[summaryGenerator] Finished generating stats.');
  return weeklyStats;
}
