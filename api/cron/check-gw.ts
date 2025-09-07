import type { VercelRequest, VercelResponse } from '@vercel/node';
const { composeSnapshot } = require('../../lib/snapshot');

interface FPLEvent {
  id: number;
  is_current: boolean;
  finished: boolean;
  deadline_time: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[check-gw] Checking if gameweek is finished...');
    
    // Fetch current gameweek status
    const resp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://fantasy.premierleague.com/'
      }
    });
    
    if (!resp.ok) {
      throw new Error(`Failed to fetch FPL data: ${resp.status}`);
    }
    
    const data = await resp.json();
    const events: FPLEvent[] = data.events || [];
    
    // Find current gameweek
    const currentEvent = events.find(e => e.is_current);
    if (!currentEvent) {
      console.log('[check-gw] No current gameweek found');
      return res.status(200).json({ 
        message: 'No current gameweek found',
        action: 'none'
      });
    }
    
    // Check if gameweek is finished
    if (!currentEvent.finished) {
      console.log(`[check-gw] Gameweek ${currentEvent.id} is still ongoing`);
      return res.status(200).json({ 
        message: `Gameweek ${currentEvent.id} is still ongoing`,
        gameweek: currentEvent.id,
        action: 'waiting'
      });
    }
    
    console.log(`[check-gw] Gameweek ${currentEvent.id} is finished! Generating snapshot...`);
    
    // Generate complete snapshot
    const leagueId = '155099';
    const snapshot = await composeSnapshot(leagueId, currentEvent.id);
    
    console.log(`[check-gw] Generated snapshot for GW ${currentEvent.id}`);
    
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
      console.log(`[check-gw] Successfully saved snapshot for finished GW ${currentEvent.id}`);
      return res.status(200).json({ 
        message: `Gameweek ${currentEvent.id} finished and snapshot generated`,
        gameweek: currentEvent.id,
        action: 'generated',
        snapshotSize: JSON.stringify(snapshot).length
      });
    } else {
      throw new Error(`Failed to save snapshot: ${aiResponse.status}`);
    }
    
  } catch (error: any) {
    console.error('[check-gw] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      action: 'error'
    });
  }
}