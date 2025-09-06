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
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`[API] Entry ${entryId} picks GW${gameweek} failed:`, response.status, response.statusText);
      return res.status(response.status).json({ error: `FPL API returned ${response.status}`, url });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error(`[API] Entry ${entryId} picks GW${gameweek} non-JSON response:`, contentType);
      return res.status(500).json({ error: 'Expected JSON response from FPL API', contentType });
    }

    const data = await response.json();
    console.log(`[API] Entry ${entryId} picks GW${gameweek} success`);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (error) {
    console.error(`[API] Entry ${entryId} picks GW${gameweek} error:`, error);
    return res.status(500).json({
      error: 'Failed to fetch from FPL API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
