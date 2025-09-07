import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface HistoryItem {
  id: number;
  title: string;
  url: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing BLOB_READ_WRITE_TOKEN' });
  }

  try {
    console.log('[API] Fetching history from Vercel Blob...');
    
    // Try to get history.json from blob
    const { blobs } = await list({ token, prefix: 'history.json' as any });
    const historyBlob = blobs?.find((b: any) => b.pathname === 'history.json');
    
    let historyData: HistoryItem[] = [];
    
    if (historyBlob) {
      console.log('[API] Found history.json in blob, fetching...');
      const response = await fetch(`${historyBlob.url}?ts=${Date.now()}`, { cache: 'no-store' });
      historyData = await response.json();
    } else {
      console.log('[API] No history.json found, returning empty array');
      // Return empty array if no history exists yet
      historyData = [];
    }

    // Filter out future GWs (only show up to current event)
    try {
      const resp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json',
          'Referer': 'https://fantasy.premierleague.com/'
        } as Record<string, string>
      });
      if (resp.ok) {
        const data = await resp.json();
        const currentId = (data.events || []).find((e: any) => e.is_current)?.id || 0;
        historyData = (historyData || []).filter((h) => h.id <= currentId);
        // Ensure newest first
        historyData.sort((a, b) => b.id - a.id);
      }
    } catch (e) {
      console.log('[API] bootstrap-static fetch failed, returning raw history');
    }

    console.log('[API] Returning history data:', historyData.length, 'items');
    
    // Cache for 2 minutes since this can change when new summaries are generated
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(200).json(historyData);

  } catch (error) {
    console.error('[API] History endpoint error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch history', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
