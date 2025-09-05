export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[API] Fetching bootstrap-static v2...');

    // Helper: retry with exponential backoff for transient blocks/errors
    const fetchWithRetry = async (url: string, init: RequestInit, attempts: number = 4): Promise<Response> => {
      let lastError: any;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const resp = await fetch(url, init);
          if (resp.ok) return resp;
          // Retry on common transient statuses
          if ([403, 429, 500, 502, 503, 504].includes(resp.status)) {
            console.warn(`[API] bootstrap-static attempt ${attempt} failed with ${resp.status}. Retrying...`);
          } else {
            return resp;
          }
        } catch (err) {
          lastError = err;
          console.warn(`[API] bootstrap-static attempt ${attempt} threw error. Retrying...`, err);
        }
        // Backoff with jitter: 200ms, 600ms, 1200ms, 2400ms...
        const base = 200 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 100);
        await new Promise((r) => setTimeout(r, base + jitter));
      }
      if (lastError) throw lastError;
      // Final fallback fetch to return the last response (non-ok) if no error captured
      return fetch(url, init);
    };

    const primaryUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    const fallbackUrl = 'https://r.jina.ai/http://fantasy.premierleague.com/api/bootstrap-static/';

    const response = await fetchWithRetry(primaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fantasy.premierleague.com/',
        'Accept-Language': 'en-US,en;q=0.9',
        // Extra hints to mimic browser more closely
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    // Helper to parse JSON even if content-type is text/plain
    const parseJsonFlexible = async (resp: Response) => {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return resp.json();
      }
      const text = await resp.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Expected JSON, got content-type=${contentType}, length=${text.length}`);
      }
    };

    if (!response.ok) {
      console.warn('[API] [v2] Bootstrap primary failed:', response.status, response.statusText, '→ trying fallback');
      const fb = await fetchWithRetry(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      if (!fb.ok) {
        console.error('[API] [v2] Bootstrap fallback failed:', fb.status, fb.statusText);
        return new Response(JSON.stringify({ 
          error: `FPL API returned ${response.status} and fallback ${fb.status}`,
          url: primaryUrl
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const fbData = await parseJsonFlexible(fb);
      console.log('[API] [v2] Bootstrap success via fallback');
      return new Response(JSON.stringify(fbData), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=120, stale-while-revalidate=120'
        }
      });
    }

    const contentType = response.headers.get('content-type') || '';
    let data: any;
    try {
      data = await parseJsonFlexible(response);
    } catch (e) {
      console.warn('[API] [v2] Primary returned non-JSON, trying fallback parser via mirror...');
      const fb = await fetchWithRetry(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      if (!fb.ok) {
        console.error('[API] [v2] Bootstrap fallback after parse failure failed:', fb.status, fb.statusText);
        return new Response(JSON.stringify({ 
          error: 'Expected JSON response from FPL API',
          contentType
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      data = await parseJsonFlexible(fb);
      console.log('[API] [v2] Bootstrap success via fallback after parse error');
    }
    
    console.log('[API] Bootstrap success v2');
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });

  } catch (error) {
    console.error('[API] Bootstrap error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch from FPL API',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
