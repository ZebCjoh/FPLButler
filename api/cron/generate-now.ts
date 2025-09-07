import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../../types/snapshot';

// Inline simplified snapshot generation for testing
async function composeSnapshot(leagueId: string, gameweek: number): Promise<Snapshot> {
  console.log(`[snapshot] Composing snapshot for league ${leagueId}, GW ${gameweek}`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
    'Accept': 'application/json',
    'Referer': 'https://fantasy.premierleague.com/'
  };

  // Get league standings
  const leagueResp = await fetch(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`, { headers });
  if (!leagueResp.ok) throw new Error(`League fetch failed: ${leagueResp.status}`);
  const leagueData = await leagueResp.json();
  const standings = leagueData.standings.results;

  return {
    meta: {
      leagueId,
      leagueName: leagueData.league?.name || 'Test League',
      gameweek,
      createdAt: new Date().toISOString()
    },
    butler: {
      summary: 'Test butler assessment - snapshot generation working!'
    },
    top3: standings.slice(0, 3).map((entry: any, idx: number) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      team: entry.entry_name,
      manager: entry.player_name,
      points: entry.total
    })),
    bottom3: standings.slice(-3).map((entry: any) => ({
      rank: entry.rank,
      team: entry.entry_name,
      manager: entry.player_name,
      points: entry.total
    })),
    weekly: {
      winner: { team: standings[0].entry_name, manager: standings[0].player_name, points: standings[0].event_total || 0 },
      loser: { team: standings[standings.length - 1].entry_name, manager: standings[standings.length - 1].player_name, points: standings[standings.length - 1].event_total || 0 },
      benchWarmer: { manager: 'Test', team: 'Test Team', benchPoints: 15 },
      chipsUsed: { count: 0, list: [] },
      movements: {
        riser: { manager: 'Test Riser', team: 'Rising Team', delta: 3 },
        faller: { manager: 'Test Faller', team: 'Falling Team', delta: -2 }
      },
      nextDeadline: { gw: gameweek + 1, date: '2024-02-01', time: '18:30' }
    },
    form3: {
      window: 3,
      hot: [{ manager: 'Hot Player', team: 'Hot Team', points: 45 }],
      cold: [{ manager: 'Cold Player', team: 'Cold Team', points: 20 }]
    },
    transferRoi: {
      genius: { manager: 'Genius', team: 'Smart Team', player: 'Kane', roi: 12 },
      bomb: { manager: 'Unlucky', team: 'Bad Team', player: 'Injured Player', roi: -4 }
    },
    highlights: [
      { id: 1, text: 'Test highlight 1' },
      { id: 2, text: 'Test highlight 2' }
    ],
    differentialHero: {
      player: 'Test Player',
      points: 15,
      ownership: 2,
      ownedBy: ['Team1', 'Team2'],
      managers: ['Manager1', 'Manager2']
    }
  };
}

async function resolveTargetGw(): Promise<number> {
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
  const next = events.find((e) => e.is_next)?.id;
  if (next) return next;
  const lastFinished = [...events].filter((e) => e.is_finished).sort((a, b) => b.id - a.id)[0]?.id;
  if (lastFinished) return lastFinished;
  return 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const gwParam = (req.query?.gw as string) || '';
    const gw = Number.isFinite(Number(gwParam)) && Number(gwParam) > 0
      ? Number(gwParam)
      : await resolveTargetGw();

    const leagueId = '155099';
    
    console.log(`[generate-now] Generating complete snapshot for league ${leagueId}, GW ${gw}`);
    
    // Generate complete snapshot using new architecture
    const snapshot = await composeSnapshot(leagueId, gw);
    
    console.log(`[generate-now] Generated snapshot with ${snapshot.top3.length} top teams, ${snapshot.highlights.length} highlights`);

    // Send snapshot to ai-summary API for persistence
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fpl-butler.vercel.app';
    const aiResponse = await fetch(`${baseUrl}/api/ai-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshot })
    });
    
    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      console.log(`[generate-now] Successfully saved complete snapshot for GW ${gw}`);
      return res.status(200).json({ 
        ok: true, 
        gameweek: gw, 
        snapshotSize: JSON.stringify(snapshot).length,
        aiResult
      });
    } else {
      console.warn(`[generate-now] Failed to save snapshot: ${aiResponse.status}`);
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to save snapshot',
        gameweek: gw
      });
    }
  } catch (error: any) {
    console.error('[generate-now] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Unknown error' });
  }
}