import { get, put } from '@vercel/blob';
import { generateButlerAssessment } from '../../src/logic/butler';

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

interface CheckResult {
  ok: boolean;
  checkedAt: string;
  currentGw: number | null;
  isFinished: boolean;
  lastProcessedGwBefore: number;
  didTrigger: boolean;
  previousGwId?: number;
  reason?: string;
  aiSummaryGenerated?: boolean;
}

/**
 * Generate AI summary for finished gameweek by fetching FPL data
 */
async function generateAISummaryForGW(gameweek: number): Promise<string> {
  try {
    console.log(`[Cron AI] Generating summary for GW ${gameweek}...`);
    
    // Fetch necessary FPL data for the gameweek (simplified version)
    const [bootstrapResponse, leagueResponse] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json',
          'Referer': 'https://fantasy.premierleague.com/',
        },
      }),
      fetch('https://fantasy.premierleague.com/api/leagues-classic/155099/standings/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
          'Accept': 'application/json',
          'Referer': 'https://fantasy.premierleague.com/',
        },
      })
    ]);

    if (!bootstrapResponse.ok || !leagueResponse.ok) {
      throw new Error('Failed to fetch FPL data for AI summary');
    }

    const [bootstrapData, leagueData] = await Promise.all([
      bootstrapResponse.json(),
      leagueResponse.json()
    ]);

    // Simplified data extraction for AI generation
    const leagueEntries = leagueData.standings?.results || [];
    
    // Create simplified weekly stats for AI generation
    const weeklyStats = {
      weekWinner: leagueEntries[0] ? {
        manager: leagueEntries[0].player_name,
        points: leagueEntries[0].event_total || 0
      } : null,
      weekLoser: leagueEntries[leagueEntries.length - 1] ? {
        manager: leagueEntries[leagueEntries.length - 1].player_name,
        points: leagueEntries[leagueEntries.length - 1].event_total || 0
      } : null,
      benchWarmer: {
        manager: 'Unknown',
        benchPoints: 0
      },
      movements: {
        riser: { manager: 'Unknown', change: 0 },
        faller: { manager: 'Unknown', change: 0 }
      },
      chipsUsed: []
    };

    // Generate AI assessment
    const aiSummary = generateButlerAssessment({ weeklyStats });
    console.log(`[Cron AI] Generated summary: ${aiSummary.substring(0, 100)}...`);
    
    return aiSummary;
  } catch (error) {
    console.error(`[Cron AI] Error generating AI summary for GW ${gameweek}:`, error);
    return "Butleren er for opptatt med å observere kompetente mennesker til å kommentere denne uken.";
  }
}

/**
 * Core logic for checking gameweek status and triggering actions
 * Separated for easy testing and reuse
 */
export async function runCheck(): Promise<CheckResult> {
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
    if (!currentEvent) {
      return {
        ok: false,
        checkedAt,
        currentGw: null,
        isFinished: false,
        lastProcessedGwBefore: 0,
        didTrigger: false,
        reason: 'No current gameweek found in FPL data'
      };
    }

    currentGw = currentEvent.id;
    isFinished = currentEvent.is_finished;
    previousGwId = currentGw > 1 ? currentGw - 1 : undefined;

    console.log(`[Cron] Current GW: ${currentGw}, finished: ${isFinished}`);

    // 3. Get last processed state from Vercel Blob
    try {
      const blob = await get('fpl-butler/last-processed.json');
      if (blob) {
        const stateText = await blob.text();
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
      console.log(`[Cron] GW ${currentGw} is finished and not yet processed. Updating state...`);

      // 5. Generate AI summary for the finished gameweek
      console.log(`[Cron] Generating AI summary for finished GW ${currentGw}...`);
      const aiSummary = await generateAISummaryForGW(currentGw);
      
      const aiSummaryData: AISummary = {
        gameweek: currentGw,
        summary: aiSummary,
        generatedAt: checkedAt
      };

      // Store AI summary in Blob (uses fpl-butler-blob storage)
      await put('ai-summary.json', JSON.stringify(aiSummaryData, null, 2), {
        contentType: 'application/json'
      });

      console.log(`[Cron] Stored AI summary for GW ${currentGw}: "${aiSummary.substring(0, 50)}..."`);

      // 6. Update processed state in Blob
      const newState: ProcessedState = {
        lastProcessedGw: currentGw,
        processedAt: checkedAt
      };

      await put('fpl-butler/last-processed.json', JSON.stringify(newState, null, 2), {
        contentType: 'application/json'
      });

      console.log(`[Cron] Updated blob with GW ${currentGw}`);

      // 7. Trigger deploy hook if configured
      const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
      if (deployHookUrl) {
        try {
          console.log('[Cron] Triggering deploy hook...');
          const hookResponse = await fetch(deployHookUrl, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
            },
            // Note: timeout is not a standard fetch option, using signal instead would be better
          });

          if (hookResponse.ok) {
            didTrigger = true;
            console.log('[Cron] Deploy hook triggered successfully');
          } else {
            console.log(`[Cron] Deploy hook failed: ${hookResponse.status}`);
          }
        } catch (hookError) {
          console.log('[Cron] Deploy hook error (non-fatal):', hookError);
          // Don't fail the whole function for hook errors
        }
      } else {
        console.log('[Cron] No deploy hook URL configured');
      }
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
 * Runs every hour at minute 0 (configured in vercel.json)
 */
export default async function handler(req: any, res: any) {
  // Only allow GET/POST for cron triggers
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Cron] Starting gameweek check...');
  
  const result = await runCheck();
  
  console.log(`[Cron] Check complete. Result:`, {
    ok: result.ok,
    currentGw: result.currentGw,
    isFinished: result.isFinished,
    didTrigger: result.didTrigger
  });

  // Return result with no-store cache to prevent caching cron responses
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json(result);
}
