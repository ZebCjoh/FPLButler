import { put, get } from '@vercel/blob';

export const config = {
  runtime: 'edge'
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
      // Lagre en test-summary i blob
      const { url } = await put('ai-summary.json', JSON.stringify({
        gameweek: 3,
        summary: "Dette er en testoppsummering fra backend. Skal være identisk på alle refresh."
      }), { access: 'public', contentType: 'application/json' });
      return new Response(JSON.stringify({ success: true, url }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (req.method === 'GET') {
      // Hent summary fra blob
      const blob = await get('ai-summary.json');
      if (!blob) {
        return new Response(JSON.stringify({ error: 'No summary found yet' }), {
          status: 404,
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