/**
 * Hotfix script to generate gw-6.v2.json with correct Classic structure
 * Run: npx tsx scripts/hotfix-gw6.ts
 */

import { put, list } from '@vercel/blob';
import type { Snapshot } from '../types/snapshot';

async function hotfixGW6() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN');
  }

  console.log('[Hotfix] Fetching existing gw-6.json...');
  
  // Fetch existing GW6 snapshot
  const { blobs } = await list({ token, prefix: 'gw-6.json' as any });
  const gw6Blob = blobs.find((b: any) => b.pathname === 'gw-6.json');
  
  if (!gw6Blob) {
    throw new Error('gw-6.json not found in blob storage');
  }

  const response = await fetch(gw6Blob.url);
  const existingSnapshot: Snapshot = await response.json();

  console.log('[Hotfix] Current AI summary:', existingSnapshot.butler.summary.substring(0, 100));
  console.log('[Hotfix] Chips used:', existingSnapshot.weekly.chipsUsed.count);
  console.log('[Hotfix] Winner:', existingSnapshot.weekly.winner.manager);
  console.log('[Hotfix] Loser:', existingSnapshot.weekly.loser.manager);

  // Generate new Classic structure summary manually
  const winner = existingSnapshot.weekly.winner;
  const loser = existingSnapshot.weekly.loser;
  const chipsUsed = existingSnapshot.weekly.chipsUsed;

  // Classic structure with correct data
  const newSummary = `Butleren har observert denne ukens amatøriske fremvisning: ${winner.manager} tok ${winner.points} poeng – imponerende, men fortsatt under butlerens standard. ${loser.manager} leverte ${loser.points} poeng – så svakt at selv benken hans vurderte å melde overgang. ${chipsUsed.count} managere våget seg på chips denne uken – butleren noterer deres desperasjon. Som alltid er butleren imponert over managernes evne til å skuffe forventningene.`;

  // Create v2 snapshot with updated summary and new templateId
  const v2Snapshot: Snapshot = {
    ...existingSnapshot,
    butler: {
      summary: newSummary,
      templateId: '0-manual-hotfix-classic'
    }
  };

  console.log('\n[Hotfix] New AI summary:', newSummary);
  console.log('\n[Hotfix] Uploading gw-6.v2.json...');

  // Upload v2 snapshot
  const blob = await put('gw-6.v2.json', JSON.stringify(v2Snapshot, null, 2), {
    access: 'public',
    token,
    addRandomSuffix: false
  });

  console.log('[Hotfix] ✅ Uploaded:', blob.url);

  // Update history.json to reference v2
  console.log('\n[Hotfix] Updating history.json...');
  const historyBlobs = await list({ token, prefix: 'history.json' as any });
  const historyBlob = historyBlobs.blobs.find((b: any) => b.pathname === 'history.json');
  
  if (!historyBlob) {
    console.log('[Hotfix] ⚠️ history.json not found - skipping update');
    return;
  }

  const historyResponse = await fetch(historyBlob.url);
  const historyData = await historyResponse.json();

  // Find GW6 entry and update filename
  const gw6Entry = historyData.find((entry: any) => entry.id === 6);
  if (gw6Entry) {
    gw6Entry.filename = 'gw-6.v2.json';
    console.log('[Hotfix] Updated GW6 entry to use v2 file');
  }

  // Upload updated history.json
  const historyBlob2 = await put('history.json', JSON.stringify(historyData, null, 2), {
    access: 'public',
    token,
    addRandomSuffix: false
  });

  console.log('[Hotfix] ✅ Updated history.json:', historyBlob2.url);
  console.log('\n[Hotfix] 🎉 GW6 hotfix complete!');
}

hotfixGW6().catch(console.error);

