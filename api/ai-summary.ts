import { put, get } from '@vercel/blob';

export const config = {
  // runtime: 'edge' // Fjernet for å bytte til Node.js-runtime for stabilitet
};

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
      }), {
        access: 'public',
        contentType: 'application/json',
        token,
        addRandomSuffix: false
      });
      return new Response(JSON.stringify({ success: true, url }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (req.method === 'GET') {
      const token = (process.env as any).BLOB_READ_WRITE_TOKEN;
      try {
        const blob = await get('ai-summary.json', { token });
        
        if (!blob) {
           return new Response(JSON.stringify({
            ok: false,
            error: 'No summary found yet',
            summary: '🍷 Ingen oppsummering tilgjengelig ennå. Kom tilbake senere.'
          }), {
            status: 200, // Returnerer 200 for å unngå at frontend krasjer
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        const text = await blob.text();
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
          summary: '🍷 Ingen oppsummering tilgjengelig ennå (feil under henting).'
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