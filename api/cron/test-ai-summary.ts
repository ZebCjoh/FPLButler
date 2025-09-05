import { put } from '@vercel/blob';

/**
 * Test endpoint to generate a dummy AI summary and store it in Vercel Blob
 * This helps verify the blob storage integration works correctly
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[Test AI] Generating dummy AI summary...');
    
    // Generate test summary with exact format you requested
    const testData = {
      gw: 3,
      summary: "Dette er en testoppsummering fra backend."
    };

    // Store AI summary in Blob (uses fpl-butler-blob storage)
    const blob = await put('ai-summary.json', JSON.stringify(testData, null, 2), {
      contentType: 'application/json'
    });

    console.log(`[Test AI] Stored test AI summary in blob: ${blob.url}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Test AI summary generated and stored successfully',
      data: testData,
      blobUrl: blob.url,
      nextStep: 'Visit /api/ai-summary to verify the stored summary can be retrieved'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Test AI] Error generating test AI summary:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate test AI summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
