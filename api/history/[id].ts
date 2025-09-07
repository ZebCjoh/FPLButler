import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../../types/snapshot';

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
    console.log(`[API] Fetching complete snapshot for gameweek ${id} from Vercel Blob...`);
    
    // Get gw-[id].json from blob (robust listing)
    const filename = `gw-${id}.json`;
    const { blobs } = await list({ token, prefix: 'gw-' as any });
    const gameweekBlob = (blobs || []).find((b: any) => b.pathname === filename);
    
    if (!gameweekBlob) {
      console.log(`[API] No snapshot found for gameweek ${id}`);
      return res.status(404).json({ 
        error: 'Gameweek not found',
        message: `No snapshot available for gameweek ${id}` 
      });
    }

    console.log(`[API] Found ${filename} in blob, fetching complete snapshot...`);
    const response = await fetch(`${gameweekBlob.url}?ts=${Date.now()}`, { cache: 'no-store' });
    const snapshot: Snapshot = await response.json();

    console.log(`[API] Returning complete snapshot for gameweek ${id}`);
    
    // Cache for 10 minutes since historical snapshots don't change
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(snapshot);

  } catch (error) {
    console.error(`[API] Error fetching gameweek ${id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch gameweek snapshot', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}