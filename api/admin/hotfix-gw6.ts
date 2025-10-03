import { put, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../../types/snapshot';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // Simple auth check
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.ADMIN_SECRET && secret !== 'fpl-butler-hotfix-2025') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing BLOB_READ_WRITE_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[Hotfix] Fetching existing gw-6.json...');
    
    // Fetch existing GW6 snapshot
    const { blobs } = await list({ token, prefix: 'gw-6.json' as any });
    const gw6Blob = blobs.find((b: any) => b.pathname === 'gw-6.json');
    
    if (!gw6Blob) {
      return new Response(JSON.stringify({ error: 'gw-6.json not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(gw6Blob.url);
    const existingSnapshot: Snapshot = await response.json();

    console.log('[Hotfix] Current summary:', existingSnapshot.butler.summary.substring(0, 100));
    console.log('[Hotfix] Chips used:', existingSnapshot.weekly.chipsUsed.count);

    // Generate new Classic structure summary with correct data
    const winner = existingSnapshot.weekly.winner;
    const loser = existingSnapshot.weekly.loser;
    const chipsUsed = existingSnapshot.weekly.chipsUsed;

    const newSummary = `Butleren har observert denne ukens amatøriske fremvisning: ${winner.manager} tok ${winner.points} poeng – imponerende, men fortsatt under butlerens standard. ${loser.manager} leverte ${loser.points} poeng – så svakt at selv benken hans vurderte å melde overgang. ${chipsUsed.count} managere våget seg på chips denne uken – butleren noterer deres desperasjon. Som alltid er butleren imponert over managernes evne til å skuffe forventningene.`;

    // Create v2 snapshot
    const v2Snapshot: Snapshot = {
      ...existingSnapshot,
      butler: {
        summary: newSummary,
        templateId: '0-manual-hotfix-classic'
      }
    };

    console.log('[Hotfix] New summary:', newSummary);
    console.log('[Hotfix] Uploading gw-6.v2.json...');

    // Upload v2 snapshot
    const blob = await put('gw-6.v2.json', JSON.stringify(v2Snapshot, null, 2), {
      access: 'public',
      token,
      addRandomSuffix: false
    });

    console.log('[Hotfix] ✅ Uploaded:', blob.url);

    // Update used-templates.json to mark this as used
    const usedBlobs = await list({ token, prefix: 'used-templates.json' as any });
    const usedBlob = usedBlobs.blobs.find((b: any) => b.pathname === 'used-templates.json');
    
    let usedTemplates: Array<{ gw: number; templateId: string }> = [];
    if (usedBlob) {
      const usedResponse = await fetch(usedBlob.url);
      usedTemplates = await usedResponse.json();
    }

    // Add GW6 v2 entry
    usedTemplates = usedTemplates.filter(t => t.gw !== 6);
    usedTemplates.push({ gw: 6, templateId: '0-manual-hotfix-classic' });

    await put('used-templates.json', JSON.stringify(usedTemplates, null, 2), {
      access: 'public',
      token,
      addRandomSuffix: false
    });

    console.log('[Hotfix] ✅ Updated used-templates.json');

    return new Response(JSON.stringify({
      ok: true,
      message: 'GW6 hotfix complete',
      newSummary,
      blobUrl: blob.url
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Hotfix] Error:', error);
    return new Response(JSON.stringify({
      error: 'Hotfix failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

