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

  try {
    // Dummy data for testing - will be replaced with real database later
    const historyData: HistoryItem[] = [
      { 
        id: 1, 
        title: "GW 1 – Saints go Martin in leder", 
        url: "/gw/1" 
      },
      { 
        id: 2, 
        title: "GW 2 – Løv-Ham raknet helt", 
        url: "/gw/2" 
      },
      { 
        id: 3, 
        title: "GW 3 – Erik Knutsen dominerer", 
        url: "/gw/3" 
      }
    ];

    console.log('[API] Returning history data:', historyData.length, 'items');
    
    // Cache for 5 minutes since this is mostly static data
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(historyData);

  } catch (error) {
    console.error('[API] History endpoint error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch history', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
