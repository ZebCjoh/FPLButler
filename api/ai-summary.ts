import { put, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface HistoryEntry {
  id: number;
  title: string;
  url: string;
}

interface GameweekData {
  id: number;
  gameweek: number;
  summary: string;
  createdAt: string;
}

// Helper function to save gameweek history
async function saveGameweekHistory(gameweek: number, summary: string, token: string) {
  const createdAt = new Date().toISOString();
  
  // 1. Save individual gameweek file
  const gameweekData: GameweekData = {
    id: gameweek,
    gameweek,
    summary,
    createdAt
  };
  
  await put(`gw-${gameweek}.json`, JSON.stringify(gameweekData), {
    access: 'public',
    contentType: 'application/json',
    token,
    addRandomSuffix: false
  });
  
  // 2. Update history index
  let historyIndex: HistoryEntry[] = [];
  
  // Try to get existing history
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
  
  console.log(`[History] Saved GW ${gameweek} to history with ${historyIndex.length} total entries`);
}

// This function now uses the Vercel Node.js runtime.
// The 'edge' runtime was removed for better stability with @vercel/blob.
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
      // Get gameweek and summary from request body
      const { gameweek, summary } = req.body || {};
      
      if (!gameweek || !summary) {
        return res.status(400).json({ error: 'Missing gameweek or summary in request body' });
      }
      
      // Save current AI summary
      const { url } = await put('ai-summary.json', JSON.stringify({
        gameweek,
        summary
      }), {
        access: 'public',
        contentType: 'application/json',
        token,
        addRandomSuffix: false // Important to overwrite the same file
      });
      
      // Save to history
      await saveGameweekHistory(gameweek, summary, token);
      
      return res.status(200).json({ success: true, url, gameweek, historySaved: true });
    }

    if (req.method === 'GET') {
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

      // Avoid CDN stale cache by appending a cache-busting query param and disabling request cache
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