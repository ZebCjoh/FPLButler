import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple retry helper (mirrors bootstrap route behavior)
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok && res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return fetchWithRetry(url, options, retries - 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 800));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId } = req.query;

  if (!leagueId || typeof leagueId !== 'string') {
    return res.status(400).json({ error: 'Invalid league ID' });
  }

  try {
    console.log(`[API] Fetching league ${leagueId} standings...`);
    
    const apiUrl = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;
    const response = await fetchWithRetry(apiUrl, {
      headers: {
        // Use a standard desktop UA to avoid being flagged
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[API] League ${leagueId} failed:`, response.status, response.statusText, body?.slice(0, 200));
      return res.status(response.status).json({ 
        error: `FPL API returned ${response.status}`,
        url: apiUrl
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
    
    console.log(`[API] League ${leagueId} success`);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);

  } catch (error) {
    console.error(`[API] League ${leagueId} error:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch from FPL API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
