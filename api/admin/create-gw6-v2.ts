import { put, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple auth
  const { secret } = req.query;
  if (secret !== 'fpl-butler-hotfix-2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing token' });
  }

  try {
    // Fetch existing GW6
    const { blobs } = await list({ token, prefix: 'gw-6.json' as any });
    const gw6Blob = blobs.find((b: any) => b.pathname === 'gw-6.json');
    
    if (!gw6Blob) {
      return res.status(404).json({ error: 'gw-6.json not found' });
    }

    const response = await fetch(gw6Blob.url);
    const existingSnapshot = await response.json();

    // Create correct summary
    const winner = existingSnapshot.weekly.winner;
    const loser = existingSnapshot.weekly.loser;
    const chipsCount = existingSnapshot.weekly.chipsUsed.count;

    const newSummary = `Butleren har observert denne ukens amatøriske fremvisning: ${winner.manager} tok ${winner.points} poeng – imponerende, men fortsatt under butlerens standard. ${loser.manager} leverte ${loser.points} poeng – så svakt at selv benken hans vurderte å melde overgang. ${chipsCount} managere våget seg på chips denne uken – butleren noterer deres desperasjon. Som alltid er butleren imponert over managernes evne til å skuffe forventningene.`;

    // Create v2
    const v2Snapshot = {
      ...existingSnapshot,
      butler: {
        summary: newSummary,
        templateId: '0-manual-hotfix-classic'
      }
    };

    // Upload v2
    const blob = await put('gw-6.v2.json', JSON.stringify(v2Snapshot, null, 2), {
      access: 'public',
      token,
      addRandomSuffix: false
    });

    return res.status(200).json({
      ok: true,
      message: 'GW6 v2 created',
      newSummary,
      url: blob.url
    });

  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed',
      message: error.message
    });
  }
}

