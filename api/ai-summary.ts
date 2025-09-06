import { put, get } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This function now uses the Vercel Node.js runtime.
// The 'edge' runtime was removed for better stability with @vercel/blob.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing BLOB_READ_WRITE_TOKEN' });
  }
  
  try {
    if (req.method === 'POST') {
      const { url } = await put('ai-summary.json', JSON.stringify({
        gameweek: 3,
        summary: "This is a test summary from the backend. It should be identical on every refresh."
      }), {
        access: 'public',
        contentType: 'application/json',
        token,
        addRandomSuffix: false // Important to overwrite the same file
      });
      return res.status(200).json({ success: true, url });
    }

    if (req.method === 'GET') {
      const blob = await get('ai-summary.json', { token });
      
      if (!blob) {
        return res.status(200).json({
          ok: false,
          error: 'No summary found yet',
          summary: '🍷 No summary is available yet. Please check back later.'
        });
      }
      
      const text = await blob.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text);
    }

    return res.status(405).json({ error: `Method ${req.method} is not allowed.` });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'An unknown server error occurred.' });
  }
}