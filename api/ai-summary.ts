import { put, list } from '@vercel/blob';

export default async function handler(req: Request): Promise<Response> {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    if (req.method === 'POST') {
      const token = (process.env as any).BLOB_READ_WRITE_TOKEN;
      if (!token) {
        return new Response(JSON.stringify({
          error: 'Missing BLOB_READ_WRITE_TOKEN environment variable'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      // Lagre en test-summary i blob
      const { url } = await put('ai-summary.json', JSON.stringify({
        gameweek: 3,
        summary: "Dette er en testoppsummering fra backend. Skal være identisk på alle refresh."
      }), { access: 'public', contentType: 'application/json', token, addRandomSuffix: false });
      return new Response(JSON.stringify({ success: true, url }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (req.method === 'GET') {
      // Finn faktisk offentlig URL via Blob API + token, ellers bruk evt. env-url
      const token = (process.env as any).BLOB_READ_WRITE_TOKEN;
      const publicUrlFromEnv = (process.env as any).BLOB_PUBLIC_AI_SUMMARY_URL as string | undefined;
      let resolvedUrl: string | undefined = undefined;

      try {
        if (token) {
          const { blobs } = await list({ token });
          const match = blobs.find((b: any) => b.pathname === 'ai-summary.json');
          if (match?.url) resolvedUrl = match.url as string;
        }
        if (!resolvedUrl && publicUrlFromEnv) {
          resolvedUrl = publicUrlFromEnv;
        }

        if (!resolvedUrl) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'No summary found yet',
            summary: '🍷 Ingen oppsummering tilgjengelig ennå. Kom tilbake senere.'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(resolvedUrl, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeout);

        if (!resp.ok) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'No summary found yet',
            summary: '🍷 Ingen oppsummering tilgjengelig ennå. Kom tilbake senere.'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        const text = await resp.text();
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Blob fetch failed',
          summary: '🍷 Ingen oppsummering tilgjengelig ennå (midlertidig fallback).'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}