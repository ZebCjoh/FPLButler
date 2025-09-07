import type { VercelRequest, VercelResponse } from '@vercel/node';
import { composeSnapshot } from '../lib/snapshot';
import { snapshotToLegacy } from '../types/snapshot';

async function resolveCurrentGw(): Promise<number> {
  const resp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
      'Accept': 'application/json',
      'Referer': 'https://fantasy.premierleague.com/'
    }
  });
  if (!resp.ok) throw new Error(`bootstrap-static failed: ${resp.status}`);
  const data = await resp.json();
  const events: any[] = data.events || [];
  const current = events.find((e) => e.is_current)?.id;
  if (current) return current;
  return 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const currentGw = await resolveCurrentGw();
    const leagueId = '155099';
    
    console.log(`[live-snapshot] Generating live snapshot for league ${leagueId}, GW ${currentGw}`);
    
    // Generate complete snapshot using unified architecture
    const snapshot = await composeSnapshot(leagueId, currentGw);
    
    // Convert to legacy format for existing components
    const legacyData = {
      snapshot,
      legacy: {
        standings: snapshot.top3.concat(snapshot.bottom3).map((team, index) => ({
          entry: index + 1,
          entry_name: team.team,
          player_name: team.manager,
          rank: team.rank,
          total: team.points,
          league_name: snapshot.meta.leagueName
        })),
        currentGameweek: snapshot.meta.gameweek,
        weeklyStats: snapshotToLegacy(snapshot),
        butlerAssessment: snapshot.butler.summary,
        topThree: snapshot.top3.map(t => ({
          rank: t.rank,
          teamName: t.team,
          manager: t.manager,
          points: t.points
        })),
        bottomThree: snapshot.bottom3.map(t => ({
          rank: t.rank,
          teamName: t.team,
          manager: t.manager,
          points: t.points
        })),
        highlights: snapshot.highlights
      }
    };
    
    console.log(`[live-snapshot] Generated live snapshot with ${snapshot.top3.length} teams, bench winner: ${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`);
    
    // Cache for 2 minutes for live data
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(200).json(legacyData);

  } catch (error: any) {
    console.error('[live-snapshot] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate live snapshot'
    });
  }
}
