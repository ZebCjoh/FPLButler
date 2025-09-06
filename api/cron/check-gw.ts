import { list, put } from '@vercel/blob';

// Inline helpers (avoid cross-file imports in serverless bundle)
async function fetchFPL<T>(url: string): Promise<T> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
    'Accept': 'application/json',
    'Referer': 'https://fantasy.premierleague.com/'
  } as Record<string, string>;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error(`[cron/check-gw] FPL ${resp.status} for ${url}:`, txt);
    throw new Error(`FPL request failed ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

async function generateComprehensiveWeeklyStats(gameweek: number): Promise<any> {
  const FPL_LEAGUE_ID = 155099;
  const leagueData: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID}/standings/`);
  const liveData: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);
  const standings = leagueData.standings.results as Array<{ entry: number; entry_name: string; player_name: string; rank: number; last_rank: number; total: number; event_total?: number; }>
  const livePointsMap = new Map<number, number>((liveData.elements || []).map((p: any) => [Number(p.id ?? p.element ?? 0), p.stats?.total_points ?? 0]));
  const managerIds = standings.map((s) => s.entry);
  const managerData = await Promise.all(managerIds.map(async (id) => {
    try { const picks: any = await fetchFPL<any>(`https://fantasy.premierleague.com/api/entry/${id}/event/${gameweek}/picks/`); return { id, picks }; }
    catch (_) { return { id, picks: null }; }
  }));
  const managerDataMap = new Map<number, { id: number; picks: any }>(managerData.map((m) => [m.id, m as any]));
  const chipsUsed: Array<{ teamName: string; chip: string; emoji: string }> = [];
  const benchPoints: { manager: string; teamName: string; points: number }[] = [];
  for (const m of standings) {
    const d = managerDataMap.get(m.entry);
    if (!d || !d.picks || !d.picks.picks) continue;
    const typed = d.picks.picks as Array<{ element: number; multiplier: number }>;
    const chip = d.picks.active_chip as string | null;
    if (chip) { const map: Record<string,string> = { triple_captain:'⚡', wildcard:'🃏', freehit:'🎯', bench_boost:'🏟️' }; chipsUsed.push({ teamName: m.entry_name, chip, emoji: map[chip] || 'CHIP' }); }
    const bench = typed.filter(p=>p.multiplier===0).reduce((sum,p)=>sum+(livePointsMap.get(p.element)||0),0);
    benchPoints.push({ manager: m.player_name, teamName: m.entry_name, points: bench });
  }
  const weekWinner = [...standings].sort((a,b)=>(b.event_total||0)-(a.event_total||0))[0];
  const weekLoser = [...standings].sort((a,b)=>(a.event_total||0)-(b.event_total||0))[0];
  const benchWarmer = [...benchPoints].sort((a,b)=>b.points-a.points)[0];
  const movements = standings.map(s=>({ manager:s.player_name, teamName:s.entry_name, change:(s.last_rank||s.rank)-s.rank }));
  const riser = [...movements].sort((a,b)=>b.change-a.change)[0];
  const faller = [...movements].sort((a,b)=>a.change-b.change)[0];
  return { currentGw: gameweek, weekWinner:{ manager:weekWinner?.player_name||'-', teamName:weekWinner?.entry_name||'-', points:weekWinner?.event_total||0 }, weekLoser:{ manager:weekLoser?.player_name||'-', teamName:weekLoser?.entry_name||'-', points:weekLoser?.event_total||0 }, benchWarmer:{ manager:benchWarmer?.manager||'-', teamName:benchWarmer?.teamName||'-', benchPoints:benchWarmer?.points||0 }, chipsUsed, movements:{ riser:{ manager:riser?.manager||'-', teamName:riser?.teamName||'-', change:riser?.change||0 }, faller:{ manager:faller?.manager||'-', teamName:faller?.teamName||'-', change:faller?.change||0 } } };
}

function generateButlerAssessment(data: { weeklyStats: any }): string {
  const { weeklyStats } = data; if (!weeklyStats) return 'Butleren er for opptatt med å observere kompetente mennesker til å kommentere denne uken.';
  const { weekWinner, weekLoser, benchWarmer } = weeklyStats;
  const riser = weeklyStats.movements?.riser; const faller = weeklyStats.movements?.faller; const chipsUsed = weeklyStats.chipsUsed || []; const currentGw = weeklyStats.currentGw || 0;
  const hash = (s:string)=>{let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);} return h>>>0;};
  const pick = <T,>(arr:T[], seed:string)=>arr[Math.abs(hash(seed))%arr.length];
  const seed = JSON.stringify({gw:currentGw,w:weekWinner?.manager,l:weekLoser?.manager,r:riser?.manager,f:faller?.manager,b:benchWarmer?.benchPoints});
  const openings=['Butleren har observert denne ukens amatøriske fremvisning:','Som forventet leverte managerne en blandet forestilling:','Butleren noterer seg følgende fra denne ukens prestasjoner:','Etter å ha studert tallene med profesjonell forakt:','Som alltid må butleren korrigere managernes oppfatning av suksess:'];
  const top=[`${weekWinner?.manager} tok ${weekWinner?.points} poeng${riser?.change>0&&riser?.manager===weekWinner?.manager?` og klatret ${riser.change} plasser`:''} – imponerende, men fortsatt under butlerens standard.`,`${weekWinner?.manager} leverte ${weekWinner?.points} poeng denne runden – et sjeldent øyeblikk av kompetanse som butleren anerkjenner.`,`${weekWinner?.manager} scoret ${weekWinner?.points} poeng – en prestasjon som nesten kvalifiserer som tilfredsstillende.`,`${weekWinner?.manager} oppnådde ${weekWinner?.points} poeng, noe som beviser at selv amatører kan ha lykkedager.`];
  const weak=[`${weekLoser?.manager} leverte ${weekLoser?.points} poeng – så svakt at selv benken hans vurderte å melde overgang.`,`${weekLoser?.manager} scoret ${weekLoser?.points} poeng, en prestasjon som får butleren til å vurdere karriereskifte som manager.`,`${faller?.change<0?`${faller?.manager} falt ${Math.abs(faller?.change)} plasser`:`${weekLoser?.manager} leverte ${weekLoser?.points} poeng`} – butleren er ikke overrasket.`,`${benchWarmer?.benchPoints>10?`${benchWarmer?.manager} hadde ${benchWarmer?.benchPoints} poeng på benken`:`${weekLoser?.manager} scoret ${weekLoser?.points} poeng`} – en kunstform som krever dedikert inkompetanse.`];
  const special=chipsUsed.length>0?[`${(chipsUsed[0].teamName||'').split(' ')[0]} aktiverte en chip – butleren håper det var verdt investeringen.`]:['Ingen våget seg på chips denne uken – en beslutning butleren respekterer.'];
  const punch=['Denne runden beviste at man kan klatre, falle og fortsatt ikke imponere. Butleren forventer mer neste uke.','Som alltid er butleren imponert over managernes evne til å skuffe forventningene.','Butleren konkluderer med at fotball tydeligvis er vanskeligere enn det ser ut på TV.','Til tross for disse prestasjonene, har butleren fortsatt tro på at forbedring er mulig.','Butleren vil fortsette å observere med profesjonell tålmodighet og økende bekymring.','Som vanlig må butleren justere sine forventninger nedover for neste uke.','Butleren noterer seg at selv lave forventninger kan skuffes.'];
  return `${pick(openings,seed+'|o')} ${pick(top,seed+'|t')} ${pick(weak,seed+'|w')} ${pick(special,seed+'|s')} ${pick(punch,seed+'|p')}`;
}
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
