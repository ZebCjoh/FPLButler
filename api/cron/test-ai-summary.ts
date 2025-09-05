export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Deleger til /api/ai-summary (POST) for å opprette testfil i Blob
    const origin = new URL(req.url).origin;
    const resp = await fetch(`${origin}/api/ai-summary`, { method: 'POST' });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Error creating test AI summary:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}