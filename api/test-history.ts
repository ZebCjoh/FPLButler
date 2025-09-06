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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing BLOB_READ_WRITE_TOKEN' });
  }

  try {
    const gameweek = 3;
    const summary = "Erik Knutsen dominerer med 189 poeng og tar over førsteplassen. Butleren er imponert over konsistensen, men Sebastian Mørken burde vurdere å skifte hobby etter denne skuffende runden.";
    const createdAt = new Date().toISOString();
    
    console.log(`[Test] Saving GW ${gameweek} to history...`);
    
    // 1. Save individual gameweek file
    const gameweekData: GameweekData = {
      id: gameweek,
      gameweek,
      summary,
      createdAt
    };
    
    const gwResult = await put(`gw-${gameweek}.json`, JSON.stringify(gameweekData), {
      access: 'public',
      contentType: 'application/json',
      token,
      addRandomSuffix: false
    });
    
    console.log(`[Test] Saved gw-${gameweek}.json:`, gwResult.url);
    
    // 2. Update history index
    let historyIndex: HistoryEntry[] = [];
    
    // Try to get existing history
    try {
      const { blobs } = await list({ token, prefix: 'history.json' as any });
      const historyBlob = blobs?.find((b: any) => b.pathname === 'history.json');
      if (historyBlob) {
        const existingHistory = await fetch(historyBlob.url);
        historyIndex = await existingHistory.json();
        console.log(`[Test] Found existing history with ${historyIndex.length} entries`);
      }
    } catch (e) {
      console.log('[Test] No existing history found, creating new');
    }
    
    // Generate title from summary (first sentence or fallback)
    const firstSentence = summary.split('.')[0] + '.';
    const title = firstSentence.length > 50 
      ? `GW ${gameweek} – ${firstSentence.substring(0, 47)}...`
      : `GW ${gameweek} – ${firstSentence}`;
    
    console.log(`[Test] Generated title: "${title}"`);
    
    // Add or update entry
    const existingIndex = historyIndex.findIndex(h => h.id === gameweek);
    const newEntry: HistoryEntry = {
      id: gameweek,
      title,
      url: `/gw/${gameweek}`
    };
    
    if (existingIndex >= 0) {
      historyIndex[existingIndex] = newEntry;
      console.log(`[Test] Updated existing entry at index ${existingIndex}`);
    } else {
      historyIndex.push(newEntry);
      console.log(`[Test] Added new entry, total entries: ${historyIndex.length}`);
    }
    
    // Sort by gameweek (newest first)
    historyIndex.sort((a, b) => b.id - a.id);
    
    // Save updated history
    const historyResult = await put('history.json', JSON.stringify(historyIndex), {
      access: 'public',
      contentType: 'application/json',
      token,
      addRandomSuffix: false
    });
    
    console.log(`[Test] Saved history.json:`, historyResult.url);
    
    return res.status(200).json({
      success: true,
      gameweek,
      title,
      gwUrl: gwResult.url,
      historyUrl: historyResult.url,
      totalEntries: historyIndex.length
    });
    
  } catch (error) {
    console.error('[Test] Error:', error);
    return res.status(500).json({ 
      error: 'Test failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
