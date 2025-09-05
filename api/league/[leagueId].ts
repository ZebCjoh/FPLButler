export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const leagueId = url.pathname.split('/')[2]; // Extract leagueId from path

  if (!leagueId) {
    return new Response(JSON.stringify({ error: 'Invalid league ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`[API] Fetching league ${leagueId} standings...`);
    
    const apiUrl = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`[API] League ${leagueId} failed:`, response.status, response.statusText);
      return new Response(JSON.stringify({ 
        error: `FPL API returned ${response.status}`,
        url: apiUrl
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error(`[API] League ${leagueId} non-JSON response:`, contentType);
      return new Response(JSON.stringify({ 
        error: 'Expected JSON response from FPL API',
        contentType 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    
    console.log(`[API] League ${leagueId} success`);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
      }
    });

  } catch (error) {
    console.error(`[API] League ${leagueId} error:`, error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch from FPL API',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
