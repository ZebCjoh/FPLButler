import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    
    // Use our proxy endpoint to avoid FPL 403 issues
    const baseUrl = process.env.PUBLIC_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.fplbutler.app');
    const resp = await fetch(`${baseUrl}/api/bootstrap-static`, {
      headers: { 'Accept': 'application/json' }
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
    
    console.log(`[check-gw] Gameweek ${currentEvent.id} is finished! Triggering generate-now...`);

    // Trigger the main generator which saves snapshot + AI summary
    const genResp = await fetch(`${baseUrl}/api/cron/generate-now?gw=${currentEvent.id}`);
    if (genResp.ok) {
      const body = await genResp.json().catch(() => ({}));
      console.log(`[check-gw] generate-now completed for GW ${currentEvent.id}`);
      return res.status(200).json({ 
        message: `Gameweek ${currentEvent.id} finished and snapshot generated`,
        gameweek: currentEvent.id,
        action: 'generated',
        details: body
      });
    } else {
      const txt = await genResp.text().catch(() => '');
      throw new Error(`generate-now failed: ${genResp.status} ${txt}`);
    }
    
  } catch (error: any) {
    console.error('[check-gw] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      action: 'error'
    });
  }
}