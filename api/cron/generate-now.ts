import type { VercelRequest, VercelResponse } from '@vercel/node';
const { composeSnapshot } = require('../../lib/snapshot');

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