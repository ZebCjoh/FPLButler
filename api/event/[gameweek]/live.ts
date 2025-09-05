export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const urlObj = new URL(req.url);
  const segments = urlObj.pathname.split('/');
  const gameweek = segments[3];
  if (!gameweek) {
    return new Response(JSON.stringify({ error: 'Invalid gameweek' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    console.log(`[API] Fetching gameweek ${gameweek} live data...`);
    
    const url = `https://fantasy.premierleague.com/api/event/${gameweek}/live/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`[API] Gameweek ${gameweek} live failed:`, response.status, response.statusText);
      return new Response(JSON.stringify({
        error: `FPL API returned ${response.status}`,
        url
      }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error(`[API] Gameweek ${gameweek} live non-JSON response:`, contentType);
      return new Response(JSON.stringify({
        error: 'Expected JSON response from FPL API',
        contentType
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    console.log(`[API] Gameweek ${gameweek} live success`);
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });

  } catch (error) {
    console.error(`[API] Gameweek ${gameweek} live error:`, error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from FPL API', message: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
