export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const urlObj = new URL(req.url);
  const segments = urlObj.pathname.split('/');
  const entryId = segments[3];
  if (!entryId) {
    return new Response(JSON.stringify({ error: 'Invalid entry ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    console.log(`[API] Fetching entry ${entryId} history...`);
    
    const url = `https://fantasy.premierleague.com/api/entry/${entryId}/history/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`[API] Entry ${entryId} history failed:`, response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `FPL API returned ${response.status}`,
        url 
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error(`[API] Entry ${entryId} history non-JSON response:`, contentType);
      return res.status(500).json({ 
        error: 'Expected JSON response from FPL API',
        contentType 
      });
    }

    const data = await response.json();
    console.log(`[API] Entry ${entryId} history success`);
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });

  } catch (error) {
    console.error(`[API] Entry ${entryId} history error:`, error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from FPL API', message: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
