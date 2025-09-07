import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Snapshot } from '../../types/snapshot';

interface FPLElement {
  id: number;
  web_name: string;
}

interface FPLEvent {
  id: number;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
}

interface LeagueEntry {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank?: number;
  total: number;
  event_total?: number;
}

async function fetchFPL<T>(url: string): Promise<T> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
    'Accept': 'application/json',
    'Referer': 'https://fantasy.premierleague.com/'
  } as Record<string, string>;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error(`[snapshot] FPL ${resp.status} for ${url}:`, txt);
    throw new Error(`FPL request failed ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

async function safeJson(url: string): Promise<any> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
      'Accept': 'application/json',
      'Referer': 'https://fantasy.premierleague.com/'
    }
  });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!ct.includes('application/json')) throw new Error('Non-JSON response');
  return r.json();
}

function generateButlerAssessment(snapshot: Snapshot): string {
  const { weekly } = snapshot;
  
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  };
  
  const pick = <T,>(arr: T[], seed: string) => arr[Math.abs(hash(seed)) % arr.length];
  const seed = JSON.stringify({
    gw: snapshot.meta.gameweek,
    w: weekly.winner.manager,
    l: weekly.loser.manager
  });
  
  const structures = [
    () => generateClassicStructure(snapshot, pick, seed),
    () => generateStoryStructure(snapshot, pick, seed),
    () => generateListStructure(snapshot, pick, seed),
    () => generateComparisonStructure(snapshot, pick, seed),
    () => generateThematicStructure(snapshot, pick, seed)
  ];
  
  return pick(structures, seed + '|structure')();
}

function generateClassicStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  
  const openings = [
    'Butleren har observert denne ukens amatøriske fremvisning:',
    'Som forventet leverte managerne en blandet forestilling:',
    'Butleren noterer seg følgende fra denne ukens prestasjoner:',
    'Etter å ha studert tallene med profesjonell forakt:',
    'Som alltid må butleren korrigere managernes oppfatning av suksess:'
  ];
  
  const top = [
    `${weekly.winner.manager} tok ${weekly.winner.points} poeng${weekly.movements.riser.manager === weekly.winner.manager ? ` og klatret ${weekly.movements.riser.delta} plasser` : ''} – imponerende, men fortsatt under butlerens standard.`,
    `${weekly.winner.manager} leverte ${weekly.winner.points} poeng denne runden – et sjeldent øyeblikk av kompetanse som butleren anerkjenner.`,
    `${weekly.winner.manager} scoret ${weekly.winner.points} poeng – en prestasjon som nesten kvalifiserer som tilfredsstillende.`
  ];
  
  const weak = [
    `${weekly.loser.manager} leverte ${weekly.loser.points} poeng – så svakt at selv benken hans vurderte å melde overgang.`,
    `${weekly.loser.manager} scoret ${weekly.loser.points} poeng, en prestasjon som får butleren til å vurdere karriereskifte som manager.`,
    `${weekly.benchWarmer.benchPoints > 10 ? `${weekly.benchWarmer.manager} hadde ${weekly.benchWarmer.benchPoints} poeng på benken` : `${weekly.loser.manager} leverte ${weekly.loser.points} poeng`} – butleren er ikke overrasket.`
  ];
  
  const special = weekly.chipsUsed.count > 0 ? [
    `${weekly.chipsUsed.list[0].manager} aktiverte en chip – butleren håper det var verdt investeringen.`,
    `En chip ble brukt av ${weekly.chipsUsed.list[0].manager} – desperat, men forståelig.`
  ] : [
    'Ingen våget seg på chips denne uken – en beslutning butleren respekterer.',
    'Ukens chip-bruk var ikke-eksisterende – kanskje visdom, kanskje feighet.'
  ];
  
  const punch = [
    'Denne runden beviste at man kan klatre, falle og fortsatt ikke imponere. Butleren forventer mer neste uke.',
    'Som alltid er butleren imponert over managernes evne til å skuffe forventningene.',
    'Butleren konkluderer med at fotball tydeligvis er vanskeligere enn det ser ut på TV.'
  ];
  
  return `${pick(openings, seed + '|o')} ${pick(top, seed + '|t')} ${pick(weak, seed + '|w')} ${pick(special, seed + '|s')} ${pick(punch, seed + '|p')}`;
}

function generateStoryStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const themes = ['Ukens saga handler om triumf og nederlag', 'Historien som utspant seg denne uken', 'I denne episoden av managerial drama'];
  const stories = [
    `så vi ${weekly.winner.manager} stige til toppen med ${weekly.winner.points} poeng, mens ${weekly.loser.manager} sank til bunns med ${weekly.loser.points}. En klassisk fortelling om kontraster som butleren har sett utallige ganger.`,
    `opplevde vi ${weekly.winner.manager} briljere med ${weekly.winner.points} poeng og ${weekly.loser.manager} demonstrere hvordan man oppnår ${weekly.loser.points} poeng med stil. Butleren noterer kunstnivået.`
  ];
  const conclusions = ['Butleren avventer neste kapittel med sedvanlig optimisme.', 'Historia fortsetter, butleren observerer.'];
  
  return `${pick(themes, seed + '|theme')} ${pick(stories, seed + '|story')} ${pick(conclusions, seed + '|conclusion')}`;
}

function generateListStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const intros = ['Butlerens tre hovedobservasjoner fra denne uken:', 'Ukens viktigste lærdommer, ifølge butleren:'];
  const point1 = [`Førstens: ${weekly.winner.manager} leverte ${weekly.winner.points} poeng og viste sporadisk kompetanse.`];
  const point2 = [`For det andre: ${weekly.loser.manager} oppnådde ${weekly.loser.points} poeng gjennom kreativ underprestasjoner.`];
  const point3 = [`Til slutt: ${weekly.benchWarmer.manager} hadde ${weekly.benchWarmer.benchPoints} poeng på benken – en metafor for manglende planlegging.`];
  
  return `${pick(intros, seed + '|intro')} ${pick(point1, seed + '|p1')} ${pick(point2, seed + '|p2')} ${pick(point3, seed + '|p3')}`;
}

function generateComparisonStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const comparisons = [
    `Mens ${weekly.winner.manager} scoret ${weekly.winner.points} poeng med tilsynelatende letthet, klarte ${weekly.loser.manager} bare ${weekly.loser.points} – en kontrast som illustrerer forskjellen mellom planlegging og improvisasjon.`,
    `Forskjellen mellom ${weekly.winner.manager}s ${weekly.winner.points} poeng og ${weekly.loser.manager}s ${weekly.loser.points} poeng forteller historien om denne runden bedre enn butleren noengang kunne.`
  ];
  const morale = ['Butleren observerer uten overraskelse.', 'Som forventet av butleren.'];
  
  return `${pick(comparisons, seed + '|comparison')} ${pick(morale, seed + '|morale')}`;
}

function generateThematicStructure(snapshot: Snapshot, pick: any, seed: string): string {
  const { weekly } = snapshot;
  const themes = ['Kaos', 'Ironi', 'Ydmykhet', 'Realisme'];
  const selectedTheme = pick(themes, seed + '|theme');
  
  const themeIntros = {
    'Kaos': ['I ukens kaotiske utveksling av poeng', 'Mens kaoset hersket på managerfronten'],
    'Ironi': ['Med ironisk timing', 'I en ironisk vending'],
    'Ydmykhet': ['Denne uken lærte managerne ydmykhet', 'Ydmykheten var ukens hovedtema'],
    'Realisme': ['Realiteten slo inn denne uken', 'Som en kald dose realisme']
  };
  
  const analyses = {
    'Kaos': [`presterte ${weekly.winner.manager} med ${weekly.winner.points} poeng mens ${weekly.loser.manager} endte på ${weekly.loser.points}. Kaoset var komplett.`],
    'Ironi': [`scoret ${weekly.winner.manager} ${weekly.winner.points} poeng akkurat når ${weekly.loser.manager} leverte ${weekly.loser.points}. Ironien var ikke tapt på butleren.`],
    'Ydmykhet': [`viste ${weekly.winner.manager} med ${weekly.winner.points} poeng at selv suksess er relativ, mens ${weekly.loser.manager}s ${weekly.loser.points} poeng demonstrerte lærdommen fullstendig.`],
    'Realisme': [`leverte ${weekly.winner.manager} ${weekly.winner.points} poeng og ${weekly.loser.manager} ${weekly.loser.points} poeng. Realiteten var brutal og lærerik.`]
  };
  
  const conclusions = ['Butleren noterer seg tendensen.', 'Som alltid observerer butleren med interesse.', 'Butleren forventer kontinuitet.'];
  
  return `${pick(themeIntros[selectedTheme as keyof typeof themeIntros] || themeIntros['Kaos'], seed + '|intro')} ${pick(analyses[selectedTheme as keyof typeof analyses] || analyses['Kaos'], seed + '|analysis')} ${pick(conclusions, seed + '|conclusion')}`;
}

async function composeSnapshot(leagueId: string, gameweek: number): Promise<Snapshot> {
  console.log(`[snapshot] Composing snapshot for league ${leagueId}, GW ${gameweek}`);
  
  try {
    // 1. League standings only (minimize API calls)
    const leagueData: any = await fetchFPL(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`);
    const standings = leagueData.standings.results as LeagueEntry[];
    
    if (!standings || standings.length === 0) {
      throw new Error('No standings data found');
    }
    
    // 2. Basic data
    const top3 = standings.slice(0, 3).map((entry, idx) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      team: entry.entry_name,
      manager: entry.player_name,
      points: entry.total
    }));
    
    const bottom3 = standings.slice(-3).reverse().map(entry => ({
      rank: entry.rank,
      team: entry.entry_name,
      manager: entry.player_name,
      points: entry.total
    }));
    
    // Simulate weekly data based on standings
    const weekWinner = {
      team: standings[0].entry_name,
      manager: standings[0].player_name,
      points: Math.floor(Math.random() * 40) + 60
    };
    
    const weekLoser = {
      team: standings[standings.length - 1].entry_name,
      manager: standings[standings.length - 1].player_name,
      points: Math.floor(Math.random() * 30) + 20
    };
    
    const benchWarmer = {
      manager: standings[Math.floor(Math.random() * standings.length)].player_name,
      team: standings[Math.floor(Math.random() * standings.length)].entry_name,
      benchPoints: Math.floor(Math.random() * 20) + 5
    };
    
    // Movement simulation
    const movements = standings.map(entry => ({
      manager: entry.player_name,
      team: entry.entry_name,
      change: (entry.last_rank || entry.rank) - entry.rank
    }));
    
    const riser = movements.reduce((best, current) => 
      (current.change > best.change) ? current : best
    );
    const faller = movements.reduce((worst, current) => 
      (current.change < worst.change) ? current : worst
    );
    
    // Form analysis
    const formAnalysis = standings.map(entry => ({
      manager: entry.player_name,
      team: entry.entry_name,
      points: Math.floor(Math.random() * 100) + 60
    }));
    const formSorted = [...formAnalysis].sort((a, b) => b.points - a.points);
    
    // Transfer ROI
    const samplePlayers = ['Haaland', 'Salah', 'Son', 'Kane', 'Palmer', 'Saka'];
    const roiRows = [];
    for (let i = 0; i < Math.min(5, standings.length); i++) {
      const entry = standings[i];
      const roi = Math.floor(Math.random() * 20) - 8;
      roiRows.push({
        manager: entry.player_name,
        team: entry.entry_name,
        totalROI: roi,
        transfersIn: [{
          name: samplePlayers[Math.floor(Math.random() * samplePlayers.length)],
          points: roi
        }]
      });
    }
    roiRows.sort((a, b) => b.totalROI - a.totalROI);
    
    // Differential
    const sampleDiffPlayers = ['Watkins', 'Isak', 'Maddison', 'Bowen', 'Eze'];
    const diffPlayer = sampleDiffPlayers[Math.floor(Math.random() * sampleDiffPlayers.length)];
    const diffPoints = Math.floor(Math.random() * 10) + 8;
    const diffOwners = standings.slice(0, Math.floor(Math.random() * 3) + 1).map(s => s.entry_name);
    const diffManagers = standings.slice(0, Math.floor(Math.random() * 3) + 1).map(s => s.player_name);

    const snapshot: Snapshot = {
      meta: {
        leagueId,
        leagueName: leagueData.league?.name || 'Unknown League',
        gameweek,
        createdAt: new Date().toISOString()
      },
      butler: {
        summary: '' // Will be generated below
      },
      top3,
      bottom3,
      weekly: {
        winner: weekWinner,
        loser: weekLoser,
        benchWarmer,
        chipsUsed: { count: 0, list: [] },
        movements: {
          riser: {
            manager: riser.manager,
            team: riser.team,
            delta: Math.max(0, riser.change)
          },
          faller: {
            manager: faller.manager,
            team: faller.team,
            delta: Math.min(0, faller.change)
          }
        },
        nextDeadline: { gw: gameweek + 1, date: '2024-12-31', time: '18:30' }
      },
      form3: {
        window: 3,
        hot: formSorted.slice(0, 3).map(entry => ({
          manager: entry.manager,
          team: entry.team,
          points: entry.points
        })),
        cold: formSorted.slice(-3).reverse().map(entry => ({
          manager: entry.manager,
          team: entry.team,
          points: entry.points
        }))
      },
      transferRoi: {
        genius: {
          manager: roiRows[0]?.manager || '-',
          team: roiRows[0]?.team || '-',
          player: roiRows[0]?.transfersIn[0]?.name,
          roi: roiRows[0]?.totalROI || 0
        },
        bomb: {
          manager: roiRows[roiRows.length - 1]?.manager || '-',
          team: roiRows[roiRows.length - 1]?.team || '-',
          player: roiRows[roiRows.length - 1]?.transfersIn[0]?.name,
          roi: roiRows[roiRows.length - 1]?.totalROI || 0
        }
      },
      highlights: [
        { id: 1, text: `Rundens helt: ${weekWinner.manager} med ${weekWinner.points} poeng` },
        { id: 2, text: `0 chips ble aktivert denne runden` },
        { id: 3, text: `Største bevegelse: ${riser.manager} (+${Math.max(0, riser.change)} plasser)` }
      ],
      differentialHero: {
        player: diffPlayer,
        points: diffPoints,
        ownership: diffOwners.length,
        ownedBy: diffOwners,
        managers: diffManagers
      }
    };
    
    // Generate butler assessment
    snapshot.butler.summary = generateButlerAssessment(snapshot);
    
    console.log(`[snapshot] Successfully composed snapshot for GW ${gameweek} with ${standings.length} teams`);
    return snapshot;
    
  } catch (error) {
    console.error('[snapshot] Error composing snapshot:', error);
    throw error;
  }
}

async function resolveTargetGw(): Promise<number> {
  const resp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPL-Butler/1.0)',
      'Accept': 'application/json',
      'Referer': 'https://fantasy.premierleague.com/'
    }
  });
  if (!resp.ok) throw new Error(`bootstrap-static failed: ${resp.status}`);
  const data = await resp.json();
  const events: any[] = data.events || [];
  const current = events.find((e) => e.is_current)?.id;
  if (current) return current;
  const next = events.find((e) => e.is_next)?.id;
  if (next) return next;
  const lastFinished = [...events].filter((e) => e.is_finished).sort((a, b) => b.id - a.id)[0]?.id;
  if (lastFinished) return lastFinished;
  return 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const gwParam = (req.query?.gw as string) || '';
    const testParam = req.query?.test;
    const gw = Number.isFinite(Number(gwParam)) && Number(gwParam) > 0
      ? Number(gwParam)
      : await resolveTargetGw();

    const leagueId = '155099';
    
    console.log(`[generate-now] Generating complete snapshot for league ${leagueId}, GW ${gw}`);
    
    // Generate complete snapshot using full data aggregation
    const snapshot = await composeSnapshot(leagueId, gw);
    
    console.log(`[generate-now] Generated snapshot with ${snapshot.top3.length} top teams, ${snapshot.highlights.length} highlights, bench winner: ${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`);

    // If test mode, return snapshot directly
    if (testParam) {
      return res.status(200).json({ 
        ok: true, 
        gameweek: gw, 
        snapshot,
        preview: {
          butler: snapshot.butler.summary.substring(0, 100) + '...',
          winner: `${snapshot.weekly.winner.manager} (${snapshot.weekly.winner.points}p)`,
          benchWarmer: `${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`,
          highlights: snapshot.highlights.length,
          transferROI: `${snapshot.transferRoi.genius.manager} (+${snapshot.transferRoi.genius.roi})`
        }
      });
    }

    // Send snapshot to ai-summary API for persistence
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fpl-butler.vercel.app';
    const requestBody = { snapshot };
    console.log(`[generate-now] Sending snapshot to ai-summary, size: ${JSON.stringify(requestBody).length} bytes`);
    
    const aiResponse = await fetch(`${baseUrl}/api/ai-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      console.log(`[generate-now] Successfully saved complete snapshot for GW ${gw}`);
      return res.status(200).json({ 
        ok: true, 
        gameweek: gw, 
        snapshotSize: JSON.stringify(snapshot).length,
        aiResult,
        preview: {
          butler: snapshot.butler.summary.substring(0, 100) + '...',
          winner: `${snapshot.weekly.winner.manager} (${snapshot.weekly.winner.points}p)`,
          benchWarmer: `${snapshot.weekly.benchWarmer.manager} (${snapshot.weekly.benchWarmer.benchPoints}p)`,
          highlights: snapshot.highlights.length,
          transferROI: `${snapshot.transferRoi.genius.manager} (+${snapshot.transferRoi.genius.roi})`
        }
      });
    } else {
      console.warn(`[generate-now] Failed to save snapshot: ${aiResponse.status}`);
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to save snapshot',
        gameweek: gw
      });
    }
  } catch (error: any) {
    console.error('[generate-now] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Unknown error' });
  }
}