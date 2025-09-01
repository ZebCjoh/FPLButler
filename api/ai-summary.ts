import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { put, get } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      // Lagre en test-summary i blob
      const { url } = await put('ai-summary.json', JSON.stringify({
        gameweek: 3,
        summary: "Dette er en testoppsummering fra backend. Skal være identisk på alle refresh."
      }), { access: 'public', contentType: 'application/json' });
      return res.status(200).json({ success: true, url });
    }

    if (req.method === 'GET') {
      // Hent summary fra blob
      const { body } = await get('ai-summary.json');
      if (!body) {
        return res.status(404).json({ error: 'No summary found yet' });
      }
      const text = await body.text();
      return res.status(200).json(JSON.parse(text));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}