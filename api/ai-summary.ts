import { put, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
const { composeSnapshot } = require('../lib/snapshot');
import type { Snapshot } from '../types/snapshot';

interface HistoryEntry {
  id: number;
  title: string;
  url: string;
}

// Helper function to save complete gameweek snapshot
async function saveGameweekSnapshot(snapshot: Snapshot, token: string) {
  const gameweek = snapshot.meta.gameweek;
  
  // 1. Save complete snapshot to gw-[id].json
  await put(`gw-${gameweek}.json`, JSON.stringify(snapshot, null, 2), {
    access: 'public',
    contentType: 'application/json',
    token,
    addRandomSuffix: false
  });
  
  // 2. Update history index
  let historyIndex: HistoryEntry[] = [];
  
  try {
    const { blobs } = await list({ token, prefix: 'history.json' as any });
    const historyBlob = blobs?.find((b: any) => b.pathname === 'history.json');
    if (historyBlob) {
      const existingHistory = await fetch(historyBlob.url);
      historyIndex = await existingHistory.json();
    }
  } catch (e) {
    console.log('[History] No existing history found, creating new');
  }
  
  // Generate title from summary (first sentence or fallback)
  const summary = snapshot.butler.summary;
  const firstSentence = summary.split('.')[0] + '.';
  const title = firstSentence.length > 50 
    ? `GW ${gameweek} – ${firstSentence.substring(0, 47)}...`
    : `GW ${gameweek} – ${firstSentence}`;
  
  // Add or update entry
  const existingIndex = historyIndex.findIndex(h => h.id === gameweek);
  const newEntry: HistoryEntry = {
    id: gameweek,
    title,
    url: `/gw/${gameweek}`
  };
  
  if (existingIndex >= 0) {
    historyIndex[existingIndex] = newEntry;
  } else {
    historyIndex.push(newEntry);
  }
  
  // Sort by gameweek (newest first)
  historyIndex.sort((a, b) => b.id - a.id);
  
  // Save updated history
  await put('history.json', JSON.stringify(historyIndex), {
    access: 'public',
    contentType: 'application/json',
    token,
    addRandomSuffix: false
  });
  
  console.log(`[History] Saved complete snapshot for GW ${gameweek} with ${historyIndex.length} total entries`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing BLOB_READ_WRITE_TOKEN' });
  }
  
  try {
    if (req.method === 'POST') {
      // Generate complete snapshot or accept pre-generated one
      let snapshot: Snapshot;
      
      if (req.body && req.body.snapshot) {
        // Accept pre-generated snapshot
        snapshot = req.body.snapshot as Snapshot;
        console.log(`[ai-summary] Received pre-generated snapshot for GW ${snapshot.meta.gameweek}`);
      } else {
        // Generate new snapshot
        const gameweek = req.body?.gameweek;
        const leagueId = req.body?.leagueId || '155099';
        
        if (!gameweek) {
          return res.status(400).json({ error: 'Missing gameweek in request body' });
        }
        
        console.log(`[ai-summary] Generating snapshot for league ${leagueId}, GW ${gameweek}`);
        snapshot = await composeSnapshot(leagueId, gameweek);
      }
      
      // Save current AI summary (simple format for compatibility)
      const { url: summaryUrl } = await put('ai-summary.json', JSON.stringify({
        gameweek: snapshot.meta.gameweek,
        summary: snapshot.butler.summary,
        generatedAt: snapshot.meta.createdAt
      }), {
        access: 'public',
        contentType: 'application/json',
        token,
        addRandomSuffix: false
      });
      
      // Save complete snapshot to history
      await saveGameweekSnapshot(snapshot, token);
      
      return res.status(200).json({ 
        success: true, 
        url: summaryUrl, 
        gameweek: snapshot.meta.gameweek, 
        historySaved: true,
        snapshotSize: JSON.stringify(snapshot).length
      });
    }

    if (req.method === 'GET') {
      // Return current AI summary (legacy compatibility)
      const { blobs } = await list({ token, prefix: 'ai-summary.json' as any });
      const candidates = (blobs || []).filter((b: any) => b.pathname === 'ai-summary.json');
      const stateBlob = candidates.sort((a: any, b: any) => {
        const atA = new Date(a.uploadedAt || a.createdAt || 0).getTime();
        const atB = new Date(b.uploadedAt || b.createdAt || 0).getTime();
        return atB - atA;
      })[0];
      
      if (!stateBlob) {
        return res.status(200).json({
          ok: false,
          error: 'No summary found yet',
          summary: '🍷 No summary is available yet. Please check back later.'
        });
      }

      // Avoid CDN stale cache
      const bust = Date.now();
      const text = await (await fetch(`${stateBlob.url}?ts=${bust}`, { cache: 'no-store' as RequestCache })).text();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).send(text);
    }

    return res.status(405).json({ error: `Method ${req.method} is not allowed.` });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'An unknown server error occurred.' });
  }
}