import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../types/snapshot';

export interface ManagerProgression {
  name: string;
  data: Array<{ gw: number; rank: number }>;
}

export interface ProgressionData {
  managers: ManagerProgression[];
  gameweeks: number[];
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
    console.log('[Progression] Fetching all snapshots for progression analysis...');
    
    // Get all gw-*.json files from blob storage
    const { blobs } = await list({ token, prefix: 'gw-' as any });
    const gameweekBlobs = (blobs || [])
      .filter((b: any) => b.pathname.match(/^gw-\d+\.json$/))
      .sort((a: any, b: any) => {
        const aGw = parseInt(a.pathname.match(/gw-(\d+)\.json$/)?.[1] || '0');
        const bGw = parseInt(b.pathname.match(/gw-(\d+)\.json$/)?.[1] || '0');
        return aGw - bGw;
      });
    
    if (gameweekBlobs.length === 0) {
      return res.status(200).json({
        managers: [],
        gameweeks: []
      });
    }

    console.log(`[Progression] Found ${gameweekBlobs.length} gameweek snapshots`);
    
    // Fetch and parse all snapshots
    const snapshots: Array<{ gw: number; snapshot: Snapshot }> = [];
    
    for (const blob of gameweekBlobs) {
      try {
        const response = await fetch(`${blob.url}?ts=${Date.now()}`, { cache: 'no-store' });
        const snapshot: Snapshot = await response.json();
        const gw = parseInt(blob.pathname.match(/gw-(\d+)\.json$/)?.[1] || '0');
        
        if (gw > 0 && snapshot.top3 && snapshot.bottom3) {
          snapshots.push({ gw, snapshot });
        }
      } catch (error) {
        console.warn(`[Progression] Failed to fetch ${blob.pathname}:`, error);
      }
    }
    
    if (snapshots.length === 0) {
      return res.status(200).json({
        managers: [],
        gameweeks: []
      });
    }

    console.log(`[Progression] Successfully parsed ${snapshots.length} snapshots`);
    
    // Build manager progression data
    const managerMap = new Map<string, Array<{ gw: number; rank: number }>>();
    const gameweeks = snapshots.map(s => s.gw).sort((a, b) => a - b);
    
    // Extract rank data from each snapshot
    for (const { gw, snapshot } of snapshots) {
      // Get all managers from top3 and bottom3
      const allManagers = [
        ...snapshot.top3.map(t => ({ name: t.manager, rank: t.rank })),
        ...snapshot.bottom3.map(b => ({ name: b.manager, rank: b.rank }))
      ];
      
      for (const manager of allManagers) {
        if (!managerMap.has(manager.name)) {
          managerMap.set(manager.name, []);
        }
        managerMap.get(manager.name)!.push({ gw, rank: manager.rank });
      }
    }
    
    // Convert to final format
    const managers: ManagerProgression[] = [];
    for (const [name, data] of managerMap.entries()) {
      // Sort by gameweek and ensure we have data for each GW
      const sortedData = data.sort((a, b) => a.gw - b.gw);
      managers.push({ name, data: sortedData });
    }
    
    // Sort managers by latest rank (best to worst)
    const latestGw = Math.max(...gameweeks);
    managers.sort((a, b) => {
      const aLatest = a.data.find(d => d.gw === latestGw)?.rank || 999;
      const bLatest = b.data.find(d => d.gw === latestGw)?.rank || 999;
      return aLatest - bLatest;
    });

    console.log(`[Progression] Returning data for ${managers.length} managers across ${gameweeks.length} gameweeks`);
    
    const result: ProgressionData = {
      managers,
      gameweeks
    };
    
    // Cache for 5 minutes since historical data doesn't change often
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=150');
    return res.status(200).json(result);

  } catch (error) {
    console.error('[Progression] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch progression data', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
