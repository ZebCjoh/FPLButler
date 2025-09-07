import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../../types/snapshot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid gameweek ID' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing BLOB_READ_WRITE_TOKEN' });
  }

  try {
    console.log(`[API] Fetching complete snapshot for gameweek ${id} from Vercel Blob...`);
    
    // Get gw-[id].json from blob (robust listing)
    const filename = `gw-${id}.json`;
    const { blobs } = await list({ token, prefix: 'gw-' as any });
    const gameweekBlob = (blobs || []).find((b: any) => b.pathname === filename);
    
    if (!gameweekBlob) {
      console.log(`[API] No snapshot found for gameweek ${id}`);
      return res.status(404).json({ 
        error: 'Gameweek not found',
        message: `No snapshot available for gameweek ${id}` 
      });
    }

    console.log(`[API] Found ${filename} in blob, fetching complete snapshot...`);
    const response = await fetch(`${gameweekBlob.url}?ts=${Date.now()}`, { cache: 'no-store' });
    const raw: any = await response.json();

    // Normalize legacy stored format -> Snapshot shape
    let snapshot: Snapshot;
    if (raw && raw.meta && raw.butler) {
      snapshot = raw as Snapshot;
    } else {
      console.log(`[API] Normalizing legacy snapshot format for gameweek ${id}`);
      const legacyTop = Array.isArray(raw?.top3) ? raw.top3 : [];
      const legacyBottom = Array.isArray(raw?.bottom3) ? raw.bottom3 : [];
      const legacyForm = raw?.form || {};
      const legacyWeekly = raw?.weeklyStats || {};
      const legacyHighlights = Array.isArray(raw?.highlights) ? raw.highlights : [];

      snapshot = {
        meta: {
          leagueId: 'unknown',
          leagueName: raw?.leagueName || 'Ukjent liga',
          gameweek: Number(raw?.gameweek || id),
          createdAt: raw?.createdAt || new Date().toISOString()
        },
        butler: {
          summary: raw?.summary || '—'
        },
        top3: legacyTop.slice(0, 3).map((t: any, idx: number) => ({
          rank: ((idx + 1) as 1 | 2 | 3),
          team: t?.teamName || '-',
          manager: t?.managerName || t?.manager || '-',
          points: Number(t?.points || 0)
        })),
        bottom3: legacyBottom.map((t: any) => ({
          rank: Number(t?.rank ?? 0),
          team: t?.teamName || '-',
          manager: t?.managerName || t?.manager || '-',
          points: Number(t?.points || 0)
        })),
        weekly: {
          winner: {
            team: legacyWeekly?.weekWinner?.teamName || '-',
            manager: legacyWeekly?.weekWinner?.manager || '-',
            points: Number(legacyWeekly?.weekWinner?.points || 0)
          },
          loser: {
            team: legacyWeekly?.weekLoser?.teamName || '-',
            manager: legacyWeekly?.weekLoser?.manager || '-',
            points: Number(legacyWeekly?.weekLoser?.points || 0)
          },
          benchWarmer: {
            manager: legacyWeekly?.benchWarmer?.manager || '-',
            team: legacyWeekly?.benchWarmer?.teamName || '-',
            benchPoints: Number(legacyWeekly?.benchWarmer?.benchPoints || 0)
          },
          chipsUsed: {
            count: 0,
            list: []
          },
          movements: {
            riser: {
              manager: legacyWeekly?.movements?.riser?.manager || '-',
              team: legacyWeekly?.movements?.riser?.teamName || '-',
              delta: Number(legacyWeekly?.movements?.riser?.change || 0)
            },
            faller: {
              manager: legacyWeekly?.movements?.faller?.manager || '-',
              team: legacyWeekly?.movements?.faller?.teamName || '-',
              delta: Number(legacyWeekly?.movements?.faller?.change || 0)
            }
          },
          nextDeadline: {
            gw: Number(raw?.gameweek ? Number(raw.gameweek) + 1 : Number(id) + 1),
            date: '—',
            time: '—'
          }
        },
        form3: {
          window: 3,
          hot: (legacyForm?.hot || []).map((h: any) => ({
            manager: h?.managerName || '-',
            team: h?.teamName || '-',
            points: Number(h?.points || 0)
          })),
          cold: (legacyForm?.cold || []).map((c: any) => ({
            manager: c?.managerName || '-',
            team: c?.teamName || '-',
            points: Number(c?.points || 0)
          }))
        },
        transferRoi: {
          genius: { manager: '-', team: '-', player: undefined, roi: 0 },
          bomb: { manager: '-', team: '-', player: undefined, roi: 0 }
        },
        highlights: legacyHighlights.map((h: any, idx: number) => ({
          id: Number(h?.id || idx + 1),
          text: h?.text || '-'
        })),
        differentialHero: {
          player: '-',
          points: 0,
          ownership: 0,
          ownedBy: [],
          managers: []
        }
      };
    }

    console.log(`[API] Returning complete snapshot for gameweek ${id}`);
    
    // Cache for 10 minutes since historical snapshots don't change
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(snapshot);

  } catch (error) {
    console.error(`[API] Error fetching gameweek ${id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to fetch gameweek snapshot', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}