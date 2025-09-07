import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GameweekData {
  id: number;
  gameweek: number;
  summary: string;
  createdAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid gameweek ID' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing BLOB_READ_WRITE_TOKEN' });
  }

  try {
    console.log(`[API] Fetching gameweek ${id} from Vercel Blob...`);
    
    // Try to get gw-[id].json from blob (robust listing)
    const filename = `gw-${id}.json`;
    // List by common prefix to avoid exact-match listing edge-cases
    const { blobs } = await list({ token, prefix: 'gw-' as any });
    const gameweekBlob = (blobs || []).find((b: any) => b.pathname === filename);
    
    if (!gameweekBlob) {
      console.log(`[API] No data found for gameweek ${id}`);
      return res.status(404).json({ 
        error: 'Gameweek not found',
        message: `No data available for gameweek ${id}` 
      });
    }

    console.log(`[API] Found ${filename} in blob, fetching...`);
    const response = await fetch(`${gameweekBlob.url}?ts=${Date.now()}`, { cache: 'no-store' });
    const gameweekData: GameweekData = await response.json();

    console.log(`[API] Returning gameweek ${id} data`);
    
    // Cache for 10 minutes since historical data doesn't change often
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(gameweekData);

  } catch (error) {
    console.error(`[API] Error fetching gameweek ${id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch gameweek data', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
