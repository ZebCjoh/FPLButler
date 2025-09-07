import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { entryId, gameweek } = req.query;

  if (!entryId || typeof entryId !== 'string' || !gameweek || typeof gameweek !== 'string') {
    return res.status(400).json({ error: 'Invalid entry ID or gameweek' });
  }

  try {
    console.log(`[API] Fetching entry ${entryId} picks for gameweek ${gameweek}...`);
    const url = `https://fantasy.premierleague.com/api/entry/${entryId}/event/${gameweek}/picks/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/'
      }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[API] FPL error ${response.status} for ${url}:`, text);
      return res.status(response.status).json({ error: 'Failed to fetch entry picks' });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json(data);
  } catch (error) {
    console.error(`[API] Error fetching entry ${entryId} picks for gameweek ${gameweek}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

