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
