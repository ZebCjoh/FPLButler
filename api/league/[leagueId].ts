import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId } = req.query;

  if (!leagueId || Array.isArray(leagueId)) {
    return res.status(400).json({ error: 'Invalid league ID' });
  }

  try {
    console.log(`[API] Fetching league ${leagueId} standings...`);
    
    const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FPLButler/1.0',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`[API] League ${leagueId} failed:`, response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `FPL API returned ${response.status}`,
        url 
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error(`[API] League ${leagueId} non-JSON response:`, contentType);
      return res.status(500).json({ 
        error: 'Expected JSON response from FPL API',
        contentType 
      });
    }

    const data = await response.json();
    
    // Set cache headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    
    console.log(`[API] League ${leagueId} success`);
    return res.status(200).json(data);

  } catch (error) {
    console.error(`[API] League ${leagueId} error:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch from FPL API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
