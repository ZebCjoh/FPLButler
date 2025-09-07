import type { VercelRequest, VercelResponse } from '@vercel/node';
import { composeSnapshot } from '../../lib/snapshot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const gwParam = req.query.gw as string;
    const overwrite = req.query.overwrite === '1';
    const leagueId = '155099';
    
    if (!gwParam || !Number.isInteger(Number(gwParam))) {
      return res.status(400).json({ 
        error: 'Invalid gameweek parameter. Use ?gw=3&overwrite=1' 
      });
    }
    
    const gw = Number(gwParam);
    
    console.log(`[backfill] Regenerating snapshot for league ${leagueId}, GW ${gw}, overwrite: ${overwrite}`);
    
    // Generate complete snapshot
    const snapshot = await composeSnapshot(leagueId, gw);
    
    console.log(`[backfill] Generated snapshot with ${snapshot.top3.length} teams, bench winner: ${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`);
    
    // Send to ai-summary API for persistence
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fpl-butler.vercel.app';
    const aiResponse = await fetch(`${baseUrl}/api/ai-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshot })
    });
    
    if (aiResponse.ok) {
      const result = await aiResponse.json();
      console.log(`[backfill] Successfully backfilled GW ${gw}`);
      
      return res.status(200).json({ 
        success: true,
        gameweek: gw,
        message: `Backfilled GW ${gw} snapshot`,
        snapshotSize: JSON.stringify(snapshot).length,
        details: {
          leagueName: snapshot.meta.leagueName,
          topTeam: snapshot.top3[0]?.team,
          weekWinner: `${snapshot.weekly.winner.manager} (${snapshot.weekly.winner.points}p)`,
          benchWarmer: `${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`,
          highlights: snapshot.highlights.length,
          formHot: snapshot.form3.hot.length,
          formCold: snapshot.form3.cold.length
        },
        apiResult: result
      });
    } else {
      throw new Error(`Failed to save backfilled snapshot: ${aiResponse.status}`);
    }
    
  } catch (error: any) {
    console.error('[backfill] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
}
