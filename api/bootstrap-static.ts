import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[API] Fetching bootstrap-static...');
    
    const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error('[API] Bootstrap failed:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `FPL API returned ${response.status}`,
        url: 'https://fantasy.premierleague.com/api/bootstrap-static/'
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('[API] Non-JSON response:', contentType);
      return res.status(500).json({ 
        error: 'Expected JSON response from FPL API',
        contentType 
      });
    }

    const data = await response.json();
    
    // Set cache headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    
    console.log('[API] Bootstrap success');
    return res.status(200).json(data);

  } catch (error) {
    console.error('[API] Bootstrap error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from FPL API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
