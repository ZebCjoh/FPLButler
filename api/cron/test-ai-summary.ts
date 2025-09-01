import { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

interface AISummary {
  gameweek: number;
  summary: string;
  generatedAt: string;
}

/**
 * Test endpoint to generate a dummy AI summary and store it in Vercel Blob
 * This helps verify the blob storage integration works correctly
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Test AI] Generating dummy AI summary...');
    
    // Generate a simple test summary
    const currentGW = 3; // Fixed for testing
    const generatedAt = new Date().toISOString();
    const testSummary = `Dette er en test-summary for GW ${currentGW}. Butleren har observert denne ukens amatøriske fremvisning og konkluderer med at alle bør skjerpe seg betydelig. Generert: ${new Date().toLocaleString('no-NO')}.`;
    
    const aiSummaryData: AISummary = {
      gameweek: currentGW,
      summary: testSummary,
      generatedAt
    };

    // Store AI summary in Blob (uses fpl-butler-blob storage)
    const blob = await put('ai-summary.json', JSON.stringify(aiSummaryData, null, 2), {
      contentType: 'application/json'
    });

    console.log(`[Test AI] Stored test AI summary in blob: ${blob.url}`);
    
    return res.status(200).json({
      success: true,
      message: 'Test AI summary generated and stored successfully',
      gameweek: currentGW,
      summary: testSummary,
      generatedAt,
      blobUrl: blob.url,
      nextStep: 'Visit /api/ai-summary to verify the stored summary can be retrieved'
    });
    
  } catch (error) {
    console.error('[Test AI] Error generating test AI summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate test AI summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
