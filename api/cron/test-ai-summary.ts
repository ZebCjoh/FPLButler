import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Missing BLOB_READ_WRITE_TOKEN' });
    }

    const now = new Date().toISOString();
    const { url } = await put('ai-summary.json', JSON.stringify({
      gameweek: 0,
      summary: `Dette er en testoppsummering generert ${now}.`,
      generatedAt: now
    }, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token,
      addRandomSuffix: false
    });

    return res.status(200).json({ ok: true, url });
  } catch (error: any) {
    console.error('[test-ai-summary] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Unknown error' });
  }
}