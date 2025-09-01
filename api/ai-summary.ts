import { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';

interface AISummary {
  gameweek: number;
  summary: string;
  generatedAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[AI Summary API] Fetching cached AI summary from fpl-butler-blob...');
    
    // Try to get the cached AI summary from Vercel Blob
    const blob = await get('ai-summary.json');
    
    if (!blob) {
      console.log('[AI Summary API] No cached summary found');
      return res.status(404).json({ 
        error: 'No summary yet'
      });
    }

    const summaryText = await blob.text();
    const summaryData: AISummary = JSON.parse(summaryText);
    
    console.log(`[AI Summary API] Serving cached summary for GW ${summaryData.gameweek}`);
    
    // Set cache headers to cache for 1 hour (since this is build-time generated)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    
    return res.status(200).json(summaryData);
    
  } catch (error) {
    console.error('[AI Summary API] Error fetching AI summary:', error);
    return res.status(500).json({
      error: 'Failed to fetch AI summary'
    });
  }
}
