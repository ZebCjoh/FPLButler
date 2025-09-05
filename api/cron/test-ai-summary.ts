import { put } from '@vercel/blob';

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

    // Generer en test AI-summary og lagre i blob
    const testSummary = {
      gw: 3,
      summary: "Dette er en testoppsummering fra backend. Skal være identisk på alle refresh."
    };

    const { url } = await put('ai-summary.json', JSON.stringify(testSummary), {
      access: 'public',
      contentType: 'application/json'
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Test AI summary created',
      url: url,
      data: testSummary
    }), {
      status: 200,
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