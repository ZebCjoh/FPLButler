import { list, put } from '@vercel/blob';
import { generateButlerAssessment } from '../_lib/butler';
import { generateComprehensiveWeeklyStats } from '../_lib/summary';
import type { VercelRequest, VercelResponse } from '@vercel/node';


// Types for FPL API and our storage
interface FPLEvent {
  id: number;
  name: string;
  is_current: boolean;
  is_finished: boolean;
  deadline_time: string;
}

interface FPLBootstrapResponse {
  events: FPLEvent[];
}

interface ProcessedState {
  lastProcessedGw: number;
  processedAt: string;
}

interface AISummary {
  gameweek: number;
  summary: string;
  generatedAt: string;
}

/**
 * Core logic for checking gameweek status and triggering actions
 * Separated for easy testing and reuse
 */
export async function runCheck() {
  const checkedAt = new Date().toISOString();
  let currentGw: number | null = null;
  let isFinished = false;
  let lastProcessedGwBefore = 0;
  let didTrigger = false;
  let previousGwId: number | undefined;

  try {
    // 1. Fetch FPL bootstrap data
    console.log('[Cron] Fetching FPL bootstrap data...');
    const fplResponse = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://fantasy.premierleague.com/',
      },
    });

    if (!fplResponse.ok) {
      throw new Error(`FPL API returned ${fplResponse.status}`);
    }

    const fplData: FPLBootstrapResponse = await fplResponse.json();
    
    // 2. Find current gameweek
    const currentEvent = fplData.events.find(e => e.is_current);
    
    // Logic to handle the case where no GW is current (end of season)
    // We'll check for the latest *finished* GW instead.
    let eventToProcess: FPLEvent | undefined = currentEvent;
    if (!eventToProcess || !eventToProcess.is_finished) {
        const lastFinishedEvent = [...fplData.events]
            .filter(e => e.is_finished)
            .sort((a, b) => b.id - a.id)[0];
        
        if (lastFinishedEvent) {
            console.log(`[Cron] No current finished GW. Using last finished GW: ${lastFinishedEvent.id}`);
            eventToProcess = lastFinishedEvent;
        } else if (currentEvent) {
            console.log(`[Cron] Current GW ${currentEvent.id} is not finished. Nothing to process.`);
            eventToProcess = currentEvent; // Let it proceed to the check
        } else {
             return { ok: false, reason: 'No current or finished gameweek found.' };
        }
    }

    currentGw = eventToProcess.id;
    isFinished = eventToProcess.is_finished;
    previousGwId = currentGw > 1 ? currentGw - 1 : undefined;

    console.log(`[Cron] Processing GW: ${currentGw}, finished: ${isFinished}`);

    // 3. Get last processed state from Vercel Blob
    try {
      const { blobs } = await list({ prefix: 'fpl-butler/last-processed.json' });
      if (blobs.length > 0) {
        const stateBlob = blobs[0];
        const stateText = await (await fetch(stateBlob.url)).text();
        const state: ProcessedState = JSON.parse(stateText);
        lastProcessedGwBefore = state.lastProcessedGw;
        console.log(`[Cron] Last processed GW: ${lastProcessedGwBefore}`);
      } else {
        console.log('[Cron] No previous state found, assuming GW 0');
      }
    } catch (blobError) {
      console.log('[Cron] Could not read blob state (assuming GW 0):', blobError);
    }

    // 4. Check if we should trigger action
    if (isFinished && currentGw > lastProcessedGwBefore) {
      console.log(`[Cron] GW ${currentGw} is finished and not yet processed. Generating summary...`);

      // 5. Generate AI summary using the new comprehensive stats generator
      const weeklyStats = await generateComprehensiveWeeklyStats(currentGw);
      const aiSummary = generateButlerAssessment({ weeklyStats });
      
      const aiSummaryData: AISummary = {
        gameweek: currentGw,
        summary: aiSummary,
        generatedAt: checkedAt
      };

      // Store AI summary in Blob
      await put('ai-summary.json', JSON.stringify(aiSummaryData, null, 2), {
        access: 'public',
        contentType: 'application/json',
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      console.log(`[Cron] Stored AI summary for GW ${currentGw}: "${aiSummary.substring(0, 50)}..."`);

      // 6. Update processed state in Blob
      const newState: ProcessedState = {
        lastProcessedGw: currentGw,
        processedAt: checkedAt
      };

      await put('fpl-butler/last-processed.json', JSON.stringify(newState, null, 2), {
        access: 'public',
        contentType: 'application/json',
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      console.log(`[Cron] Updated blob with GW ${currentGw}`);
      
      didTrigger = true; // Mark that we did work

    } else if (isFinished) {
      console.log(`[Cron] GW ${currentGw} already processed (last: ${lastProcessedGwBefore})`);
    } else {
      console.log(`[Cron] GW ${currentGw} not finished yet`);
    }

    return {
      ok: true,
      checkedAt,
      currentGw,
      isFinished,
      lastProcessedGwBefore,
      didTrigger,
      previousGwId,
      aiSummaryGenerated: isFinished && currentGw > lastProcessedGwBefore
    };

  } catch (error) {
    console.error('[Cron] Error during check:', error);
    return {
      ok: false,
      checkedAt,
      currentGw,
      isFinished,
      lastProcessedGwBefore,
      didTrigger: false,
      reason: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Vercel Cron endpoint
 * Runs on a schedule defined in vercel.json
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Cron] Starting gameweek check...');
    const result = await runCheck();
    console.log('[Cron] Check complete.', result);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Cron] Handler caught unhandled error:', error);
    return res.status(500).json({
        ok: false,
        reason: 'Cron handler failed unexpectedly',
        error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
