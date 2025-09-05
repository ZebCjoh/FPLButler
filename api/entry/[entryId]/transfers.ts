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
    console.log(`[API] Fetching entry ${entryId} transfers...`);
    
    const url = `https://fantasy.premierleague.com/api/entry/${entryId}/transfers/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`[API] Entry ${entryId} transfers failed:`, response.status, response.statusText);
      return new Response(JSON.stringify({
        error: `FPL API returned ${response.status}`,
        url
      }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error(`[API] Entry ${entryId} transfers non-JSON response:`, contentType);
      return new Response(JSON.stringify({
        error: 'Expected JSON response from FPL API',
        contentType
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    console.log(`[API] Entry ${entryId} transfers success`);
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });

  } catch (error) {
    console.error(`[API] Entry ${entryId} transfers error:`, error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from FPL API', message: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
